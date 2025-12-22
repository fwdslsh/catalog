import { readFile, writeFile, mkdir, stat, access } from "fs/promises";
import { join, resolve, relative } from "path";
import { homedir } from "os";
import { createHash } from "crypto";

/**
 * CacheManager - Incremental rebuilds with file caching
 *
 * Tracks file hashes and modification times to only reprocess changed files.
 * Essential for iterative workflows (inform → catalog → findex) without
 * constant full rebuilds.
 *
 * @example
 * const cache = new CacheManager({ inputDir: './docs', outputDir: './build' });
 * const { changed, unchanged, deleted } = await cache.getChangedFiles(files);
 * // ... process only changed files
 * await cache.updateCache(processedDocs);
 */
export class CacheManager {
  /**
   * Default cache directory
   */
  static DEFAULT_CACHE_DIR = join(homedir(), '.cache', 'fwdslsh', 'catalog');

  /**
   * Create a new CacheManager instance
   *
   * @param {Object} options - Configuration options
   * @param {string} options.inputDir - Input directory path
   * @param {string} options.outputDir - Output directory path
   * @param {string} [options.cacheDir] - Custom cache directory
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {boolean} [options.forceRebuild=false] - Ignore cache, rebuild everything
   */
  constructor(options = {}) {
    this.inputDir = resolve(options.inputDir || '.');
    this.outputDir = resolve(options.outputDir || '.');
    this.silent = options.silent || false;
    this.forceRebuild = options.forceRebuild || false;

    // Generate project-specific cache key from input directory
    this.projectKey = this.sha256(this.inputDir).substring(0, 12);

    // Set cache directory
    this.cacheDir = options.cacheDir || join(CacheManager.DEFAULT_CACHE_DIR, this.projectKey);

    // Cache state
    this.previousState = null;
    this.currentState = null;
  }

  /**
   * Initialize cache - load previous state if exists
   *
   * @returns {Promise<boolean>} True if previous cache exists
   */
  async initialize() {
    try {
      await mkdir(this.cacheDir, { recursive: true });

      const statePath = join(this.cacheDir, 'build.state.json');
      const data = await readFile(statePath, 'utf8');
      this.previousState = JSON.parse(data);

      this.log(`✔ Loaded cache state (${Object.keys(this.previousState.files || {}).length} files)`);
      return true;
    } catch (error) {
      // No previous state exists
      this.previousState = null;
      return false;
    }
  }

  /**
   * Determine which files have changed since last build
   *
   * @param {string[]} currentFiles - Array of current file paths
   * @returns {Promise<Object>} { changed, unchanged, deleted, added }
   */
  async getChangedFiles(currentFiles) {
    if (this.forceRebuild || !this.previousState) {
      return {
        changed: [],
        unchanged: [],
        deleted: [],
        added: currentFiles,
        requiresFullRebuild: true
      };
    }

    const previousFiles = this.previousState.files || {};
    const changed = [];
    const unchanged = [];
    const added = [];

    // Check each current file
    for (const filePath of currentFiles) {
      const relativePath = relative(this.inputDir, filePath);
      const previousEntry = previousFiles[relativePath];

      if (!previousEntry) {
        added.push(filePath);
        continue;
      }

      // Check if file has changed (by mtime and size)
      const fileChanged = await this.hasFileChanged(filePath, previousEntry);

      if (fileChanged) {
        changed.push(filePath);
      } else {
        unchanged.push(filePath);
      }
    }

    // Find deleted files
    const currentRelativePaths = new Set(
      currentFiles.map(f => relative(this.inputDir, f))
    );

    const deleted = Object.keys(previousFiles)
      .filter(path => !currentRelativePaths.has(path));

    return {
      changed,
      unchanged,
      deleted,
      added,
      requiresFullRebuild: false
    };
  }

