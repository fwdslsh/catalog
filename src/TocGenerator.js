import { readdir, readFile, writeFile, stat, mkdir } from "fs/promises";
import { join, relative, basename, dirname } from "path";

/**
 * TocGenerator - Responsible for generating toc.md files for directory navigation
 * Follows Single Responsibility Principle by focusing solely on TOC file generation
 */
export class TocGenerator {
  constructor(inputDir, outputDir, options = {}) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.baseUrl = options.baseUrl || null;
  }

  /**
   * Log messages unless in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }

  /**
   * Generate all TOC files for the directory structure
   */
  async generateAll() {
    // Collect all index.json files to reuse the filesystem data
    const allIndexes = await this.collectAllIndexes(this.outputDir);
    
    if (allIndexes.length === 0) {
      throw new Error('No index.json files found. Please generate index files first using --index flag.');
    }

    // Generate toc.md for each directory
    for (const indexData of allIndexes) {
      await this.generateDirectoryToc(indexData);
    }
    
    // Generate toc-full.md at the root
    await this.generateFullToc(allIndexes);
    
    this.log(`✔ Generated ${allIndexes.length} toc.md files`);
    this.log('✔ Generated toc-full.md');
  }

  /**
   * Generate toc.md for a specific directory
   */
  async generateDirectoryToc(indexData) {
    const { relativePath, content } = indexData;

    // Determine output directory for this toc.md
    const tocOutputDir = relativePath === '.'
      ? this.outputDir
      : join(this.outputDir, relativePath);

    // Ensure output directory exists
    await mkdir(tocOutputDir, { recursive: true });

    // Generate TOC content
    const tocContent = await this.generateTocContent(content, relativePath);

    // Write toc.md file
    const tocPath = join(tocOutputDir, 'toc.md');
    await writeFile(tocPath, tocContent, 'utf8');
  }

  /**
   * Generate toc-full.md with nested structure of all pages
   */
  async generateFullToc(allIndexes) {
    // Build a hierarchical structure
    const hierarchy = this.buildHierarchy(allIndexes);

    // Generate full TOC content
    const tocContent = await this.generateFullTocContent(hierarchy);

    // Write toc-full.md to root output directory
    const tocFullPath = join(this.outputDir, 'toc-full.md');
    await writeFile(tocFullPath, tocContent, 'utf8');
  }

  /**
   * Generate TOC content for a single directory
   */
  async generateTocContent(indexContent, relativePath) {
    const { files, subdirectories } = indexContent;
    const directoryName = relativePath === '.' ? basename(this.inputDir) : basename(relativePath);

    let content = `# Table of Contents - ${directoryName}\n\n`;

    // Add parent directory link if not at root
    if (relativePath !== '.') {
      const parentPath = dirname(relativePath);
      const parentLink = parentPath === '.' ? 'toc.md' : `../${basename(parentPath)}/toc.md`;
      content += `- [← Parent Directory](${parentLink})\n\n`;
    }

    // Add files in this directory
    if (files && files.length > 0) {
      content += '## Files\n\n';
      for (const file of files) {
        if (file.isMarkdown) {
          const fileUrl = this.buildFileUrl(file.path);
          const lineCount = await this.getLineCount(file.path);
          const displayName = this.getDisplayName(file.name);
          content += `- [${displayName}](${fileUrl}) (${lineCount} lines)\n`;
        }
      }
      content += '\n';
    }

    // Add subdirectories
    if (subdirectories && subdirectories.length > 0) {
      content += '## Subdirectories\n\n';
      for (const subdir of subdirectories) {
        const subdirTocUrl = `${subdir.name}/toc.md`;
        content += `- [${subdir.name}/](${subdirTocUrl})\n`;
      }
    }

    return content;
  }

  /**
   * Generate full TOC content with nested structure
   */
  async generateFullTocContent(hierarchy) {
    let content = `# Complete Table of Contents\n\n`;
    content += `> Generated from ${basename(this.inputDir)}\n\n`;

    content += await this.renderHierarchy(hierarchy, 0);

    return content;
  }

  /**
   * Build hierarchical structure from index data
   */
  buildHierarchy(allIndexes) {
    // Sort by path depth and name for consistent ordering
    const sortedIndexes = allIndexes.sort((a, b) => {
      const depthA = a.relativePath === '.' ? 0 : a.relativePath.split('/').length;
      const depthB = b.relativePath === '.' ? 0 : b.relativePath.split('/').length;
      if (depthA !== depthB) return depthA - depthB;
      return a.relativePath.localeCompare(b.relativePath);
    });
    
    const hierarchy = {
      path: '.',
      name: basename(this.inputDir),
      files: [],
      subdirectories: []
    };
    
    const pathMap = new Map();
    pathMap.set('.', hierarchy);
    
    for (const indexData of sortedIndexes) {
      const { relativePath, content } = indexData;
      
      if (relativePath === '.') {
        // Root directory
        hierarchy.files = content.files || [];
      } else {
        // Create directory entry
        const dirEntry = {
          path: relativePath,
          name: basename(relativePath),
          files: content.files || [],
          subdirectories: []
        };
        
        pathMap.set(relativePath, dirEntry);
        
        // Find parent and add to its subdirectories
        const parentPath = dirname(relativePath);
        const parent = pathMap.get(parentPath === '.' ? '.' : parentPath);
        if (parent) {
          parent.subdirectories.push(dirEntry);
        }
      }
    }
    
    return hierarchy;
  }

  /**
   * Render hierarchy as nested markdown lists
   */
  async renderHierarchy(node, depth) {
    let content = '';
    const indent = '  '.repeat(depth);

    // Render files in current directory
    if (node.files && node.files.length > 0) {
      for (const file of node.files) {
        if (file.isMarkdown) {
          const fileUrl = this.buildFileUrl(file.path);
          const displayName = this.getDisplayName(file.name);
          const lineCount = await this.getLineCount(file.path);
          content += `${indent}- [${displayName}](${fileUrl}) (${lineCount} lines)\n`;
        }
      }
    }

    // Render subdirectories
    if (node.subdirectories && node.subdirectories.length > 0) {
      for (const subdir of node.subdirectories) {
        content += `${indent}- **${subdir.name}/**\n`;
        content += await this.renderHierarchy(subdir, depth + 1);
      }
    }

    return content;
  }

  /**
   * Build URL for a file based on base URL setting
   */
  buildFileUrl(filePath) {
    if (this.baseUrl) {
      // Generate absolute URL
      const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
      return `${cleanBaseUrl}/${filePath}`;
    } else {
      // Generate relative URL
      return filePath;
    }
  }

  /**
   * Get display name for a file (remove extension for cleaner display)
   */
  getDisplayName(filename) {
    // Remove .md or .mdx extension for display
    return filename.replace(/\.(md|mdx)$/i, '');
  }

  /**
   * Get line count for a file
   */
  async getLineCount(filePath) {
    try {
      const fullPath = join(this.inputDir, filePath);
      const content = await readFile(fullPath, 'utf8');
      const lines = content.split('\n').length;
      return lines;
    } catch (error) {
      // If file cannot be read, return 0
      return 0;
    }
  }

  /**
   * Recursively collect all index.json files from the output directory
   */
  async collectAllIndexes(dir, basePath = null, collected = []) {
    const base = basePath || dir;
    
    try {
      // Check if index.json exists in current directory
      const indexPath = join(dir, 'index.json');
      try {
        const indexContent = JSON.parse(await readFile(indexPath, 'utf8'));
        const relativePath = relative(base, dir).replace(/\\/g, '/') || '.';
        collected.push({
          relativePath,
          content: indexContent
        });
      } catch (error) {
        // index.json doesn't exist in this directory, skip
      }
      
      // Recursively collect from subdirectories
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.' && entry.name !== '..') {
          const subDir = join(dir, entry.name);
          await this.collectAllIndexes(subDir, base, collected);
        }
      }
      
    } catch (error) {
      // Directory might not exist or be accessible, skip
    }
    
    return collected;
  }
}