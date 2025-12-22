import { writeFile } from "fs/promises";
import { join, basename } from "path";

/**
 * ContextBundler - Generate multiple context bundles for different model sizes
 *
 * Creates llms-ctx-{size}.txt files optimized for specific token budgets.
 * Dispatch can inject the right-sized context pack automatically based on
 * the model/context budget.
 *
 * @example
 * const bundler = new ContextBundler(outputDir, { bundleSizes: [2000, 8000, 32000] });
 * await bundler.generate(documents, siteMetadata, sections);
 */
export class ContextBundler {
  /**
   * Default bundle sizes (in tokens)
   */
  static DEFAULT_SIZES = [2000, 4000, 8000, 16000, 32000, 64000, 128000];

  /**
   * Create a new ContextBundler instance
   *
   * @param {string} outputDir - Destination directory for bundle files
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {number[]} [options.bundleSizes] - Token sizes for bundles
   * @param {string} [options.baseUrl=null] - Base URL for links
   * @param {Object} [options.priorityWeights] - Custom priority weights for document ranking
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.bundleSizes = options.bundleSizes || ContextBundler.DEFAULT_SIZES;
    this.baseUrl = options.baseUrl || null;
    this.priorityWeights = options.priorityWeights || {
      isIndex: 100,
      isReadme: 90,
      isImportant: 50,
      hasHighInlinks: 30,
      recentlyModified: 10
    };
  }

  /**
   * Generate all context bundles
   *
   * @param {Array<Object>} documents - All processed documents
   * @param {Object} siteMetadata - Site metadata
   * @param {Map} sections - Section map from ContentProcessor
   * @param {Object} [options={}] - Additional options
   * @param {Object} [options.linkGraph=null] - Link graph for importance scoring
   * @param {Object} [options.usageMetrics=null] - Usage metrics if available
   * @returns {Promise<Object>} Bundle generation results
   */
  async generate(documents, siteMetadata, sections, options = {}) {
    const { linkGraph = null, usageMetrics = null } = options;

    // Score and rank documents
    const rankedDocs = this.rankDocuments(documents, {
      linkGraph,
      usageMetrics
    });

    // Generate bundles for each size
    const bundles = {};
    for (const size of this.bundleSizes) {
      const bundle = await this.generateBundle(size, rankedDocs, siteMetadata, sections);
      bundles[size] = bundle;
    }

    // Write bundle metadata
    const metadataPath = join(this.outputDir, 'bundles.meta.json');
    const metadata = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      bundles: Object.entries(bundles).map(([size, bundle]) => ({
        size: parseInt(size),
        filename: `llms-ctx-${this.formatSize(size)}.txt`,
        actual_tokens: bundle.actualTokens,
        document_count: bundle.documentCount,
        sections_included: bundle.sectionsIncluded
      }))
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    this.log(`✔ Context bundles generated (${this.bundleSizes.length} sizes)`);

    return bundles;
  }

  /**
   * Generate a single bundle for a specific token size
   *
   * @param {number} targetTokens - Target token count
   * @param {Array<Object>} rankedDocs - Documents sorted by priority
   * @param {Object} siteMetadata - Site metadata
   * @param {Map} sections - Section map
   * @returns {Promise<Object>} Bundle result
   */
  async generateBundle(targetTokens, rankedDocs, siteMetadata, sections) {
    let content = '';
    let currentTokens = 0;
    const includedDocs = [];
    const includedSections = new Set();

    // Add header
    const header = this.buildHeader(siteMetadata);
    const headerTokens = this.estimateTokens(header);
    content += header;
    currentTokens += headerTokens;

    // Reserve tokens for footer
    const footerReserve = 50;
    const availableTokens = targetTokens - headerTokens - footerReserve;

    // Add documents in priority order until we hit the limit
    for (const doc of rankedDocs) {
      const entry = this.buildDocumentEntry(doc);
      const entryTokens = this.estimateTokens(entry);

      // Check if we can fit this document
      if (currentTokens + entryTokens <= availableTokens) {
        content += entry;
        currentTokens += entryTokens;
        includedDocs.push(doc.relativePath);

        // Track which sections are included
        const section = this.getSectionName(doc.relativePath);
        if (section) {
          includedSections.add(section);
        }
      } else if (currentTokens + 100 <= availableTokens) {
        // Try to include at least a reference
        const reference = this.buildDocumentReference(doc);
        const refTokens = this.estimateTokens(reference);
        if (currentTokens + refTokens <= availableTokens) {
          content += reference;
          currentTokens += refTokens;
        }
      }
    }

    // Add footer with truncation notice if we didn't include all docs
    if (includedDocs.length < rankedDocs.length) {
      const footer = `\n---\n*Context truncated. ${rankedDocs.length - includedDocs.length} additional documents available.*\n`;
      content += footer;
    }

    // Write bundle file
    const filename = `llms-ctx-${this.formatSize(targetTokens)}.txt`;
    const bundlePath = join(this.outputDir, filename);
    await writeFile(bundlePath, content, 'utf8');

    return {
      filename,
      targetTokens,
      actualTokens: currentTokens,
      documentCount: includedDocs.length,
      totalDocuments: rankedDocs.length,
      includedDocuments: includedDocs,
      sectionsIncluded: Array.from(includedSections)
    };
  }

