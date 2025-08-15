import { writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";

/**
 * OutputGenerator - Responsible for generating llms.txt and llms-full.txt files
 * Follows Single Responsibility Principle by focusing solely on output generation
 */
export class OutputGenerator {
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.baseUrl = options.baseUrl || null;
  }

  /**
   * Generate all output files: llms.txt, llms-ctx.txt, llms-ctx-full.txt
   */
  async generateAllOutputs(siteMetadata, sections, optionalDocs, baseUrl = null) {
    // Ensure output directory exists
    try {
      await mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
    
    // Generate llms.txt (standard format with all sections)
    const llmsContent = this.generateLlmsIndex(siteMetadata, sections, optionalDocs, baseUrl);
    
    // Generate llms-ctx.txt (without Optional section)
    const llmsCtxContent = this.generateLlmsIndex(siteMetadata, sections, [], baseUrl);
    
    // Generate llms-ctx-full.txt (identical to llms.txt)
    const llmsCtxFullContent = llmsContent;
    
    // Generate llms-full.txt (full content)
    const allDocs = this.getAllDocuments(sections, optionalDocs);
    const llmsFullContent = this.generateLlmsFull(siteMetadata, allDocs);
    
    // Write files
    const llmsPath = join(this.outputDir, 'llms.txt');
    const llmsCtxPath = join(this.outputDir, 'llms-ctx.txt');
    const llmsCtxFullPath = join(this.outputDir, 'llms-ctx-full.txt');
    const llmsFullPath = join(this.outputDir, 'llms-full.txt');
    
    await writeFile(llmsPath, llmsContent, 'utf8');
    await writeFile(llmsCtxPath, llmsCtxContent, 'utf8');
    await writeFile(llmsCtxFullPath, llmsCtxFullContent, 'utf8');
    await writeFile(llmsFullPath, llmsFullContent, 'utf8');
    
    this.log(`Writing to: ${this.outputDir}`);
    this.log(`✔ llms.txt (${this.formatSize(llmsContent.length)})`);
    this.log(`✔ llms-ctx.txt (${this.formatSize(llmsCtxContent.length)})`);
    this.log(`✔ llms-ctx-full.txt (${this.formatSize(llmsCtxFullContent.length)})`);
    this.log(`✔ llms-full.txt (${this.formatSize(llmsFullContent.length)})`);
  }

  /**
   * Legacy method for backward compatibility
   */
  async generateOutputs(projectName, orderedDocs) {
    // Convert legacy format to new format
    const siteMetadata = {
      title: projectName,
      description: `Documentation for ${projectName}`,
      instructions: null
    };
    
    // Convert legacy ordered docs to sections
    const sections = new Map();
    if (orderedDocs.index && orderedDocs.index.length > 0) {
      sections.set('Root', orderedDocs.index);
    }
    if (orderedDocs.important && orderedDocs.important.length > 0) {
      sections.set('Documentation', orderedDocs.important);
    }
    
    const optionalDocs = orderedDocs.other || [];
    
    await this.generateAllOutputs(siteMetadata, sections, optionalDocs, this.baseUrl);
  }

  /**
   * Generate the structured index content for llms.txt
   */
  generateLlmsIndex(siteMetadata, sections, optionalDocs = [], baseUrl = null) {
    let content = `# ${siteMetadata.title}\n\n`;
    content += `> ${siteMetadata.description}\n\n`;
    
    // Add instructions if present
    if (siteMetadata.instructions) {
      content += `${siteMetadata.instructions}\n\n`;
    }
    
    // Generate sections based on path structure
    for (const [sectionName, docs] of sections) {
      content += `## ${sectionName}\n\n`;
      
      for (const doc of docs) {
        const url = this.buildUrl(doc.relativePath, baseUrl);
        const title = this.getDocumentTitle(doc);
        const notes = this.getDocumentNotes(doc);
        
        content += `- [${title}](${url})`;
        if (notes) {
          content += `: ${notes}`;
        }
        content += `\n`;
      }
      content += `\n`;
    }
    
    // Add Optional section if there are optional docs
    if (optionalDocs.length > 0) {
      content += `## Optional\n\n`;
      
      for (const doc of optionalDocs) {
        const url = this.buildUrl(doc.relativePath, baseUrl);
        const title = this.getDocumentTitle(doc);
        const notes = this.getDocumentNotes(doc);
        
        content += `- [${title}](${url})`;
        if (notes) {
          content += `: ${notes}`;
        }
        content += `\n`;
      }
      content += `\n`;
    }
    
    return content.trimEnd() + '\n';
  }

  /**
   * Generate the full content for llms-full.txt
   */
  generateLlmsFull(siteMetadata, documents) {
    let content = `# ${siteMetadata.title}\n\n`;
    content += `> ${siteMetadata.description}\n\n`;
    
    if (siteMetadata.instructions) {
      content += `${siteMetadata.instructions}\n\n`;
    }
    
    for (const doc of documents) {
      content += `## ${doc.relativePath}\n\n`;
      content += `${doc.content}\n\n`;
      content += `---\n\n`;
    }
    
    return content;
  }

  /**
   * Get all documents from sections and optional docs in proper order
   */
  getAllDocuments(sections, optionalDocs) {
    const allDocs = [];
    
    // Add documents from sections in order
    for (const [sectionName, docs] of sections) {
      allDocs.push(...docs);
    }
    
    // Add optional documents at the end
    allDocs.push(...optionalDocs);
    
    return allDocs;
  }

  /**
   * Build URL based on base URL setting
   */
  buildUrl(relativePath, baseUrl) {
    if (baseUrl) {
      try {
        return new URL(relativePath, baseUrl).href;
      } catch (error) {
        // If URL construction fails, return relative path
        return relativePath;
      }
    }
    return relativePath;
  }

  /**
   * Get document title from metadata or use file name
   */
  getDocumentTitle(doc) {
    if (doc.metadata && doc.metadata.title) {
      return doc.metadata.title;
    }
    
    // Use file name without extension as fallback
    const fileName = basename(doc.relativePath);
    return fileName.replace(/\.[^.]+$/, '');
  }

  /**
   * Get document notes from metadata
   */
  getDocumentNotes(doc) {
    if (doc.metadata && doc.metadata.notes) {
      return doc.metadata.notes;
    }
    return null;
  }

  /**
   * Format byte size for human readability
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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