import { writeFile } from "fs/promises";
import { join } from "path";

/**
 * Validator - Validates llms.txt files for compliance with official standard
 *
 * Ensures generated llms.txt files follow the proper format:
 * - H1 heading followed by blockquote summary
 * - Proper section structure with H2 headings
 * - Correct link format with optional descriptions
 * - Optional section placement (must be last)
 *
 * Extended with AI readiness checks:
 * - Code fence integrity
 * - Link health (internal links resolve)
 * - Redundancy detection
 * - Secrets/PII scanning
 * - Chunk quality checks
 *
 * @example
 * const validator = new Validator({ silent: false });
 * const result = validator.validateStructure(llmsContent);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.issues);
 * }
 */
export class Validator {
  /**
   * Common secret patterns to detect
   */
  static SECRET_PATTERNS = [
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
    { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g },
    { name: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9]{36}/g },
    { name: 'GitHub OAuth', pattern: /gho_[A-Za-z0-9]{36}/g },
    { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[a-zA-Z0-9]{24}/g },
    { name: 'Slack Webhook', pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
    { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
    { name: 'API Key Pattern', pattern: /api[_-]?key['":\s]*[=:]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi },
    { name: 'Bearer Token', pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/g },
    { name: 'Password Pattern', pattern: /password['":\s]*[=:]\s*['"][^'"]{8,}['"]/gi },
    { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g },
    { name: 'Generic Secret', pattern: /secret['":\s]*[=:]\s*['"]?[A-Za-z0-9_-]{16,}['"]?/gi },
    { name: 'Anthropic API Key', pattern: /sk-ant-[A-Za-z0-9_-]{40,}/g },
    { name: 'OpenAI API Key', pattern: /sk-[A-Za-z0-9]{40,}/g },
    { name: 'Stripe Key', pattern: /(sk|pk)_(test|live)_[A-Za-z0-9]{24,}/g },
    { name: 'SendGrid Key', pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g }
  ];

  /**
   * PII patterns to detect
   */
  static PII_PATTERNS = [
    { name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'Phone Number (US)', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
    { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
    { name: 'Credit Card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
    { name: 'IP Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g }
  ];
  /**
   * Create a new Validator instance
   *
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   */
  constructor(options = {}) {
    this.silent = options.silent || false;
  }

  /**
   * Validate llms.txt structure compliance with official standard
   *
   * Checks for:
   * - Valid H1 heading at start
   * - Valid blockquote summary after H1
   * - No headings in details section
   * - Proper section structure (H2 headings)
   * - Correct link format
   * - Optional section placement
   *
   * @param {string} content - The llms.txt file content to validate
   * @returns {{valid: boolean, issues: string[]}} Validation result with any issues found
   *
   * @example
   * const result = validator.validateStructure(fileContent);
   * if (result.valid) {
   *   console.log('llms.txt is valid!');
   * } else {
   *   result.issues.forEach(issue => console.error(issue));
   * }
   */
  validateStructure(content) {
    const issues = [];

    // Check H1 presence and format
    if (!this.hasValidH1(content)) {
      issues.push('Missing or invalid H1 heading at start of file');
    }

    // Check blockquote presence
    if (!this.hasValidBlockquote(content)) {
      issues.push('Missing or invalid blockquote summary after H1');
    }

    // Validate no headings in details section
    const detailsIssues = this.validateDetailsSection(content);
    issues.push(...detailsIssues);

    // Validate section structure
    const sectionIssues = this.validateSections(content);
    issues.push(...sectionIssues);

    // Validate link format
    const linkIssues = this.validateLinks(content);
    issues.push(...linkIssues);

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Check if content has valid H1 heading at start
   */
  hasValidH1(content) {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim() !== '');
    
    if (!firstNonEmptyLine) {
      return false;
    }

    return /^# .+/.test(firstNonEmptyLine.trim());
  }

  /**
   * Check if content has valid blockquote after H1
   */
  hasValidBlockquote(content) {
    const lines = content.split('\n');
    let foundH1 = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!foundH1 && /^# .+/.test(trimmed)) {
        foundH1 = true;
        continue;
      }
      
      if (foundH1 && trimmed !== '') {
        return /^> .+/.test(trimmed);
      }
    }
    
    return false;
  }

  /**
   * Validate that details section has no headings
   */
  validateDetailsSection(content) {
    const issues = [];
    const lines = content.split('\n');
    
    let pastBlockquote = false;
    let foundFirstSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Mark when we've passed the blockquote
      if (/^> .+/.test(line)) {
        pastBlockquote = true;
        continue;
      }
      
      // First H2 marks end of details section
      if (/^## .+/.test(line)) {
        foundFirstSection = true;
        continue;
      }
      
      // Check for illegal headings in details section (after blockquote, before first H2)
      if (pastBlockquote && !foundFirstSection && /^#{2,6} .+/.test(line)) {
        issues.push(`Illegal heading in details section at line ${i + 1}: "${line}"`);
      }
    }
    
    return issues;
  }

  /**
   * Validate H2 section structure and naming
   */
  validateSections(content) {
    const issues = [];
    const lines = content.split('\n');
    const sections = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (/^## (.+)/.test(line)) {
        const match = line.match(/^## (.+)/);
        const sectionName = match[1];
        sections.push({ name: sectionName, line: i + 1 });
      }
    }
    
    // Check for at least one non-Optional section
    const nonOptionalSections = sections.filter(s => s.name !== 'Optional');
    if (nonOptionalSections.length === 0) {
      issues.push('Must have at least one non-Optional section');
    }
    
    // Check Optional section spelling and placement
    const optionalSections = sections.filter(s => s.name === 'Optional');
    if (optionalSections.length > 1) {
      issues.push('Multiple Optional sections found');
    } else if (optionalSections.length === 1) {
      const optionalSection = optionalSections[0];
      const lastSection = sections[sections.length - 1];
      
      if (optionalSection !== lastSection) {
        issues.push('Optional section must be the last section');
      }
    }
    
    return issues;
  }

  /**
   * Validate link format compliance
   */
  validateLinks(content) {
    const issues = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for list items that should be links
      if (/^- /.test(line)) {
        // Must be a link format
        if (!/^- \[.+\]\(.+\)/.test(line)) {
          issues.push(`Invalid link format at line ${i + 1}: "${line}"`);
        } else {
          // Validate link format details
          const linkMatch = line.match(/^- \[(.+)\]\((.+)\)(.*)$/);
          if (linkMatch) {
            const [, linkText, url, notes] = linkMatch;
            
            // Check for empty link text
            if (!linkText.trim()) {
              issues.push(`Empty link text at line ${i + 1}`);
            }
            
            // Check for empty URL
            if (!url.trim()) {
              issues.push(`Empty URL at line ${i + 1}`);
            }
            
            // Validate notes format if present
            if (notes && !/^: .+/.test(notes)) {
              issues.push(`Invalid notes format at line ${i + 1}. Notes must start with ": "`);
            }
          }
        }
      }
    }
    
    return issues;
  }

  /**
   * Validate that all URLs are absolute when base URL is provided
   */
  validateAbsoluteUrls(content, baseUrl) {
    if (!baseUrl) {
      return { valid: true, issues: [] };
    }

    const issues = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (/^- \[.+\]\(.+\)/.test(line)) {
        const linkMatch = line.match(/^- \[.+\]\((.+)\)/);
        if (linkMatch) {
          const url = linkMatch[1];
          
          // Check if URL is absolute
          if (!this.isAbsoluteUrl(url)) {
            issues.push(`Relative URL found when base URL provided at line ${i + 1}: "${url}"`);
          }
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Check if a URL is absolute
   */
  isAbsoluteUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log a message if not in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }

  // ==========================================
  // AI READINESS VALIDATION METHODS
  // ==========================================

  /**
   * Perform comprehensive AI readiness validation
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [options={}] - Validation options
   * @param {Object} [options.chunks=null] - Chunk data if available
   * @param {Set} [options.docPaths=null] - Set of valid document paths for link checking
   * @returns {Object} Validation report
   */
  async validateAIReadiness(documents, options = {}) {
    const { chunks = null, docPaths = null } = options;

    const report = {
      valid: true,
      timestamp: new Date().toISOString(),
      summary: {
        documents_checked: documents.length,
        issues_found: 0,
        warnings: 0,
        errors: 0
      },
      code_fence_issues: [],
      link_issues: [],
      redundancy_issues: [],
      security_issues: [],
      chunk_quality_issues: [],
      recommendations: []
    };

    // 1. Check code fence integrity
    for (const doc of documents) {
      const fenceIssues = this.validateCodeFences(doc);
      report.code_fence_issues.push(...fenceIssues);
    }

    // 2. Check internal link health
    if (docPaths) {
      for (const doc of documents) {
        const linkIssues = this.validateInternalLinks(doc, docPaths);
        report.link_issues.push(...linkIssues);
      }
    }

    // 3. Check for redundant content
    const redundancy = this.detectRedundancy(documents);
    report.redundancy_issues = redundancy;

    // 4. Scan for secrets and PII
    for (const doc of documents) {
      const securityIssues = this.scanForSecrets(doc);
      report.security_issues.push(...securityIssues);
    }

    // 5. Validate chunk quality if chunks provided
    if (chunks && chunks.length > 0) {
      const chunkIssues = this.validateChunkQuality(chunks);
      report.chunk_quality_issues = chunkIssues;
    }

    // Calculate totals
    const allIssues = [
      ...report.code_fence_issues,
      ...report.link_issues,
      ...report.redundancy_issues,
      ...report.security_issues,
      ...report.chunk_quality_issues
    ];

    report.summary.issues_found = allIssues.length;
    report.summary.errors = allIssues.filter(i => i.severity === 'error').length;
    report.summary.warnings = allIssues.filter(i => i.severity === 'warning').length;
    report.valid = report.summary.errors === 0;

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate a JSON report file
   *
   * @param {Object} report - Validation report
   * @param {string} outputDir - Output directory
   * @returns {Promise<void>}
   */
  async writeReport(report, outputDir) {
    const reportPath = join(outputDir, 'catalog.report.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    this.log(`✔ catalog.report.json generated`);
  }

  /**
   * Validate code fence integrity in a document
   *
   * @param {Object} doc - Document object
   * @returns {Array} Array of issues
   */
  validateCodeFences(doc) {
    const issues = [];
    const content = doc.content || '';
    const lines = content.split('\n');

    let inCodeBlock = false;
    let codeBlockStartLine = 0;
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for code fence
      const fenceMatch = line.match(/^(\s*)(```+)(\w*)/);

      if (fenceMatch) {
        const [, indent, backticks, language] = fenceMatch;

        if (!inCodeBlock) {
          // Opening fence
          inCodeBlock = true;
          codeBlockStartLine = lineNum;
          codeBlockLanguage = language;

          // Check for unusual indentation
          if (indent.length > 0 && !content.includes('- ') && !content.includes('1. ')) {
            issues.push({
              type: 'code_fence_indentation',
              severity: 'warning',
              document: doc.relativePath,
              line: lineNum,
              message: `Code fence has unusual indentation (${indent.length} spaces)`
            });
          }
        } else {
          // Closing fence
          inCodeBlock = false;
        }
      }

      // Check for inline code with backticks that might be malformed
      if (!inCodeBlock) {
        const inlineCodeMatches = line.match(/`[^`]*$/);
        if (inlineCodeMatches && !line.includes('```')) {
          // Possible unclosed inline code
          // Check if it's closed on the same line
          const openBackticks = (line.match(/`/g) || []).length;
          if (openBackticks % 2 !== 0) {
            issues.push({
              type: 'unclosed_inline_code',
              severity: 'warning',
              document: doc.relativePath,
              line: lineNum,
              message: 'Possible unclosed inline code block'
            });
          }
        }
      }
    }

    // Check for unclosed code block at end of document
    if (inCodeBlock) {
      issues.push({
        type: 'unclosed_code_fence',
        severity: 'error',
        document: doc.relativePath,
        line: codeBlockStartLine,
        message: `Unclosed code fence starting at line ${codeBlockStartLine}${codeBlockLanguage ? ` (language: ${codeBlockLanguage})` : ''}`
      });
    }

    return issues;
  }

  /**
   * Validate internal links resolve to existing documents
   *
   * @param {Object} doc - Document object
   * @param {Set} docPaths - Set of valid document paths
   * @returns {Array} Array of issues
   */
  validateInternalLinks(doc, docPaths) {
    const issues = [];
    const content = doc.content || '';

    // Match markdown links
    const linkRegex = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, text, url] = match;

      // Skip external links and anchors
      if (url.startsWith('http://') ||
          url.startsWith('https://') ||
          url.startsWith('mailto:') ||
          url.startsWith('#')) {
        continue;
      }

      // Resolve relative path
      const targetPath = this.resolveRelativePath(url, doc.relativePath);

      // Check if target exists
      if (!this.pathExists(targetPath, docPaths)) {
        issues.push({
          type: 'broken_internal_link',
          severity: 'warning',
          document: doc.relativePath,
          target: url,
          resolved: targetPath,
          message: `Broken internal link: "${url}" does not resolve to an existing document`
        });
      }
    }

    return issues;
  }

  /**
   * Resolve a relative path to a document path
   */
  resolveRelativePath(url, sourcePath) {
    // Remove anchor
    const [path] = url.split('#');
    if (!path) return sourcePath;

    // Get source directory
    const sourceDir = sourcePath.includes('/')
      ? sourcePath.substring(0, sourcePath.lastIndexOf('/'))
      : '';

    // Resolve relative path
    let resolved = sourceDir ? `${sourceDir}/${path}` : path;

    // Normalize
    resolved = resolved.replace(/\\/g, '/');
    resolved = resolved.replace(/^\.\//, '');

    // Handle ../ segments
    const parts = resolved.split('/');
    const stack = [];
    for (const part of parts) {
      if (part === '..') {
        stack.pop();
      } else if (part !== '.') {
        stack.push(part);
      }
    }

    return stack.join('/');
  }

  /**
   * Check if a path exists in the document set
   */
  pathExists(path, docPaths) {
    if (docPaths.has(path)) return true;
    if (docPaths.has(path + '.md')) return true;
    if (docPaths.has(path + '/index.md')) return true;
    return false;
  }

  /**
   * Detect redundant/duplicate content across documents
   *
   * @param {Array<Object>} documents - Documents to check
   * @returns {Array} Array of redundancy issues
   */
  detectRedundancy(documents) {
    const issues = [];

    // Track content hashes for exact duplicates
    const contentHashes = new Map();

    // Track title frequencies for potential duplicates
    const titleFrequencies = new Map();

    // Track section heading frequencies
    const sectionHeadings = new Map();

    for (const doc of documents) {
      const content = doc.content || '';
      const title = doc.metadata?.title || '';

      // Check for exact content duplicates
      const contentHash = this.simpleHash(content);
      if (contentHashes.has(contentHash)) {
        issues.push({
          type: 'duplicate_content',
          severity: 'warning',
          documents: [contentHashes.get(contentHash), doc.relativePath],
          message: `Duplicate content detected between documents`
        });
      } else {
        contentHashes.set(contentHash, doc.relativePath);
      }

      // Check for title duplicates
      if (title) {
        const normalizedTitle = title.toLowerCase().trim();
        if (titleFrequencies.has(normalizedTitle)) {
          titleFrequencies.get(normalizedTitle).push(doc.relativePath);
        } else {
          titleFrequencies.set(normalizedTitle, [doc.relativePath]);
        }
      }

      // Extract and track section headings
      const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
      for (const heading of headings) {
        const normalized = heading.toLowerCase().replace(/^#+\s+/, '').trim();
        if (sectionHeadings.has(normalized)) {
          sectionHeadings.get(normalized).push(doc.relativePath);
        } else {
          sectionHeadings.set(normalized, [doc.relativePath]);
        }
      }
    }

    // Report title duplicates
    for (const [title, docs] of titleFrequencies) {
      if (docs.length > 1) {
        issues.push({
          type: 'duplicate_title',
          severity: 'info',
          title,
          documents: docs,
          message: `Multiple documents with similar title: "${title}"`
        });
      }
    }

    // Report heavily duplicated sections (5+ occurrences)
    for (const [heading, docs] of sectionHeadings) {
      if (docs.length >= 5) {
        issues.push({
          type: 'repeated_section',
          severity: 'info',
          heading,
          count: docs.length,
          message: `Section heading "${heading}" appears in ${docs.length} documents (possible boilerplate)`
        });
      }
    }

    return issues;
  }

  /**
   * Simple string hash for duplicate detection
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Scan document for secrets and PII
   *
   * @param {Object} doc - Document object
   * @returns {Array} Array of security issues
   */
  scanForSecrets(doc) {
    const issues = [];
    const content = doc.content || '';

    // Skip scanning if content is in a code block that's meant to show patterns
    // (documentation about secrets detection, etc.)
    const isDocumentingSecrets = content.toLowerCase().includes('secret pattern') ||
                                  content.toLowerCase().includes('detecting secrets');

    if (isDocumentingSecrets) {
      return issues;
    }

    // Check for secrets
    for (const { name, pattern } of Validator.SECRET_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip matches that are clearly examples/placeholders
        const matchText = match[0];
        if (this.isLikelyExample(matchText)) continue;

        issues.push({
          type: 'potential_secret',
          severity: 'error',
          document: doc.relativePath,
          secret_type: name,
          position: match.index,
          message: `Potential ${name} found in document`,
          snippet: this.maskSecret(matchText)
        });
      }
    }

    // Check for PII (with lower severity)
    for (const { name, pattern } of Validator.PII_PATTERNS) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Skip obvious examples
        if (this.isLikelyExample(match[0])) continue;

        // Skip if in code block (likely example code)
        if (this.isInCodeBlock(content, match.index)) continue;

        issues.push({
          type: 'potential_pii',
          severity: 'warning',
          document: doc.relativePath,
          pii_type: name,
          position: match.index,
          message: `Potential ${name} found in document`
        });
      }
    }

    return issues;
  }

  /**
   * Check if a matched string is likely an example/placeholder
   */
  isLikelyExample(text) {
    const examplePatterns = [
      /^AKIA[X]{16}$/,        // AWS key placeholder
      /^xxx+$/i,              // xxx placeholder
      /^example/i,            // example...
      /^your[_-]?/i,          // your_key, your-token
      /^test[_-]?/i,          // test_key
      /^sample/i,             // sample...
      /^placeholder/i,        // placeholder...
      /^dummy/i,              // dummy...
      /^\*+$/,                // asterisks
      /^\.\.\.$/,             // ellipsis
      /example\.com/i,        // example.com
      /localhost/i,           // localhost
      /127\.0\.0\.1/,         // localhost IP
      /0\.0\.0\.0/            // null IP
    ];

    return examplePatterns.some(p => p.test(text));
  }

  /**
   * Check if a position is inside a code block
   */
  isInCodeBlock(content, position) {
    const before = content.substring(0, position);
    const codeBlockStarts = (before.match(/```/g) || []).length;
    return codeBlockStarts % 2 === 1;
  }

  /**
   * Mask a secret for safe display
   */
  maskSecret(secret) {
    if (secret.length <= 8) {
      return '*'.repeat(secret.length);
    }
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }

  /**
   * Validate chunk quality
   *
   * @param {Array} chunks - Chunk objects from ChunkGenerator
   * @returns {Array} Array of quality issues
   */
  validateChunkQuality(chunks) {
    const issues = [];

    for (const chunk of chunks) {
      const content = chunk.content || '';
      const tokenCount = chunk.token_count || 0;

      // Check for too small chunks
      if (tokenCount < 50) {
        issues.push({
          type: 'chunk_too_small',
          severity: 'warning',
          chunk_id: chunk.chunk_id,
          source: chunk.source_path,
          token_count: tokenCount,
          message: `Chunk is very small (${tokenCount} tokens)`
        });
      }

      // Check for very large chunks
      if (tokenCount > 3000) {
        issues.push({
          type: 'chunk_too_large',
          severity: 'warning',
          chunk_id: chunk.chunk_id,
          source: chunk.source_path,
          token_count: tokenCount,
          message: `Chunk is very large (${tokenCount} tokens)`
        });
      }

      // Check for boilerplate-heavy chunks
      const boilerplateRatio = this.calculateBoilerplateRatio(content);
      if (boilerplateRatio > 0.5) {
        issues.push({
          type: 'chunk_boilerplate_heavy',
          severity: 'info',
          chunk_id: chunk.chunk_id,
          source: chunk.source_path,
          boilerplate_ratio: boilerplateRatio,
          message: `Chunk may be boilerplate-heavy (${Math.round(boilerplateRatio * 100)}% common phrases)`
        });
      }

      // Check for chunks that are mostly code with no explanation
      if (chunk.has_code && !this.hasExplanation(content)) {
        issues.push({
          type: 'chunk_missing_explanation',
          severity: 'info',
          chunk_id: chunk.chunk_id,
          source: chunk.source_path,
          message: 'Chunk contains code but lacks explanatory text'
        });
      }
    }

    return issues;
  }

  /**
   * Calculate boilerplate ratio in content
   */
  calculateBoilerplateRatio(content) {
    const boilerplatePhrases = [
      'click here',
      'read more',
      'see also',
      'for more information',
      'please refer to',
      'as shown above',
      'as mentioned',
      'copyright',
      'all rights reserved',
      'table of contents',
      'back to top'
    ];

    const lowerContent = content.toLowerCase();
    const wordCount = content.split(/\s+/).length;

    let boilerplateCount = 0;
    for (const phrase of boilerplatePhrases) {
      const matches = lowerContent.split(phrase).length - 1;
      boilerplateCount += matches * phrase.split(' ').length;
    }

    return boilerplateCount / wordCount;
  }

  /**
   * Check if content has explanatory text
   */
  hasExplanation(content) {
    // Remove code blocks
    const withoutCode = content.replace(/```[\s\S]*?```/g, '');

    // Check if remaining text has substantial content
    const words = withoutCode.split(/\s+/).filter(w => w.length > 0);
    return words.length >= 10;
  }

  /**
   * Generate recommendations based on validation report
   */
  generateRecommendations(report) {
    const recommendations = [];

    if (report.code_fence_issues.length > 0) {
      const unclosed = report.code_fence_issues.filter(i => i.type === 'unclosed_code_fence');
      if (unclosed.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'code_quality',
          message: `Fix ${unclosed.length} unclosed code fence(s) to prevent rendering issues`
        });
      }
    }

    if (report.security_issues.length > 0) {
      const secrets = report.security_issues.filter(i => i.type === 'potential_secret');
      if (secrets.length > 0) {
        recommendations.push({
          priority: 'critical',
          category: 'security',
          message: `Review and remove ${secrets.length} potential secret(s) before publishing`
        });
      }
    }

    if (report.link_issues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'content_quality',
        message: `Fix ${report.link_issues.length} broken internal link(s) to improve navigation`
      });
    }

    if (report.redundancy_issues.length > 0) {
      const duplicates = report.redundancy_issues.filter(i => i.type === 'duplicate_content');
      if (duplicates.length > 0) {
        recommendations.push({
          priority: 'low',
          category: 'content_optimization',
          message: `Consider consolidating ${duplicates.length} duplicate content section(s)`
        });
      }
    }

    if (report.chunk_quality_issues.length > 0) {
      const small = report.chunk_quality_issues.filter(i => i.type === 'chunk_too_small');
      const large = report.chunk_quality_issues.filter(i => i.type === 'chunk_too_large');

      if (small.length > 5) {
        recommendations.push({
          priority: 'medium',
          category: 'chunk_quality',
          message: `${small.length} chunks are very small - consider combining related content`
        });
      }

      if (large.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'chunk_quality',
          message: `${large.length} chunks are very large - consider adding more section headings`
        });
      }
    }

    return recommendations;
  }
}