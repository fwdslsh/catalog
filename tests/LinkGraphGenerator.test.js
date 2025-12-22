import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { LinkGraphGenerator } from "../src/LinkGraphGenerator.js";
import { mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

const TEST_OUTPUT_DIR = "./tests/graph_test_output";

describe("LinkGraphGenerator", () => {
  beforeAll(async () => {
    await mkdir(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  });

  describe("constructor", () => {
    test("creates instance with default options", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.dampingFactor).toBe(0.85);
      expect(generator.iterations).toBe(20);
      expect(generator.includeSectionGraph).toBe(true);
    });

    test("accepts custom options", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR, {
        dampingFactor: 0.9,
        iterations: 10
      });
      expect(generator.dampingFactor).toBe(0.9);
      expect(generator.iterations).toBe(10);
    });
  });

  describe("isExternalLink", () => {
    test("identifies external HTTP links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.isExternalLink("https://example.com")).toBe(true);
      expect(generator.isExternalLink("http://example.com")).toBe(true);
    });

    test("identifies mailto links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.isExternalLink("mailto:test@example.com")).toBe(true);
    });

    test("identifies protocol-relative links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.isExternalLink("//example.com/path")).toBe(true);
    });

    test("identifies relative links as internal", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.isExternalLink("./other.md")).toBe(false);
      expect(generator.isExternalLink("../docs/guide.md")).toBe(false);
      expect(generator.isExternalLink("file.md")).toBe(false);
    });
  });

  describe("extractLinks", () => {
    test("extracts internal links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      const docPaths = new Set(["other.md", "docs/guide.md"]);
      const doc = {
        relativePath: "index.md",
        content: "See [other](other.md) and [guide](docs/guide.md)."
      };

      const { internal, external } = generator.extractLinks(doc, docPaths);
      expect(internal.length).toBe(2);
      expect(internal[0].target).toBe("other.md");
      expect(internal[1].target).toBe("docs/guide.md");
    });

    test("extracts external links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      const docPaths = new Set(["index.md"]);
      const doc = {
        relativePath: "index.md",
        content: "Visit [website](https://example.com)."
      };

      const { internal, external } = generator.extractLinks(doc, docPaths);
      expect(external.length).toBe(1);
      expect(external[0].target).toBe("https://example.com");
    });

    test("handles anchor links", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      const docPaths = new Set(["index.md", "other.md"]);
      const doc = {
        relativePath: "index.md",
        content: "See [section](#section) and [other section](other.md#details)."
      };

      const { internal } = generator.extractLinks(doc, docPaths);
      // #section is internal anchor to same doc
      const sameDocAnchor = internal.find(l => l.type === "internal-anchor" && l.target === "index.md");
      expect(sameDocAnchor).toBeDefined();
    });
  });

  describe("extractHeadings", () => {
    test("extracts headings from content", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      const content = `# Main Title
## Section One
### Subsection
## Section Two`;

      const headings = generator.extractHeadings(content);
      expect(headings.length).toBe(4);
      expect(headings[0].level).toBe(1);
      expect(headings[0].title).toBe("Main Title");
    });

    test("creates proper anchors", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      const content = "## Getting Started\n## API Reference";

      const headings = generator.extractHeadings(content);
      expect(headings[0].anchor).toBe("getting-started");
      expect(headings[1].anchor).toBe("api-reference");
    });
  });

  describe("createAnchor", () => {
    test("creates URL-safe anchor", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);
      expect(generator.createAnchor("Hello World")).toBe("hello-world");
      expect(generator.createAnchor("API Reference")).toBe("api-reference");
      expect(generator.createAnchor("What's New?")).toBe("whats-new");
    });
  });

  describe("calculateImportance", () => {
    test("calculates PageRank-style importance", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);

      const nodes = [
        { path: "a.md", in_links: 0, out_links: 2 },
        { path: "b.md", in_links: 1, out_links: 1 },
        { path: "c.md", in_links: 2, out_links: 0 }
      ];

      const edges = [
        { source: "a.md", target: "b.md" },
        { source: "a.md", target: "c.md" },
        { source: "b.md", target: "c.md" }
      ];

      generator.calculateImportance(nodes, edges);

      // Node c should have highest importance (most inlinks)
      const nodeC = nodes.find(n => n.path === "c.md");
      const nodeA = nodes.find(n => n.path === "a.md");
      expect(nodeC.importance).toBeGreaterThan(nodeA.importance);
    });
  });

  describe("analyzeGraph", () => {
    test("identifies hubs and authorities", () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR);

      const nodes = [
        { path: "hub.md", in_links: 1, out_links: 10, importance: 50 },
        { path: "auth.md", in_links: 8, out_links: 0, importance: 90 },
        { path: "orphan.md", in_links: 0, out_links: 0, importance: 10 }
      ];

      const edges = [];

      const analysis = generator.analyzeGraph(nodes, edges);

      expect(analysis.hubs.find(h => h.path === "hub.md")).toBeDefined();
      expect(analysis.authorities.find(a => a.path === "auth.md")).toBeDefined();
      expect(analysis.orphans).toContain("orphan.md");
    });
  });

  describe("generate", () => {
    test("generates graph for documents", async () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        {
          relativePath: "index.md",
          content: "# Home\n\nSee [guide](guide.md)."
        },
        {
          relativePath: "guide.md",
          content: "# Guide\n\nBack to [home](index.md)."
        }
      ];

      const graph = await generator.generate(documents);

      expect(graph.nodes.length).toBe(2);
      expect(graph.edges.length).toBe(2);

      // Verify file was created
      const content = await readFile(join(TEST_OUTPUT_DIR, "graph.json"), "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.nodes.length).toBe(2);
    });

    test("generates section-level graph", async () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR, {
        silent: true,
        includeSectionGraph: true
      });

      const documents = [
        {
          relativePath: "test.md",
          content: "# Title\n## Section 1\nContent\n## Section 2\nMore"
        }
      ];

      await generator.generate(documents);

      const content = await readFile(join(TEST_OUTPUT_DIR, "graph-sections.json"), "utf8");
      const sectionGraph = JSON.parse(content);
      expect(sectionGraph.nodes.length).toBeGreaterThan(0);
    });

    test("includes analysis in output", async () => {
      const generator = new LinkGraphGenerator(TEST_OUTPUT_DIR, { silent: true });

      const documents = [
        { relativePath: "a.md", content: "[b](b.md) [c](c.md)" },
        { relativePath: "b.md", content: "[c](c.md)" },
        { relativePath: "c.md", content: "" }
      ];

      const graph = await generator.generate(documents);

      expect(graph.analysis).toBeDefined();
      expect(graph.analysis.total_nodes).toBe(3);
      expect(graph.analysis.total_edges).toBeGreaterThanOrEqual(0);
    });
  });
});
