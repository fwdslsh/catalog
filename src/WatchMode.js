import { watch } from "fs";
import { join, relative, extname } from "path";
import { EventEmitter } from "events";

/**
 * WatchMode - File system watching for continuous pipelines
 *
 * Watches input directory for changes and triggers incremental rebuilds.
 * Emits events as JSONL to stdout so other tools can subscribe.
 * Supports "living knowledge" updates and continuous pipelines.
 *
 * @example
 * const watcher = new WatchMode(inputDir, { processor, outputDir });
 * watcher.on('rebuild', (result) => console.log('Rebuilt:', result));
 * await watcher.start();
 */
export class WatchMode extends EventEmitter {
  /**
   * Supported file extensions
   */
  static EXTENSIONS = ['.md', '.mdx', '.html'];

  /**
   * Create a new WatchMode instance
   *
   * @param {string} inputDir - Directory to watch
   * @param {Object} options - Configuration options
   * @param {Object} options.processor - CatalogProcessor instance for rebuilds
   * @param {string} options.outputDir - Output directory
   * @param {boolean} [options.silent=false] - Suppress non-event output
   * @param {number} [options.debounceMs=500] - Debounce delay for rapid changes
   * @param {boolean} [options.emitJsonl=true] - Emit JSONL events to stdout
   * @param {boolean} [options.recursive=true] - Watch subdirectories recursively
   */
  constructor(inputDir, options = {}) {
    super();

    this.inputDir = inputDir;
    this.processor = options.processor;
    this.outputDir = options.outputDir;
    this.silent = options.silent || false;
    this.debounceMs = options.debounceMs || 500;
    this.emitJsonl = options.emitJsonl !== false;
    this.recursive = options.recursive !== false;

    // Watching state
    this.watchers = [];
    this.isRunning = false;
    this.pendingChanges = new Map();
    this.debounceTimer = null;
    this.lastRebuildTime = null;
    this.rebuildCount = 0;
  }

  /**
   * Start watching for file changes
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRunning) {
      throw new Error('WatchMode is already running');
    }

    this.isRunning = true;
    this.log(`👁 Watching ${this.inputDir} for changes...`);

    // Emit start event
    this.emitEvent({
      type: 'watch_started',
      input_dir: this.inputDir,
      output_dir: this.outputDir,
      timestamp: new Date().toISOString()
    });

    // Create file system watcher
    try {
      const watcher = watch(this.inputDir, {
        recursive: this.recursive,
        persistent: true
      }, (eventType, filename) => {
        this.handleFileChange(eventType, filename);
      });

      watcher.on('error', (error) => {
        this.handleError(error);
      });

      this.watchers.push(watcher);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Stop watching
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Close all watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Clear pending changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingChanges.clear();

    this.emitEvent({
      type: 'watch_stopped',
      rebuild_count: this.rebuildCount,
      timestamp: new Date().toISOString()
    });

    this.log('👁 Watch mode stopped');
  }

  /**
   * Handle a file change event
   *
   * @param {string} eventType - 'change' or 'rename'
   * @param {string} filename - Changed filename
   */
  handleFileChange(eventType, filename) {
    if (!filename) return;

    // Check if it's a supported file type
    const ext = extname(filename).toLowerCase();
    if (!WatchMode.EXTENSIONS.includes(ext)) {
      return;
    }

    // Ignore output directory changes
    const relativePath = relative(this.inputDir, join(this.inputDir, filename));
    if (this.outputDir && relativePath.startsWith(relative(this.inputDir, this.outputDir))) {
      return;
    }

    // Record the change
    this.pendingChanges.set(filename, {
      eventType,
      timestamp: Date.now()
    });

    // Debounce - wait for rapid changes to settle
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.debounceMs);
  }

  /**
   * Process all pending changes
   */
  async processPendingChanges() {
    if (this.pendingChanges.size === 0) return;

    const changes = Array.from(this.pendingChanges.entries()).map(([filename, info]) => ({
      filename,
      eventType: info.eventType,
      timestamp: new Date(info.timestamp).toISOString()
    }));

    this.pendingChanges.clear();

    // Emit change detected event
    this.emitEvent({
      type: 'changes_detected',
      changes,
      count: changes.length,
      timestamp: new Date().toISOString()
    });

    this.log(`📝 Changes detected: ${changes.map(c => c.filename).join(', ')}`);

    // Trigger rebuild
    await this.rebuild(changes);
  }

  /**
   * Trigger a rebuild
   *
   * @param {Array} changes - Array of change objects
   */
  async rebuild(changes) {
    const startTime = Date.now();

    this.emitEvent({
      type: 'rebuild_started',
      changes: changes.map(c => c.filename),
      timestamp: new Date().toISOString()
    });

    try {
      // Run the processor
      if (this.processor) {
        await this.processor.process();
      }

      const duration = Date.now() - startTime;
      this.rebuildCount++;
      this.lastRebuildTime = new Date().toISOString();

      this.emitEvent({
        type: 'rebuild_completed',
        duration_ms: duration,
        changes: changes.map(c => c.filename),
        rebuild_count: this.rebuildCount,
        timestamp: this.lastRebuildTime
      });

      this.log(`✔ Rebuild completed in ${duration}ms`);
      this.emit('rebuild', { success: true, duration, changes });

    } catch (error) {
      const duration = Date.now() - startTime;

      this.emitEvent({
        type: 'rebuild_failed',
        duration_ms: duration,
        error: error.message,
        changes: changes.map(c => c.filename),
        timestamp: new Date().toISOString()
      });

      this.log(`✖ Rebuild failed: ${error.message}`);
      this.emit('rebuild', { success: false, duration, changes, error });
    }
  }

  /**
   * Handle watcher error
   *
   * @param {Error} error - Error object
   */
  handleError(error) {
    this.emitEvent({
      type: 'watch_error',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    this.emit('error', error);
    this.log(`✖ Watch error: ${error.message}`);
  }

  /**
   * Emit a JSONL event to stdout
   *
   * @param {Object} event - Event object
   */
  emitEvent(event) {
    if (this.emitJsonl) {
      console.log(JSON.stringify(event));
    }
    this.emit('event', event);
  }

  /**
   * Get watch status
   *
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      inputDir: this.inputDir,
      outputDir: this.outputDir,
      rebuildCount: this.rebuildCount,
      lastRebuildTime: this.lastRebuildTime,
      pendingChanges: this.pendingChanges.size,
      watcherCount: this.watchers.length
    };
  }

  /**
   * Force a full rebuild
   *
   * @returns {Promise<void>}
   */
  async forceRebuild() {
    this.emitEvent({
      type: 'force_rebuild_requested',
      timestamp: new Date().toISOString()
    });

    await this.rebuild([{ filename: '*', eventType: 'force' }]);
  }

  /**
   * Log a message if not in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.error(...args); // Use stderr for logs to keep stdout clean for JSONL
    }
  }
}
