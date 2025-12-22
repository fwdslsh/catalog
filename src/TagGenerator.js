import { writeFile } from "fs/promises";
import { join, basename, dirname } from "path";

/**
 * TagGenerator - Rule-based semantic tagging (zero model calls)
 *
 * Provides basic semantics for routing/retrieval without provider calls.
 * Tags are assigned based on path patterns, keywords, and frontmatter fields.
 *
 * @example
 * const tagger = new TagGenerator(outputDir, { customRules: [...] });
 * const tags = await tagger.generate(documents);
 */
export class TagGenerator {
  /**
   * Default path-based tagging rules
   * Pattern matches are case-insensitive
   */
  static PATH_RULES = [
    { pattern: /^api\//i, tag: 'api-reference' },
    { pattern: /^docs?\//i, tag: 'documentation' },
    { pattern: /^guide[s]?\//i, tag: 'guide' },
    { pattern: /^tutorial[s]?\//i, tag: 'tutorial' },
    { pattern: /^example[s]?\//i, tag: 'example' },
    { pattern: /^reference\//i, tag: 'reference' },
    { pattern: /^faq\//i, tag: 'faq' },
    { pattern: /^blog\//i, tag: 'blog' },
    { pattern: /^changelog/i, tag: 'changelog' },
    { pattern: /^release/i, tag: 'release-notes' },
    { pattern: /^config/i, tag: 'configuration' },
    { pattern: /^install/i, tag: 'installation' },
    { pattern: /^deploy/i, tag: 'deployment' },
    { pattern: /^test/i, tag: 'testing' },
    { pattern: /^security/i, tag: 'security' },
    { pattern: /^troubleshoot/i, tag: 'troubleshooting' },
    { pattern: /^migration/i, tag: 'migration' },
    { pattern: /^upgrade/i, tag: 'upgrade' },
    { pattern: /^internal\//i, tag: 'internal' },
    { pattern: /^draft/i, tag: 'draft' },
    { pattern: /^archive/i, tag: 'archived' }
  ];

  /**
   * Default keyword-based tagging rules
   * Keywords are matched in title, description, and content
   */
  static KEYWORD_RULES = [
    // Getting Started / Intro
    { keywords: ['getting started', 'get started', 'quick start', 'quickstart'], tag: 'getting-started' },
    { keywords: ['introduction', 'intro', 'overview', 'about'], tag: 'introduction' },

    // Tutorials & Guides
    { keywords: ['tutorial', 'walkthrough', 'step by step', 'step-by-step'], tag: 'tutorial' },
    { keywords: ['how to', 'how-to', 'howto'], tag: 'how-to' },
    { keywords: ['best practice', 'best practices'], tag: 'best-practices' },

    // API & Reference
    { keywords: ['api reference', 'api docs', 'api documentation'], tag: 'api-reference' },
    { keywords: ['endpoint', 'endpoints', 'route', 'routes'], tag: 'api-endpoints' },
    { keywords: ['authentication', 'auth', 'oauth', 'jwt'], tag: 'authentication' },
    { keywords: ['authorization', 'permissions', 'rbac', 'acl'], tag: 'authorization' },

    // Technical
    { keywords: ['configuration', 'config', 'settings', 'options'], tag: 'configuration' },
    { keywords: ['installation', 'install', 'setup'], tag: 'installation' },
    { keywords: ['deployment', 'deploy', 'hosting'], tag: 'deployment' },
    { keywords: ['testing', 'test', 'tests', 'unit test', 'integration test'], tag: 'testing' },
    { keywords: ['debugging', 'debug', 'troubleshoot', 'troubleshooting'], tag: 'troubleshooting' },
    { keywords: ['performance', 'optimization', 'optimize'], tag: 'performance' },
    { keywords: ['security', 'secure', 'vulnerability', 'vulnerabilities'], tag: 'security' },

    // Architecture & Design
    { keywords: ['architecture', 'design', 'system design'], tag: 'architecture' },
    { keywords: ['data model', 'schema', 'database'], tag: 'data-model' },
    { keywords: ['component', 'components'], tag: 'components' },
    { keywords: ['plugin', 'plugins', 'extension', 'extensions'], tag: 'plugins' },

    // Updates & Changes
    { keywords: ['changelog', 'change log', 'release notes', 'what\'s new'], tag: 'changelog' },
    { keywords: ['migration', 'migrate', 'upgrade', 'upgrading'], tag: 'migration' },
    { keywords: ['breaking change', 'breaking changes'], tag: 'breaking-changes' },
    { keywords: ['deprecation', 'deprecated'], tag: 'deprecated' },

    // Content Types
    { keywords: ['example', 'examples', 'sample', 'samples', 'demo'], tag: 'examples' },
    { keywords: ['faq', 'frequently asked', 'common questions'], tag: 'faq' },
    { keywords: ['glossary', 'terminology', 'terms'], tag: 'glossary' },
    { keywords: ['appendix', 'reference'], tag: 'reference' },

    // Code-related
    { keywords: ['cli', 'command line', 'command-line', 'terminal'], tag: 'cli' },
    { keywords: ['sdk', 'library', 'libraries', 'client'], tag: 'sdk' },
    { keywords: ['webhook', 'webhooks', 'callback', 'callbacks'], tag: 'webhooks' },
    { keywords: ['error', 'errors', 'error handling', 'exceptions'], tag: 'error-handling' }
  ];

  /**
   * Default filename-based tagging rules
   */
  static FILENAME_RULES = [
    { pattern: /^readme/i, tag: 'readme' },
    { pattern: /^index/i, tag: 'index' },
    { pattern: /^changelog/i, tag: 'changelog' },
    { pattern: /^contributing/i, tag: 'contributing' },
    { pattern: /^license/i, tag: 'license' },
    { pattern: /^code[_-]?of[_-]?conduct/i, tag: 'code-of-conduct' },
    { pattern: /^security/i, tag: 'security' }
  ];

  /**
   * Create a new TagGenerator instance
   *
   * @param {string} outputDir - Destination directory for tag files
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {Array} [options.customPathRules=[]] - Additional path-based rules
   * @param {Array} [options.customKeywordRules=[]] - Additional keyword-based rules
   * @param {Array} [options.customFilenameRules=[]] - Additional filename-based rules
   * @param {boolean} [options.includeContentKeywords=true] - Scan content for keywords
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.includeContentKeywords = options.includeContentKeywords !== false;

    // Merge custom rules with defaults
    this.pathRules = [...TagGenerator.PATH_RULES, ...(options.customPathRules || [])];
    this.keywordRules = [...TagGenerator.KEYWORD_RULES, ...(options.customKeywordRules || [])];
    this.filenameRules = [...TagGenerator.FILENAME_RULES, ...(options.customFilenameRules || [])];
  }

  /**
   * Generate tags for all documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @returns {Promise<Object>} Tag assignments keyed by document path
   */
  async generate(documents) {
    const tagAssignments = {};
    const tagStats = {};

    for (const doc of documents) {
      const tags = this.tagDocument(doc);
      tagAssignments[doc.relativePath] = tags;

      // Track tag statistics
      for (const tag of tags) {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      }
    }

    // Write tags.json
    const tagsPath = join(this.outputDir, 'tags.json');
    const tagsOutput = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      documents: tagAssignments,
      statistics: {
        total_documents: documents.length,
        total_unique_tags: Object.keys(tagStats).length,
        tag_counts: tagStats
      }
    };
    await writeFile(tagsPath, JSON.stringify(tagsOutput, null, 2), 'utf8');

    // Write tags-by-tag.json (inverted index)
    const invertedIndex = this.buildInvertedIndex(tagAssignments);
    const invertedPath = join(this.outputDir, 'tags-by-tag.json');
    await writeFile(invertedPath, JSON.stringify(invertedIndex, null, 2), 'utf8');

    this.log(`✔ tags.json (${Object.keys(tagStats).length} unique tags)`);

    return tagAssignments;
  }

  /**
   * Tag a single document
   *
   * @param {Object} doc - Document object
   * @returns {Array<string>} Array of tags
   */
  tagDocument(doc) {
    const tags = new Set();

    // 1. Path-based tagging
    this.applyPathRules(doc.relativePath, tags);

    // 2. Filename-based tagging
    this.applyFilenameRules(doc.relativePath, tags);

    // 3. Frontmatter-based tagging
    this.applyFrontmatterTags(doc.metadata, tags);

    // 4. Keyword-based tagging (title, description, content)
    this.applyKeywordRules(doc, tags);

    // 5. Auto-detect content characteristics
    this.detectContentCharacteristics(doc, tags);

    return Array.from(tags).sort();
  }

  /**
   * Apply path-based tagging rules
   */
  applyPathRules(relativePath, tags) {
    for (const rule of this.pathRules) {
      if (rule.pattern.test(relativePath)) {
        tags.add(rule.tag);
      }
    }
  }

  /**
   * Apply filename-based tagging rules
   */
  applyFilenameRules(relativePath, tags) {
    const filename = basename(relativePath);
    for (const rule of this.filenameRules) {
      if (rule.pattern.test(filename)) {
        tags.add(rule.tag);
      }
    }
  }

  /**
   * Apply tags from frontmatter metadata
   */
  applyFrontmatterTags(metadata, tags) {
    if (!metadata) return;

    // Direct tags field
    if (metadata.tags) {
      const frontmatterTags = Array.isArray(metadata.tags)
        ? metadata.tags
        : String(metadata.tags).split(',').map(t => t.trim());

      for (const tag of frontmatterTags) {
        if (tag) {
          tags.add(this.normalizeTag(tag));
        }
      }
    }

    // Categories field
    if (metadata.categories) {
      const categories = Array.isArray(metadata.categories)
        ? metadata.categories
        : String(metadata.categories).split(',').map(t => t.trim());

      for (const category of categories) {
        if (category) {
          tags.add(this.normalizeTag(category));
        }
      }
    }

    // Type field
    if (metadata.type) {
      tags.add(this.normalizeTag(metadata.type));
    }

    // Audience field
    if (metadata.audience) {
      tags.add(`audience:${this.normalizeTag(metadata.audience)}`);
    }

    // Difficulty/level field
    if (metadata.difficulty || metadata.level) {
      const level = metadata.difficulty || metadata.level;
      tags.add(`level:${this.normalizeTag(level)}`);
    }
  }

  /**
   * Apply keyword-based tagging rules
   */
  applyKeywordRules(doc, tags) {
    // Build searchable text
    const title = doc.metadata?.title || '';
    const description = doc.metadata?.description || doc.metadata?.notes || '';
    const content = this.includeContentKeywords ? (doc.content || '') : '';

    // Combine and lowercase for matching
    const searchText = `${title} ${description} ${content}`.toLowerCase();

    for (const rule of this.keywordRules) {
      for (const keyword of rule.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          tags.add(rule.tag);
          break; // Only add tag once per rule
        }
      }
    }
  }

  /**
   * Auto-detect content characteristics
   */
  detectContentCharacteristics(doc, tags) {
    const content = doc.content || '';

    // Has code blocks
    if (/```[\s\S]*?```/.test(content)) {
      tags.add('has-code');

      // Detect specific languages
      const languages = this.detectCodeLanguages(content);
      for (const lang of languages) {
        tags.add(`lang:${lang}`);
      }
    }

    // Has tables
    if (/\|.*\|.*\|/.test(content) && /\|[-:]+\|/.test(content)) {
      tags.add('has-tables');
    }

    // Has images
    if (/!\[.*?\]\(.*?\)/.test(content)) {
      tags.add('has-images');
    }

    // Has links
    if (/\[.*?\]\(.*?\)/.test(content)) {
      tags.add('has-links');
    }

    // Is primarily code (>50% code blocks)
    const codeMatches = content.match(/```[\s\S]*?```/g) || [];
    const codeLength = codeMatches.reduce((sum, m) => sum + m.length, 0);
    if (codeLength > content.length * 0.5) {
      tags.add('code-heavy');
    }

    // Is Q&A format
    if (/^#+\s*(Q:|Question:|FAQ)/mi.test(content) ||
        /\*\*Q:\*\*|<strong>Q:<\/strong>/i.test(content)) {
      tags.add('qa-format');
    }

    // Has numbered steps
    if (/^\d+\.\s+/m.test(content) && (content.match(/^\d+\.\s+/gm) || []).length >= 3) {
      tags.add('step-by-step');
    }

    // Content length classification
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 200) {
      tags.add('length:short');
    } else if (wordCount > 2000) {
      tags.add('length:long');
    } else {
      tags.add('length:medium');
    }
  }

  /**
   * Detect programming languages in code blocks
   */
  detectCodeLanguages(content) {
    const languages = new Set();
    const codeBlockMatches = content.matchAll(/```(\w+)/g);

    for (const match of codeBlockMatches) {
      if (match[1]) {
        languages.add(match[1].toLowerCase());
      }
    }

    return Array.from(languages);
  }

  /**
   * Build inverted index (tag → documents)
   */
  buildInvertedIndex(tagAssignments) {
    const index = {};

    for (const [docPath, tags] of Object.entries(tagAssignments)) {
      for (const tag of tags) {
        if (!index[tag]) {
          index[tag] = [];
        }
        index[tag].push(docPath);
      }
    }

    // Sort document lists
    for (const tag of Object.keys(index)) {
      index[tag].sort();
    }

    return {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      tags: index
    };
  }

  /**
   * Normalize a tag string
   */
  normalizeTag(tag) {
    return String(tag)
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9:-]/g, '');
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