  /**
   * Check if a file has changed since last build
   *
   * @param {string} filePath - File path to check
   * @param {Object} previousEntry - Previous cache entry
   * @returns {Promise<boolean>} True if file has changed
   */
  async hasFileChanged(filePath, previousEntry) {
    try {
      const stats = await stat(filePath);

      // Quick check: mtime changed
      if (stats.mtimeMs !== previousEntry.mtimeMs) {
        return true;
      }

      // Quick check: size changed
      if (stats.size !== previousEntry.size) {
        return true;
      }

      // If mtime and size are same, check content hash for certainty
      if (previousEntry.hash) {
        const content = await readFile(filePath, 'utf8');
        const currentHash = this.sha256(content);
        return currentHash !== previousEntry.hash;
      }

      return false;
    } catch (error) {
      // File doesn't exist or can't be read - treat as changed
      return true;
    }
  }

  /**
   * Update cache with newly processed documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [options={}] - Additional metadata to store
   * @returns {Promise<void>}
   */
  async updateCache(documents, options = {}) {
    const files = {};

    for (const doc of documents) {
      const filePath = doc.fullPath;
      const relativePath = doc.relativePath;

      try {
        const stats = await stat(filePath);

        files[relativePath] = {
          hash: this.sha256(doc.content || ''),
          mtimeMs: stats.mtimeMs,
          size: stats.size,
          processedAt: Date.now()
        };
      } catch (error) {
        // Skip files that can't be stat'd
      }
    }

    const state = {
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      input_dir: this.inputDir,
      output_dir: this.outputDir,
      file_count: documents.length,
      files,
      metadata: {
        ...options,
        generator_version: options.generatorVersion || null,
        build_duration_ms: options.buildDuration || null
      }
    };

    // Write state file
    const statePath = join(this.cacheDir, 'build.state.json');
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');

    // Also write to output directory
    const outputStatePath = join(this.outputDir, 'build.state.json');
    await writeFile(outputStatePath, JSON.stringify(state, null, 2), 'utf8');

    this.currentState = state;
    this.log(`✔ Cache updated (${documents.length} files)`);
  }

  /**
   * Get cached document data if available
   *
   * @param {string} relativePath - Document relative path
   * @returns {Object|null} Cached document data or null
   */
  getCachedDocument(relativePath) {
    if (!this.previousState || !this.previousState.files) {
      return null;
    }
    return this.previousState.files[relativePath] || null;
  }

  /**
   * Clear the cache
   *
   * @returns {Promise<void>}
   */
  async clearCache() {
    const statePath = join(this.cacheDir, 'build.state.json');
    try {
      const { unlink } = await import('fs/promises');
      await unlink(statePath);
      this.log('✔ Cache cleared');
    } catch (error) {
      // File doesn't exist, that's fine
    }
    this.previousState = null;
    this.currentState = null;
  }

  /**
   * Get version history for a document (if tracking is enabled)
   *
   * @param {string} relativePath - Document relative path
   * @returns {Promise<Array>} Version history array
   */
  async getVersionHistory(relativePath) {
    const historyPath = join(this.cacheDir, 'history', relativePath.replace(/\//g, '_') + '.json');

    try {
      const data = await readFile(historyPath, 'utf8');
      return JSON.parse(data).versions || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Track version for a document
   *
   * @param {Object} doc - Document object
   * @returns {Promise<void>}
   */
  async trackVersion(doc) {
    const historyDir = join(this.cacheDir, 'history');
    await mkdir(historyDir, { recursive: true });

    const historyPath = join(historyDir, doc.relativePath.replace(/\//g, '_') + '.json');

    let history;
    try {
      const data = await readFile(historyPath, 'utf8');
      history = JSON.parse(data);
    } catch (error) {
      history = { path: doc.relativePath, versions: [] };
    }

    // Add new version entry
    history.versions.push({
      hash: this.sha256(doc.content || ''),
      timestamp: new Date().toISOString(),
      size: doc.content?.length || 0
    });

    // Keep only last 50 versions
    if (history.versions.length > 50) {
      history.versions = history.versions.slice(-50);
    }

    await writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getStats() {
    const stats = {
      cacheDir: this.cacheDir,
      projectKey: this.projectKey,
      hasPreviousState: !!this.previousState,
      hasCurrentState: !!this.currentState,
      previousFileCount: this.previousState?.file_count || 0,
      currentFileCount: this.currentState?.file_count || 0,
      lastBuildTime: this.previousState?.updated_at || null
    };

    return stats;
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
