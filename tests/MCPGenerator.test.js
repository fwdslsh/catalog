import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { MCPGenerator } from "../src/MCPGenerator.js";
import { mkdir, rm, readFile, access } from "fs/promises";
import { join } from "path";

const TEST_DIR = "./tests/mcp_test";

describe("MCPGenerator", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("static properties", () => {
    test("has MCP_VERSION", () => {
      expect(MCPGenerator.MCP_VERSION).toBe("1.0.0");
    });

    test("has SERVER_TYPES", () => {
      expect(MCPGenerator.SERVER_TYPES).toContain("stdio");
      expect(MCPGenerator.SERVER_TYPES).toContain("http");
      expect(MCPGenerator.SERVER_TYPES).toContain("websocket");
    });
  });

  describe("constructor", () => {
    test("initializes with output directory", () => {
      const generator = new MCPGenerator(TEST_DIR);
      expect(generator.outputDir).toBe(TEST_DIR);
    });

    test("accepts server options", () => {
      const generator = new MCPGenerator(TEST_DIR, {
        serverType: "http",
        projectName: "test-docs",
        baseUrl: "https://docs.example.com"
      });
      expect(generator.serverType).toBe("http");
      expect(generator.projectName).toBe("test-docs");
      expect(generator.baseUrl).toBe("https://docs.example.com");
    });

    test("defaults to stdio server type", () => {
      const generator = new MCPGenerator(TEST_DIR);
      expect(generator.serverType).toBe("stdio");
    });
  });

  describe("generateTools", () => {
    test("generates search_docs tool", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "guide.md", title: "Guide", content: "Guide content" }
      ];

      const tools = generator.generateTools(documents);
      const searchTool = tools.find(t => t.name === "search_docs");

      expect(searchTool).toBeDefined();
      expect(searchTool.description).toContain("Search");
      expect(searchTool.inputSchema.properties.query).toBeDefined();
    });

    test("generates get_document tool", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "guide.md", title: "Guide", content: "Guide content" }
      ];

      const tools = generator.generateTools(documents);
      const getTool = tools.find(t => t.name === "get_document");

      expect(getTool).toBeDefined();
      expect(getTool.inputSchema.properties.path).toBeDefined();
    });

    test("generates list_documents tool", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [];

      const tools = generator.generateTools(documents);
      const listTool = tools.find(t => t.name === "list_documents");

      expect(listTool).toBeDefined();
    });

    test("generates get_section tool", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [];

      const tools = generator.generateTools(documents);
      const sectionTool = tools.find(t => t.name === "get_section");

      expect(sectionTool).toBeDefined();
      expect(sectionTool.inputSchema.properties.section).toBeDefined();
    });
  });

  describe("generateResources", () => {
    test("generates resources from documents", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "guide.md", title: "Guide", content: "Guide content" },
        { relativePath: "api/index.md", title: "API Reference", content: "API docs" }
      ];

      const resources = generator.generateResources(documents);

      // Should include llms.txt, llms-full.txt, and section resources
      expect(resources.length).toBeGreaterThanOrEqual(2);
      // Check that it has the base resources
      expect(resources.find(r => r.name === "Documentation Index")).toBeDefined();
      expect(resources.find(r => r.name === "Full Documentation")).toBeDefined();
    });

    test("creates section resources from documents", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "api/endpoints.md", title: "API Endpoints", content: "Content" }
      ];

      const resources = generator.generateResources(documents);
      const sectionResource = resources.find(r => r.uri.includes("sections/api"));

      expect(sectionResource).toBeDefined();
    });

    test("includes manifest resource when provided", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [];
      const manifest = { documents: [] };

      const resources = generator.generateResources(documents, manifest);
      const manifestResource = resources.find(r => r.name === "Documentation Manifest");

      expect(manifestResource).toBeDefined();
    });
  });

  describe("generateServerConfig", () => {
    test("generates stdio server config", () => {
      const generator = new MCPGenerator(TEST_DIR, {
        serverType: "stdio",
        projectName: "test-docs"
      });

      const config = generator.generateServerConfig([], null);

      expect(config.name).toBe("test-docs-docs");
      expect(config.version).toBe(MCPGenerator.MCP_VERSION);
      expect(config.server.type).toBe("stdio");
    });

    test("generates http server config with port", () => {
      const generator = new MCPGenerator(TEST_DIR, {
        serverType: "http",
        port: 3001
      });

      const config = generator.generateServerConfig([], null);

      expect(config.server.type).toBe("http");
      expect(config.server.port).toBe(3001);
    });

    test("includes tools in config", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const config = generator.generateServerConfig([], null);

      expect(config.tools).toBeDefined();
      expect(Array.isArray(config.tools)).toBe(true);
    });

    test("includes resources in config", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [{ relativePath: "guide.md", title: "Guide" }];
      const config = generator.generateServerConfig(documents, null);

      expect(config.resources).toBeDefined();
      expect(Array.isArray(config.resources)).toBe(true);
    });
  });

  describe("generateClientConfigs", () => {
    test("generates Cursor IDE configuration", async () => {
      const outputDir = join(TEST_DIR, "cursor_test");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir, {
        projectName: "my-docs"
      });

      const serverConfig = generator.generateServerConfig([], null);
      const clientConfigs = await generator.generateClientConfigs(serverConfig);

      expect(clientConfigs.cursor).toBeDefined();
      expect(clientConfigs.cursor.mcpServers).toBeDefined();
      expect(clientConfigs.cursor.mcpServers["my-docs-docs"]).toBeDefined();
      expect(clientConfigs.cursor.mcpServers["my-docs-docs"].command).toBe("node");
    });

    test("generates Claude Desktop configuration", async () => {
      const outputDir = join(TEST_DIR, "claude_test");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir, {
        projectName: "my-docs"
      });

      const serverConfig = generator.generateServerConfig([], null);
      const clientConfigs = await generator.generateClientConfigs(serverConfig);

      expect(clientConfigs.claude).toBeDefined();
      expect(clientConfigs.claude.mcpServers).toBeDefined();
      expect(clientConfigs.claude.mcpServers["my-docs-docs"]).toBeDefined();
    });
  });

  describe("generateServerScript", () => {
    test("generates executable server script", async () => {
      const outputDir = join(TEST_DIR, "script_test");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);
      const documents = [
        { relativePath: "guide.md", title: "Guide", content: "Guide content" }
      ];

      const scriptPath = await generator.generateServerScript(documents, null);

      expect(scriptPath).toContain("mcp-server.js");
      const script = await readFile(scriptPath, "utf8");
      expect(script).toContain("#!/usr/bin/env node");
      expect(script).toContain("MCP Server");
      expect(script).toContain("search_docs");
    });

    test("includes tool handlers in script", async () => {
      const outputDir = join(TEST_DIR, "handlers_test");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);

      const scriptPath = await generator.generateServerScript([], null);
      const script = await readFile(scriptPath, "utf8");

      expect(script).toContain("callTool");
      expect(script).toContain("listTools");
    });
  });

  describe("generate", () => {
    test("generates all MCP files", async () => {
      const outputDir = join(TEST_DIR, "full_gen");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir, {
        projectName: "test-docs"
      });

      const documents = [
        { relativePath: "index.md", title: "Home", content: "Welcome" },
        { relativePath: "guide.md", title: "Guide", content: "Guide content" }
      ];

      const result = await generator.generate(documents);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.serverConfig).toBeDefined();
      expect(result.clientConfigs).toBeDefined();
    });

    test("writes server config file", async () => {
      const outputDir = join(TEST_DIR, "server_config");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);
      await generator.generate([]);

      const configPath = join(outputDir, "mcp-server.json");
      const config = JSON.parse(await readFile(configPath, "utf8"));

      expect(config.name).toBeDefined();
      expect(config.tools).toBeDefined();
    });

    test("writes client config files", async () => {
      const outputDir = join(TEST_DIR, "client_configs");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);
      await generator.generate([{ relativePath: "doc.md", title: "Doc", content: "Content" }]);

      const cursorConfig = JSON.parse(
        await readFile(join(outputDir, "cursor-mcp.json"), "utf8")
      );

      expect(cursorConfig.mcpServers).toBeDefined();
    });

    test("generates executable server script", async () => {
      const outputDir = join(TEST_DIR, "with_script");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);
      await generator.generate([]);

      const scriptPath = join(outputDir, "mcp-server.js");
      const script = await readFile(scriptPath, "utf8");

      expect(script).toContain("#!/usr/bin/env node");
    });
  });

  describe("edge cases", () => {
    test("handles empty document list", async () => {
      const outputDir = join(TEST_DIR, "empty_docs");
      await mkdir(outputDir, { recursive: true });

      const generator = new MCPGenerator(outputDir);
      const result = await generator.generate([]);

      expect(result.files.length).toBeGreaterThan(0);
    });

    test("handles documents without relativePath", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "doc.md", content: "Content without title" }
      ];

      // Should not throw
      const resources = generator.generateResources(documents);
      expect(resources.length).toBeGreaterThan(0);
    });

    test("handles root-level documents", () => {
      const generator = new MCPGenerator(TEST_DIR);
      const documents = [
        { relativePath: "readme.md", title: "Readme" }
      ];

      const resources = generator.generateResources(documents);

      // Should create a section for root-level docs
      expect(resources.length).toBeGreaterThan(2); // llms.txt, llms-full.txt, plus section
    });
  });
});
