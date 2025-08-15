import { readFile, access } from "fs/promises";
import { relative, basename, join } from "path";
import TurndownService from "turndown";
import { minimatch } from "minimatch";

/**
 * ContentProcessor - Responsible for processing markdown and HTML files and content
 * Follows Single Responsibility Principle by focusing solely on document processing
 */
export class ContentProcessor {
  constructor(inputDir, options = {}) {
    this.inputDir = inputDir;
    this.silent = options.silent || false;
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
  }

  /**
   * Extract site metadata from root index file
   */
  async extractSiteMetadata() {
    const rootIndexFile = await this.findRootIndexFile();
    
    if (!rootIndexFile) {
      // Return default metadata if no root index found
      return {
        title: basename(this.inputDir),
        description: `Documentation and resources for ${basename(this.inputDir)}.`,
        instructions: null
      };
    }

    const content = await readFile(rootIndexFile, 'utf8');
    const relativePath = relative(this.inputDir, rootIndexFile);
    
    if (rootIndexFile.toLowerCase().endsWith('.html')) {
      return this.extractFromHtmlMeta(content);
    } else {
      return this.extractFromMarkdownFrontmatter(content);
    }
  }

  /**
   * Find root index file in priority order: index.md, index.mdx, index.html
   */
  async findRootIndexFile() {
    const candidates = [
      'index.md',
      'index.mdx', 
      'index.html'
    ];

    for (const candidate of candidates) {
      const filePath = join(this.inputDir, candidate);
      try {
        await access(filePath);
        return filePath;
      } catch (error) {
        // File doesn't exist, try next candidate
      }
    }

    return null;
  }

