import { writeFile } from "fs/promises";
import { join, dirname, resolve, relative } from "path";

/**
 * LinkGraphGenerator - Build link graph with importance scoring
 *
 * Parses Markdown links to produce a graph representation with
 * PageRank-style importance scores. Helps dispatch and retrieval
 * tools prioritize authoritative docs first.
 *
 * @example
 * const graphGen = new LinkGraphGenerator(outputDir);
 * const graph = await graphGen.generate(documents);
 */
export class LinkGraphGenerator {
  /**
   * Create a new LinkGraphGenerator instance
   *
   * @param {string} outputDir - Destination directory for graph files
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {number} [options.dampingFactor=0.85] - PageRank damping factor
   * @param {number} [options.iterations=20] - PageRank iterations
   * @param {boolean} [options.includeSectionGraph=true] - Generate section-level graph
   * @param {boolean} [options.includeExternalLinks=false] - Include external links in graph
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.dampingFactor = options.dampingFactor || 0.85;
    this.iterations = options.iterations || 20;
    this.includeSectionGraph = options.includeSectionGraph !== false;
    this.includeExternalLinks = options.includeExternalLinks || false;
  }

  /**
   * Generate the link graph for all documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @returns {Promise<Object>} Graph object with nodes and edges
   */
  async generate(documents) {
    // Build document path set for internal link detection
    const docPaths = new Set(documents.map(d => d.relativePath));

    // Extract links from all documents
    const allEdges = [];
    const externalLinks = [];

    for (const doc of documents) {
      const { internal, external } = this.extractLinks(doc, docPaths);
      allEdges.push(...internal);
      externalLinks.push(...external);
    }

    // Build nodes with initial data
    const nodes = this.buildNodes(documents, allEdges);

    // Calculate PageRank-style importance
    this.calculateImportance(nodes, allEdges);

    // Detect hubs and orphans
    const analysis = this.analyzeGraph(nodes, allEdges);

    // Build the graph object
    const graph = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      nodes,
      edges: allEdges,
      external_links: this.includeExternalLinks ? externalLinks : undefined,
      analysis
    };

    // Write graph.json
    const graphPath = join(this.outputDir, 'graph.json');
    await writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf8');

    // Generate section-level graph if enabled
    if (this.includeSectionGraph) {
      const sectionGraph = this.generateSectionGraph(documents, allEdges);
      const sectionGraphPath = join(this.outputDir, 'graph-sections.json');
      await writeFile(sectionGraphPath, JSON.stringify(sectionGraph, null, 2), 'utf8');
    }

    this.log(`✔ graph.json (${nodes.length} nodes, ${allEdges.length} edges)`);

