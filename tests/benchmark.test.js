import { describe, test, expect } from 'bun:test';
import { CatalogProcessor } from '../src/CatalogProcessor.js';
import { ContentProcessor } from '../src/ContentProcessor.js';
import { DirectoryScanner } from '../src/DirectoryScanner.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

/**
 * Performance Benchmark Tests
 *
 * These tests measure performance characteristics and ensure
 * the tool meets acceptable performance standards for various
 * document set sizes.
 *
 * Benchmarks:
 * - Small sets (<10 files): Should complete in <100ms
 * - Medium sets (10-100 files): Should complete in <1000ms
 * - Large sets (100+ files): Should complete in <10000ms
 *
 * Run with: bun test tests/benchmark.test.js
 */

describe('Performance Benchmarks', () => {
  const benchmarkDir = './tests/benchmark_test';

  /**
   * Helper to create test files
   */
  async function createTestFiles(dir, count, sizeKB = 1) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    const content = 'x'.repeat(sizeKB * 1024); // Generate file content

    for (let i = 0; i < count; i++) {
      const filename = `file${i.toString().padStart(4, '0')}.md`;
      const fileContent = `---
title: Test Document ${i}
description: Benchmark test file ${i}
---

# Test Document ${i}

${content}

This is test content for benchmarking purposes.
`;
      await writeFile(join(dir, filename), fileContent);
    }
  }

  /**
   * Helper to measure execution time
   */
  async function measureTime(fn) {
    const start = Date.now();
    await fn();
    const end = Date.now();
    return end - start;
  }

  /**
   * Cleanup after tests
   */
  async function cleanup() {
    await rm(benchmarkDir, { recursive: true, force: true });
    await rm('./tests/benchmark_output', { recursive: true, force: true });
  }

  describe('Small Document Sets (<10 files)', () => {
    test('should process 5 files in <100ms', async () => {
      await createTestFiles(benchmarkDir, 5, 1);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          { silent: true }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 5 files in ${duration}ms`);
      expect(duration).toBeLessThan(100);

      await cleanup();
    });

    test('should scan directory with 10 files in <50ms', async () => {
      await createTestFiles(benchmarkDir, 10, 1);

      const duration = await measureTime(async () => {
        const scanner = new DirectoryScanner({});
        await scanner.scanDirectory(benchmarkDir);
      });

      console.log(`  ⏱️  Scanned 10 files in ${duration}ms`);
      expect(duration).toBeLessThan(50);

      await cleanup();
    });
  });

  describe('Medium Document Sets (10-50 files)', () => {
    test('should process 25 files in <500ms', async () => {
      await createTestFiles(benchmarkDir, 25, 2);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          { silent: true }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 25 files in ${duration}ms`);
      expect(duration).toBeLessThan(500);

      await cleanup();
    });

    test('should process 50 files in <1000ms', async () => {
      await createTestFiles(benchmarkDir, 50, 2);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          { silent: true }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 50 files in ${duration}ms`);
      expect(duration).toBeLessThan(1000);

      await cleanup();
    });
  });

  describe('Large Document Sets (100+ files)', () => {
    test('should process 100 files in <2000ms', async () => {
      await createTestFiles(benchmarkDir, 100, 2);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          { silent: true }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 100 files in ${duration}ms`);
      expect(duration).toBeLessThan(2000);

      await cleanup();
    }, { timeout: 10000 }); // Allow up to 10s for this test

    test('should process 200 files in <5000ms', async () => {
      await createTestFiles(benchmarkDir, 200, 2);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          { silent: true }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 200 files in ${duration}ms`);
      expect(duration).toBeLessThan(5000);

      await cleanup();
    }, { timeout: 15000 }); // Allow up to 15s for this test
  });

  describe('Content Processing Performance', () => {
    test('should process files with frontmatter efficiently', async () => {
      await createTestFiles(benchmarkDir, 20, 3);
      const scanner = new DirectoryScanner({});
      const files = await scanner.scanDirectory(benchmarkDir);

      const processor = new ContentProcessor(benchmarkDir, { silent: true });

      const duration = await measureTime(async () => {
        await processor.processFiles(files);
      });

      console.log(`  ⏱️  Processed 20 files with frontmatter in ${duration}ms`);
      expect(duration).toBeLessThan(200);

      await cleanup();
    });
  });

  describe('Memory Usage', () => {
    test('should not exceed reasonable memory limits for 100 files', async () => {
      await createTestFiles(benchmarkDir, 100, 5); // 5KB files

      const before = process.memoryUsage();

      const processor = new CatalogProcessor(
        benchmarkDir,
        './tests/benchmark_output',
        { silent: true }
      );
      await processor.process();

      const after = process.memoryUsage();
      const heapIncrease = (after.heapUsed - before.heapUsed) / (1024 * 1024); // MB

      console.log(`  💾 Heap increased by ${heapIncrease.toFixed(2)}MB for 100 files`);

      // Should not increase heap by more than 50MB for 100 files
      expect(heapIncrease).toBeLessThan(50);

      await cleanup();
    }, { timeout: 15000 });
  });

  describe('Performance with All Features Enabled', () => {
    test('should handle full feature set efficiently', async () => {
      await createTestFiles(benchmarkDir, 30, 2);

      const duration = await measureTime(async () => {
        const processor = new CatalogProcessor(
          benchmarkDir,
          './tests/benchmark_output',
          {
            silent: true,
            generateIndex: true,
            generateSitemap: true,
            baseUrl: 'https://example.com',
            validate: true,
            optionalPatterns: ['**/file002*.md']
          }
        );
        await processor.process();
      });

      console.log(`  ⏱️  Processed 30 files with all features in ${duration}ms`);
      expect(duration).toBeLessThan(1000);

      await cleanup();
    });
  });

  describe('Scalability Tests', () => {
    test('should scale roughly linearly with file count', async () => {
      const results = [];

      // Test with 10, 20, 40 files
      for (const count of [10, 20, 40]) {
        await createTestFiles(benchmarkDir, count, 2);

        const duration = await measureTime(async () => {
          const processor = new CatalogProcessor(
            benchmarkDir,
            './tests/benchmark_output',
            { silent: true }
          );
          await processor.process();
        });

        results.push({ count, duration });
        console.log(`  📊 ${count} files: ${duration}ms (${(duration / count).toFixed(2)}ms per file)`);

        await cleanup();
      }

      // Check that doubling files doesn't more than triple the time
      // (allows for some overhead but ensures roughly linear scaling)
      const ratio = results[2].duration / results[0].duration; // 40 files vs 10 files
      console.log(`  📈 Scaling ratio (4x files): ${ratio.toFixed(2)}x time`);
      expect(ratio).toBeLessThan(6); // Should be less than 6x for 4x files

    }, { timeout: 20000 });
  });
});
