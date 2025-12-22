import { writeFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

/**
 * ChunkGenerator - Deterministic chunking with citations
 *
 * Provides the foundation for high-quality memory/RAG and precise citations.
 * Chunks are based on heading-level semantic breaks with stable IDs.
 *
 * @example
 * const chunker = new ChunkGenerator(outputDir, { profile: 'default' });
 * const chunks = await chunker.generate(documents);
 */
export class ChunkGenerator {
  /**
   * Chunking profiles with different strategies
   */
  static PROFILES = {
    // Default: heading-based chunks ~800-1200 tokens
    default: {
      name: 'default',
      targetTokens: 1000,
      minTokens: 200,
      maxTokens: 1500,
      splitOnHeadings: true,
      preserveCodeBlocks: true,
      preserveLists: true
    },
    // Code-heavy: don't split code fences
    'code-heavy': {
      name: 'code-heavy',
      targetTokens: 1200,
      minTokens: 300,
      maxTokens: 2000,
      splitOnHeadings: true,
      preserveCodeBlocks: true,
      preserveLists: true,
      codeBlockWeight: 0.5 // Count code as fewer tokens
    },
    // FAQ: one Q/A per chunk
    faq: {
      name: 'faq',
      targetTokens: 500,
      minTokens: 50,
      maxTokens: 800,
      splitOnHeadings: true,
      splitOnQA: true,
      preserveCodeBlocks: true,
      preserveLists: false
    },
    // Large context: bigger chunks for models with large context
    'large-context': {
      name: 'large-context',
      targetTokens: 3000,
      minTokens: 500,
      maxTokens: 5000,
      splitOnHeadings: true,
      preserveCodeBlocks: true,
      preserveLists: true
    },
    // Granular: smaller chunks for precise retrieval
    granular: {
      name: 'granular',
      targetTokens: 400,
      minTokens: 100,
      maxTokens: 600,
      splitOnHeadings: true,
      splitOnParagraphs: true,
      preserveCodeBlocks: true,
      preserveLists: false
    }
  };

  /**
   * Create a new ChunkGenerator instance
   *
   * @param {string} outputDir - Destination directory for chunk files
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {string} [options.profile='default'] - Chunking profile name
   * @param {Object} [options.customProfile=null] - Custom profile settings
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.profileName = options.profile || 'default';
    this.profile = options.customProfile || ChunkGenerator.PROFILES[this.profileName] || ChunkGenerator.PROFILES.default;
  }

  /**
   * Generate chunks for all documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @returns {Promise<Array<Object>>} Array of chunk objects
   */
  async generate(documents) {
    const allChunks = [];

    for (const doc of documents) {
      const docChunks = this.chunkDocument(doc);
      allChunks.push(...docChunks);
    }

    // Write chunks.jsonl (one JSON object per line)
    const chunksPath = join(this.outputDir, 'chunks.jsonl');
    const jsonlContent = allChunks.map(chunk => JSON.stringify(chunk)).join('\n');
    await writeFile(chunksPath, jsonlContent, 'utf8');

    // Write chunks metadata
    const metadataPath = join(this.outputDir, 'chunks.meta.json');
    const metadata = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      profile: this.profile.name,
      profile_settings: this.profile,
      statistics: {
        total_chunks: allChunks.length,
        total_documents: documents.length,
        average_chunk_size: Math.round(
          allChunks.reduce((sum, c) => sum + c.content.length, 0) / allChunks.length
        ),
        average_chunks_per_doc: Math.round(allChunks.length / documents.length * 10) / 10
      }
    };
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    this.log(`✔ chunks.jsonl (${allChunks.length} chunks, profile: ${this.profile.name})`);

    return allChunks;
  }

  /**
   * Chunk a single document
   *
   * @param {Object} doc - Document object
   * @returns {Array<Object>} Array of chunk objects for this document
   */
  chunkDocument(doc) {
    const content = doc.content || '';
    const docHash = this.sha256(doc.relativePath + content).substring(0, 8);

    // Parse document structure
    const structure = this.parseStructure(content);

    // Create chunks based on structure
    const chunks = [];
    let chunkIndex = 0;

    for (const section of structure.sections) {
      const sectionChunks = this.chunkSection(section, {
        doc,
        docHash,
        startIndex: chunkIndex
      });

      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }

    // Handle remaining content not in sections
    if (structure.preamble && structure.preamble.trim().length > 0) {
      const preambleChunks = this.createChunks(structure.preamble, {
        doc,
        docHash,
        headingPath: [],
        startIndex: chunkIndex,
        lineOffset: 0
      });
      chunks.unshift(...preambleChunks);
    }

    return chunks;
  }

  /**
   * Parse document structure into sections based on headings
   *
   * @param {string} content - Document content
   * @returns {Object} Parsed structure with sections
   */
  parseStructure(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;
    let preamble = [];
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Check for heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        } else if (preamble.length > 0) {
          // Save preamble
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        currentSection = {
          level,
          title,
          anchor: this.createAnchor(title),
          content: [],
          startLine: lineNumber,
          endLine: lineNumber
        };
      } else if (currentSection) {
        currentSection.content.push(line);
        currentSection.endLine = lineNumber;
      } else {
        preamble.push(line);
      }
    }

    // Push final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      preamble: preamble.join('\n'),
      sections: this.nestSections(sections)
    };
  }

  /**
   * Nest sections based on heading level
   */
  nestSections(flatSections) {
    // For chunking purposes, we keep sections flat but track hierarchy
    return flatSections.map(section => ({
      ...section,
      content: section.content.join('\n')
    }));
  }

  /**
   * Chunk a section and its subsections
   */
  chunkSection(section, options) {
    const { doc, docHash, startIndex } = options;
    const headingPath = [section.anchor];

    return this.createChunks(section.content, {
      doc,
      docHash,
      headingPath,
      startIndex,
      lineOffset: section.startLine,
      sectionTitle: section.title,
      sectionLevel: section.level
    });
  }

  /**
   * Create chunks from content based on profile settings
   *
   * @param {string} content - Content to chunk
   * @param {Object} options - Chunking options
   * @returns {Array<Object>} Array of chunks
   */
  createChunks(content, options) {
    const { doc, docHash, headingPath = [], startIndex = 0, lineOffset = 0 } = options;

    if (!content || content.trim().length === 0) {
      return [];
    }

    const chunks = [];
    const paragraphs = this.splitIntoParagraphs(content);

    let currentChunk = {
      content: [],
      tokens: 0,
      startLine: lineOffset,
      endLine: lineOffset
    };

    let chunkIndex = startIndex;
    let currentLine = lineOffset;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph.content);
      const paragraphLines = paragraph.content.split('\n').length;

      // Check if this paragraph is a code block
      const isCodeBlock = this.isCodeBlock(paragraph.content);

      // Decide whether to add to current chunk or start new one
      if (currentChunk.tokens + paragraphTokens > this.profile.maxTokens && currentChunk.content.length > 0) {
        // Finalize current chunk
        chunks.push(this.finalizeChunk(currentChunk, {
          doc,
          docHash,
          headingPath,
          chunkIndex: chunkIndex++,
          ...options
        }));

        // Start new chunk
        currentChunk = {
          content: [],
          tokens: 0,
          startLine: currentLine,
          endLine: currentLine
        };
      }

      // Add paragraph to current chunk
      currentChunk.content.push(paragraph.content);
      currentChunk.tokens += paragraphTokens;
      currentChunk.endLine = currentLine + paragraphLines;
      currentLine += paragraphLines;

      // If we're at target size and not in middle of code block, consider splitting
      if (currentChunk.tokens >= this.profile.targetTokens &&
          !isCodeBlock &&
          currentChunk.content.length > 0) {
        chunks.push(this.finalizeChunk(currentChunk, {
          doc,
          docHash,
          headingPath,
          chunkIndex: chunkIndex++,
          ...options
        }));

        currentChunk = {
          content: [],
          tokens: 0,
          startLine: currentLine,
          endLine: currentLine
        };
      }
    }

    // Finalize remaining content
    if (currentChunk.content.length > 0) {
      chunks.push(this.finalizeChunk(currentChunk, {
        doc,
        docHash,
        headingPath,
        chunkIndex,
        ...options
      }));
    }

    return chunks;
  }

  /**
   * Finalize a chunk with metadata
   */
  finalizeChunk(chunk, options) {
    const { doc, docHash, headingPath, chunkIndex, sectionTitle, sectionLevel } = options;

    const content = chunk.content.join('\n\n').trim();
    const chunkId = this.generateChunkId(docHash, headingPath, chunkIndex);

    return {
      // Stable identification
      chunk_id: chunkId,
      doc_id: docHash,

      // Content
      content,
      token_count: this.estimateTokens(content),

      // Citation information
      source_path: doc.relativePath,
      heading_path: headingPath.join(' > '),
      section_title: sectionTitle || null,
      section_level: sectionLevel || null,

      // Position
      line_range: {
        start: chunk.startLine,
        end: chunk.endLine
      },
      byte_range: {
        start: this.getByteOffset(doc.content, chunk.startLine),
        end: this.getByteOffset(doc.content, chunk.endLine)
      },
      chunk_index: chunkIndex,

      // Metadata
      has_code: this.hasCode(content),
      has_list: this.hasList(content),
      language_hints: this.detectLanguages(content)
    };
  }

  /**
   * Generate stable chunk ID
   */
  generateChunkId(docHash, headingPath, chunkIndex) {
    const pathStr = headingPath.join('/');
    const input = `${docHash}:${pathStr}:${chunkIndex}`;
    return this.sha256(input).substring(0, 16);
  }

  /**
   * Split content into paragraphs, preserving code blocks
   */
  splitIntoParagraphs(content) {
    const paragraphs = [];
    const lines = content.split('\n');

    let currentParagraph = [];
    let inCodeBlock = false;
    let codeBlockStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for code block boundaries
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting code block - save current paragraph first
          if (currentParagraph.length > 0) {
            paragraphs.push({
              content: currentParagraph.join('\n'),
              type: 'text',
              lineStart: i - currentParagraph.length
            });
            currentParagraph = [];
          }
          inCodeBlock = true;
          codeBlockStart = i;
        } else {
          // Ending code block
          currentParagraph.push(line);
          paragraphs.push({
            content: currentParagraph.join('\n'),
            type: 'code',
            lineStart: codeBlockStart
          });
          currentParagraph = [];
          inCodeBlock = false;
        }
        if (inCodeBlock) {
          currentParagraph.push(line);
        }
        continue;
      }

      if (inCodeBlock) {
        currentParagraph.push(line);
        continue;
      }

      // Empty line marks paragraph boundary (not in code block)
      if (line.trim() === '') {
        if (currentParagraph.length > 0) {
          paragraphs.push({
            content: currentParagraph.join('\n'),
            type: 'text',
            lineStart: i - currentParagraph.length
          });
          currentParagraph = [];
        }
      } else {
        currentParagraph.push(line);
      }
    }

    // Handle remaining content
    if (currentParagraph.length > 0) {
      paragraphs.push({
        content: currentParagraph.join('\n'),
        type: inCodeBlock ? 'code' : 'text',
        lineStart: lines.length - currentParagraph.length
      });
    }

    return paragraphs;
  }

  /**
   * Estimate token count (rough approximation: 4 chars = 1 token)
   */
  estimateTokens(content) {
    if (!content) return 0;

    // Use profile-specific code weight if applicable
    if (this.profile.codeBlockWeight && this.isCodeBlock(content)) {
      return Math.ceil(content.length / 4 * this.profile.codeBlockWeight);
    }

    return Math.ceil(content.length / 4);
  }

  /**
   * Check if content is a code block
   */
  isCodeBlock(content) {
    return content.startsWith('```') && content.includes('\n```');
  }

  /**
   * Check if content contains code
   */
  hasCode(content) {
    return /```[\s\S]*?```/.test(content) || /`[^`]+`/.test(content);
  }

  /**
   * Check if content contains lists
   */
  hasList(content) {
    return /^[-*+]\s/m.test(content) || /^\d+\.\s/m.test(content);
  }

  /**
   * Detect programming languages in code blocks
   */
  detectLanguages(content) {
    const languages = [];
    const codeBlockMatches = content.matchAll(/```(\w+)?/g);

    for (const match of codeBlockMatches) {
      if (match[1] && !languages.includes(match[1])) {
        languages.push(match[1]);
      }
    }

    return languages;
  }

  /**
   * Get byte offset for a line number
   */
  getByteOffset(content, lineNumber) {
    if (!content) return 0;
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    return offset;
  }

  /**
   * Create URL-safe anchor from heading
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
   * SHA256 hash
   */
  sha256(content) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
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
