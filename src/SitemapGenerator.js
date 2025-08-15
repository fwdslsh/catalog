import { writeFile, stat } from "fs/promises";
import { join } from "path";

/**
 * SitemapGenerator - Responsible for generating XML sitemap from documents
 * Follows Single Responsibility Principle by focusing solely on sitemap generation
 */
export class SitemapGenerator {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.stripExtensions = options.stripExtensions || false;
  }

  /**
   * Generate sitemap.xml file from documents
   */
  async generateSitemap(documents, baseUrl, outputDir) {
    if (!baseUrl) {
      throw new Error('Base URL is required for sitemap generation');
    }

    const sitemapEntries = await this.createSitemapEntries(documents, baseUrl);
    const sitemapXml = this.generateSitemapXml(sitemapEntries);
    
    const sitemapPath = join(outputDir, 'sitemap.xml');
    await writeFile(sitemapPath, sitemapXml, 'utf8');
    
    this.log(`Generated sitemap: ${sitemapPath} (${sitemapEntries.length} URLs)`);
    
    return sitemapPath;
  }

  /**
   * Create sitemap entries from documents
   */
  async createSitemapEntries(documents, baseUrl) {
    const entries = [];
    
    for (const doc of documents) {
      try {
        const entry = {
          url: this.buildSitemapUrl(doc, baseUrl),
          lastmod: await this.getLastModified(doc),
          changefreq: this.getChangeFreq(doc),
          priority: this.getPriority(doc)
        };
        
        entries.push(entry);
      } catch (error) {
        this.log(`Warning: Failed to create sitemap entry for ${doc.relativePath}: ${error.message}`);
      }
    }
    
    return entries;
  }

  /**
   * Build sitemap URL for a document
   */
  buildSitemapUrl(doc, baseUrl) {
    // Remove trailing slash from base URL
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    
    // Use originalPath if available (for HTML converted files), otherwise relativePath
    let path = doc.originalPath || doc.relativePath;
    
    // Strip extensions if requested
    if (this.stripExtensions) {
      // Remove .md, .mdx, .html extensions but preserve path structure
      path = path.replace(/\.(md|mdx|html)$/, '');
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Handle index files - convert /index to /
    if (path.endsWith('/index')) {
      path = path.replace('/index', '/');
    } else if (path === '/index') {
      path = '/';
    }
    
    return cleanBaseUrl + path;
  }

  /**
   * Get last modified date for a document
   */
  async getLastModified(doc) {
    try {
      if (doc.fullPath) {
        const stats = await stat(doc.fullPath);
        return stats.mtime.toISOString();
      }
    } catch (error) {
      // Fall back to current date if file stats unavailable
    }
    
    return new Date().toISOString();
  }

  /**
   * Get change frequency for a document based on metadata or file type
   */
  getChangeFreq(doc) {
    // Check if metadata specifies change frequency
    if (doc.metadata && doc.metadata.changefreq) {
      return doc.metadata.changefreq;
    }
    
    // Check for sitemap-specific meta tags (from HTML conversion)
    if (doc.metadata && doc.metadata['sitemap-changefreq']) {
      return doc.metadata['sitemap-changefreq'];
    }
    
    // Default based on file type/path
    const path = doc.relativePath.toLowerCase();
    
    if (path.includes('index') || path.includes('home')) {
      return 'weekly';
    } else if (path.includes('doc') || path.includes('tutorial')) {
      return 'monthly';
    } else if (path.includes('api') || path.includes('reference')) {
      return 'monthly';
    }
    
    return 'yearly'; // Default for other content
  }

  /**
   * Get priority for a document based on metadata or file importance
   */
  getPriority(doc) {
    // Check if metadata specifies priority
    if (doc.metadata && doc.metadata.priority) {
      const priority = parseFloat(doc.metadata.priority);
      if (!isNaN(priority) && priority >= 0 && priority <= 1) {
        return priority.toString();
      }
    }
    
    // Check for sitemap-specific meta tags (from HTML conversion)
    if (doc.metadata && doc.metadata['sitemap-priority']) {
      const priority = parseFloat(doc.metadata['sitemap-priority']);
      if (!isNaN(priority) && priority >= 0 && priority <= 1) {
        return priority.toString();
      }
    }
    
    // Default based on file type/path
    const path = doc.relativePath.toLowerCase();
    
    if (path.includes('index') || path.includes('home')) {
      return '1.0'; // Highest priority for index pages
    } else if (path.includes('doc') || path.includes('tutorial') || path.includes('getting-started')) {
      return '0.8'; // High priority for documentation
    } else if (path.includes('api') || path.includes('reference')) {
      return '0.7'; // High priority for reference material
    }
    
    return '0.5'; // Default priority
  }

  /**
   * Generate XML sitemap content
   */
  generateSitemapXml(entries) {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    const urlsetClose = '</urlset>';
    
    const urls = entries.map(entry => {
      const url = `    <url>
        <loc>${this.escapeXml(entry.url)}</loc>
        <lastmod>${entry.lastmod}</lastmod>
        <changefreq>${entry.changefreq}</changefreq>
        <priority>${entry.priority}</priority>
    </url>`;
      return url;
    }).join('\n');
    
    return `${xmlHeader}
${urlsetOpen}
${urls}
${urlsetClose}`;
  }

  /**
   * Escape XML special characters in URLs
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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