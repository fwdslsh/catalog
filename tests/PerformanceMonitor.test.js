import { describe, test, expect } from 'bun:test';
import { 
  PerformanceMonitor, 
  FileSizeMonitor, 
  ConcurrentProcessor 
} from '../src/PerformanceMonitor.js';

describe('PerformanceMonitor', () => {
  test('creates monitor with default options', () => {
    const monitor = new PerformanceMonitor();
    expect(monitor.silent).toBe(false);
    expect(monitor.metrics.size).toBe(0);
    expect(monitor.startTime).toBeGreaterThan(0);
  });

  test('respects silent option', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    expect(monitor.silent).toBe(true);
  });

  test('starts and ends timer correctly', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    monitor.startTimer('test');
    
    const metric = monitor.getMetric('test');
    expect(metric.startTime).toBeGreaterThan(0);
    expect(metric.endTime).toBe(null);
    
    // Wait a bit
    setTimeout(() => {
      const endedMetric = monitor.endTimer('test');
      expect(endedMetric.duration).toBeGreaterThan(0);
      expect(endedMetric.endTime).toBeGreaterThan(endedMetric.startTime);
    }, 10);
  });

  test('throws error for non-existent timer', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    expect(() => monitor.endTimer('nonexistent')).toThrow();
  });

  test('records simple metrics', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    monitor.recordMetric('files_processed', 42);
    
    const metric = monitor.getMetric('files_processed');
    expect(metric.value).toBe(42);
    expect(metric.timestamp).toBeGreaterThan(0);
  });

  test('formats bytes correctly', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    expect(monitor.formatBytes(512)).toBe('512B');
    expect(monitor.formatBytes(1536)).toBe('1.50KB');
    expect(monitor.formatBytes(2 * 1024 * 1024)).toBe('2.00MB');
    expect(monitor.formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00GB');
    expect(monitor.formatBytes(-1024)).toBe('-1.00KB');
  });

  test('formats duration correctly', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    expect(monitor.formatDuration(500)).toBe('500ms');
    expect(monitor.formatDuration(1500)).toBe('1.50s');
    expect(monitor.formatDuration(65000)).toBe('1m 5s');
  });

  test('generates performance report', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    monitor.recordMetric('files', 10);
    
    const report = monitor.generateReport();
    expect(report.totalTime).toMatch(/\d+ms/);
    expect(report.memoryUsage).toHaveProperty('heapUsed');
    expect(report.memoryDelta).toHaveProperty('heapUsed');
    expect(report.operations.files).toBe(10);
  });

  test('wraps function with performance monitoring', async () => {
    const monitor = new PerformanceMonitor({ silent: true });
    
    const testFunction = async (x) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return x * 2;
    };
    
    const wrappedFunction = monitor.wrapFunction(testFunction, 'multiply');
    const result = await wrappedFunction(5);
    
    expect(result).toBe(10);
    const metric = monitor.getMetric('multiply');
    expect(metric.duration).toBeGreaterThan(0);
  });

  test('wrapped function handles errors', async () => {
    const monitor = new PerformanceMonitor({ silent: true });
    
    const errorFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 1)); // Add small delay
      throw new Error('Test error');
    };
    
    const wrappedFunction = monitor.wrapFunction(errorFunction, 'error_test');
    
    await expect(wrappedFunction()).rejects.toThrow('Test error');
    
    const metric = monitor.getMetric('error_test');
    expect(metric.duration).toBeGreaterThanOrEqual(0);
  });

  test('checks memory threshold', () => {
    const monitor = new PerformanceMonitor({ silent: true });
    
    // Should not exceed threshold with reasonable limit
    expect(monitor.checkMemoryThreshold(1000)).toBe(false);
    
    // Should exceed with very low threshold
    expect(monitor.checkMemoryThreshold(0.001)).toBe(true);
  });
});

