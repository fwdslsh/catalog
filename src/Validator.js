/**
 * Validator - Validates llms.txt files for compliance with official standard
 *
 * Ensures generated llms.txt files follow the proper format:
 * - H1 heading followed by blockquote summary
 * - Proper section structure with H2 headings
 * - Correct link format with optional descriptions
 * - Optional section placement (must be last)
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
}