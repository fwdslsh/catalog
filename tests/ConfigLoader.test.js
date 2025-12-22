import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ConfigLoader } from "../src/ConfigLoader.js";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/config_test";

describe("ConfigLoader", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("DEFAULTS", () => {
    test("has expected default values", () => {
      expect(ConfigLoader.DEFAULTS.input).toBe(".");
      expect(ConfigLoader.DEFAULTS.output).toBe(".");
      expect(ConfigLoader.DEFAULTS.generateManifest).toBe(false);
      expect(ConfigLoader.DEFAULTS.chunkProfile).toBe("default");
    });
  });

  describe("CONFIG_FILES", () => {
    test("has expected config file names", () => {
      expect(ConfigLoader.CONFIG_FILES).toContain("catalog.yaml");
      expect(ConfigLoader.CONFIG_FILES).toContain("catalog.json");
      expect(ConfigLoader.CONFIG_FILES).toContain(".catalogrc");
    });
  });

  describe("parseYaml", () => {
    test("parses simple key-value pairs", () => {
      const loader = new ConfigLoader();
      const yaml = `input: ./docs
output: ./build
silent: true`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.input).toBe("./docs");
      expect(parsed.output).toBe("./build");
      expect(parsed.silent).toBe(true);
    });

    test("parses arrays", () => {
      const loader = new ConfigLoader();
      const yaml = `include:
  - "*.md"
  - "*.html"`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.include).toContain("*.md");
      expect(parsed.include).toContain("*.html");
    });

    test("parses numbers", () => {
      const loader = new ConfigLoader();
      const yaml = `watchDebounce: 500
bundleSizes: [2000, 8000]`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.watchDebounce).toBe(500);
    });

    test("parses booleans", () => {
      const loader = new ConfigLoader();
      const yaml = `validate: true
silent: false`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.validate).toBe(true);
      expect(parsed.silent).toBe(false);
    });

    test("handles comments", () => {
      const loader = new ConfigLoader();
      const yaml = `# This is a comment
input: ./docs
# Another comment`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.input).toBe("./docs");
    });

    test("converts kebab-case to camelCase", () => {
      const loader = new ConfigLoader();
      const yaml = `base-url: https://example.com
chunk-profile: code-heavy`;
      const parsed = loader.parseYaml(yaml);
      expect(parsed.baseUrl).toBe("https://example.com");
      expect(parsed.chunkProfile).toBe("code-heavy");
    });
  });

  describe("camelCase", () => {
    test("converts kebab-case", () => {
      const loader = new ConfigLoader();
      expect(loader.camelCase("base-url")).toBe("baseUrl");
      expect(loader.camelCase("chunk-profile")).toBe("chunkProfile");
    });

    test("converts snake_case", () => {
      const loader = new ConfigLoader();
      expect(loader.camelCase("base_url")).toBe("baseUrl");
    });

    test("preserves already camelCase", () => {
      const loader = new ConfigLoader();
      expect(loader.camelCase("baseUrl")).toBe("baseUrl");
    });
  });

  describe("mergeConfigs", () => {
    test("merges multiple configs", () => {
      const loader = new ConfigLoader();
      const result = loader.mergeConfigs(
        { a: 1, b: 2 },
        { b: 3, c: 4 },
        { c: 5 }
      );
      expect(result.a).toBe(1);
      expect(result.b).toBe(3);
      expect(result.c).toBe(5);
    });

    test("concatenates pattern arrays", () => {
      const loader = new ConfigLoader();
      const result = loader.mergeConfigs(
        { include: ["*.md"] },
        { include: ["*.html"] }
      );
      expect(result.include).toContain("*.md");
      expect(result.include).toContain("*.html");
    });

    test("replaces non-pattern arrays", () => {
      const loader = new ConfigLoader();
      const result = loader.mergeConfigs(
        { astExtensions: ["js"] },
        { astExtensions: ["ts"] }
      );
      expect(result.astExtensions).toEqual(["ts"]);
    });
  });

  describe("normalizeConfig", () => {
    test("ensures arrays are arrays", () => {
      const loader = new ConfigLoader();
      const result = loader.normalizeConfig({
        include: "*.md"
      });
      expect(Array.isArray(result.include)).toBe(true);
    });

    test("validates chunk profile", () => {
      const loader = new ConfigLoader();
      const result = loader.normalizeConfig({
        chunkProfile: "invalid-profile"
      });
      expect(result.chunkProfile).toBe("default");
    });

    test("normalizes base URL", () => {
      const loader = new ConfigLoader();
      const result = loader.normalizeConfig({
        baseUrl: "https://example.com"
      });
      expect(result.baseUrl).toBe("https://example.com/");
    });
  });

  describe("loadConfigFile", () => {
    test("loads JSON config", async () => {
      const configPath = join(TEST_DIR, "test.json");
      await writeFile(configPath, JSON.stringify({ input: "./docs" }));

      const loader = new ConfigLoader();
      const config = await loader.loadConfigFile(configPath);
      expect(config.input).toBe("./docs");
    });

    test("loads YAML config", async () => {
      const configPath = join(TEST_DIR, "test.yaml");
      await writeFile(configPath, "input: ./docs\noutput: ./build");

      const loader = new ConfigLoader();
      const config = await loader.loadConfigFile(configPath);
      expect(config.input).toBe("./docs");
      expect(config.output).toBe("./build");
    });
  });

  describe("findConfigFile", () => {
    test("finds config file in directory", async () => {
      const configPath = join(TEST_DIR, "catalog.yaml");
      await writeFile(configPath, "input: ./docs");

      const loader = new ConfigLoader();
      const found = await loader.findConfigFile(TEST_DIR);
      // Returns absolute path
      expect(found).toContain("catalog.yaml");
      expect(found).toContain("config_test");
    });

    test("returns null if no config found", async () => {
      const emptyDir = join(TEST_DIR, "empty");
      await mkdir(emptyDir, { recursive: true });

      const loader = new ConfigLoader();
      const found = await loader.findConfigFile(emptyDir);
      expect(found).toBeNull();
    });
  });

  describe("generateSampleConfig", () => {
    test("generates YAML sample", () => {
      const loader = new ConfigLoader();
      const sample = loader.generateSampleConfig("yaml");
      expect(sample).toContain("input:");
      expect(sample).toContain("output:");
    });

    test("generates JSON sample", () => {
      const loader = new ConfigLoader();
      const sample = loader.generateSampleConfig("json");
      const parsed = JSON.parse(sample);
      expect(parsed.input).toBeDefined();
    });
  });

  describe("load", () => {
    test("loads and merges config with CLI options", async () => {
      const configPath = join(TEST_DIR, "merge.yaml");
      await writeFile(configPath, "input: ./file-docs\nsilent: true");

      const loader = new ConfigLoader({ silent: true });
      const config = await loader.load(configPath, { output: "./cli-build" });

      // Paths are normalized to absolute
      expect(config.input).toContain("file-docs");
      expect(config.output).toContain("cli-build");
      expect(config.silent).toBe(true); // from file
    });

    test("CLI overrides file config", async () => {
      const configPath = join(TEST_DIR, "override.yaml");
      await writeFile(configPath, "input: ./file\noutput: ./file");

      const loader = new ConfigLoader({ silent: true });
      const config = await loader.load(configPath, { input: "./cli", output: "./cli" });

      // CLI overrides file values, paths are normalized to absolute
      expect(config.input).toContain("cli");
      expect(config.output).toContain("cli");
    });
  });
});
