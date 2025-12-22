import { writeFile } from "fs/promises";
import { join, basename, dirname } from "path";
import { createHash } from "crypto";

/**
 * ManifestGenerator - Generates catalog.manifest.json for downstream tools
 *
 * Provides a canonical format for dispatch, fmemory, frecall, fworkflow,
 * and other PAI apps without coupling to filesystem conventions.
 *
 * @example
 * const generator = new ManifestGenerator(outputDir, {
 *   origin: 'https://docs.example.com',
 *   generatorVersion: '0.2.0'
 * });
 * await generator.generate(documents, siteMetadata, linkGraph);
 */
export class ManifestGenerator {
  /**
   * Create a new ManifestGenerator instance
   *
   * @param {string} outputDir - Destination directory for manifest file
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {string} [options.origin=null] - Origin URL (e.g., crawl source)
   * @param {string} [options.repoRef=null] - Git repository reference
   * @param {string} [options.generatorVersion=null] - Version of catalog that generated this
   * @param {boolean} [options.includeFingerprints=true] - Include sha256 and simhash fingerprints
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.origin = options.origin || null;
    this.repoRef = options.repoRef || null;
    this.generatorVersion = options.generatorVersion || null;
    this.includeFingerprints = options.includeFingerprints !== false;
  }

  /**
   * Generate the manifest file
   *
   * @param {Array<Object>} documents - Processed documents with content and metadata
   * @param {Object} siteMetadata - Site-level metadata (title, description)
   * @param {Object} [options={}] - Additional generation options
   * @param {Object} [options.linkGraph=null] - Link graph for relationship data
   * @param {Object} [options.tags=null] - Tag assignments from TagGenerator
   * @param {Object} [options.chunks=null] - Chunk data from ChunkGenerator
   * @returns {Promise<Object>} The generated manifest object
   */
  async generate(documents, siteMetadata, options = {}) {
    const { linkGraph = null, tags = null, chunks = null } = options;

    const manifest = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      generator: {
        name: "catalog",
        version: this.generatorVersion || "unknown"
      },
      provenance: this.buildProvenance(),
      site: {
        title: siteMetadata.title,
        description: siteMetadata.description,
        instructions: siteMetadata.instructions || null
      },
      documents: documents.map((doc, index) => this.buildDocumentEntry(doc, {
        index,
        linkGraph,
        tags,
        chunks
      })),
      statistics: this.buildStatistics(documents, chunks)
    };

    // Write manifest file
    const manifestPath = join(this.outputDir, 'catalog.manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    this.log(`✔ catalog.manifest.json (${documents.length} documents)`);

    return manifest;
  }

  /**
   * Build provenance information
   */
  buildProvenance() {
    return {
      origin: this.origin,
      repo_ref: this.repoRef,
      crawl_url: this.origin, // Alias for compatibility
      generated_by: "catalog",
      generator_version: this.generatorVersion
    };
  }

  /**
   * Build a document entry for the manifest
   *
   * @param {Object} doc - Document object
   * @param {Object} options - Additional options
   * @returns {Object} Manifest document entry
   */
  buildDocumentEntry(doc, options = {}) {
    const { index, linkGraph, tags, chunks } = options;

    // Generate stable document ID based on content hash
    const docId = this.generateDocId(doc);

    const entry = {
      id: docId,
      path: doc.relativePath,
      title: doc.metadata?.title || this.titleFromPath(doc.relativePath),
      description: doc.metadata?.description || doc.metadata?.notes || null,

      // File statistics
      stats: {
        size: doc.content?.length || 0,
        modified: doc.modifiedTime || null,
        created: doc.createdTime || null,
        word_count: this.countWords(doc.content),
        line_count: this.countLines(doc.content),
        has_code_blocks: this.hasCodeBlocks(doc.content),
        has_frontmatter: doc.hasFrontmatter || false
      },

      // Document metadata
      metadata: {
        ...doc.metadata,
        original_path: doc.originalPath || null,
        is_html_converted: doc.isHtmlConverted || false,
        section: doc.section || null
      }
    };

    // Add fingerprints for deduplication and change detection
    if (this.includeFingerprints) {
      entry.fingerprints = {
        sha256: this.sha256(doc.content || ''),
        content_hash: docId, // Same as ID for now
        simhash: this.simhash(doc.content || '') // Near-duplicate detection
      };
    }

    // Add relationship data if link graph is available
    if (linkGraph && linkGraph.edges) {
      entry.relationships = this.buildRelationships(doc.relativePath, linkGraph);
    }

    // Add tags if available
    if (tags && tags[doc.relativePath]) {
      entry.tags = tags[doc.relativePath];
    }

    // Add chunk references if available
    if (chunks) {
      const docChunks = chunks.filter(c => c.source_path === doc.relativePath);
      if (docChunks.length > 0) {
        entry.chunk_ids = docChunks.map(c => c.chunk_id);
        entry.chunk_count = docChunks.length;
      }
    }

    return entry;
  }