    return graph;
  }

  /**
   * Extract internal and external links from a document
   *
   * @param {Object} doc - Document object
   * @param {Set<string>} docPaths - Set of all document paths
   * @returns {Object} { internal: [], external: [] }
   */
  extractLinks(doc, docPaths) {
    const content = doc.content || '';
    const internal = [];
    const external = [];

    // Match markdown links: [text](url) or [text](url "title")
    const linkRegex = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, text, url] = match;

      // Skip anchor-only links
      if (url.startsWith('#')) {
        internal.push({
          source: doc.relativePath,
          target: doc.relativePath,
          anchor: url.substring(1),
          text,
          type: 'internal-anchor'
        });
        continue;
      }

      // Check for external links
      if (this.isExternalLink(url)) {
        external.push({
          source: doc.relativePath,
          target: url,
          text,
          type: 'external'
        });
        continue;
      }

      // Resolve relative path
      const resolvedPath = this.resolveLink(url, doc.relativePath, docPaths);

      if (resolvedPath) {
        // Extract anchor if present
        const [targetPath, anchor] = resolvedPath.split('#');

        internal.push({
          source: doc.relativePath,
          target: targetPath,
          anchor: anchor || null,
          text,
          type: anchor ? 'internal-anchor' : 'internal'
        });
      }
    }

    // Also extract reference-style links: [text][ref] with [ref]: url
    const refLinks = this.extractReferenceLinks(content, doc.relativePath, docPaths);
    internal.push(...refLinks.internal);
    external.push(...refLinks.external);

    return { internal, external };
  }

  /**
   * Extract reference-style links
   */
  extractReferenceLinks(content, sourcePath, docPaths) {
    const internal = [];
    const external = [];

    // Find reference definitions: [ref]: url
    const refDefs = {};
    const refDefRegex = /^\[([^\]]+)\]:\s*(\S+)/gm;
    let match;

    while ((match = refDefRegex.exec(content)) !== null) {
      refDefs[match[1].toLowerCase()] = match[2];
    }

    // Find reference usages: [text][ref] or [ref][]
    const refUseRegex = /\[([^\]]+)\]\[([^\]]*)\]/g;

    while ((match = refUseRegex.exec(content)) !== null) {
      const text = match[1];
      const ref = (match[2] || match[1]).toLowerCase();
      const url = refDefs[ref];

      if (url) {
        if (this.isExternalLink(url)) {
          external.push({
            source: sourcePath,
            target: url,
            text,
            type: 'external'
          });
        } else {
          const resolved = this.resolveLink(url, sourcePath, docPaths);
          if (resolved) {
            const [targetPath, anchor] = resolved.split('#');
            internal.push({
              source: sourcePath,
              target: targetPath,
              anchor: anchor || null,
              text,
              type: 'internal'
            });
          }
        }
      }
    }

    return { internal, external };
  }

  /**
   * Check if a URL is external
   */
  isExternalLink(url) {
    return url.startsWith('http://') ||
           url.startsWith('https://') ||
           url.startsWith('mailto:') ||
           url.startsWith('//');
  }

  /**
   * Resolve a relative link to a document path
   */
  resolveLink(url, sourcePath, docPaths) {
    // Remove anchor
    const [path] = url.split('#');

    // Remove query string
    const cleanPath = path.split('?')[0];

    if (!cleanPath) return null;

    // Resolve relative to source directory
    const sourceDir = dirname(sourcePath);
    let resolved = sourceDir ? join(sourceDir, cleanPath) : cleanPath;

    // Normalize path separators
    resolved = resolved.replace(/\\/g, '/');

    // Try direct match
    if (docPaths.has(resolved)) {
      return url.includes('#') ? `${resolved}#${url.split('#')[1]}` : resolved;
    }

    // Try with .md extension
    if (docPaths.has(resolved + '.md')) {
      const target = resolved + '.md';
      return url.includes('#') ? `${target}#${url.split('#')[1]}` : target;
    }

    // Try with index.md for directory links
    if (docPaths.has(resolved + '/index.md')) {
      const target = resolved + '/index.md';
      return url.includes('#') ? `${target}#${url.split('#')[1]}` : target;
    }

    // Try without leading ./
    const withoutDotSlash = resolved.replace(/^\.\//, '');
    if (docPaths.has(withoutDotSlash)) {
      return url.includes('#') ? `${withoutDotSlash}#${url.split('#')[1]}` : withoutDotSlash;
    }

    return null;
  }

  /**
   * Build node objects for all documents
   */
  buildNodes(documents, edges) {
    // Count in/out links per document
    const inLinks = {};
    const outLinks = {};

    for (const edge of edges) {
      inLinks[edge.target] = (inLinks[edge.target] || 0) + 1;
      outLinks[edge.source] = (outLinks[edge.source] || 0) + 1;
    }

    return documents.map(doc => ({
      path: doc.relativePath,
      title: doc.metadata?.title || this.titleFromPath(doc.relativePath),
      section: this.getSection(doc.relativePath),
      in_links: inLinks[doc.relativePath] || 0,
      out_links: outLinks[doc.relativePath] || 0,
      importance: 1.0, // Will be calculated by PageRank
      word_count: doc.content ? doc.content.split(/\s+/).length : 0
    }));
  }

  /**
   * Calculate PageRank-style importance scores
   */
  calculateImportance(nodes, edges) {
    const n = nodes.length;
    if (n === 0) return;

    // Build adjacency map
    const nodeIndex = {};
    nodes.forEach((node, i) => {
      nodeIndex[node.path] = i;
    });

    // Initialize scores
    const scores = new Array(n).fill(1.0 / n);
    const outDegree = new Array(n).fill(0);

    // Count out-degree
    for (const edge of edges) {
      const sourceIdx = nodeIndex[edge.source];
      if (sourceIdx !== undefined) {
        outDegree[sourceIdx]++;
      }
    }

    // Build link matrix
    const links = {};
    for (const edge of edges) {
      const sourceIdx = nodeIndex[edge.source];
      const targetIdx = nodeIndex[edge.target];

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        if (!links[targetIdx]) links[targetIdx] = [];
        links[targetIdx].push(sourceIdx);
      }
    }

    // PageRank iteration
    for (let iter = 0; iter < this.iterations; iter++) {
      const newScores = new Array(n).fill((1 - this.dampingFactor) / n);

      for (let i = 0; i < n; i++) {
        const incomingNodes = links[i] || [];
        for (const j of incomingNodes) {
          if (outDegree[j] > 0) {
            newScores[i] += this.dampingFactor * scores[j] / outDegree[j];
          }
        }
      }

      // Update scores
      for (let i = 0; i < n; i++) {
        scores[i] = newScores[i];
      }
    }

    // Normalize to 0-100 scale
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore || 1;

    for (let i = 0; i < n; i++) {
      nodes[i].importance = Math.round((scores[i] - minScore) / range * 100);
    }
  }

  /**
   * Analyze graph structure
   */
  analyzeGraph(nodes, edges) {
    // Find hubs (high out-degree)
    const hubs = nodes
      .filter(n => n.out_links >= 5)
      .sort((a, b) => b.out_links - a.out_links)
      .slice(0, 10)
      .map(n => ({ path: n.path, out_links: n.out_links }));

    // Find authorities (high in-degree)
    const authorities = nodes
      .filter(n => n.in_links >= 3)
      .sort((a, b) => b.in_links - a.in_links)
      .slice(0, 10)
      .map(n => ({ path: n.path, in_links: n.in_links }));

    // Find orphans (no incoming links)
    const orphans = nodes
      .filter(n => n.in_links === 0 && n.out_links === 0)
      .map(n => n.path);

    // Find isolated (no links at all)
    const isolated = nodes
      .filter(n => n.in_links === 0 && n.out_links === 0)
      .map(n => n.path);

    // Find most important by PageRank
    const mostImportant = nodes
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10)
      .map(n => ({ path: n.path, importance: n.importance }));

    return {
      total_nodes: nodes.length,
      total_edges: edges.length,
      average_links_per_doc: edges.length / nodes.length || 0,
      hubs,
      authorities,
      orphans,
      isolated_count: isolated.length,
      most_important: mostImportant
    };
  }

  /**
   * Generate section-level graph with heading anchors
   */
  generateSectionGraph(documents, docEdges) {
    const sectionNodes = [];
    const sectionEdges = [];

    for (const doc of documents) {
      // Parse headings from document
      const headings = this.extractHeadings(doc.content || '');

      // Create nodes for each heading
      for (const heading of headings) {
        const nodeId = `${doc.relativePath}#${heading.anchor}`;
        sectionNodes.push({
          id: nodeId,
          doc_path: doc.relativePath,
          title: heading.title,
          level: heading.level,
          anchor: heading.anchor
        });
      }

      // Create edges between sections based on document links
      for (const edge of docEdges) {
        if (edge.source === doc.relativePath && edge.anchor) {
          const sourceId = doc.relativePath;
          const targetId = edge.anchor
            ? `${edge.target}#${edge.anchor}`
            : edge.target;

          sectionEdges.push({
            source: sourceId,
            target: targetId,
            type: 'section-reference'
          });
        }
      }
    }

    // Add parent-child relationships within documents
    for (const doc of documents) {
      const headings = this.extractHeadings(doc.content || '');
      const stack = [];

      for (const heading of headings) {
        // Pop headings that are at same or higher level
        while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
          stack.pop();
        }

        // Create parent-child edge
        if (stack.length > 0) {
          const parent = stack[stack.length - 1];
          sectionEdges.push({
            source: `${doc.relativePath}#${parent.anchor}`,
            target: `${doc.relativePath}#${heading.anchor}`,
            type: 'parent-child'
          });
        }

        stack.push(heading);
      }
    }

    return {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      nodes: sectionNodes,
      edges: sectionEdges,
      statistics: {
        total_sections: sectionNodes.length,
        total_section_edges: sectionEdges.length
      }
    };
  }

  /**
   * Extract headings from content
   */
  extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        const anchor = this.createAnchor(title);

        headings.push({ level, title, anchor });
      }
    }

    return headings;
  }

  /**
   * Create URL-safe anchor from heading title
   */
  createAnchor(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Get section name from path
   */
  getSection(relativePath) {
    const parts = relativePath.split('/');
    return parts.length > 1 ? parts[0] : 'root';
  }

  /**
   * Extract title from path
   */
  titleFromPath(relativePath) {
    const parts = relativePath.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
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
