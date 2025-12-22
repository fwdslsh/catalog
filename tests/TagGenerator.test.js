import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { TagGenerator } from "../src/TagGenerator.js";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

const TEST_OUTPUT_DIR = "./tests/tags_test_output";

describe("TagGenerator", () => {
  beforeAll(async () => {
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates instance with default rules", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR);
      expect(generator.pathRules.length).toBeGreaterThan(0);
      expect(generator.keywordRules.length).toBeGreaterThan(0);
    });

    test("accepts custom rules", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, {
        customPathRules: [{ pattern: /^custom\//, tag: "custom-tag" }]
      });
      expect(generator.pathRules.length).toBe(TagGenerator.PATH_RULES.length + 1);
    });
  });

  describe("path-based tagging", () => {
    test("tags API paths", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "api/endpoints.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("api-reference");
    });

    test("tags docs paths", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "docs/intro.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("documentation");
    });

    test("tags guide paths", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "guides/setup.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("guide");
    });
  });

  describe("filename-based tagging", () => {
    test("tags README files", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "README.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("readme");
    });

    test("tags index files", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "index.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("index");
    });

    test("tags changelog files", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = { relativePath: "CHANGELOG.md", content: "", metadata: {} };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("changelog");
    });
  });

  describe("keyword-based tagging", () => {
    test("tags getting started content", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "intro.md",
        content: "This is a getting started guide.",
        metadata: { title: "Getting Started" }
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("getting-started");
    });

    test("tags tutorial content", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "learn.md",
        content: "This tutorial walks you through...",
        metadata: {}
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("tutorial");
    });

    test("tags authentication content", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "security.md",
        content: "Configure authentication using OAuth.",
        metadata: {}
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("authentication");
    });
  });

  describe("frontmatter-based tagging", () => {
    test("extracts tags from frontmatter", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "",
        metadata: { tags: ["custom-tag", "another-tag"] }
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("custom-tag");
      expect(tags).toContain("another-tag");
    });

    test("extracts categories from frontmatter", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "",
        metadata: { categories: ["web", "backend"] }
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("web");
      expect(tags).toContain("backend");
    });

    test("extracts type from frontmatter", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "",
        metadata: { type: "reference" }
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("reference");
    });
  });

  describe("content characteristic detection", () => {
    test("detects code blocks", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "```javascript\nconst x = 1;\n```",
        metadata: {}
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("has-code");
      expect(tags).toContain("lang:javascript");
    });

    test("detects tables", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "| A | B |\n|---|---|\n| 1 | 2 |",
        metadata: {}
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("has-tables");
    });

    test("detects links", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });
      const doc = {
        relativePath: "test.md",
        content: "See [this link](./other.md) for more.",
        metadata: {}
      };
      const tags = generator.tagDocument(doc);
      expect(tags).toContain("has-links");
    });

    test("classifies content length", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });

      const shortDoc = {
        relativePath: "short.md",
        content: "Short content.",
        metadata: {}
      };
      expect(generator.tagDocument(shortDoc)).toContain("length:short");

      const longDoc = {
        relativePath: "long.md",
        content: "word ".repeat(3000),
        metadata: {}
      };
      expect(generator.tagDocument(longDoc)).toContain("length:long");
    });
  });

  describe("generate", () => {
    test("generates tags for all documents", async () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        { relativePath: "api/users.md", content: "User API docs", metadata: {} },
        { relativePath: "guides/setup.md", content: "Getting started guide", metadata: {} }
      ];

      const tags = await generator.generate(documents);

      expect(tags["api/users.md"]).toContain("api-reference");
      expect(tags["guides/setup.md"]).toContain("guide");

      // Verify files were created
      const content = await readFile(join(TEST_OUTPUT_DIR, "tags.json"), "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.documents).toBeDefined();
    });

    test("generates inverted index", async () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        { relativePath: "a.md", content: "", metadata: { tags: ["shared-tag"] } },
        { relativePath: "b.md", content: "", metadata: { tags: ["shared-tag"] } }
      ];

      await generator.generate(documents);

      const content = await readFile(join(TEST_OUTPUT_DIR, "tags-by-tag.json"), "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.tags["shared-tag"]).toContain("a.md");
      expect(parsed.tags["shared-tag"]).toContain("b.md");
    });
  });

  describe("normalizeTag", () => {
    test("normalizes tag strings", () => {
      const generator = new TagGenerator(TEST_OUTPUT_DIR);
      expect(generator.normalizeTag("Hello World")).toBe("hello-world");
      expect(generator.normalizeTag("API Reference")).toBe("api-reference");
      expect(generator.normalizeTag("test_tag")).toBe("test-tag");
    });
  });
});