  /**
   * Extract metadata from YAML frontmatter
   */
  extractFromMarkdownFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/m);
    
    if (!frontmatterMatch) {
      return {
        title: basename(this.inputDir),
        description: `Documentation and resources for ${basename(this.inputDir)}.`,
        instructions: null
      };
    }

    const frontmatter = frontmatterMatch[1];
    const metadata = {};

    // Simple YAML parsing for basic fields
    const lines = frontmatter.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
      }
    }

    return {
      title: metadata.title || basename(this.inputDir),
      description: metadata.description || `Documentation and resources for ${basename(this.inputDir)}.`,
      instructions: metadata.instructions || null
    };
  }

  /**
   * Extract metadata from HTML meta tags using regex parsing
   */
  extractFromHtmlMeta(htmlContent) {
    let title = basename(this.inputDir);
    let description = `Documentation and resources for ${basename(this.inputDir)}.`;
    let instructions = null;
    const metadata = {};

    // Extract title
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract description meta tag
    const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch) {
      description = descMatch[1];
    }

    // Extract instructions meta tag
    const instrMatch = htmlContent.match(/<meta\s+name=["']instructions["']\s+content=["']([^"']+)["']/i);
    if (instrMatch) {
      instructions = instrMatch[1];
    }

    // Extract all other meta tags for sitemap and other purposes
    const metaMatches = htmlContent.matchAll(/<meta\s+name=["']([^"']+)["']\s+content=["']([^"']+)["']/gi);
    for (const match of metaMatches) {
      const [, name, content] = match;
      if (name !== 'description' && name !== 'instructions') {
        metadata[name] = content;
      }
    }

    return {
      title,
      description,
      instructions,
      ...metadata // Include all extracted meta tags
    };
  }

  /**
   * Process a list of file paths into document objects
   */
  async processFiles(filePaths) {
    const documents = [];
    
    for (const filePath of filePaths) {
      try {
        const content = await readFile(filePath, 'utf8');
        const relativePath = relative(this.inputDir, filePath);
        
        // Process HTML files differently from Markdown files
        if (filePath.toLowerCase().endsWith('.html')) {
          const processedDoc = this.processHtmlFile(filePath, content, relativePath);
          documents.push(processedDoc);
        } else {
          const cleanContent = this.stripFrontmatter(content).trim();
          const metadata = this.extractFromMarkdownFrontmatter(content);
          
          documents.push({
            relativePath: relativePath.replace(/\\/g, '/'),
            content: cleanContent,
            metadata,
            fullPath: filePath
          });
        }
      } catch (error) {
        this.log(`Warning: Failed to read ${filePath}: ${error.message}`);
      }
    }
    
    return documents;
  }

  /**
   * Process HTML file and convert to markdown
   */
  processHtmlFile(filePath, htmlContent, relativePath) {
    // Extract metadata from HTML meta tags
    const metadata = this.extractFromHtmlMeta(htmlContent);
    
    // Strip any YAML frontmatter if present in HTML files
    const cleanHtmlContent = this.stripFrontmatter(htmlContent);
    
    // Convert HTML to markdown
    const markdownContent = this.convertHtmlToMarkdown(cleanHtmlContent);
    
    // Create reference path that indicates HTML conversion
    const outputPath = relativePath + '.md';
    
    return {
      relativePath: outputPath.replace(/\\/g, '/'),
      originalPath: relativePath.replace(/\\/g, '/'),
      content: markdownContent.trim(),
      metadata,
      fullPath: filePath,
      isHtmlConverted: true
    };
  }

  /**
   * Convert HTML content to Markdown using Turndown
   */
  convertHtmlToMarkdown(htmlContent) {
    try {
      return this.turndownService.turndown(htmlContent);
    } catch (error) {
      this.log(`Warning: Failed to convert HTML to Markdown: ${error.message}`);
      // Return raw HTML as fallback
      return htmlContent;
    }
  }

  /**
   * Strip YAML frontmatter from content (works for both markdown and HTML with frontmatter)
   */
  stripFrontmatter(content) {
    // Remove YAML frontmatter (--- at start, content, --- delimiter)
    return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, '');
  }

  /**
   * Generate sections automatically based on file paths
   */
  generateSections(documents) {
    const sections = new Map();
    
    for (const doc of documents) {
      const sectionName = this.getFirstPathSegment(doc.relativePath);
      
      if (!sections.has(sectionName)) {
        sections.set(sectionName, []);
      }
      sections.get(sectionName).push(doc);
    }
    
    return this.sortSections(sections);
  }

  /**
   * Get the first path segment or 'Root' for root-level files
   */
  getFirstPathSegment(relativePath) {
    const segments = relativePath.split('/');
    if (segments.length === 1) {
      return 'Root';
    }
    return segments[0];
  }

  /**
   * Sort sections alphabetically with Root first
   */
  sortSections(sections) {
    const sortedSections = new Map();
    
    // Add Root section first if it exists
    if (sections.has('Root')) {
      const rootDocs = sections.get('Root');
      rootDocs.sort((a, b) => this.getDocumentPriority(a) - this.getDocumentPriority(b));
      sortedSections.set('Root', rootDocs);
    }
    
    // Add other sections alphabetically
    const otherSectionNames = Array.from(sections.keys())
      .filter(name => name !== 'Root')
      .sort();
    
    for (const sectionName of otherSectionNames) {
      const docs = sections.get(sectionName);
      docs.sort((a, b) => this.getDocumentPriority(a) - this.getDocumentPriority(b));
      sortedSections.set(sectionName, docs);
    }
    
    return sortedSections;
  }

  /**
   * Apply optional patterns to move matching files to Optional section
   */
  applyOptionalPatterns(sections, optionalPatterns) {
    if (!optionalPatterns || optionalPatterns.length === 0) {
      return { regularSections: sections, optionalDocs: [] };
    }

    const regularSections = new Map();
    const optionalDocs = [];

    for (const [sectionName, docs] of sections) {
      const regularDocs = [];
      
      for (const doc of docs) {
        if (this.matchesOptionalPattern(doc.relativePath, optionalPatterns)) {
          optionalDocs.push(doc);
        } else {
          regularDocs.push(doc);
        }
      }
      
      if (regularDocs.length > 0) {
        regularSections.set(sectionName, regularDocs);
      }
    }

    return { regularSections, optionalDocs };
  }

  /**
   * Check if a file path matches any optional pattern
   */
  matchesOptionalPattern(filePath, optionalPatterns) {
    return optionalPatterns.some(pattern => minimatch(filePath, pattern));
  }

  /**
   * Get document priority for sorting (lower number = higher priority)
   */
  getDocumentPriority(doc) {
    if (this.isIndexDocument(doc.relativePath)) {
      return this.getIndexPriority(doc.relativePath);
    } else if (this.isImportantDocument(doc.relativePath)) {
      return 100; // Lower priority than index docs but higher than others
    } else {
      return 200; // Lowest priority
    }
  }

  /**
   * Order documents according to importance heuristics (legacy method for compatibility)
   */
  orderDocuments(documents) {
    // Separate documents by importance
    const indexDocs = [];
    const importantDocs = [];
    const otherDocs = [];
    
    for (const doc of documents) {
      if (this.isIndexDocument(doc.relativePath)) {
        indexDocs.push(doc);
      } else if (this.isImportantDocument(doc.relativePath)) {
        importantDocs.push(doc);
      } else {
        otherDocs.push(doc);
      }
    }
    
    // Sort each category
    indexDocs.sort((a, b) => this.getIndexPriority(a.relativePath) - this.getIndexPriority(b.relativePath));
    importantDocs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    otherDocs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    
    return {
      index: indexDocs,
      important: importantDocs,
      other: otherDocs,
      all: [...indexDocs, ...importantDocs, ...otherDocs]
    };
  }

  /**
   * Check if a document is an index document (readme, index, home)
   */
  isIndexDocument(path) {
    const lower = path.toLowerCase();
    const filename = basename(path).toLowerCase();
    
    return (
      filename === 'index.md' ||
      filename === 'index.mdx' ||
      filename === 'index.html' ||
      filename === 'readme.md' ||
      filename === 'readme.mdx' ||
      filename === 'readme.html' ||
      filename === 'home.md' ||
      filename === 'home.mdx' ||
      filename === 'home.html' ||
      lower.includes('/index.') ||
      lower.includes('/readme.') ||
      lower.includes('/home.')
    );
  }

  /**
   * Check if a document is important (catalogs, tutorials, docs)
   */
  isImportantDocument(path) {
    const lower = path.toLowerCase();
    const importantPatterns = [
      'doc', 'docs', 'catalog', 'catalogs', 'tutorial', 'tutorials',
      'intro', 'introduction', 'getting-started', 'get-started',
      'quickstart', 'quick-start', 'start'
    ];
    
    return importantPatterns.some(pattern => lower.includes(pattern));
  }

  /**
   * Get priority for index documents (lower number = higher priority)
   */
  getIndexPriority(path) {
    const lower = path.toLowerCase();
    const filename = basename(path).toLowerCase();
    
    // Priority: exact index/readme at root, then others
    if (filename === 'index.md' || filename === 'index.mdx' || filename === 'index.html') return 1;
    if (filename === 'readme.md' || filename === 'readme.mdx' || filename === 'readme.html') return 2;
    if (filename === 'home.md' || filename === 'home.mdx' || filename === 'home.html') return 3;
    return 4;
  }

  /**
   * Log a message if not in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }
}