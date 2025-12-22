/**
 * PatternConfig - Apply per-pattern configuration overrides
 *
 * Allows fine-grained control over processing options based on file paths.
 * Supports glob patterns to match files and apply specific configurations.
 *
 * @example
 * ```js
 * const patternConfig = new PatternConfig({
 *   patterns: {
 *     "api/*.md": { chunkProfile: "code-heavy", tags: ["api"] },
 *     "guides/*.md": { chunkProfile: "default" }
 *   }
 * });
 *
 * const config = patternConfig.getConfigForPath("api/endpoints.md");
 * ```
 */
export class PatternConfig {
  /**
   * Configuration options that can be overridden per pattern
   */
  static OVERRIDABLE_OPTIONS = [
    "chunkProfile",
    "tags",
    "optional",
    "priority",
    "exclude",
    "summarize",
    "maxChunkSize",
    "minChunkSize",
    "chunkOverlap"
  ];

  /**
   * Create a new PatternConfig instance
   *
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.patterns={}] - Pattern-to-config mapping
   * @param {Object} [options.defaults={}] - Default configuration
   * @param {boolean} [options.silent=false] - Suppress log output
   */
  constructor(options = {}) {
    this.patterns = options.patterns || {};
    this.defaults = options.defaults || {};
    this.silent = options.silent || false;

    // Compile patterns for efficient matching
    this.compiledPatterns = this.compilePatterns(this.patterns);
  }

  /**
   * Compile pattern strings into matchers
   *
   * @param {Object} patterns - Pattern-to-config mapping
   * @returns {Array<Object>} Compiled pattern matchers
   */
  compilePatterns(patterns) {
    return Object.entries(patterns).map(([pattern, config]) => ({
      pattern,
      regex: this.patternToRegex(pattern),
      config: this.validateConfig(config),
      specificity: this.calculateSpecificity(pattern)
    })).sort((a, b) => b.specificity - a.specificity); // More specific patterns first
  }