  /**
   * Rank documents by importance for context packing
   *
   * @param {Array<Object>} documents - All documents
   * @param {Object} options - Ranking options
   * @returns {Array<Object>} Documents sorted by priority (highest first)
   */
  rankDocuments(documents, options = {}) {
    const { linkGraph = null, usageMetrics = null } = options;

    // Calculate scores for each document
    const scoredDocs = documents.map(doc => {
      const score = this.calculateDocumentScore(doc, { linkGraph, usageMetrics });
      return { ...doc, _priority: score };
    });

    // Sort by priority (highest first)
    scoredDocs.sort((a, b) => b._priority - a._priority);

    return scoredDocs;
  }

  /**
   * Calculate priority score for a document
   */
  calculateDocumentScore(doc, options = {}) {
    const { linkGraph = null, usageMetrics = null } = options;
    const path = doc.relativePath.toLowerCase();
    const filename = basename(path);
    let score = 0;

    // Index files get highest priority
    if (this.isIndexFile(filename)) {
      score += this.priorityWeights.isIndex;
    }

    // README files get high priority
    if (this.isReadmeFile(filename)) {
      score += this.priorityWeights.isReadme;
    }

    // Important documentation patterns
    if (this.isImportantDoc(path)) {
      score += this.priorityWeights.isImportant;
    }

    // Boost for high inlink count (if link graph available)
    if (linkGraph && linkGraph.nodes) {
      const node = linkGraph.nodes.find(n => n.path === doc.relativePath);
      if (node && node.importance) {
        score += node.importance * this.priorityWeights.hasHighInlinks;
      }
    }

    // Boost for recently modified files
    if (doc.modifiedTime) {
      const daysSinceModified = (Date.now() - new Date(doc.modifiedTime).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) {
        score += this.priorityWeights.recentlyModified * (1 - daysSinceModified / 30);
      }
    }

    // Boost from usage metrics if available
    if (usageMetrics && usageMetrics[doc.relativePath]) {
      score += usageMetrics[doc.relativePath].score || 0;
    }

    // Root-level files get a small boost
    if (!doc.relativePath.includes('/')) {
      score += 5;
    }

    // Penalize very long documents (they take up too much space)
    const docLength = doc.content?.length || 0;
    if (docLength > 10000) {
      score -= 10;
    }

    return score;
  }

  /**
   * Build bundle header from site metadata
   */
  buildHeader(siteMetadata) {
    let header = `# ${siteMetadata.title}\n\n`;
    header += `> ${siteMetadata.description}\n\n`;

    if (siteMetadata.instructions) {
      header += `${siteMetadata.instructions}\n\n`;
    }

    return header;
  }

  /**
   * Build full document entry for inclusion in bundle
   */
  buildDocumentEntry(doc) {
    const title = doc.metadata?.title || this.titleFromPath(doc.relativePath);
    let entry = `## ${title}\n`;
    entry += `*Source: ${doc.relativePath}*\n\n`;
    entry += `${doc.content || ''}\n\n`;
    entry += `---\n\n`;
    return entry;
  }

  /**
   * Build minimal document reference (just link, no content)
   */
  buildDocumentReference(doc) {
    const title = doc.metadata?.title || this.titleFromPath(doc.relativePath);
    const url = this.baseUrl ? `${this.baseUrl}${doc.relativePath}` : doc.relativePath;
    const notes = doc.metadata?.notes || doc.metadata?.description || '';
    let ref = `- [${title}](${url})`;
    if (notes) {
      ref += `: ${notes}`;
    }
    return ref + '\n';
  }

  /**
   * Get section name from path
   */
  getSectionName(relativePath) {
    const parts = relativePath.split('/');
    return parts.length > 1 ? parts[0] : 'Root';
  }

  /**
   * Check if filename is an index file
   */
  isIndexFile(filename) {
    const indexNames = ['index.md', 'index.mdx', 'index.html'];
    return indexNames.includes(filename.toLowerCase());
  }

  /**
   * Check if filename is a README file
   */
  isReadmeFile(filename) {
    const readmeNames = ['readme.md', 'readme.mdx', 'readme.html'];
    return readmeNames.includes(filename.toLowerCase());
  }

  /**
   * Check if path contains important documentation patterns
   */
  isImportantDoc(path) {
    const patterns = [
      'getting-started', 'quickstart', 'quick-start',
      'introduction', 'intro', 'overview',
      'tutorial', 'guide', 'doc', 'docs',
      'api', 'reference', 'usage'
    ];
    return patterns.some(p => path.includes(p));
  }

  /**
   * Extract title from path
   */
  titleFromPath(relativePath) {
    const filename = basename(relativePath);
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }

  /**
   * Format token size for filename (e.g., 2000 -> "2k", 32000 -> "32k")
   */
  formatSize(tokens) {
    if (tokens >= 1000) {
      return `${Math.round(tokens / 1000)}k`;
    }
    return `${tokens}`;
  }

  /**
   * Estimate token count (rough: 4 chars = 1 token)
   */
  estimateTokens(content) {
    if (!content) return 0;
    return Math.ceil(content.length / 4);
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
