/**
 * Performance monitoring for Catalog CLI
 * Tracks timing, memory usage, and provides performance reports
 */

export class PerformanceMonitor {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.metrics = new Map();
    this.startTime = Date.now();
    this.initialMemory = process.memoryUsage();
  }

  /**
   * Start timing a specific operation
   */
  startTimer(name) {
    this.metrics.set(name, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      endTime: null,
      endMemory: null,
      duration: null,
      memoryDelta: null
    });
  }

  /**
   * End timing for a specific operation
   */
  endTimer(name) {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Timer '${name}' was not started`);
    }

    metric.endTime = Date.now();
    metric.endMemory = process.memoryUsage();
    metric.duration = metric.endTime - metric.startTime;
    metric.memoryDelta = {
      rss: metric.endMemory.rss - metric.startMemory.rss,
      heapUsed: metric.endMemory.heapUsed - metric.startMemory.heapUsed,
      external: metric.endMemory.external - metric.startMemory.external
    };

    return metric;
  }

  /**
   * Record a simple metric without timing
   */
  recordMetric(name, value) {
    this.metrics.set(name, { value, timestamp: Date.now() });
  }

  /**
   * Get a specific metric
   */
  getMetric(name) {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage() {
    const current = process.memoryUsage();
    return {
      rss: this.formatBytes(current.rss),
      heapUsed: this.formatBytes(current.heapUsed),
      heapTotal: this.formatBytes(current.heapTotal),
      external: this.formatBytes(current.external),
      arrayBuffers: this.formatBytes(current.arrayBuffers)
    };
  }

  /**
   * Get memory usage delta from start
   */
  getMemoryDelta() {
    const current = process.memoryUsage();
    return {
      rss: this.formatBytes(current.rss - this.initialMemory.rss),
      heapUsed: this.formatBytes(current.heapUsed - this.initialMemory.heapUsed),
      external: this.formatBytes(current.external - this.initialMemory.external)
    };
  }

  /**
   * Get total elapsed time
   */
  getTotalTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Format bytes for human readability
   */
  formatBytes(bytes) {
    const abs = Math.abs(bytes);
    const sign = bytes < 0 ? '-' : '';
    
    if (abs < 1024) {
      return `${sign}${abs}B`;
    } else if (abs < 1024 * 1024) {
      return `${sign}${(abs / 1024).toFixed(2)}KB`;
    } else if (abs < 1024 * 1024 * 1024) {
      return `${sign}${(abs / (1024 * 1024)).toFixed(2)}MB`;
    } else {
      return `${sign}${(abs / (1024 * 1024 * 1024)).toFixed(2)}GB`;
    }
  }

  /**
   * Format duration for human readability
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      totalTime: this.formatDuration(this.getTotalTime()),
      memoryUsage: this.getCurrentMemoryUsage(),
      memoryDelta: this.getMemoryDelta(),
      operations: {}
    };

    // Add timing metrics
    for (const [name, metric] of this.metrics.entries()) {
      if (metric.duration !== undefined) {
        report.operations[name] = {
          duration: this.formatDuration(metric.duration),
          memoryDelta: metric.memoryDelta ? {
            heapUsed: this.formatBytes(metric.memoryDelta.heapUsed),
            rss: this.formatBytes(metric.memoryDelta.rss)
          } : null
        };
      } else if (metric.value !== undefined) {
        report.operations[name] = metric.value;
      }
    }

    return report;
  }

  /**
   * Print performance report to console
   */
  printReport() {
    if (this.silent) return;

    const report = this.generateReport();
    
    console.log('\n📊 Performance Report:');
    console.log(`  Total Time: ${report.totalTime}`);
    console.log(`  Memory Usage:`);
    console.log(`    Heap Used: ${report.memoryUsage.heapUsed}`);
    console.log(`    RSS: ${report.memoryUsage.rss}`);
    console.log(`  Memory Delta:`);
    console.log(`    Heap: ${report.memoryDelta.heapUsed}`);
    console.log(`    RSS: ${report.memoryDelta.rss}`);
    
    if (Object.keys(report.operations).length > 0) {
      console.log(`  Operations:`);
      for (const [name, data] of Object.entries(report.operations)) {
        if (typeof data === 'object' && data.duration) {
          console.log(`    ${name}: ${data.duration}`);
          if (data.memoryDelta) {
            console.log(`      Memory: +${data.memoryDelta.heapUsed}`);
          }
        } else {
          console.log(`    ${name}: ${data}`);
        }
      }
    }
  }

  /**
   * Check if memory usage exceeds threshold
   */
  checkMemoryThreshold(thresholdMB = 500) {
    const currentMB = process.memoryUsage().heapUsed / (1024 * 1024);
    return currentMB > thresholdMB;
  }

  /**
   * Create a performance wrapped function
   */
  wrapFunction(fn, name) {
    return async (...args) => {
      this.startTimer(name);
      try {
        const result = await fn(...args);
        this.endTimer(name);
        return result;
      } catch (error) {
        this.endTimer(name);
        throw error;
      }
    };
  }
}

/**
 * File size monitor for tracking large files
 */
export class FileSizeMonitor {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.warnFileSize = options.warnFileSize || 5 * 1024 * 1024; // 5MB default
    this.largeFiles = [];
    this.totalSize = 0;
    this.fileCount = 0;
  }

  /**
   * Check file size and track if large
   */
  checkFileSize(filePath, size) {
    this.fileCount++;
    this.totalSize += size;

    if (size > this.maxFileSize) {
      this.largeFiles.push({
        path: filePath,
        size: size,
        type: 'exceeds_max'
      });
      return { ok: false, reason: 'exceeds_max_size' };
    } else if (size > this.warnFileSize) {
      this.largeFiles.push({
        path: filePath,
        size: size,
        type: 'warning'
      });
      return { ok: true, warning: true, reason: 'large_file' };
    }

    return { ok: true };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalFiles: this.fileCount,
      totalSize: this.totalSize,
      averageSize: this.fileCount > 0 ? this.totalSize / this.fileCount : 0,
      largeFiles: this.largeFiles.length,
      exceedsMax: this.largeFiles.filter(f => f.type === 'exceeds_max').length,
      warnings: this.largeFiles.filter(f => f.type === 'warning').length
    };
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  /**
   * Get report of large files
   */
  getLargeFilesReport() {
    return this.largeFiles.map(file => ({
      path: file.path,
      size: this.formatSize(file.size),
      type: file.type
    }));
  }
}

/**
 * Concurrent processor for parallel operations
 */
export class ConcurrentProcessor {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 5;
    this.timeout = options.timeout || 30000; // 30 seconds default
  }

  /**
   * Process items in batches with concurrency limit
   */
  async processBatch(items, processor) {
    const results = [];
    const errors = [];

    // Process in chunks
    for (let i = 0; i < items.length; i += this.concurrency) {
      const batch = items.slice(i, i + this.concurrency);
      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await this.withTimeout(
            processor(item),
            this.timeout,
            `Processing item ${i + index}`
          );
          return { success: true, result, item };
        } catch (error) {
          return { success: false, error, item };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.success) {
          results.push(result.result);
        } else {
          errors.push({ item: result.item, error: result.error });
        }
      }
    }

    return { results, errors };
  }

  /**
   * Add timeout to a promise
   */
  withTimeout(promise, ms, description = 'Operation') {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${description} timed out after ${ms}ms`));
      }, ms);

      promise
        .then(value => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Process items with rate limiting
   */
  async processWithRateLimit(items, processor, rateLimit = 10) {
    const delay = 1000 / rateLimit; // Convert to ms between operations
    const results = [];

    for (const item of items) {
      const startTime = Date.now();
      results.push(await processor(item));
      
      const elapsed = Date.now() - startTime;
      if (elapsed < delay) {
        await new Promise(resolve => setTimeout(resolve, delay - elapsed));
      }
    }

    return results;
  }
}