import { readFile, access } from "fs/promises";
import { join, resolve, dirname } from "path";

/**
 * ConfigLoader - Load and merge configuration from files and CLI
 *
 * Supports configuration files in multiple formats:
 * - catalog.yaml / catalog.yml (YAML format)
 * - catalog.json (JSON format)
 * - catalog.config.js (JavaScript module)
 * - .catalogrc (JSON format)
 *
 * CLI flags always override config file settings.
 *
 * @example
 * const loader = new ConfigLoader();
 * const config = await loader.load('./docs', cliOptions);
 */
export class ConfigLoader {
  /**
   * Default configuration values
   */
  static DEFAULTS = {
    input: '.',
    output: '.',
    baseUrl: null,

    // Pattern matching
    include: [],
    exclude: [],
    optional: [],

    // Output generation
    generateIndex: false,
    generateToc: false,
    generateAst: false,
    astExtensions: [],
    generateSitemap: false,
    sitemapNoExtensions: false,
    validate: false,

    // New v0.2.0 features
    generateManifest: false,
    generateChunks: false,
    chunkProfile: 'default',
    generateTags: false,
    generateGraph: false,
    generateBundles: false,
    bundleSizes: [2000, 8000, 32000],

    // Caching and incremental
    enableCache: false,
    cacheDir: null,
    forceRebuild: false,

    // Watch mode
    watch: false,
    watchDebounce: 500,

    // Validation
    validateAIReadiness: false,

    // Provenance
    origin: null,
    repoRef: null,

    // Performance
    silent: false,
    enablePerformanceMonitoring: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    warnFileSize: 5 * 1024 * 1024, // 5MB
    continueOnError: true
  };

  /**
   * Config file search order
   */
  static CONFIG_FILES = [
    'catalog.yaml',
    'catalog.yml',
    'catalog.json',
    'catalog.config.js',
    '.catalogrc',
    '.catalogrc.json',
    '.catalogrc.yaml'
  ];

  /**
   * Create a new ConfigLoader instance
   *
   * @param {Object} [options={}] - Loader options
   * @param {boolean} [options.silent=false] - Suppress log output
   */
  constructor(options = {}) {
    this.silent = options.silent || false;
  }

  /**
   * Load configuration from file and merge with CLI options
   *
   * @param {string} [configPath=null] - Explicit config file path, or null to auto-detect
   * @param {Object} [cliOptions={}] - CLI options (override file config)
   * @param {string} [searchDir='.'] - Directory to search for config files
   * @returns {Promise<Object>} Merged configuration
   */
  async load(configPath = null, cliOptions = {}, searchDir = '.') {
    let fileConfig = {};

    // Load config from explicit path or auto-detect
    if (configPath) {
      fileConfig = await this.loadConfigFile(configPath);
    } else {
      const foundPath = await this.findConfigFile(searchDir);
      if (foundPath) {
        fileConfig = await this.loadConfigFile(foundPath);
        this.log(`✔ Loaded config from ${foundPath}`);
      }
    }

    // Merge: defaults < file config < CLI options
    const merged = this.mergeConfigs(
      ConfigLoader.DEFAULTS,
      fileConfig,
      cliOptions
    );

    // Validate and normalize
    return this.normalizeConfig(merged);
  }

  /**
   * Find config file in directory
   *
   * @param {string} dir - Directory to search
   * @returns {Promise<string|null>} Path to config file or null
   */
  async findConfigFile(dir) {
    const resolvedDir = resolve(dir);

    for (const filename of ConfigLoader.CONFIG_FILES) {
      const filepath = join(resolvedDir, filename);
      try {
        await access(filepath);
        return filepath;
      } catch {
        // File doesn't exist, try next
      }
    }

    return null;
  }

