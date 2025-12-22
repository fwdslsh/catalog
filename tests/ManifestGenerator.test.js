import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ManifestGenerator } from "../src/ManifestGenerator.js";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

const TEST_OUTPUT_DIR = "./tests/manifest_test_output";

describe("ManifestGenerator", () => {
  beforeAll(async () => {
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates instance with default options", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      expect(generator.outputDir).toBe(TEST_OUTPUT_DIR);
      expect(generator.silent).toBe(false);
      expect(generator.includeFingerprints).toBe(true);
    });

    test("accepts custom options", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR, {
        silent: true,
        origin: "https://docs.example.com",
        repoRef: "main",
        generatorVersion: "0.2.0"
      });
      expect(generator.silent).toBe(true);
      expect(generator.origin).toBe("https://docs.example.com");
      expect(generator.repoRef).toBe("main");
      expect(generator.generatorVersion).toBe("0.2.0");
    });
  });

  describe("generateDocId", () => {
    test("generates stable doc ID from path and content", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      const doc = {
        relativePath: "test/file.md",
        content: "Hello World"
      };

      const id1 = generator.generateDocId(doc);
      const id2 = generator.generateDocId(doc);

      expect(id1).toBe(id2);
      expect(id1.length).toBe(12);
    });

    test("generates different IDs for different content", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);

      const id1 = generator.generateDocId({
        relativePath: "test.md",
        content: "Content A"
      });

      const id2 = generator.generateDocId({
        relativePath: "test.md",
        content: "Content B"
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe("sha256", () => {
    test("generates consistent hash", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      const hash1 = generator.sha256("test content");
      const hash2 = generator.sha256("test content");
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe("simhash", () => {
    test("generates simhash for near-duplicate detection", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      const hash = generator.simhash("This is a test document with some content");
      expect(hash.length).toBe(16);
    });

    test("similar content has similar simhash", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      const hash1 = generator.simhash("The quick brown fox jumps over the lazy dog");
      const hash2 = generator.simhash("The quick brown fox leaps over the lazy dog");
      // Similar documents should have similar (but not identical) hashes
      expect(hash1).not.toBe(hash2);
    });

    test("handles empty content", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      const hash = generator.simhash("");
      expect(hash).toBe("0000000000000000");
    });
  });

  describe("countWords", () => {
    test("counts words correctly", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      expect(generator.countWords("one two three")).toBe(3);
      expect(generator.countWords("")).toBe(0);
      expect(generator.countWords("single")).toBe(1);
    });
  });

  describe("hasCodeBlocks", () => {
    test("detects fenced code blocks", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      expect(generator.hasCodeBlocks("```js\ncode\n```")).toBe(true);
      expect(generator.hasCodeBlocks("no code here")).toBe(false);
    });

    test("detects inline code", () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR);
      expect(generator.hasCodeBlocks("Use `npm install`")).toBe(true);
    });
  });

  describe("generate", () => {
    test("generates manifest file", async () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "index.md",
          content: "# Home\nWelcome",
          metadata: { title: "Home" }
        },
        {
          relativePath: "docs/guide.md",
          content: "# Guide\nHow to use",
          metadata: { title: "Guide", description: "Usage guide" }
        }
      ];

      const siteMetadata = {
        title: "Test Site",
        description: "A test site"
      };

      const manifest = await generator.generate(documents, siteMetadata);

      expect(manifest.version).toBe("1.0.0");
      expect(manifest.site.title).toBe("Test Site");
      expect(manifest.documents.length).toBe(2);
      expect(manifest.statistics.document_count).toBe(2);

      // Verify file was created
      const content = await readFile(join(TEST_OUTPUT_DIR, "catalog.manifest.json"), "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe("1.0.0");
    });

    test("includes document fingerprints", async () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "test.md",
          content: "Test content",
          metadata: {}
        }
      ];

      const manifest = await generator.generate(documents, {
        title: "Test",
        description: "Test"
      });

      expect(manifest.documents[0].fingerprints).toBeDefined();
      expect(manifest.documents[0].fingerprints.sha256).toBeDefined();
      expect(manifest.documents[0].fingerprints.simhash).toBeDefined();
    });

    test("includes provenance information", async () => {
      const generator = new ManifestGenerator(TEST_OUTPUT_DIR, {
        silent: true,
        origin: "https://example.com",
        repoRef: "v1.0.0",
        generatorVersion: "0.2.0"
      });

      const manifest = await generator.generate(
        [{ relativePath: "test.md", content: "test", metadata: {} }],
        { title: "Test", description: "Test" }
      );

      expect(manifest.provenance.origin).toBe("https://example.com");
      expect(manifest.provenance.repo_ref).toBe("v1.0.0");
      expect(manifest.generator.version).toBe("0.2.0");
    });
  });
});