  /**
   * Convert a glob pattern to a regex
   *
   * @param {string} pattern - Glob pattern
   * @returns {RegExp} Compiled regex
   */
  patternToRegex(pattern) {
    let regex = pattern
      // Escape special regex chars except * and ?
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // Convert ** to match any path
      .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
      // Convert * to match anything except /
      .replace(/\*/g, "[^/]*")
      // Restore **
      .replace(/<<<DOUBLESTAR>>>/g, ".*")
      // Convert ? to match single char
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`);
  }

  /**
   * Calculate pattern specificity for ordering
   * More specific patterns should be matched first
   *
   * @param {string} pattern - Glob pattern
   * @returns {number} Specificity score
   */
  calculateSpecificity(pattern) {
    let score = 0;

    // Literal characters add specificity
    score += (pattern.match(/[a-zA-Z0-9]/g) || []).length;

    // Wildcards reduce specificity
    score -= (pattern.match(/\*/g) || []).length * 5;
    score -= (pattern.match(/\*\*/g) || []).length * 10;

    // Directory depth adds specificity
    score += (pattern.match(/\//g) || []).length * 3;

    return score;
  }

  /**
   * Validate and normalize a pattern configuration
   *
   * @param {Object} config - Pattern configuration
   * @returns {Object} Validated configuration
   */
  validateConfig(config) {
    const validated = {};

    for (const [key, value] of Object.entries(config)) {
      // Only allow overridable options
      if (PatternConfig.OVERRIDABLE_OPTIONS.includes(key)) {
        validated[key] = value;
      } else if (!this.silent) {
        console.warn(`Warning: "${key}" is not an overridable option, ignoring`);
      }
    }

    // Normalize tags to array
    if (validated.tags && !Array.isArray(validated.tags)) {
      validated.tags = [validated.tags];
    }

    return validated;
  }

  /**
   * Get configuration for a specific file path
   *
   * @param {string} path - File path to match
   * @returns {Object} Merged configuration for the path
   */
  getConfigForPath(path) {
    // Start with defaults
    let config = { ...this.defaults };

    // Apply matching patterns in order (least to most specific)
    const matches = this.getMatchingPatterns(path).reverse();

    for (const match of matches) {
      config = this.mergeConfigs(config, match.config);
    }

    return config;
  }

  /**
   * Get all patterns that match a path
   *
   * @param {string} path - File path to match
   * @returns {Array<Object>} Matching patterns with their configs
   */
  getMatchingPatterns(path) {
    // Normalize path
    const normalizedPath = path.replace(/\\/g, "/");

    return this.compiledPatterns.filter(
      compiled => compiled.regex.test(normalizedPath)
    );
  }

  /**
   * Check if a path matches any pattern
   *
   * @param {string} path - File path to check
   * @returns {boolean} True if path matches any pattern
   */
  matchesAny(path) {
    return this.getMatchingPatterns(path).length > 0;
  }

  /**
   * Merge two configurations
   *
   * @param {Object} base - Base configuration
   * @param {Object} override - Override configuration
   * @returns {Object} Merged configuration
   */
  mergeConfigs(base, override) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (key === "tags" && merged.tags) {
        // Merge tags arrays
        merged.tags = [...new Set([...merged.tags, ...value])];
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Add a pattern configuration
   *
   * @param {string} pattern - Glob pattern
   * @param {Object} config - Configuration for pattern
   */
  addPattern(pattern, config) {
    this.patterns[pattern] = config;
    this.compiledPatterns = this.compilePatterns(this.patterns);
  }

  /**
   * Remove a pattern configuration
   *
   * @param {string} pattern - Pattern to remove
   * @returns {boolean} True if pattern was removed
   */
  removePattern(pattern) {
    if (pattern in this.patterns) {
      delete this.patterns[pattern];
      this.compiledPatterns = this.compilePatterns(this.patterns);
      return true;
    }
    return false;
  }

  /**
   * Get all configured patterns
   *
   * @returns {Array<string>} List of patterns
   */
  getPatterns() {
    return Object.keys(this.patterns);
  }

  /**
   * Apply pattern configurations to a list of documents
   *
   * @param {Array<Object>} documents - Documents to process
   * @returns {Array<Object>} Documents with applied configurations
   */
  applyToDocuments(documents) {
    return documents.map(doc => {
      const pathConfig = this.getConfigForPath(doc.relativePath);

      // Apply configuration to document
      const enhanced = { ...doc };

      // Apply chunk profile
      if (pathConfig.chunkProfile) {
        enhanced._chunkProfile = pathConfig.chunkProfile;
      }

      // Apply tags
      if (pathConfig.tags) {
        enhanced._additionalTags = pathConfig.tags;
      }

      // Apply optional flag
      if (pathConfig.optional !== undefined) {
        enhanced._isOptional = pathConfig.optional;
      }

      // Apply priority
      if (pathConfig.priority !== undefined) {
        enhanced._priority = pathConfig.priority;
      }

      // Apply chunk size overrides
      if (pathConfig.maxChunkSize) {
        enhanced._maxChunkSize = pathConfig.maxChunkSize;
      }
      if (pathConfig.minChunkSize) {
        enhanced._minChunkSize = pathConfig.minChunkSize;
      }
      if (pathConfig.chunkOverlap) {
        enhanced._chunkOverlap = pathConfig.chunkOverlap;
      }

      return enhanced;
    });
  }

  /**
   * Generate a sample patterns configuration
   *
   * @returns {Object} Sample patterns configuration
   */
  static generateSample() {
    return {
      patterns: {
        "api/**/*.md": {
          chunkProfile: "code-heavy",
          tags: ["api", "reference"],
          priority: 100
        },
        "guides/**/*.md": {
          chunkProfile: "default",
          tags: ["guide", "tutorial"]
        },
        "faq/**/*.md": {
          chunkProfile: "faq",
          tags: ["faq", "support"]
        },
        "**/CHANGELOG.md": {
          optional: true,
          tags: ["changelog"]
        },
        "**/internal/**/*": {
          exclude: true
        },
        "reference/**/*.md": {
          chunkProfile: "large-context",
          maxChunkSize: 2000,
          tags: ["reference"]
        }
      }
    };
  }

  /**
   * Create from a configuration object
   *
   * @param {Object} config - Configuration with patterns key
   * @returns {PatternConfig} New instance
   */
  static fromConfig(config) {
    return new PatternConfig({
      patterns: config.patterns || {},
      defaults: {
        chunkProfile: config.chunkProfile || "default",
        tags: config.defaultTags || []
      },
      silent: config.silent
    });
  }
}