  /**
   * Generate a stable document ID based on path and content hash
   * Uses first 12 chars of SHA256 for brevity while maintaining uniqueness
   *
   * @param {Object} doc - Document object
   * @returns {string} Stable document ID
   */
  generateDocId(doc) {
    // Use path + content hash for stability across regenerations
    const input = doc.relativePath + (doc.content || '');
    return this.sha256(input).substring(0, 12);
  }

  /**
   * Generate SHA256 hash of content
   *
   * @param {string} content - Content to hash
   * @returns {string} Hex-encoded SHA256 hash
   */
  sha256(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Generate simhash for near-duplicate detection
   * Simplified implementation using word frequency fingerprinting
   *
   * @param {string} content - Content to hash
   * @returns {string} 64-bit simhash as hex string
   */
  simhash(content) {
    if (!content || content.length === 0) {
      return '0000000000000000';
    }

    // Tokenize into words
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (words.length === 0) {
      return '0000000000000000';
    }

    // Initialize 64 counters for each bit position
    const v = new Array(64).fill(0);

    // For each word, compute hash and adjust counters
    for (const word of words) {
      const hash = this.sha256(word);
      const bits = BigInt('0x' + hash.substring(0, 16));

      for (let i = 0; i < 64; i++) {
        if ((bits >> BigInt(i)) & BigInt(1)) {
          v[i]++;
        } else {
          v[i]--;
        }
      }
    }

    // Build final hash from counter signs
    let result = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (v[i] > 0) {
        result |= (BigInt(1) << BigInt(i));
      }
    }

    return result.toString(16).padStart(16, '0');
  }

  /**
   * Build relationship data from link graph
   */
  buildRelationships(docPath, linkGraph) {
    const relationships = {
      parent_section: null,
      outgoing_links: [],
      incoming_links: []
    };

    // Extract parent section from path
    const pathParts = docPath.split('/');
    if (pathParts.length > 1) {
      relationships.parent_section = pathParts[0];
    }

    // Find outgoing links
    if (linkGraph.edges) {
      for (const edge of linkGraph.edges) {
        if (edge.source === docPath) {
          relationships.outgoing_links.push({
            target: edge.target,
            type: edge.type || 'reference',
            anchor: edge.anchor || null
          });
        }
        if (edge.target === docPath) {
          relationships.incoming_links.push({
            source: edge.source,
            type: edge.type || 'reference',
            anchor: edge.anchor || null
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Build statistics summary
   */
  buildStatistics(documents, chunks = null) {
    const totalSize = documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0);
    const totalWords = documents.reduce((sum, doc) => sum + this.countWords(doc.content), 0);

    const stats = {
      document_count: documents.length,
      total_size_bytes: totalSize,
      total_word_count: totalWords,
      average_document_size: Math.round(totalSize / documents.length),
      documents_with_code: documents.filter(doc => this.hasCodeBlocks(doc.content)).length,
      documents_with_frontmatter: documents.filter(doc => doc.hasFrontmatter).length
    };

    if (chunks) {
      stats.total_chunks = chunks.length;
      stats.average_chunks_per_doc = Math.round(chunks.length / documents.length * 10) / 10;
    }

    return stats;
  }

  /**
   * Extract title from path
   */
  titleFromPath(relativePath) {
    const fileName = basename(relativePath);
    return fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  }

  /**
   * Count words in content
   */
  countWords(content) {
    if (!content) return 0;
    return content.split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Count lines in content
   */
  countLines(content) {
    if (!content) return 0;
    return content.split('\n').length;
  }

  /**
   * Check if content has code blocks
   */
  hasCodeBlocks(content) {
    if (!content) return false;
    return /```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content);
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