describe('FileSizeMonitor', () => {
  test('creates monitor with default options', () => {
    const monitor = new FileSizeMonitor();
    expect(monitor.maxFileSize).toBe(10 * 1024 * 1024); // 10MB
    expect(monitor.warnFileSize).toBe(5 * 1024 * 1024); // 5MB
    expect(monitor.largeFiles).toEqual([]);
    expect(monitor.totalSize).toBe(0);
    expect(monitor.fileCount).toBe(0);
  });

  test('respects custom size limits', () => {
    const monitor = new FileSizeMonitor({
      maxFileSize: 1024 * 1024, // 1MB
      warnFileSize: 512 * 1024  // 512KB
    });
    expect(monitor.maxFileSize).toBe(1024 * 1024);
    expect(monitor.warnFileSize).toBe(512 * 1024);
  });

  test('handles normal file sizes', () => {
    const monitor = new FileSizeMonitor();
    const result = monitor.checkFileSize('small.md', 1024);
    
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(monitor.largeFiles.length).toBe(0);
  });

  test('handles warning file sizes', () => {
    const monitor = new FileSizeMonitor();
    const result = monitor.checkFileSize('large.md', 6 * 1024 * 1024); // 6MB
    
    expect(result.ok).toBe(true);
    expect(result.warning).toBe(true);
    expect(result.reason).toBe('large_file');
    expect(monitor.largeFiles.length).toBe(1);
    expect(monitor.largeFiles[0].type).toBe('warning');
  });

  test('handles files exceeding maximum size', () => {
    const monitor = new FileSizeMonitor();
    const result = monitor.checkFileSize('huge.md', 15 * 1024 * 1024); // 15MB
    
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('exceeds_max_size');
    expect(monitor.largeFiles.length).toBe(1);
    expect(monitor.largeFiles[0].type).toBe('exceeds_max');
  });

  test('tracks statistics correctly', () => {
    const monitor = new FileSizeMonitor();
    monitor.checkFileSize('file1.md', 1024);
    monitor.checkFileSize('file2.md', 2048);
    monitor.checkFileSize('large.md', 6 * 1024 * 1024);
    monitor.checkFileSize('huge.md', 15 * 1024 * 1024);
    
    const stats = monitor.getStats();
    expect(stats.totalFiles).toBe(4);
    expect(stats.totalSize).toBe(1024 + 2048 + 6 * 1024 * 1024 + 15 * 1024 * 1024);
    expect(stats.largeFiles).toBe(2);
    expect(stats.warnings).toBe(1);
    expect(stats.exceedsMax).toBe(1);
  });

  test('formats file sizes correctly', () => {
    const monitor = new FileSizeMonitor();
    expect(monitor.formatSize(1024)).toBe('1.00KB');
    expect(monitor.formatSize(1024 * 1024)).toBe('1.00MB');
    expect(monitor.formatSize(1024 * 1024 * 1024)).toBe('1.00GB');
  });

  test('generates large files report', () => {
    const monitor = new FileSizeMonitor();
    monitor.checkFileSize('large.md', 6 * 1024 * 1024);
    monitor.checkFileSize('huge.md', 15 * 1024 * 1024);
    
    const report = monitor.getLargeFilesReport();
    expect(report.length).toBe(2);
    expect(report[0]).toHaveProperty('path', 'large.md');
    expect(report[0]).toHaveProperty('size', '6.00MB');
    expect(report[0]).toHaveProperty('type', 'warning');
    expect(report[1]).toHaveProperty('path', 'huge.md');
    expect(report[1]).toHaveProperty('type', 'exceeds_max');
  });
});

describe('ConcurrentProcessor', () => {
  test('creates processor with default options', () => {
    const processor = new ConcurrentProcessor();
    expect(processor.concurrency).toBe(5);
    expect(processor.timeout).toBe(30000);
  });

  test('respects custom options', () => {
    const processor = new ConcurrentProcessor({
      concurrency: 3,
      timeout: 10000
    });
    expect(processor.concurrency).toBe(3);
    expect(processor.timeout).toBe(10000);
  });

  test('processes batch with concurrency limit', async () => {
    const processor = new ConcurrentProcessor({ concurrency: 2 });
    const items = [1, 2, 3, 4, 5];
    
    const processItem = async (item) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return item * 2;
    };
    
    const { results, errors } = await processor.processBatch(items, processItem);
    
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errors).toEqual([]);
  });

  test('handles errors in batch processing', async () => {
    const processor = new ConcurrentProcessor({ concurrency: 2 });
    const items = [1, 2, 3];
    
    const processItem = async (item) => {
      if (item === 2) {
        throw new Error(`Error processing ${item}`);
      }
      return item * 2;
    };
    
    const { results, errors } = await processor.processBatch(items, processItem);
    
    expect(results).toEqual([2, 6]);
    expect(errors.length).toBe(1);
    expect(errors[0].item).toBe(2);
    expect(errors[0].error.message).toBe('Error processing 2');
  });

  test('handles timeout', async () => {
    const processor = new ConcurrentProcessor({ timeout: 50 });
    
    const slowFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'done';
    };
    
    await expect(
      processor.withTimeout(slowFunction(), 50, 'Slow operation')
    ).rejects.toThrow('Slow operation timed out after 50ms');
  });

  test('processes with rate limiting', async () => {
    const processor = new ConcurrentProcessor();
    const items = [1, 2, 3];
    const processItem = async (item) => item * 2;
    
    const startTime = Date.now();
    const results = await processor.processWithRateLimit(items, processItem, 5); // 5 ops/sec
    const duration = Date.now() - startTime;
    
    expect(results).toEqual([2, 4, 6]);
    // Should take at least 400ms for 3 items at 5 ops/sec (200ms between each)
    expect(duration).toBeGreaterThan(200);
  });
});