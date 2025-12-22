import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ContextBundler } from "../src/ContextBundler.js";
import { mkdir, rm, readFile, readdir } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/bundler_test";

describe("ContextBundler", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("DEFAULT_SIZES", () => {
    test("has expected default token sizes", () => {
      expect(ContextBundler.DEFAULT_SIZES).toContain(2000);
      expect(ContextBundler.DEFAULT_SIZES).toContain(8000);
      expect(ContextBundler.DEFAULT_SIZES).toContain(32000);
      expect(ContextBundler.DEFAULT_SIZES).toContain(128000);
    });
  });

  describe("constructor", () => {
    test("uses default sizes when not specified", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.bundleSizes).toEqual(ContextBundler.DEFAULT_SIZES);
    });

    test("accepts custom bundle sizes", () => {
      const bundler = new ContextBundler(TEST_DIR, {
        bundleSizes: [1000, 5000]
      });
      expect(bundler.bundleSizes).toEqual([1000, 5000]);
    });

    test("accepts base URL", () => {
      const bundler = new ContextBundler(TEST_DIR, {
        baseUrl: "https://example.com/"
      });
      expect(bundler.baseUrl).toBe("https://example.com/");
    });

    test("accepts custom priority weights", () => {
      const weights = { isIndex: 200, isReadme: 150 };
      const bundler = new ContextBundler(TEST_DIR, {
        priorityWeights: weights
      });
      expect(bundler.priorityWeights.isIndex).toBe(200);
      expect(bundler.priorityWeights.isReadme).toBe(150);
    });
  });

  describe("formatSize", () => {
    test("formats small sizes", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.formatSize(500)).toBe("500");
    });

    test("formats thousands as k", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.formatSize(2000)).toBe("2k");
      expect(bundler.formatSize(8000)).toBe("8k");
      expect(bundler.formatSize(32000)).toBe("32k");
    });

    test("rounds to nearest k", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.formatSize(2500)).toBe("3k");
    });
  });

  describe("estimateTokens", () => {
    test("estimates tokens from content length", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.estimateTokens("test")).toBe(1);
      expect(bundler.estimateTokens("testtest")).toBe(2);
    });

    test("handles empty content", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.estimateTokens("")).toBe(0);
      expect(bundler.estimateTokens(null)).toBe(0);
    });

    test("rounds up token count", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.estimateTokens("t")).toBe(1);
      expect(bundler.estimateTokens("test1")).toBe(2);
    });
  });

  describe("isIndexFile", () => {
    test("recognizes index files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isIndexFile("index.md")).toBe(true);
      expect(bundler.isIndexFile("INDEX.MD")).toBe(true);
      expect(bundler.isIndexFile("index.mdx")).toBe(true);
      expect(bundler.isIndexFile("index.html")).toBe(true);
    });

    test("rejects non-index files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isIndexFile("readme.md")).toBe(false);
      expect(bundler.isIndexFile("home.md")).toBe(false);
    });
  });

  describe("isReadmeFile", () => {
    test("recognizes readme files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isReadmeFile("readme.md")).toBe(true);
      expect(bundler.isReadmeFile("README.MD")).toBe(true);
      expect(bundler.isReadmeFile("readme.mdx")).toBe(true);
    });

    test("rejects non-readme files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isReadmeFile("index.md")).toBe(false);
      expect(bundler.isReadmeFile("about.md")).toBe(false);
    });
  });

  describe("isImportantDoc", () => {
    test("recognizes important patterns", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isImportantDoc("getting-started.md")).toBe(true);
      expect(bundler.isImportantDoc("docs/quickstart.md")).toBe(true);
      expect(bundler.isImportantDoc("api/reference.md")).toBe(true);
      expect(bundler.isImportantDoc("guides/tutorial.md")).toBe(true);
    });

    test("rejects unimportant paths", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.isImportantDoc("changelog.md")).toBe(false);
      expect(bundler.isImportantDoc("license.md")).toBe(false);
    });
  });

  describe("titleFromPath", () => {
    test("extracts title from path", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.titleFromPath("getting-started.md")).toBe("getting started");
      expect(bundler.titleFromPath("api_reference.md")).toBe("api reference");
    });

    test("handles nested paths", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.titleFromPath("docs/api/endpoints.md")).toBe("endpoints");
    });
  });

  describe("getSectionName", () => {
    test("extracts section from path", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.getSectionName("docs/file.md")).toBe("docs");
      expect(bundler.getSectionName("api/endpoints/list.md")).toBe("api");
    });

    test("returns Root for root-level files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      expect(bundler.getSectionName("readme.md")).toBe("Root");
    });
  });

  describe("calculateDocumentScore", () => {
    test("gives high score to index files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const indexDoc = { relativePath: "index.md", content: "test" };
      const otherDoc = { relativePath: "other.md", content: "test" };

      const indexScore = bundler.calculateDocumentScore(indexDoc, {});
      const otherScore = bundler.calculateDocumentScore(otherDoc, {});

      expect(indexScore).toBeGreaterThan(otherScore);
    });

    test("gives high score to readme files", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const readmeDoc = { relativePath: "readme.md", content: "test" };
      const otherDoc = { relativePath: "random.md", content: "test" };

      const readmeScore = bundler.calculateDocumentScore(readmeDoc, {});
      const otherScore = bundler.calculateDocumentScore(otherDoc, {});

      expect(readmeScore).toBeGreaterThan(otherScore);
    });

    test("boosts important documentation", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const importantDoc = { relativePath: "getting-started.md", content: "test" };
      const otherDoc = { relativePath: "changelog.md", content: "test" };

      const importantScore = bundler.calculateDocumentScore(importantDoc, {});
      const otherScore = bundler.calculateDocumentScore(otherDoc, {});

      expect(importantScore).toBeGreaterThan(otherScore);
    });

    test("penalizes very long documents", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const longDoc = { relativePath: "long.md", content: "x".repeat(15000) };
      const shortDoc = { relativePath: "short.md", content: "short content" };

      const longScore = bundler.calculateDocumentScore(longDoc, {});
      const shortScore = bundler.calculateDocumentScore(shortDoc, {});

      expect(shortScore).toBeGreaterThan(longScore);
    });

    test("uses link graph importance if provided", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const doc = { relativePath: "popular.md", content: "test" };
      const linkGraph = {
        nodes: [{ path: "popular.md", importance: 0.8 }]
      };

      const scoreWithGraph = bundler.calculateDocumentScore(doc, { linkGraph });
      const scoreWithoutGraph = bundler.calculateDocumentScore(doc, {});

      expect(scoreWithGraph).toBeGreaterThan(scoreWithoutGraph);
    });
  });

  describe("rankDocuments", () => {
    test("sorts documents by priority", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const docs = [
        { relativePath: "changelog.md", content: "changes" },
        { relativePath: "index.md", content: "home" },
        { relativePath: "readme.md", content: "readme" }
      ];

      const ranked = bundler.rankDocuments(docs, {});

      expect(ranked[0].relativePath).toBe("index.md");
      expect(ranked[1].relativePath).toBe("readme.md");
    });

    test("adds _priority property to documents", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const docs = [{ relativePath: "test.md", content: "content" }];

      const ranked = bundler.rankDocuments(docs, {});

      expect(ranked[0]._priority).toBeDefined();
      expect(typeof ranked[0]._priority).toBe("number");
    });
  });

  describe("buildHeader", () => {
    test("builds header from metadata", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const metadata = {
        title: "Test Project",
        description: "A test project description"
      };

      const header = bundler.buildHeader(metadata);

      expect(header).toContain("# Test Project");
      expect(header).toContain("> A test project description");
    });

    test("includes instructions if provided", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const metadata = {
        title: "Test",
        description: "Desc",
        instructions: "Use this for testing"
      };

      const header = bundler.buildHeader(metadata);

      expect(header).toContain("Use this for testing");
    });
  });

  describe("buildDocumentEntry", () => {
    test("builds full document entry", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const doc = {
        relativePath: "test.md",
        content: "Test content here",
        metadata: { title: "Test Document" }
      };

      const entry = bundler.buildDocumentEntry(doc);

      expect(entry).toContain("## Test Document");
      expect(entry).toContain("*Source: test.md*");
      expect(entry).toContain("Test content here");
      expect(entry).toContain("---");
    });

    test("uses path for title when metadata missing", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const doc = {
        relativePath: "getting-started.md",
        content: "Content"
      };

      const entry = bundler.buildDocumentEntry(doc);

      expect(entry).toContain("## getting started");
    });
  });

  describe("buildDocumentReference", () => {
    test("builds minimal reference", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const doc = {
        relativePath: "test.md",
        metadata: { title: "Test Doc" }
      };

      const ref = bundler.buildDocumentReference(doc);

      expect(ref).toContain("- [Test Doc](test.md)");
    });

    test("uses base URL when provided", () => {
      const bundler = new ContextBundler(TEST_DIR, {
        baseUrl: "https://example.com/"
      });
      const doc = {
        relativePath: "test.md",
        metadata: { title: "Test" }
      };

      const ref = bundler.buildDocumentReference(doc);

      expect(ref).toContain("https://example.com/test.md");
    });

    test("includes notes if available", () => {
      const bundler = new ContextBundler(TEST_DIR);
      const doc = {
        relativePath: "test.md",
        metadata: { title: "Test", notes: "Important doc" }
      };

      const ref = bundler.buildDocumentReference(doc);

      expect(ref).toContain(": Important doc");
    });
  });

  describe("generate", () => {
    test("generates bundles for all sizes", async () => {
      const bundler = new ContextBundler(TEST_DIR, {
        bundleSizes: [1000, 2000],
        silent: true
      });

      const docs = [
        { relativePath: "index.md", content: "Home content", metadata: { title: "Home" } },
        { relativePath: "about.md", content: "About content", metadata: { title: "About" } }
      ];

      const metadata = { title: "Test", description: "Test project" };
      const sections = new Map();

      const bundles = await bundler.generate(docs, metadata, sections);

      expect(Object.keys(bundles)).toHaveLength(2);
      expect(bundles[1000]).toBeDefined();
      expect(bundles[2000]).toBeDefined();
    });

    test("creates bundle files", async () => {
      const bundler = new ContextBundler(TEST_DIR, {
        bundleSizes: [2000],
        silent: true
      });

      const docs = [
        { relativePath: "test.md", content: "Content", metadata: { title: "Test" } }
      ];

      await bundler.generate(docs, { title: "Test", description: "Desc" }, new Map());

      const files = await readdir(TEST_DIR);
      expect(files).toContain("llms-ctx-2k.txt");
    });

    test("creates metadata file", async () => {
      const bundler = new ContextBundler(TEST_DIR, {
        bundleSizes: [2000],
        silent: true
      });

      await bundler.generate(
        [{ relativePath: "test.md", content: "x", metadata: {} }],
        { title: "Test", description: "Desc" },
        new Map()
      );

      const metaPath = join(TEST_DIR, "bundles.meta.json");
      const metaContent = await readFile(metaPath, "utf8");
      const meta = JSON.parse(metaContent);

      expect(meta.version).toBe("1.0.0");
      expect(meta.bundles).toHaveLength(1);
      expect(meta.bundles[0].filename).toBe("llms-ctx-2k.txt");
    });

    test("tracks included sections", async () => {
      const bundler = new ContextBundler(TEST_DIR, {
        bundleSizes: [4000],
        silent: true
      });

      const docs = [
        { relativePath: "api/endpoints.md", content: "API", metadata: {} },
        { relativePath: "guides/intro.md", content: "Guide", metadata: {} }
      ];

      const bundles = await bundler.generate(
        docs,
        { title: "Test", description: "Desc" },
        new Map()
      );

      expect(bundles[4000].sectionsIncluded).toContain("api");
      expect(bundles[4000].sectionsIncluded).toContain("guides");
    });
  });

  describe("generateBundle", () => {
    test("respects token limits", async () => {
      const bundler = new ContextBundler(TEST_DIR, { silent: true });

      // Create docs with known content sizes
      const docs = [
        { relativePath: "short.md", content: "x".repeat(100), metadata: { title: "Short" } },
        { relativePath: "long.md", content: "x".repeat(10000), metadata: { title: "Long" } }
      ];

      const ranked = bundler.rankDocuments(docs, {});
      const bundle = await bundler.generateBundle(
        500, // Very small limit
        ranked,
        { title: "Test", description: "Desc" },
        new Map()
      );

      // Should not include all documents
      expect(bundle.actualTokens).toBeLessThanOrEqual(500);
    });

    test("adds truncation notice when not all docs included", async () => {
      const bundler = new ContextBundler(TEST_DIR, { silent: true });

      const docs = Array(10).fill(null).map((_, i) => ({
        relativePath: `doc${i}.md`,
        content: "x".repeat(1000),
        metadata: { title: `Doc ${i}` }
      }));

      const ranked = bundler.rankDocuments(docs, {});
      const bundle = await bundler.generateBundle(
        500,
        ranked,
        { title: "Test", description: "Desc" },
        new Map()
      );

      expect(bundle.documentCount).toBeLessThan(10);

      const content = await readFile(join(TEST_DIR, bundle.filename), "utf8");
      expect(content).toContain("Context truncated");
    });
  });
});
