/**
 * @catalog/llamaindex - LlamaIndex Integration for Catalog
 *
 * Provides readers, node parsers, and utilities for using Catalog outputs with LlamaIndex.
 *
 * @example
 * import { CatalogReader, CatalogNodeParser } from '@catalog/llamaindex';
 *
 * // Load documents
 * const reader = new CatalogReader('./build');
 * const documents = await reader.loadData();
 *
 * // Parse into nodes with Catalog's chunking
 * const parser = new CatalogNodeParser('./build/chunks.jsonl');
 * const nodes = await parser.getNodesFromDocuments(documents);
 */

import { readFile, readdir, stat } from "fs/promises";
import { join, extname, relative, basename } from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { createHash } from "crypto";

/**
 * CatalogReader - LlamaIndex Reader for Catalog outputs
 *
 * Reads documents from a Catalog output directory with full metadata
 * preservation for LlamaIndex's document processing pipeline.
 */
export class CatalogReader {
  /**
   * Create a new CatalogReader
   *
   * @param {string} catalogDir - Path to Catalog output directory
   * @param {Object} [options={}] - Reader options
   * @param {boolean} [options.useManifest=true] - Use manifest for metadata
   * @param {boolean} [options.includeTags=true] - Include tags in metadata
   * @param {boolean} [options.includeGraph=false] - Include graph importance
   * @param {string[]} [options.sections=[]] - Filter by sections
   */
  constructor(catalogDir, options = {}) {
    this.catalogDir = catalogDir;
    this.useManifest = options.useManifest !== false;
    this.includeTags = options.includeTags !== false;
    this.includeGraph = options.includeGraph || false;
    this.sections = options.sections || [];

    this.manifest = null;
    this.tags = null;
    this.graph = null;
  }

  /**
   * Load all documents from the Catalog directory
   *
   * @returns {Promise<Array<Document>>} LlamaIndex-compatible documents
   */
  async loadData() {
    await this.loadMetadata();

    const documents = [];

    if (this.manifest && this.manifest.documents) {
      for (const docEntry of this.manifest.documents) {
        // Filter by section if specified
        if (this.sections.length > 0 && !this.sections.includes(docEntry.section)) {
          continue;
        }

        try {
          const content = await readFile(
            join(this.catalogDir, "..", docEntry.path),
            "utf8"
          );

          documents.push(this.createDocument(content, docEntry));
        } catch (error) {
          console.warn(`Failed to load ${docEntry.path}: ${error.message}`);
        }
      }
    } else {
      // Fallback to directory scanning
      const files = await this.findMarkdownFiles(this.catalogDir);

      for (const file of files) {
        try {
          const content = await readFile(file, "utf8");
          const relativePath = relative(this.catalogDir, file);

          documents.push(this.createDocument(content, {
            path: relativePath,
            id: this.generateId(relativePath),
            title: this.titleFromPath(relativePath)
          }));
        } catch (error) {
          console.warn(`Failed to load ${file}: ${error.message}`);
        }
      }
    }

    return documents;
  }

  /**
   * Load metadata files
   */
  async loadMetadata() {
    // Load manifest
    if (this.useManifest) {
      try {
        const manifestPath = join(this.catalogDir, "catalog.manifest.json");
        this.manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      } catch {
        // Manifest not available
      }
    }

    // Load tags
    if (this.includeTags) {
      try {
        const tagsPath = join(this.catalogDir, "tags.json");
        this.tags = JSON.parse(await readFile(tagsPath, "utf8"));
      } catch {
        // Tags not available
      }
    }

    // Load graph
    if (this.includeGraph) {
      try {
        const graphPath = join(this.catalogDir, "graph.json");
        this.graph = JSON.parse(await readFile(graphPath, "utf8"));
      } catch {
        // Graph not available
      }
    }
  }

  /**
   * Create a LlamaIndex-compatible document
   *
   * @param {string} text - Document content
   * @param {Object} docEntry - Document metadata entry
   * @returns {Document}
   */
  createDocument(text, docEntry) {
    const metadata = {
      file_path: docEntry.path,
      file_name: basename(docEntry.path),
      doc_id: docEntry.id,
      title: docEntry.title,
      section: docEntry.section,
      content_hash: docEntry.content_hash,
      modified_at: docEntry.modified_at
    };

    // Add tags if available
    if (this.tags && this.tags.documents && this.tags.documents[docEntry.path]) {
      metadata.tags = this.tags.documents[docEntry.path].tags;
    }

    // Add graph importance if available
    if (this.graph && this.graph.nodes) {
      const node = this.graph.nodes.find(n => n.path === docEntry.path);
      if (node) {
        metadata.importance = node.importance;
        metadata.inlink_count = node.inlinks?.length || 0;
        metadata.outlink_count = node.outlinks?.length || 0;
      }
    }

    // Add frontmatter fields
    if (docEntry.frontmatter) {
      Object.assign(metadata, docEntry.frontmatter);
    }

    return {
      id_: docEntry.id,
      text,
      metadata,
      excluded_embed_metadata_keys: ["content_hash", "modified_at"],
      excluded_llm_metadata_keys: ["content_hash", "modified_at", "file_path"]
    };
  }

