import { spawn } from "child_process";
import { mkdir, writeFile, rm, readFile, stat } from "fs/promises";
import { join, resolve } from "path";

describe("CLI Integration", () => {
  const testInputDir = "./tests/cli_input";
  const testOutputDir = "./tests/cli_output";
  const cliPath = resolve(__dirname, "../src/cli.js");

  beforeAll(async () => {
    await mkdir(testInputDir, { recursive: true });
    await mkdir(testOutputDir, { recursive: true });
    await writeFile(
      join(testInputDir, "readme.md"),
      "# Readme\nReadme content"
    );
    await writeFile(
      join(testInputDir, "tutorial.md"),
      "# Tutorial\nTutorial content"
    );
  });

  afterAll(async () => {
    await rm(testInputDir, { recursive: true, force: true });
    await rm(testOutputDir, { recursive: true, force: true });
  });

  function runCLI(args = [], env = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn("node", [cliPath, ...args], {
        env: { ...process.env, ...env },
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => {
        stdout += d;
      });
      proc.stderr.on("data", (d) => {
        stderr += d;
      });
      proc.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
      proc.on("error", reject);
    });
  }

  function normalizeOutput(output) {
    return output.trim().replace(/\s+/g, " ");
  }

  test("shows help with --help", async () => {
    const result = await runCLI(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/Usage:/);
  });

  test("shows version with --version", async () => {
    const result = await runCLI(["--version"]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("generates output files with input/output options", async () => {
    const result = await runCLI([
      "--input",
      testInputDir,
      "--output",
      testOutputDir,
    ]);
    expect(result.code).toBe(0);
    const llms = await readFile(join(testOutputDir, "llms.txt"), "utf8");
    const llmsFull = await readFile(
      join(testOutputDir, "llms-full.txt"),
      "utf8"
    );
    expect(llms).toMatch(/Root|Documentation/);
    expect(llmsFull).toMatch(/Readme content/);
    expect(llmsFull).toMatch(/Tutorial content/);
  });

  test("silent mode suppresses output", async () => {
    const result = await runCLI([
      "--input",
      testInputDir,
      "--output",
      testOutputDir,
      "--silent",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("errors on unknown option", async () => {
    const result = await runCLI(["--badopt"]);
    const normalizedStderr = result.stderr.trim();
    console.log("Normalized stderr:", normalizedStderr);
    expect(result.code).toBe(1);
    expect(normalizedStderr).toContain("Error: Unknown option --badopt");
    expect(normalizedStderr).toContain("Use --help to see available options");
  });

  test("errors if input path is missing", async () => {
    const result = await runCLI(["--input"]);
    const normalizedStderr = result.stderr.trim();
    console.log("Normalized stderr:", normalizedStderr);
    expect(result.code).toBe(1);
    expect(normalizedStderr).toContain(
      "Error: --input requires a path argument"
    );
  });

  test("generates index.json files with --generate-index flag", async () => {
    const result = await runCLI([
      "--input",
      testInputDir,
      "--output",
      testOutputDir,
      "--generate-index",
    ]);
    expect(result.code).toBe(0);

    // Check that index files are created
    const rootIndexStats = await stat(join(testOutputDir, "index.json"));
    expect(rootIndexStats.isFile()).toBe(true);

    const masterIndexStats = await stat(
      join(testOutputDir, "master-index.json")
    );
    expect(masterIndexStats.isFile()).toBe(true);

    // Check that regular outputs are still created
    const llms = await readFile(join(testOutputDir, "llms.txt"), "utf8");
    expect(llms).toMatch(/Root|Documentation/);
  });

  test("help text includes --index option", async () => {
    const result = await runCLI(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/--index/);
    expect(result.stdout).toMatch(/Generate index\.json files/);
  });

  test("help text includes new include/exclude options", async () => {
    const result = await runCLI(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/--include <pattern>/);
    expect(result.stdout).toMatch(/--exclude <pattern>/);
    expect(result.stdout).toMatch(/HTML files/);
  });

  test("errors when include option is missing pattern", async () => {
    const result = await runCLI(["--include"]);
    const normalizedStderr = result.stderr.trim();
    console.log("Normalized stderr:", normalizedStderr);
    expect(result.code).toBe(1);
    expect(normalizedStderr).toContain(
      "Error: --include requires a glob pattern argument"
    );
  });

  test("errors when exclude option is missing pattern", async () => {
    const result = await runCLI(["--exclude"]);
    const normalizedStderr = result.stderr.trim();
    console.log("Normalized stderr:", normalizedStderr);
    expect(result.code).toBe(1);
    expect(normalizedStderr).toContain(
      "Error: --exclude requires a glob pattern argument"
    );
  });

  test("processes files with include glob pattern", async () => {
    const result = await runCLI([
      "--input",
      testInputDir,
      "--output",
      testOutputDir,
      "--include",
      "*.md",
    ]);
    expect(result.code).toBe(0);

    const llmsFile = join(testOutputDir, "llms.txt");
    const llms = await readFile(llmsFile, "utf8");
    expect(llms).toMatch(/readme\.md|tutorial\.md/);
    expect(llms).not.toMatch(/\.html/);
  });

  test("processes files with exclude glob pattern", async () => {
    const result = await runCLI([
      "--input",
      testInputDir,
      "--output",
      testOutputDir,
      "--exclude",
      "**/reference.md",
    ]);
    expect(result.code).toBe(0);

    const llmsFile = join(testOutputDir, "llms.txt");
    const llms = await readFile(llmsFile, "utf8");
    expect(llms).toMatch(/readme\.md|tutorial\.md/);
    expect(llms).not.toMatch(/reference\.md/);
  });

  describe("New CLI Options", () => {
    test("help text includes all new options", async () => {
      const result = await runCLI(["--help"]);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/--base-url <url>/);
      expect(result.stdout).toMatch(/--optional <pattern>/);
      expect(result.stdout).toMatch(/--sitemap/);
      expect(result.stdout).toMatch(/--sitemap-no-extensions/);
      expect(result.stdout).toMatch(/--validate/);
      expect(result.stdout).toMatch(/--index/);
      expect(result.stdout).toMatch(/--toc/);
      expect(result.stdout).toContain("toc.md");
      expect(result.stdout).toContain("toc-full.md");
    });

    test("processes files with base URL", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--base-url",
        "https://example.com",
      ]);
      expect(result.code).toBe(0);

      const llmsFile = join(testOutputDir, "llms.txt");
      const llms = await readFile(llmsFile, "utf8");
      expect(llms).toContain("https://example.com");
    });

    test("processes files with optional patterns", async () => {
      // Create an optional file
      await writeFile(join(testInputDir, "draft.md"), "# Draft\nDraft content");
      
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--optional",
        "**/draft.md",
      ]);
      expect(result.code).toBe(0);

      const llmsFile = join(testOutputDir, "llms.txt");
      const llms = await readFile(llmsFile, "utf8");
      expect(llms).toContain("## Optional");
      expect(llms).toContain("draft.md");
      
      // Clean up
      await rm(join(testInputDir, "draft.md"));
    });

    test("generates sitemap with --sitemap flag", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--sitemap",
        "--base-url",
        "https://example.com",
      ]);
      expect(result.code).toBe(0);

      const sitemapFile = join(testOutputDir, "sitemap.xml");
      const sitemap = await readFile(sitemapFile, "utf8");
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain("https://example.com");
      expect(sitemap).toContain("<urlset");
    });

    test("generates sitemap with extension stripping", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--sitemap",
        "--sitemap-no-extensions",
        "--base-url",
        "https://example.com",
      ]);
      expect(result.code).toBe(0);

      const sitemapFile = join(testOutputDir, "sitemap.xml");
      const sitemap = await readFile(sitemapFile, "utf8");
      expect(sitemap).toContain("https://example.com/readme</loc>");
      expect(sitemap).not.toContain("readme.md</loc>");
    });

    test("requires base URL for sitemap generation", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--sitemap",
      ]);
      expect(result.code).toBe(3); // EXIT_CODES.INVALID_INPUT
      expect(result.stderr).toContain("--base-url is required when using --sitemap");
    });

    test("validates output with --validate flag", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--validate",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("✔ llms.txt validation passed");
    });

    test("generates index files with --index flag (renamed from --generate-index)", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--index",
      ]);
      expect(result.code).toBe(0);

      const rootIndexStats = await stat(join(testOutputDir, "index.json"));
      expect(rootIndexStats.isFile()).toBe(true);

      const masterIndexStats = await stat(join(testOutputDir, "master-index.json"));
      expect(masterIndexStats.isFile()).toBe(true);
    });

    test("generates TOC files with --toc flag", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--index",
        "--toc",
      ]);
      expect(result.code).toBe(0);

      // Check that toc.md and toc-full.md files were created
      const tocStats = await stat(join(testOutputDir, "toc.md"));
      expect(tocStats.isFile()).toBe(true);

      const tocFullStats = await stat(join(testOutputDir, "toc-full.md"));
      expect(tocFullStats.isFile()).toBe(true);

      // Check content
      const tocContent = await readFile(join(testOutputDir, "toc.md"), "utf8");
      const tocFullContent = await readFile(join(testOutputDir, "toc-full.md"), "utf8");
      
      expect(tocContent).toContain("# Table of Contents");
      expect(tocContent).toContain("[readme](readme.md)");
      expect(tocContent).toContain("[tutorial](tutorial.md)");
      
      expect(tocFullContent).toContain("# Complete Table of Contents");
      expect(tocFullContent).toContain("- [readme](readme.md)");
      expect(tocFullContent).toContain("- [tutorial](tutorial.md)");
    });

    test("requires --index flag when using --toc", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--toc",
      ]);
      expect(result.code).toBe(3); // INVALID_INPUT error code
      expect(result.stderr).toContain("--toc requires --index to be enabled");
    });

    test("handles multiple optional patterns", async () => {
      await writeFile(join(testInputDir, "draft.md"), "# Draft\nDraft content");
      await writeFile(join(testInputDir, "temp.md"), "# Temp\nTemporary content");
      
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--optional",
        "**/draft.md",
        "--optional", 
        "**/temp.md",
      ]);
      expect(result.code).toBe(0);

      const llmsFile = join(testOutputDir, "llms.txt");
      const llms = await readFile(llmsFile, "utf8");
      expect(llms).toContain("## Optional");
      expect(llms).toContain("draft.md");
      expect(llms).toContain("temp.md");
      
      // Clean up
      await rm(join(testInputDir, "draft.md"));
      await rm(join(testInputDir, "temp.md"));
    });

    test("validates output with base URL", async () => {
      const result = await runCLI([
        "--input",
        testInputDir,
        "--output",
        testOutputDir,
        "--validate",
        "--base-url",
        "https://example.com",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("✔ llms.txt validation passed");
    });

    test("errors on invalid option argument combinations", async () => {
      // Test missing base URL argument  
      const result1 = await runCLI(["--base-url"]);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain("--base-url requires a URL argument");

      // Test missing optional pattern argument
      const result2 = await runCLI(["--optional"]);
      expect(result2.code).toBe(1);
      expect(result2.stderr).toContain("--optional requires a glob pattern argument");
    });
  });
});
