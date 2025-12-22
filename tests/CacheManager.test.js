import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { CacheManager } from "../src/CacheManager.js";
import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/cache_test";
const CACHE_DIR = "./tests/cache_test/.cache";
const INPUT_DIR = "./tests/cache_test/input";
const OUTPUT_DIR = "./tests/cache_test/output";

describe("CacheManager", () => {
  beforeAll(async () => {
    await mkdir(INPUT_DIR, { recursive: true });
    await mkdir(OUTPUT_DIR, { recursive: true });
    await mkdir(CACHE_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("DEFAULT_CACHE_DIR", () => {
    test("has expected default cache directory path", () => {
      expect(CacheManager.DEFAULT_CACHE_DIR).toContain(".cache");
      expect(CacheManager.DEFAULT_CACHE_DIR).toContain("catalog");
    });
  });

  describe("constructor", () => {
    test("resolves input and output directories", () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        outputDir: OUTPUT_DIR
      });

      expect(cache.inputDir).toContain("cache_test/input");
      expect(cache.outputDir).toContain("cache_test/output");
    });

    test("generates project key from input directory", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });
      expect(cache.projectKey).toHaveLength(12);
    });

    test("accepts custom cache directory", () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: CACHE_DIR
      });

      expect(cache.cacheDir).toBe(CACHE_DIR);
    });

    test("initializes with null state", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });
      expect(cache.previousState).toBeNull();
      expect(cache.currentState).toBeNull();
    });

    test("accepts forceRebuild option", () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        forceRebuild: true
      });

      expect(cache.forceRebuild).toBe(true);
    });
  });

  describe("sha256", () => {
    test("generates consistent hash", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });
      const hash1 = cache.sha256("test content");
      const hash2 = cache.sha256("test content");

      expect(hash1).toBe(hash2);
    });

    test("generates different hash for different content", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });
      const hash1 = cache.sha256("content a");
      const hash2 = cache.sha256("content b");

      expect(hash1).not.toBe(hash2);
    });

    test("generates 64 character hex string", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });
      const hash = cache.sha256("test");

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("initialize", () => {
    test("creates cache directory", async () => {
      const customCacheDir = join(TEST_DIR, "init_test_cache");
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: customCacheDir
      });

      await cache.initialize();

      // Verify directory exists (access resolves without throwing)
      const { access } = await import("fs/promises");
      const result = await access(customCacheDir);
      expect(result === undefined || result === null).toBe(true);
    });

    test("returns false when no previous state", async () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: join(TEST_DIR, "empty_cache"),
        silent: true
      });

      const result = await cache.initialize();

      expect(result).toBe(false);
      expect(cache.previousState).toBeNull();
    });

    test("loads previous state if exists", async () => {
      const cacheDir = join(TEST_DIR, "with_state");
      await mkdir(cacheDir, { recursive: true });

      const state = {
        version: "1.0.0",
        files: { "test.md": { hash: "abc123" } }
      };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state),
        "utf8"
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      const result = await cache.initialize();

      expect(result).toBe(true);
      expect(cache.previousState.files["test.md"]).toBeDefined();
    });
  });

  describe("getChangedFiles", () => {
    test("returns all files as added when no previous state", async () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        silent: true
      });

      const files = [join(INPUT_DIR, "a.md"), join(INPUT_DIR, "b.md")];
      const result = await cache.getChangedFiles(files);

      expect(result.added).toHaveLength(2);
      expect(result.changed).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
      expect(result.requiresFullRebuild).toBe(true);
    });

    test("returns all files as added when forceRebuild is true", async () => {
      const cacheDir = join(TEST_DIR, "force_rebuild_cache");
      await mkdir(cacheDir, { recursive: true });

      // Create previous state
      const state = {
        version: "1.0.0",
        files: { "a.md": { hash: "abc" } }
      };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state)
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        forceRebuild: true,
        silent: true
      });

      await cache.initialize();
      const files = [join(INPUT_DIR, "a.md")];
      const result = await cache.getChangedFiles(files);

      expect(result.added).toContain(files[0]);
      expect(result.requiresFullRebuild).toBe(true);
    });

    test("identifies deleted files", async () => {
      const cacheDir = join(TEST_DIR, "deleted_cache");
      await mkdir(cacheDir, { recursive: true });

      // Previous state had 2 files
      const state = {
        version: "1.0.0",
        files: {
          "a.md": { hash: "abc", mtimeMs: 1000, size: 100 },
          "deleted.md": { hash: "def", mtimeMs: 1000, size: 100 }
        }
      };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state)
      );

      // Create only one file
      await writeFile(join(INPUT_DIR, "a.md"), "content a");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.initialize();
      const result = await cache.getChangedFiles([join(INPUT_DIR, "a.md")]);

      expect(result.deleted).toContain("deleted.md");
    });
  });

  describe("hasFileChanged", () => {
    test("returns true when mtime changed", async () => {
      await writeFile(join(INPUT_DIR, "mtime_test.md"), "content");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        silent: true
      });

      const previousEntry = { mtimeMs: 0, size: 7 };
      const result = await cache.hasFileChanged(
        join(INPUT_DIR, "mtime_test.md"),
        previousEntry
      );

      expect(result).toBe(true);
    });

    test("returns true when size changed", async () => {
      await writeFile(join(INPUT_DIR, "size_test.md"), "content");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        silent: true
      });

      const { stat } = await import("fs/promises");
      const stats = await stat(join(INPUT_DIR, "size_test.md"));

      const previousEntry = { mtimeMs: stats.mtimeMs, size: 999 };
      const result = await cache.hasFileChanged(
        join(INPUT_DIR, "size_test.md"),
        previousEntry
      );

      expect(result).toBe(true);
    });

    test("returns true when file does not exist", async () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        silent: true
      });

      const result = await cache.hasFileChanged(
        join(INPUT_DIR, "nonexistent.md"),
        { mtimeMs: 0, size: 0 }
      );

      expect(result).toBe(true);
    });

    test("checks hash when mtime and size match", async () => {
      const content = "test content";
      await writeFile(join(INPUT_DIR, "hash_test.md"), content);

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        silent: true
      });

      const { stat } = await import("fs/promises");
      const stats = await stat(join(INPUT_DIR, "hash_test.md"));

      const previousEntry = {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        hash: cache.sha256(content)
      };

      const result = await cache.hasFileChanged(
        join(INPUT_DIR, "hash_test.md"),
        previousEntry
      );

      expect(result).toBe(false);
    });
  });

  describe("updateCache", () => {
    test("writes cache state file", async () => {
      const cacheDir = join(TEST_DIR, "update_cache");
      await mkdir(cacheDir, { recursive: true });

      await writeFile(join(INPUT_DIR, "cached.md"), "cached content");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        outputDir: OUTPUT_DIR,
        cacheDir,
        silent: true
      });

      const docs = [
        {
          fullPath: join(INPUT_DIR, "cached.md"),
          relativePath: "cached.md",
          content: "cached content"
        }
      ];

      await cache.updateCache(docs);

      const statePath = join(cacheDir, "build.state.json");
      const stateContent = await readFile(statePath, "utf8");
      const state = JSON.parse(stateContent);

      expect(state.version).toBe("1.0.0");
      expect(state.file_count).toBe(1);
      expect(state.files["cached.md"]).toBeDefined();
    });

    test("also writes to output directory", async () => {
      const cacheDir = join(TEST_DIR, "update_cache_output");
      const outputDir = join(TEST_DIR, "update_output");
      await mkdir(cacheDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });

      await writeFile(join(INPUT_DIR, "out.md"), "content");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        outputDir,
        cacheDir,
        silent: true
      });

      await cache.updateCache([
        { fullPath: join(INPUT_DIR, "out.md"), relativePath: "out.md", content: "c" }
      ]);

      const outputStatePath = join(outputDir, "build.state.json");
      const outputState = await readFile(outputStatePath, "utf8");

      expect(JSON.parse(outputState).version).toBe("1.0.0");
    });

    test("includes metadata in state", async () => {
      const cacheDir = join(TEST_DIR, "meta_cache");
      await mkdir(cacheDir, { recursive: true });

      await writeFile(join(INPUT_DIR, "meta.md"), "content");

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        outputDir: OUTPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.updateCache(
        [{ fullPath: join(INPUT_DIR, "meta.md"), relativePath: "meta.md", content: "c" }],
        { generatorVersion: "1.0.0", buildDuration: 100 }
      );

      const state = JSON.parse(
        await readFile(join(cacheDir, "build.state.json"), "utf8")
      );

      expect(state.metadata.generator_version).toBe("1.0.0");
      expect(state.metadata.build_duration_ms).toBe(100);
    });
  });

  describe("getCachedDocument", () => {
    test("returns null when no previous state", () => {
      const cache = new CacheManager({ inputDir: INPUT_DIR });

      expect(cache.getCachedDocument("test.md")).toBeNull();
    });

    test("returns cached data when available", async () => {
      const cacheDir = join(TEST_DIR, "get_cached");
      await mkdir(cacheDir, { recursive: true });

      const state = {
        version: "1.0.0",
        files: {
          "test.md": { hash: "abc123", mtimeMs: 1000 }
        }
      };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state)
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.initialize();
      const cached = cache.getCachedDocument("test.md");

      expect(cached.hash).toBe("abc123");
    });

    test("returns null for uncached document", async () => {
      const cacheDir = join(TEST_DIR, "uncached");
      await mkdir(cacheDir, { recursive: true });

      const state = { version: "1.0.0", files: {} };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state)
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.initialize();

      expect(cache.getCachedDocument("nonexistent.md")).toBeNull();
    });
  });

  describe("clearCache", () => {
    test("removes cache state file", async () => {
      const cacheDir = join(TEST_DIR, "clear_cache");
      await mkdir(cacheDir, { recursive: true });

      const statePath = join(cacheDir, "build.state.json");
      await writeFile(statePath, JSON.stringify({ version: "1.0.0" }));

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.clearCache();

      const { access } = await import("fs/promises");
      await expect(access(statePath)).rejects.toThrow();
    });

    test("resets state properties", async () => {
      const cacheDir = join(TEST_DIR, "clear_reset");
      await mkdir(cacheDir, { recursive: true });

      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify({ version: "1.0.0", files: {} })
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.initialize();
      cache.currentState = { version: "1.0.0" };

      await cache.clearCache();

      expect(cache.previousState).toBeNull();
      expect(cache.currentState).toBeNull();
    });

    test("handles missing cache file gracefully", async () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: join(TEST_DIR, "nonexistent_cache"),
        silent: true
      });

      // Should not throw
      await expect(cache.clearCache()).resolves.toBeUndefined();
    });
  });

  describe("getStats", () => {
    test("returns cache statistics", () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: CACHE_DIR
      });

      const stats = cache.getStats();

      expect(stats.cacheDir).toBe(CACHE_DIR);
      expect(stats.projectKey).toBeDefined();
      expect(stats.hasPreviousState).toBe(false);
      expect(stats.hasCurrentState).toBe(false);
    });

    test("includes file counts from state", async () => {
      const cacheDir = join(TEST_DIR, "stats_cache");
      await mkdir(cacheDir, { recursive: true });

      const state = {
        version: "1.0.0",
        file_count: 5,
        updated_at: "2024-01-01T00:00:00Z",
        files: {}
      };
      await writeFile(
        join(cacheDir, "build.state.json"),
        JSON.stringify(state)
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.initialize();
      const stats = cache.getStats();

      expect(stats.hasPreviousState).toBe(true);
      expect(stats.previousFileCount).toBe(5);
      expect(stats.lastBuildTime).toBe("2024-01-01T00:00:00Z");
    });
  });

  describe("trackVersion", () => {
    test("creates version history file", async () => {
      const cacheDir = join(TEST_DIR, "version_cache");
      await mkdir(cacheDir, { recursive: true });

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.trackVersion({
        relativePath: "versioned.md",
        content: "version 1"
      });

      const historyPath = join(cacheDir, "history", "versioned.md.json");
      const history = JSON.parse(await readFile(historyPath, "utf8"));

      expect(history.path).toBe("versioned.md");
      expect(history.versions).toHaveLength(1);
      expect(history.versions[0].hash).toBeDefined();
    });

    test("appends to existing history", async () => {
      const cacheDir = join(TEST_DIR, "version_append");
      await mkdir(join(cacheDir, "history"), { recursive: true });

      const historyPath = join(cacheDir, "history", "multi.md.json");
      await writeFile(
        historyPath,
        JSON.stringify({
          path: "multi.md",
          versions: [{ hash: "old", timestamp: "2024-01-01" }]
        })
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.trackVersion({ relativePath: "multi.md", content: "new" });

      const history = JSON.parse(await readFile(historyPath, "utf8"));

      expect(history.versions).toHaveLength(2);
    });

    test("limits history to 50 versions", async () => {
      const cacheDir = join(TEST_DIR, "version_limit");
      await mkdir(join(cacheDir, "history"), { recursive: true });

      const historyPath = join(cacheDir, "history", "limited.md.json");
      const versions = Array(50).fill(null).map((_, i) => ({
        hash: `hash${i}`,
        timestamp: new Date().toISOString()
      }));

      await writeFile(
        historyPath,
        JSON.stringify({ path: "limited.md", versions })
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      await cache.trackVersion({ relativePath: "limited.md", content: "new" });

      const history = JSON.parse(await readFile(historyPath, "utf8"));

      expect(history.versions).toHaveLength(50);
    });
  });

  describe("getVersionHistory", () => {
    test("returns empty array for no history", async () => {
      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir: join(TEST_DIR, "no_history"),
        silent: true
      });

      const history = await cache.getVersionHistory("unknown.md");

      expect(history).toEqual([]);
    });

    test("returns version history", async () => {
      const cacheDir = join(TEST_DIR, "get_history");
      await mkdir(join(cacheDir, "history"), { recursive: true });

      await writeFile(
        join(cacheDir, "history", "known.md.json"),
        JSON.stringify({
          path: "known.md",
          versions: [{ hash: "abc", timestamp: "2024-01-01" }]
        })
      );

      const cache = new CacheManager({
        inputDir: INPUT_DIR,
        cacheDir,
        silent: true
      });

      const history = await cache.getVersionHistory("known.md");

      expect(history).toHaveLength(1);
      expect(history[0].hash).toBe("abc");
    });
  });
});