  /**
   * Find markdown files recursively
   */
  async findMarkdownFiles(dir, files = []) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.findMarkdownFiles(fullPath, files);
      } else if ([".md", ".mdx"].includes(extname(entry.name))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Generate a document ID from path
   */
  generateId(path) {
    return createHash("sha256").update(path).digest("hex").substring(0, 12);
  }

  /**
   * Extract title from path
   */
  titleFromPath(path) {
    return basename(path)
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}

/**
 * CatalogNodeParser - Parse Catalog documents into LlamaIndex nodes
 *
 * Uses Catalog's pre-generated chunks for optimal node creation
 * with full citation information.
 */
export class CatalogNodeParser {
  /**
   * Create a new CatalogNodeParser
   *
   * @param {string} chunksPath - Path to chunks.jsonl file
   * @param {Object} [options={}] - Parser options
   * @param {boolean} [options.includeMetadata=true] - Include metadata in nodes
   * @param {boolean} [options.includeCitation=true] - Include citation info
   */
  constructor(chunksPath, options = {}) {
    this.chunksPath = chunksPath;
    this.includeMetadata = options.includeMetadata !== false;
    this.includeCitation = options.includeCitation !== false;
  }

  /**
   * Parse documents into nodes using Catalog chunks
   *
   * @param {Array<Document>} documents - Source documents
   * @returns {Promise<Array<Node>>} LlamaIndex nodes
   */
  async getNodesFromDocuments(documents) {
    const nodes = [];
    const docMap = new Map(documents.map(d => [d.metadata?.file_path, d]));

    const fileStream = createReadStream(this.chunksPath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const chunk = JSON.parse(line);
        const sourceDoc = docMap.get(chunk.source_path);

        nodes.push(this.createNode(chunk, sourceDoc));
      } catch (error) {
        console.warn(`Failed to parse chunk: ${error.message}`);
      }
    }

    return nodes;
  }

  /**
   * Create a LlamaIndex node from a chunk
   *
   * @param {Object} chunk - Catalog chunk
   * @param {Document} [sourceDoc] - Source document
   * @returns {Node}
   */
  createNode(chunk, sourceDoc = null) {
    const metadata = {
      file_path: chunk.source_path,
      chunk_id: chunk.chunk_id,
      heading_path: chunk.heading_path,
      line_range: chunk.line_range,
      byte_range: chunk.byte_range,
      token_count: chunk.token_count,
      has_code: chunk.has_code,
      profile: chunk.profile
    };

    // Add citation if requested
    if (this.includeCitation) {
      metadata.citation = this.formatCitation(chunk);
    }

    // Inherit metadata from source document
    if (sourceDoc && sourceDoc.metadata) {
      metadata.doc_title = sourceDoc.metadata.title;
      metadata.doc_section = sourceDoc.metadata.section;
      metadata.doc_tags = sourceDoc.metadata.tags;
    }

    return {
      id_: chunk.chunk_id,
      text: chunk.content,
      metadata,
      relationships: this.buildRelationships(chunk, sourceDoc),
      excluded_embed_metadata_keys: ["byte_range", "line_range"],
      excluded_llm_metadata_keys: ["byte_range", "chunk_id"]
    };
  }

  /**
   * Build node relationships
   *
   * @param {Object} chunk - Catalog chunk
   * @param {Document} [sourceDoc] - Source document
   * @returns {Object}
   */
  buildRelationships(chunk, sourceDoc = null) {
    const relationships = {};

    // Link to source document
    if (sourceDoc) {
      relationships.source = {
        node_id: sourceDoc.id_,
        node_type: "document",
        metadata: { file_path: chunk.source_path }
      };
    }

    // Could add prev/next relationships based on chunk ordering
    // This would require tracking chunk sequence during parsing

    return relationships;
  }

  /**
   * Format citation for a chunk
   */
  formatCitation(chunk) {
    const parts = [chunk.source_path];

    if (chunk.heading_path?.length > 0) {
      parts.push(`§ ${chunk.heading_path.join(" > ")}`);
    }

    if (chunk.line_range) {
      parts.push(`L${chunk.line_range.start}-${chunk.line_range.end}`);
    }

    return parts.join(" ");
  }
}

