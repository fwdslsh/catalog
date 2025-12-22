/**
 * @catalog/langchain - LangChain Integration for Catalog
 *
 * Provides document loaders and utilities for using Catalog outputs with LangChain.
 *
 * @example
 * import { CatalogLoader, CatalogChunkLoader } from '@catalog/langchain';
 *
 * // Load full documents
 * const loader = new CatalogLoader('./build');
 * const docs = await loader.load();
 *
 * // Load pre-chunked documents
 * const chunkLoader = new CatalogChunkLoader('./build/chunks.jsonl');
 * const chunks = await chunkLoader.load();
 */

import { readFile, readdir, stat } from "fs/promises";
import { join, extname, relative } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

/**
 * CatalogLoader - Load Catalog-processed documents for LangChain
 *
 * Loads documents from a Catalog output directory, preserving metadata
 * and structure for use with LangChain's document processing pipeline.
 */
export class CatalogLoader {
  /**
   * Create a new CatalogLoader
   *
   * @param {string} catalogDir - Path to Catalog output directory
   * @param {Object} [options={}] - Loader options
   * @param {boolean} [options.loadManifest=true] - Load and use manifest metadata
   * @param {boolean} [options.loadTags=true] - Include tags in metadata
   * @param {string[]} [options.include=[]] - Glob patterns to include
   * @param {string[]} [options.exclude=[]] - Glob patterns to exclude
   */
  constructor(catalogDir, options = {}) {
    this.catalogDir = catalogDir;
    this.loadManifest = options.loadManifest !== false;
    this.loadTags = options.loadTags !== false;
    this.include = options.include || [];
    this.exclude = options.exclude || [];

    this.manifest = null;
    this.tags = null;
  }

  /**
   * Load all documents from the Catalog directory
   *
   * @returns {Promise<Array<Document>>} LangChain-compatible documents
   */
  async load() {
    // Load manifest if available
    if (this.loadManifest) {
      try {
        const manifestPath = join(this.catalogDir, "catalog.manifest.json");
        const manifestContent = await readFile(manifestPath, "utf8");
        this.manifest = JSON.parse(manifestContent);
      } catch {
        // Manifest not available
      }
    }

    // Load tags if available
    if (this.loadTags) {
      try {
        const tagsPath = join(this.catalogDir, "tags.json");
        const tagsContent = await readFile(tagsPath, "utf8");
        this.tags = JSON.parse(tagsContent);
      } catch {
        // Tags not available
      }
    }

    // If manifest is available, use it to load documents
    if (this.manifest && this.manifest.documents) {
      return this.loadFromManifest();
    }

    // Otherwise, scan the directory for markdown files
    return this.loadFromDirectory();
  }

  /**
   * Load documents using manifest metadata
   *
   * @returns {Promise<Array<Document>>}
   */
  async loadFromManifest() {
    const documents = [];

    for (const docEntry of this.manifest.documents) {
      // Check include/exclude patterns
      if (!this.shouldInclude(docEntry.path)) {
        continue;
      }

      try {
        const content = await readFile(
          join(this.catalogDir, "..", docEntry.path),
          "utf8"
        );

        // Get tags for this document
        const docTags = this.getTagsForDocument(docEntry.path);

        documents.push(this.createDocument(content, {
          source: docEntry.path,
          doc_id: docEntry.id,
          title: docEntry.title,
          section: docEntry.section,
          hash: docEntry.content_hash,
          modified_at: docEntry.modified_at,
          tags: docTags,
          ...docEntry.frontmatter
        }));
      } catch (error) {
        console.warn(`Failed to load ${docEntry.path}: ${error.message}`);
      }
    }

    return documents;
  }

  /**
   * Load documents by scanning directory
   *
   * @returns {Promise<Array<Document>>}
   */
  async loadFromDirectory() {
    const documents = [];
    const files = await this.findMarkdownFiles(this.catalogDir);

    for (const file of files) {
      const relativePath = relative(this.catalogDir, file);

      if (!this.shouldInclude(relativePath)) {
        continue;
      }

      try {
        const content = await readFile(file, "utf8");
        const docTags = this.getTagsForDocument(relativePath);

        documents.push(this.createDocument(content, {
          source: relativePath,
          tags: docTags
        }));
      } catch (error) {
        console.warn(`Failed to load ${file}: ${error.message}`);
      }
    }

    return documents;
  }