  /**
   * Load configuration from a specific file
   *
   * @param {string} filepath - Path to config file
   * @returns {Promise<Object>} Parsed configuration
   */
  async loadConfigFile(filepath) {
    const ext = filepath.split('.').pop().toLowerCase();

    try {
      const content = await readFile(filepath, 'utf8');

      if (ext === 'json' || filepath.endsWith('.catalogrc')) {
        return JSON.parse(content);
      }

      if (ext === 'yaml' || ext === 'yml') {
        return this.parseYaml(content);
      }

      if (ext === 'js') {
        // Dynamic import for JS config
        const module = await import(filepath);
        return module.default || module;
      }

      throw new Error(`Unsupported config format: ${ext}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Config file not found: ${filepath}`);
      }
      throw new Error(`Failed to load config from ${filepath}: ${error.message}`);
    }
  }

  /**
   * Simple YAML parser (handles common cases without external dependency)
   *
   * @param {string} content - YAML content
   * @returns {Object} Parsed object
   */
  parseYaml(content) {
    const result = {};
    const lines = content.split('\n');
    let currentKey = null;
    let currentArray = null;

    for (let line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue;
      }

      // Check for array item
      const arrayMatch = line.match(/^(\s*)- (.+)$/);
      if (arrayMatch && currentArray) {
        const [, indent, value] = arrayMatch;
        currentArray.push(this.parseYamlValue(value.trim()));
        continue;
      }

      // Check for key-value pair (supports kebab-case and snake_case keys)
      const kvMatch = line.match(/^(\s*)([\w-]+):\s*(.*)$/);
      if (kvMatch) {
        const [, indent, key, value] = kvMatch;
        const normalizedKey = this.camelCase(key);

        if (value.trim() === '') {
          // Could be start of array or nested object
          result[normalizedKey] = [];
          currentKey = normalizedKey;
          currentArray = result[normalizedKey];
        } else {
          result[normalizedKey] = this.parseYamlValue(value.trim());
          currentKey = normalizedKey;
          currentArray = Array.isArray(result[normalizedKey]) ? result[normalizedKey] : null;
        }
      }
    }

    return result;
  }

  /**
   * Parse a YAML value
   */
  parseYamlValue(value) {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null
    if (value === 'null' || value === '~') return null;

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Inline array
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map(v => this.parseYamlValue(v.trim()));
    }

    // Plain string
    return value;
  }

  /**
   * Convert kebab-case or snake_case to camelCase
   */
  camelCase(str) {
    return str.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase());
  }

  /**
   * Merge multiple config objects (later sources override earlier)
   *
   * @param {...Object} configs - Config objects to merge
   * @returns {Object} Merged configuration
   */
  mergeConfigs(...configs) {
    const result = {};

    for (const config of configs) {
      for (const [key, value] of Object.entries(config)) {
        if (value === undefined) continue;

        // Arrays are concatenated for patterns, replaced for others
        if (Array.isArray(value) && Array.isArray(result[key])) {
          if (['include', 'exclude', 'optional', 'bundleSizes'].includes(key)) {
            result[key] = [...new Set([...result[key], ...value])];
          } else {
            result[key] = value;
          }
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Deep merge objects
          result[key] = this.mergeConfigs(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Normalize and validate configuration
   *
   * @param {Object} config - Configuration to normalize
   * @returns {Object} Normalized configuration
   */
  normalizeConfig(config) {
    // Ensure arrays are arrays
    const arrayFields = ['include', 'exclude', 'optional', 'bundleSizes', 'astExtensions'];
    for (const field of arrayFields) {
      if (config[field] && !Array.isArray(config[field])) {
        config[field] = [config[field]];
      }
    }

    // Normalize paths
    if (config.input) {
      config.input = resolve(config.input);
    }
    if (config.output) {
      config.output = resolve(config.output);
    }
    if (config.cacheDir) {
      config.cacheDir = resolve(config.cacheDir);
    }

    // Validate bundle sizes
    if (config.bundleSizes) {
      config.bundleSizes = config.bundleSizes
        .map(s => parseInt(s, 10))
        .filter(s => !isNaN(s) && s > 0)
        .sort((a, b) => a - b);
    }

    // Validate chunk profile
    const validProfiles = ['default', 'code-heavy', 'faq', 'large-context', 'granular'];
    if (config.chunkProfile && !validProfiles.includes(config.chunkProfile)) {
      console.warn(`Warning: Invalid chunk profile "${config.chunkProfile}", using "default"`);
      config.chunkProfile = 'default';
    }

    // Normalize base URL
    if (config.baseUrl && !config.baseUrl.endsWith('/')) {
      config.baseUrl = config.baseUrl + '/';
    }

    return config;
  }

  /**
   * Generate a sample config file
   *
   * @param {string} format - 'yaml' or 'json'
   * @returns {string} Sample config content
   */
  generateSampleConfig(format = 'yaml') {
    const sample = {
      input: './docs',
      output: './build',
      baseUrl: 'https://docs.example.com/',

      // Patterns
      include: ['**/*.md', '**/*.html'],
      exclude: ['**/drafts/**', '**/internal/**'],
      optional: ['**/changelog.md', '**/appendix/**'],

      // Standard outputs
      generateIndex: true,
      generateToc: true,
      generateSitemap: true,
      validate: true,

      // PAI features
      generateManifest: true,
      generateChunks: true,
      chunkProfile: 'default',
      generateTags: true,
      generateGraph: true,
      generateBundles: true,
      bundleSizes: [2000, 8000, 32000],

      // Caching
      enableCache: true,

      // Validation
      validateAIReadiness: true,

      // Performance
      silent: false,
      continueOnError: true
    };

    if (format === 'json') {
      return JSON.stringify(sample, null, 2);
    }

    // Generate YAML
    return this.toYaml(sample);
  }

  /**
   * Convert object to YAML string
   */
  toYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    for (const [key, value] of Object.entries(obj)) {
      const yamlKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();

      if (Array.isArray(value)) {
        yaml += `${spaces}${yamlKey}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${this.yamlValue(item)}\n`;
        }
      } else if (value !== null && typeof value === 'object') {
        yaml += `${spaces}${yamlKey}:\n`;
        yaml += this.toYaml(value, indent + 1);
      } else {
        yaml += `${spaces}${yamlKey}: ${this.yamlValue(value)}\n`;
      }
    }

    return yaml;
  }

  /**
   * Format a value for YAML
   */
  yamlValue(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
      if (value.includes(':') || value.includes('#') || value.includes("'")) {
        return `"${value}"`;
      }
      return value;
    }
    return String(value);
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