/**
 * CatalogIndex - Pre-built index using Catalog's graph
 *
 * Creates a knowledge graph-aware index using Catalog's
 * link graph and importance scores.
 */
export class CatalogIndex {
  /**
   * Create a new CatalogIndex
   *
   * @param {string} catalogDir - Path to Catalog output directory
   * @param {Object} [options={}] - Index options
   */
  constructor(catalogDir, options = {}) {
    this.catalogDir = catalogDir;
    this.options = options;

    this.nodes = [];
    this.graph = null;
    this.initialized = false;
  }

  /**
   * Build the index from Catalog outputs
   *
   * @returns {Promise<void>}
   */
  async build() {
    if (this.initialized) return;

    // Load documents
    const reader = new CatalogReader(this.catalogDir, {
      includeGraph: true
    });
    const documents = await reader.loadData();

    // Parse into nodes
    const chunksPath = join(this.catalogDir, "chunks.jsonl");
    try {
      const parser = new CatalogNodeParser(chunksPath);
      this.nodes = await parser.getNodesFromDocuments(documents);
    } catch {
      // Chunks not available, create simple nodes from documents
      this.nodes = documents.map(doc => ({
        id_: doc.id_,
        text: doc.text,
        metadata: doc.metadata
      }));
    }

    // Load graph
    try {
      const graphPath = join(this.catalogDir, "graph.json");
      this.graph = JSON.parse(await readFile(graphPath, "utf8"));
    } catch {
      // Graph not available
    }

    this.initialized = true;
  }

  /**
   * Query the index
   *
   * @param {string} query - Search query
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array<Object>>}
   */
  async query(query, options = {}) {
    await this.build();

    const topK = options.topK || 5;
    const useGraphReranking = options.useGraphReranking !== false;

    // Simple keyword search (in production, use embeddings)
    const queryTerms = query.toLowerCase().split(/\s+/);

    let results = this.nodes.map(node => {
      let score = 0;
      const text = node.text.toLowerCase();

      for (const term of queryTerms) {
        const matches = (text.match(new RegExp(term, "g")) || []).length;
        score += matches;
      }

      return { node, score };
    });

    // Apply graph reranking if available
    if (useGraphReranking && this.graph) {
      results = results.map(result => {
        const graphNode = this.graph.nodes?.find(
          n => n.path === result.node.metadata?.file_path
        );

        if (graphNode && graphNode.importance) {
          result.score *= (1 + graphNode.importance);
        }

        return result;
      });
    }

    // Sort and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(r => r.score > 0)
      .map(r => ({
        node: r.node,
        score: r.score
      }));
  }

  /**
   * Get nodes by section
   *
   * @param {string} section - Section name
   * @returns {Array<Object>}
   */
  getNodesBySection(section) {
    return this.nodes.filter(
      node => node.metadata?.doc_section === section
    );
  }

  /**
   * Get nodes by tag
   *
   * @param {string} tag - Tag to filter by
   * @returns {Array<Object>}
   */
  getNodesByTag(tag) {
    return this.nodes.filter(node => {
      const tags = node.metadata?.doc_tags || node.metadata?.tags || [];
      return tags.includes(tag);
    });
  }
}

/**
 * Create a hierarchical node structure using Catalog sections
 *
 * @param {Array<Document>} documents - Catalog documents
 * @returns {Object} Hierarchical structure
 */
export function createHierarchicalNodes(documents) {
  const hierarchy = {
    root: {
      children: {},
      documents: []
    }
  };

  for (const doc of documents) {
    const section = doc.metadata?.section || "root";
    const parts = section.split("/");

    let current = hierarchy.root;
    for (const part of parts) {
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          children: {},
          documents: []
        };
      }
      current = current.children[part];
    }

    current.documents.push(doc);
  }

  return hierarchy;
}

/**
 * Create sub-document summaries structure
 * (Implements LlamaIndex's sub-document summaries pattern)
 *
 * @param {Array<Document>} documents - Catalog documents
 * @param {Object} manifest - Catalog manifest
 * @returns {Array<Object>} Documents with summary metadata
 */
export function createSubDocumentSummaries(documents, manifest) {
  if (!manifest || !manifest.documents) {
    return documents;
  }

  return documents.map(doc => {
    const manifestEntry = manifest.documents.find(
      e => e.path === doc.metadata?.file_path
    );

    if (manifestEntry) {
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          summary: manifestEntry.frontmatter?.description ||
                   manifestEntry.frontmatter?.summary ||
                   `Document: ${manifestEntry.title}`,
          parent_doc_id: manifestEntry.id
        }
      };
    }

    return doc;
  });
}

// Export for CommonJS compatibility
export default {
  CatalogReader,
  CatalogNodeParser,
  CatalogIndex,
  createHierarchicalNodes,
  createSubDocumentSummaries
};