  /**
   * Find all markdown files in a directory
   *
   * @param {string} dir - Directory to search
   * @returns {Promise<string[]>} List of file paths
   */
  async findMarkdownFiles(dir) {
    const files = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if ([".md", ".mdx"].includes(extname(entry.name))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if a path should be included
   *
   * @param {string} path - Path to check
   * @returns {boolean}
   */
  shouldInclude(path) {
    // Check excludes first
    if (this.exclude.length > 0) {
      for (const pattern of this.exclude) {
        if (this.matchPattern(path, pattern)) {
          return false;
        }
      }
    }

    // Check includes
    if (this.include.length > 0) {
      for (const pattern of this.include) {
        if (this.matchPattern(path, pattern)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Simple pattern matching
   *
   * @param {string} path - Path to match
   * @param {string} pattern - Glob pattern
   * @returns {boolean}
   */
  matchPattern(path, pattern) {
    const regex = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".");
    return new RegExp(`^${regex}$`).test(path);
  }

  /**
   * Get tags for a document from the tags index
   *
   * @param {string} path - Document path
   * @returns {string[]}
   */
  getTagsForDocument(path) {
    if (!this.tags || !this.tags.documents) {
      return [];
    }

    const docTags = this.tags.documents[path];
    return docTags ? docTags.tags : [];
  }

  /**
   * Create a LangChain-compatible document
   *
   * @param {string} pageContent - Document content
   * @param {Object} metadata - Document metadata
   * @returns {Document}
   */
  createDocument(pageContent, metadata) {
    return {
      pageContent,
      metadata
    };
  }
}

/**
 * CatalogChunkLoader - Load pre-chunked documents from Catalog
 *
 * Loads chunks from the chunks.jsonl file generated by Catalog,
 * with full citation information preserved.
 */
export class CatalogChunkLoader {
  /**
   * Create a new CatalogChunkLoader
   *
   * @param {string} chunksPath - Path to chunks.jsonl file
   * @param {Object} [options={}] - Loader options
   * @param {string[]} [options.profiles=[]] - Filter by chunk profiles
   * @param {number} [options.minTokens=0] - Minimum token count
   * @param {number} [options.maxTokens=Infinity] - Maximum token count
   */
  constructor(chunksPath, options = {}) {
    this.chunksPath = chunksPath;
    this.profiles = options.profiles || [];
    this.minTokens = options.minTokens || 0;
    this.maxTokens = options.maxTokens || Infinity;
  }

  /**
   * Load all chunks
   *
   * @returns {Promise<Array<Document>>}
   */
  async load() {
    const documents = [];

    const fileStream = createReadStream(this.chunksPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const chunk = JSON.parse(line);

        // Apply filters
        if (!this.shouldIncludeChunk(chunk)) {
          continue;
        }

        documents.push(this.createDocument(chunk.content, {
          chunk_id: chunk.chunk_id,
          source: chunk.source_path,
          heading_path: chunk.heading_path,
          line_range: chunk.line_range,
          byte_range: chunk.byte_range,
          token_count: chunk.token_count,
          has_code: chunk.has_code,
          profile: chunk.profile,
          // Citation info for RAG
          citation: this.formatCitation(chunk)
        }));
      } catch (error) {
        console.warn(`Failed to parse chunk: ${error.message}`);
      }
    }

    return documents;
  }

  /**
   * Check if a chunk should be included
   *
   * @param {Object} chunk - Chunk to check
   * @returns {boolean}
   */
  shouldIncludeChunk(chunk) {
    // Check profile filter
    if (this.profiles.length > 0 && !this.profiles.includes(chunk.profile)) {
      return false;
    }

    // Check token count
    if (chunk.token_count < this.minTokens || chunk.token_count > this.maxTokens) {
      return false;
    }

    return true;
  }

  /**
   * Format citation information for a chunk
   *
   * @param {Object} chunk - Chunk data
   * @returns {string}
   */
  formatCitation(chunk) {
    const parts = [chunk.source_path];

    if (chunk.heading_path && chunk.heading_path.length > 0) {
      parts.push(`§ ${chunk.heading_path.join(" > ")}`);
    }

    if (chunk.line_range) {
      parts.push(`L${chunk.line_range.start}-${chunk.line_range.end}`);
    }

    return parts.join(" ");
  }

  /**
   * Create a LangChain-compatible document
   *
   * @param {string} pageContent - Chunk content
   * @param {Object} metadata - Chunk metadata
   * @returns {Document}
   */
  createDocument(pageContent, metadata) {
    return {
      pageContent,
      metadata
    };
  }
}

/**
 * CatalogRetriever - LangChain retriever for Catalog documents
 *
 * Provides a retriever interface that uses Catalog's built-in
 * search capabilities for efficient document retrieval.
 */
export class CatalogRetriever {
  /**
   * Create a new CatalogRetriever
   *
   * @param {string} catalogDir - Path to Catalog output directory
   * @param {Object} [options={}] - Retriever options
   * @param {number} [options.k=4] - Number of documents to retrieve
   * @param {boolean} [options.useGraph=false] - Use link graph for ranking
   */
  constructor(catalogDir, options = {}) {
    this.catalogDir = catalogDir;
    this.k = options.k || 4;
    this.useGraph = options.useGraph || false;

    this.documents = [];
    this.graph = null;
    this.initialized = false;
  }

  /**
   * Initialize the retriever by loading documents
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    const loader = new CatalogLoader(this.catalogDir);
    this.documents = await loader.load();

    // Load graph if requested
    if (this.useGraph) {
      try {
        const graphPath = join(this.catalogDir, "graph.json");
        const graphContent = await readFile(graphPath, "utf8");
        this.graph = JSON.parse(graphContent);
      } catch {
        // Graph not available
      }
    }

    this.initialized = true;
  }

  /**
   * Retrieve relevant documents for a query
   *
   * @param {string} query - Search query
   * @returns {Promise<Array<Document>>}
   */
  async getRelevantDocuments(query) {
    await this.initialize();

    // Simple keyword matching (in production, use embeddings)
    const queryTerms = query.toLowerCase().split(/\s+/);

    const scored = this.documents.map(doc => {
      let score = 0;
      const content = doc.pageContent.toLowerCase();
      const title = (doc.metadata.title || "").toLowerCase();

      for (const term of queryTerms) {
        // Title matches are weighted higher
        if (title.includes(term)) score += 10;
        // Content matches
        const contentMatches = (content.match(new RegExp(term, "g")) || []).length;
        score += contentMatches;
      }

      // Boost by graph importance if available
      if (this.graph && doc.metadata.source) {
        const node = this.graph.nodes?.find(n => n.path === doc.metadata.source);
        if (node && node.importance) {
          score *= (1 + node.importance);
        }
      }

      return { doc, score };
    });

    // Sort by score and return top k
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.k)
      .filter(item => item.score > 0)
      .map(item => item.doc);
  }
}

/**
 * Create a text splitter that respects Catalog's structure
 *
 * @param {Object} [options={}] - Splitter options
 * @returns {Object} Text splitter configuration
 */
export function createCatalogSplitter(options = {}) {
  return {
    chunkSize: options.chunkSize || 1000,
    chunkOverlap: options.chunkOverlap || 200,
    separators: [
      "\n## ",      // H2 headings
      "\n### ",     // H3 headings
      "\n#### ",    // H4 headings
      "\n```",      // Code blocks
      "\n\n",       // Paragraphs
      "\n",         // Lines
      " "           // Words
    ],
    keepSeparator: true
  };
}

// Export for CommonJS compatibility
export default {
  CatalogLoader,
  CatalogChunkLoader,
  CatalogRetriever,
  createCatalogSplitter
};
