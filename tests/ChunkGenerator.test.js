import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ChunkGenerator } from "../src/ChunkGenerator.js";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

const TEST_OUTPUT_DIR = "./tests/chunks_test_output";

describe("ChunkGenerator", () => {
  beforeAll(async () => {
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates instance with default profile", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.profile.name).toBe("default");
      expect(generator.profile.targetTokens).toBe(1000);
    });

    test("accepts custom profile", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR, {
        profile: "code-heavy"
      });
      expect(generator.profile.name).toBe("code-heavy");
      expect(generator.profile.codeBlockWeight).toBe(0.5);
    });
  });

  describe("profiles", () => {
    test("has expected profiles defined", () => {
      expect(ChunkGenerator.PROFILES.default).toBeDefined();
      expect(ChunkGenerator.PROFILES["code-heavy"]).toBeDefined();
      expect(ChunkGenerator.PROFILES.faq).toBeDefined();
      expect(ChunkGenerator.PROFILES["large-context"]).toBeDefined();
      expect(ChunkGenerator.PROFILES.granular).toBeDefined();
    });

    test("faq profile has smaller target size", () => {
      expect(ChunkGenerator.PROFILES.faq.targetTokens).toBe(500);
    });

    test("large-context profile has larger target size", () => {
      expect(ChunkGenerator.PROFILES["large-context"].targetTokens).toBe(3000);
    });
  });

  describe("parseStructure", () => {
    test("parses headings into sections", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = `# Main Title

Some preamble text.

## Section One

Content of section one.

## Section Two

Content of section two.
`;
      const structure = generator.parseStructure(content);
      expect(structure.sections.length).toBe(3); // Including h1
    });

    test("handles nested headings", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = `# Title
## Section
### Subsection
Content`;
      const structure = generator.parseStructure(content);
      expect(structure.sections.length).toBe(3);
    });
  });

  describe("createAnchor", () => {
    test("creates URL-safe anchor from title", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.createAnchor("Hello World")).toBe("hello-world");
      expect(generator.createAnchor("API Reference")).toBe("api-reference");
      expect(generator.createAnchor("Getting Started!")).toBe("getting-started");
    });
  });

  describe("estimateTokens", () => {
    test("estimates token count", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = "a".repeat(400); // 400 chars ~ 100 tokens
      expect(generator.estimateTokens(content)).toBe(100);
    });

    test("handles empty content", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.estimateTokens("")).toBe(0);
      expect(generator.estimateTokens(null)).toBe(0);
    });
  });

  describe("splitIntoParagraphs", () => {
    test("splits content on blank lines", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = `Paragraph one.

Paragraph two.

Paragraph three.`;
      const paragraphs = generator.splitIntoParagraphs(content);
      expect(paragraphs.length).toBe(3);
    });

    test("preserves code blocks", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = `Text before.

\`\`\`javascript
const x = 1;

const y = 2;
\`\`\`

Text after.`;
      const paragraphs = generator.splitIntoParagraphs(content);
      // Code block should be kept as single paragraph
      const codeBlock = paragraphs.find(p => p.type === "code");
      expect(codeBlock).toBeDefined();
    });
  });

  describe("hasCode", () => {
    test("detects code blocks", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.hasCode("```js\ncode\n```")).toBe(true);
      expect(generator.hasCode("`inline`")).toBe(true);
      expect(generator.hasCode("no code")).toBe(false);
    });
  });

  describe("hasList", () => {
    test("detects bullet lists", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.hasList("- item")).toBe(true);
      expect(generator.hasList("* item")).toBe(true);
      expect(generator.hasList("+ item")).toBe(true);
    });

    test("detects numbered lists", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      expect(generator.hasList("1. item")).toBe(true);
      expect(generator.hasList("10. item")).toBe(true);
    });
  });

  describe("detectLanguages", () => {
    test("detects languages from code blocks", () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR);
      const content = "```javascript\ncode\n```\n```python\ncode\n```";
      const languages = generator.detectLanguages(content);
      expect(languages).toContain("javascript");
      expect(languages).toContain("python");
    });
  });

  describe("generate", () => {
    test("generates chunks for documents", async () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "test.md",
          content: `# Title

## Section 1

This is the first section with some content.

## Section 2

This is the second section with more content.
`
        }
      ];

      const chunks = await generator.generate(documents);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunk_id).toBeDefined();
      expect(chunks[0].source_path).toBe("test.md");

      // Verify files were created
      const jsonlContent = await readFile(join(TEST_OUTPUT_DIR, "chunks.jsonl"), "utf8");
      expect(jsonlContent.length).toBeGreaterThan(0);
    });

    test("generates stable chunk IDs", async () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "stable.md",
          content: "# Title\n\nContent here."
        }
      ];

      const chunks1 = await generator.generate(documents);
      const chunks2 = await generator.generate(documents);

      expect(chunks1[0].chunk_id).toBe(chunks2[0].chunk_id);
    });

    test("includes citation information", async () => {
      const generator = new ChunkGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "docs/guide.md",
          content: "# Guide\n\n## Section\n\nContent"
        }
      ];

      const chunks = await generator.generate(documents);

      expect(chunks[0].source_path).toBe("docs/guide.md");
      expect(chunks[0].line_range).toBeDefined();
      expect(chunks[0].line_range.start).toBeDefined();
      expect(chunks[0].line_range.end).toBeDefined();
    });
  });
});
