import { describe, test, expect } from "bun:test";
import { PatternConfig } from "../src/PatternConfig.js";

describe("PatternConfig", () => {
  describe("static properties", () => {
    test("has OVERRIDABLE_OPTIONS list", () => {
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("chunkProfile");
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("tags");
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("optional");
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("priority");
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("exclude");
      expect(PatternConfig.OVERRIDABLE_OPTIONS).toContain("maxChunkSize");
    });
  });

  describe("constructor", () => {
    test("initializes with empty patterns", () => {
      const config = new PatternConfig();
      expect(config.patterns).toEqual({});
      expect(config.defaults).toEqual({});
    });

    test("accepts pattern configurations", () => {
      const patterns = {
        "**/*.md": { chunkProfile: "default" },
        "api/**/*": { chunkProfile: "code-heavy" }
      };

      const config = new PatternConfig({ patterns });
      expect(Object.keys(config.patterns).length).toBe(2);
    });

    test("accepts default configuration", () => {
      const config = new PatternConfig({ defaults: { chunkProfile: "default" } });
      expect(config.defaults.chunkProfile).toBe("default");
    });
  });

  describe("addPattern", () => {
    test("adds pattern to configuration", () => {
      const config = new PatternConfig();
      config.addPattern("**/*.md", { chunkProfile: "default" });

      expect(config.patterns["**/*.md"]).toBeDefined();
      expect(config.patterns["**/*.md"].chunkProfile).toBe("default");
    });
  });

  describe("getConfigForPath", () => {
    test("returns defaults for non-matching path", () => {
      const config = new PatternConfig({
        patterns: {
          "api/*.md": { chunkProfile: "code-heavy" }
        },
        defaults: { chunkProfile: "default" }
      });

      const result = config.getConfigForPath("docs/guide.md");

      expect(result.chunkProfile).toBe("default");
    });

    test("returns pattern config for matching path", () => {
      const config = new PatternConfig({
        patterns: {
          "api/*.md": { chunkProfile: "code-heavy" }
        }
      });

      const result = config.getConfigForPath("api/endpoints.md");

      expect(result.chunkProfile).toBe("code-heavy");
    });

    test("applies matching pattern config", () => {
      const config = new PatternConfig({
        patterns: {
          "api/endpoints.md": { chunkProfile: "code-heavy", tags: ["api"] }
        }
      });

      const result = config.getConfigForPath("api/endpoints.md");

      expect(result.tags).toContain("api");
      expect(result.chunkProfile).toBe("code-heavy");
    });

    test("more specific patterns override less specific", () => {
      const config = new PatternConfig({
        patterns: {
          "*.md": { chunkProfile: "default" },
          "api/endpoints.md": { chunkProfile: "code-heavy" }
        }
      });

      const result = config.getConfigForPath("api/endpoints.md");

      expect(result.chunkProfile).toBe("code-heavy");
    });

    test("merges tag arrays from matching patterns", () => {
      const config = new PatternConfig({
        patterns: {
          "api/endpoints.md": { tags: ["api", "reference"] }
        },
        defaults: { tags: ["docs"] }
      });

      const result = config.getConfigForPath("api/endpoints.md");

      expect(result.tags).toContain("docs");
      expect(result.tags).toContain("api");
    });
  });

  describe("patternToRegex", () => {
    test("converts * to match single path segment", () => {
      const config = new PatternConfig();
      const regex = config.patternToRegex("docs/*.md");

      expect(regex.test("docs/guide.md")).toBe(true);
      expect(regex.test("docs/nested/guide.md")).toBe(false);
    });

    test("matches exact paths", () => {
      const config = new PatternConfig();
      const regex = config.patternToRegex("api/endpoints.md");

      expect(regex.test("api/endpoints.md")).toBe(true);
      expect(regex.test("api/other.md")).toBe(false);
    });

    test("handles wildcards in filenames", () => {
      const config = new PatternConfig();
      const regex = config.patternToRegex("*.md");

      expect(regex.test("guide.md")).toBe(true);
      expect(regex.test("readme.md")).toBe(true);
      expect(regex.test("docs/guide.md")).toBe(false);
    });
  });

  describe("matchesAny", () => {
    test("returns true for matching paths", () => {
      const config = new PatternConfig({
        patterns: {
          "api/*.md": { chunkProfile: "code-heavy" }
        }
      });

      expect(config.matchesAny("api/endpoints.md")).toBe(true);
    });

    test("returns false for non-matching paths", () => {
      const config = new PatternConfig({
        patterns: {
          "api/*.md": { chunkProfile: "code-heavy" }
        }
      });

      expect(config.matchesAny("docs/guide.md")).toBe(false);
    });
  });

  describe("getMatchingPatterns", () => {
    test("returns matching patterns", () => {
      const config = new PatternConfig({
        patterns: {
          "api/*.md": { chunkProfile: "code-heavy" }
        }
      });

      const matches = config.getMatchingPatterns("api/endpoints.md");

      expect(matches.length).toBe(1);
      expect(matches[0].config.chunkProfile).toBe("code-heavy");
    });

    test("returns patterns ordered by specificity", () => {
      const config = new PatternConfig({
        patterns: {
          "*.md": { tags: ["docs"] },
          "api/endpoints.md": { priority: 100 }
        }
      });

      const matches = config.getMatchingPatterns("api/endpoints.md");

      // More specific pattern should come first
      expect(matches[0].config.priority).toBe(100);
    });
  });

  describe("validateConfig", () => {
    test("filters to only overridable options", () => {
      const config = new PatternConfig({ silent: true });
      const validated = config.validateConfig({
        chunkProfile: "default",
        invalidOption: "ignored"
      });

      expect(validated.chunkProfile).toBe("default");
      expect(validated.invalidOption).toBeUndefined();
    });

    test("normalizes tags to array", () => {
      const config = new PatternConfig();
      const validated = config.validateConfig({
        tags: "single-tag"
      });

      expect(Array.isArray(validated.tags)).toBe(true);
      expect(validated.tags).toContain("single-tag");
    });
  });

  describe("calculateSpecificity", () => {
    test("specific paths have higher specificity", () => {
      const config = new PatternConfig();

      const broadScore = config.calculateSpecificity("**/*.md");
      const specificScore = config.calculateSpecificity("api/endpoints.md");

      expect(specificScore).toBeGreaterThan(broadScore);
    });

    test("wildcards reduce specificity", () => {
      const config = new PatternConfig();

      const noWildcard = config.calculateSpecificity("api/endpoints.md");
      const withWildcard = config.calculateSpecificity("api/*.md");

      expect(noWildcard).toBeGreaterThan(withWildcard);
    });
  });

  describe("mergeConfigs", () => {
    test("merges two configurations", () => {
      const config = new PatternConfig();
      const result = config.mergeConfigs(
        { chunkProfile: "default", tags: ["docs"] },
        { priority: 10 }
      );

      expect(result.chunkProfile).toBe("default");
      expect(result.tags).toContain("docs");
      expect(result.priority).toBe(10);
    });

    test("combines tag arrays", () => {
      const config = new PatternConfig();
      const result = config.mergeConfigs(
        { tags: ["docs", "markdown"] },
        { tags: ["api"] }
      );

      expect(result.tags).toContain("docs");
      expect(result.tags).toContain("api");
      expect(result.tags.length).toBe(3);
    });

    test("deduplicates tags", () => {
      const config = new PatternConfig();
      const result = config.mergeConfigs(
        { tags: ["docs", "api"] },
        { tags: ["api", "reference"] }
      );

      const apiCount = result.tags.filter(t => t === "api").length;
      expect(apiCount).toBe(1);
    });
  });

  describe("removePattern", () => {
    test("removes pattern from configuration", () => {
      const config = new PatternConfig({
        patterns: {
          "**/*.md": { chunkProfile: "default" }
        }
      });

      const removed = config.removePattern("**/*.md");

      expect(removed).toBe(true);
      expect(config.patterns["**/*.md"]).toBeUndefined();
    });

    test("returns false if pattern not found", () => {
      const config = new PatternConfig();
      const removed = config.removePattern("nonexistent");

      expect(removed).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("handles empty patterns", () => {
      const config = new PatternConfig();
      const result = config.getConfigForPath("any/path.md");

      expect(result).toEqual({});
    });

    test("handles specific paths", () => {
      const config = new PatternConfig({
        patterns: {
          "docs/api/endpoints.md": { chunkProfile: "code-heavy" }
        }
      });

      const result = config.getConfigForPath("docs/api/endpoints.md");

      expect(result.chunkProfile).toBe("code-heavy");
    });

    test("handles Windows-style paths", () => {
      const config = new PatternConfig({
        patterns: {
          "api/endpoints.md": { chunkProfile: "code-heavy" }
        }
      });

      // Note: Windows paths are normalized to forward slashes internally
      const result = config.getConfigForPath("api\\endpoints.md");

      // The path normalization converts \\ to / before matching
      expect(result.chunkProfile).toBe("code-heavy");
    });
  });
});
