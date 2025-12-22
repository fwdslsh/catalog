import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { SourceConnector } from "../src/SourceConnector.js";
import { mkdir, rm, writeFile, readdir } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/source_test";

describe("SourceConnector", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("static properties", () => {
    test("has PROTOCOLS list", () => {
      expect(SourceConnector.PROTOCOLS).toContain("git");
      expect(SourceConnector.PROTOCOLS).toContain("github");
      expect(SourceConnector.PROTOCOLS).toContain("http");
      expect(SourceConnector.PROTOCOLS).toContain("https");
      expect(SourceConnector.PROTOCOLS).toContain("s3");
      expect(SourceConnector.PROTOCOLS).toContain("file");
    });

    test("has DEFAULT_CACHE_DIR", () => {
      expect(SourceConnector.DEFAULT_CACHE_DIR).toBe(".cache/catalog/sources");
    });
  });

  describe("constructor", () => {
    test("initializes with default options", () => {
      const connector = new SourceConnector();
      expect(connector.cacheDir).toBe(SourceConnector.DEFAULT_CACHE_DIR);
      expect(connector.silent).toBe(false);
      expect(connector.branch).toBe("main");
    });

    test("accepts custom options", () => {
      const connector = new SourceConnector({
        cacheDir: "/tmp/cache",
        silent: true,
        branch: "develop"
      });
      expect(connector.cacheDir).toBe("/tmp/cache");
      expect(connector.silent).toBe(true);
      expect(connector.branch).toBe("develop");
    });
  });

  describe("parseSource", () => {
    test("parses GitHub shorthand (owner/repo)", () => {
      const connector = new SourceConnector();
      const parsed = connector.parseSource("facebook/react");

      expect(parsed.protocol).toBe("github");
      expect(parsed.owner).toBe("facebook");
      expect(parsed.repo).toBe("react");
      expect(parsed.host).toBe("github.com");
    });

    test("parses GitHub shorthand with path", () => {
      const connector = new SourceConnector();
      const parsed = connector.parseSource("facebook/react/docs");

      expect(parsed.protocol).toBe("github");
      expect(parsed.owner).toBe("facebook");
      expect(parsed.repo).toBe("react");
      expect(parsed.path).toBe("/docs");
    });

    test("parses github:// URLs", () => {
      const connector = new SourceConnector();
      const parsed = connector.parseSource("github://owner/repo");

      expect(parsed.protocol).toBe("github");
      expect(parsed.owner).toBe("owner");
      expect(parsed.repo).toBe("repo");
    });

    test("parses https:// URLs", () => {
      const connector = new SourceConnector();
      const parsed = connector.parseSource("https://docs.example.com/docs");

      expect(parsed.protocol).toBe("https");
      expect(parsed.host).toBe("docs.example.com");
      expect(parsed.path).toBe("/docs");
    });

    test("returns null for invalid sources", () => {
      const connector = new SourceConnector();

      expect(connector.parseSource("")).toBeNull();
      expect(connector.parseSource("invalid")).toBeNull();
      expect(connector.parseSource("ftp://example.com")).toBeNull();
    });

    test("parses file:// URLs", () => {
      const connector = new SourceConnector();
      const parsed = connector.parseSource("file://localhost/home/user/docs");

      expect(parsed).not.toBeNull();
      expect(parsed.protocol).toBe("file");
    });
  });

  describe("generateCacheKey", () => {
    test("generates deterministic cache keys", () => {
      const connector = new SourceConnector();

      const key1 = connector.generateCacheKey("https://example.com/docs");
      const key2 = connector.generateCacheKey("https://example.com/docs");

      expect(key1).toBe(key2);
    });

    test("generates different keys for different sources", () => {
      const connector = new SourceConnector();

      const key1 = connector.generateCacheKey("https://example.com/docs");
      const key2 = connector.generateCacheKey("https://other.com/docs");

      expect(key1).not.toBe(key2);
    });

    test("generates short hash keys", () => {
      const connector = new SourceConnector();

      const key = connector.generateCacheKey("https://example.com/docs");

      expect(key.length).toBeLessThanOrEqual(16);
    });
  });

  describe("fetch", () => {
    test("throws on invalid source", async () => {
      const connector = new SourceConnector();

      await expect(connector.fetch("")).rejects.toThrow("Invalid source URI");
    });

    test("throws on unsupported protocol", async () => {
      const connector = new SourceConnector();

      await expect(connector.fetch("ftp://example.com")).rejects.toThrow("Invalid source URI");
    });
  });

  describe("file protocol handling", () => {
    test("parses file:// URLs correctly", () => {
      const connector = new SourceConnector();

      // Test that file:// URLs are parsed correctly
      const parsed = connector.parseSource("file://localhost/home/user/docs");

      expect(parsed).not.toBeNull();
      expect(parsed.protocol).toBe("file");
    });
  });

  describe("caching", () => {
    test("cacheDir is configurable", () => {
      const connector = new SourceConnector({
        cacheDir: "/custom/cache/path"
      });

      expect(connector.cacheDir).toBe("/custom/cache/path");
    });

    test("force option bypasses cache", () => {
      const connector = new SourceConnector({ force: true });

      expect(connector.force).toBe(true);
    });
  });

  describe("github shorthand detection", () => {
    test("detects owner/repo format", () => {
      const connector = new SourceConnector();

      const parsed1 = connector.parseSource("facebook/react");
      const parsed2 = connector.parseSource("microsoft/vscode");

      expect(parsed1).not.toBeNull();
      expect(parsed1.protocol).toBe("github");
      expect(parsed2).not.toBeNull();
      expect(parsed2.protocol).toBe("github");
    });

    test("detects owner/repo/path format", () => {
      const connector = new SourceConnector();

      const parsed = connector.parseSource("facebook/react/docs/api");

      expect(parsed).not.toBeNull();
      expect(parsed.protocol).toBe("github");
      expect(parsed.path).toBe("/docs/api");
    });
  });

  describe("edge cases", () => {
    test("handles repos with dots in name", () => {
      const connector = new SourceConnector();

      const parsed = connector.parseSource("owner/repo.js");

      expect(parsed).not.toBeNull();
      expect(parsed.repo).toBe("repo.js");
    });

    test("handles repos with dashes in name", () => {
      const connector = new SourceConnector();

      const parsed = connector.parseSource("facebook/react-native");

      expect(parsed).not.toBeNull();
      expect(parsed.repo).toBe("react-native");
    });

    test("handles force option", () => {
      const connector = new SourceConnector({ force: true });

      expect(connector.force).toBe(true);
    });

    test("handles depth option", () => {
      const connector = new SourceConnector({ depth: 5 });

      expect(connector.depth).toBe(5);
    });
  });
});
