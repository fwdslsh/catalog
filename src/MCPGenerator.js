import { writeFile, mkdir } from "fs/promises";
import { join, resolve, basename } from "path";

/**
 * MCPGenerator - Generate MCP (Model Context Protocol) server configurations
 *
 * Creates configuration files that enable IDE integration with tools like
 * Cursor, Claude Code, Windsurf, and other MCP-compatible editors.
 *
 * @example
 * const generator = new MCPGenerator(outputDir, { projectName: 'my-docs' });
 * await generator.generate(documents, manifest);
 */
export class MCPGenerator {
  /**
   * MCP specification version
   */
  static MCP_VERSION = "1.0.0";

  /**
   * Supported MCP server types
   */
  static SERVER_TYPES = ["stdio", "http", "websocket"];

  /**
   * Create a new MCPGenerator instance
   *
   * @param {string} outputDir - Destination directory for MCP config files
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {string} [options.projectName] - Project name for the MCP server
   * @param {string} [options.baseUrl=null] - Base URL for documentation
   * @param {string} [options.serverType='stdio'] - MCP server type
   * @param {number} [options.port=3100] - Port for HTTP/WebSocket servers
   */
  constructor(outputDir, options = {}) {
    this.outputDir = outputDir;
    this.silent = options.silent || false;
    this.projectName = options.projectName || basename(resolve(outputDir)) || "catalog-docs";
    this.baseUrl = options.baseUrl || null;
    this.serverType = options.serverType || "stdio";
    this.port = options.port || 3100;
  }

  /**
   * Generate all MCP configuration files
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [manifest=null] - Manifest data if available
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Generation results
   */
  async generate(documents, manifest = null, options = {}) {
    const results = {
      files: [],
      serverConfig: null,
      clientConfigs: {}
    };

    // Generate MCP server configuration
    const serverConfig = this.generateServerConfig(documents, manifest);
    results.serverConfig = serverConfig;

    // Write server config
    const serverConfigPath = join(this.outputDir, "mcp-server.json");
    await writeFile(serverConfigPath, JSON.stringify(serverConfig, null, 2), "utf8");
    results.files.push(serverConfigPath);

    // Generate client configurations for popular tools
    results.clientConfigs = await this.generateClientConfigs(serverConfig);

    // Generate the actual MCP server script
    const serverScriptPath = await this.generateServerScript(documents, manifest);
    results.files.push(serverScriptPath);

    // Generate Claude Code specific config
    const claudeConfigPath = await this.generateClaudeCodeConfig(serverConfig);
    results.files.push(claudeConfigPath);

    this.log(`✔ MCP server configuration generated`);

    return results;
  }

  /**
   * Generate MCP server configuration
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [manifest=null] - Manifest data
   * @returns {Object} Server configuration
   */
  generateServerConfig(documents, manifest = null) {
    const tools = this.generateTools(documents);
    const resources = this.generateResources(documents, manifest);

    return {
      name: `${this.projectName}-docs`,
      version: MCPGenerator.MCP_VERSION,
      description: `MCP server for ${this.projectName} documentation`,
      server: {
        type: this.serverType,
        command: "node",
        args: ["mcp-server.js"],
        ...(this.serverType !== "stdio" && { port: this.port })
      },
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      },
      tools,
      resources,
      prompts: this.generatePrompts(documents),
      metadata: {
        generated_at: new Date().toISOString(),
        generator: "catalog",
        document_count: documents.length,
        ...(this.baseUrl && { base_url: this.baseUrl })
      }
    };
  }

  /**
   * Generate MCP tools from documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @returns {Array<Object>} Tool definitions
   */
  generateTools(documents) {
    const tools = [];

    // Search documentation tool
    tools.push({
      name: "search_docs",
      description: `Search ${this.projectName} documentation for relevant information`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant documentation"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return",
            default: 5
          }
        },
        required: ["query"]
      }
    });

    // Get document by path tool
    tools.push({
      name: "get_document",
      description: `Get the full content of a specific document from ${this.projectName}`,
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the document"
          }
        },
        required: ["path"]
      }
    });

    // List documents tool
    tools.push({
      name: "list_documents",
      description: `List all available documents in ${this.projectName}`,
      inputSchema: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description: "Optional section/directory to filter by"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags to filter by"
          }
        }
      }
    });

    // Get section tool
    tools.push({
      name: "get_section",
      description: `Get all documents in a specific section of ${this.projectName}`,
      inputSchema: {
        type: "object",
        properties: {
          section: {
            type: "string",
            description: "Section name (e.g., 'api', 'guides')"
          }
        },
        required: ["section"]
      }
    });

    return tools;
  }

  /**
   * Generate MCP resources from documents
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [manifest=null] - Manifest data
   * @returns {Array<Object>} Resource definitions
   */
  generateResources(documents, manifest = null) {
    const resources = [];

    // Add llms.txt as a resource
    resources.push({
      uri: "docs://llms.txt",
      name: "Documentation Index",
      description: "Structured index of all documentation",
      mimeType: "text/markdown"
    });

    // Add llms-full.txt as a resource
    resources.push({
      uri: "docs://llms-full.txt",
      name: "Full Documentation",
      description: "Complete documentation content in a single file",
      mimeType: "text/markdown"
    });

    // Add manifest if available
    if (manifest) {
      resources.push({
        uri: "docs://manifest.json",
        name: "Documentation Manifest",
        description: "Metadata and structure of all documents",
        mimeType: "application/json"
      });
    }

    // Add individual documents as resources
    const sections = new Map();
    for (const doc of documents) {
      const section = this.getSectionFromPath(doc.relativePath);
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      sections.get(section).push(doc);
    }

    // Add section resources
    for (const [section, docs] of sections) {
      resources.push({
        uri: `docs://sections/${section}`,
        name: `${this.titleCase(section)} Section`,
        description: `Documentation for ${section} (${docs.length} documents)`,
        mimeType: "text/markdown"
      });
    }

    return resources;
  }

  /**
   * Generate MCP prompts
   *
   * @param {Array<Object>} documents - Processed documents
   * @returns {Array<Object>} Prompt definitions
   */
  generatePrompts(documents) {
    return [
      {
        name: "explain_concept",
        description: `Explain a concept from ${this.projectName} documentation`,
        arguments: [
          {
            name: "concept",
            description: "The concept to explain",
            required: true
          }
        ]
      },
      {
        name: "find_example",
        description: `Find code examples related to a topic in ${this.projectName}`,
        arguments: [
          {
            name: "topic",
            description: "The topic to find examples for",
            required: true
          }
        ]
      },
      {
        name: "summarize_section",
        description: `Summarize a section of ${this.projectName} documentation`,
        arguments: [
          {
            name: "section",
            description: "The section to summarize",
            required: true
          }
        ]
      }
    ];
  }

  /**
   * Generate client configurations for popular tools
   *
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<Object>} Client configurations
   */
  async generateClientConfigs(serverConfig) {
    const configs = {};

    // Cursor configuration
    configs.cursor = {
      mcpServers: {
        [serverConfig.name]: {
          command: serverConfig.server.command,
          args: [join(this.outputDir, serverConfig.server.args[0])],
          env: {}
        }
      }
    };

    // Claude Desktop configuration
    configs.claude = {
      mcpServers: {
        [serverConfig.name]: {
          command: serverConfig.server.command,
          args: [join(this.outputDir, serverConfig.server.args[0])]
        }
      }
    };

    // Write Cursor config
    const cursorConfigPath = join(this.outputDir, "cursor-mcp.json");
    await writeFile(cursorConfigPath, JSON.stringify(configs.cursor, null, 2), "utf8");

    // Write Claude Desktop config
    const claudeConfigPath = join(this.outputDir, "claude-desktop-mcp.json");
    await writeFile(claudeConfigPath, JSON.stringify(configs.claude, null, 2), "utf8");

    return configs;
  }

  /**
   * Generate the MCP server script
   *
   * @param {Array<Object>} documents - Processed documents
   * @param {Object} [manifest=null] - Manifest data
   * @returns {Promise<string>} Path to generated script
   */
  async generateServerScript(documents, manifest = null) {
    const scriptPath = join(this.outputDir, "mcp-server.js");

    // Build document index for the server
    const docIndex = documents.map(doc => ({
      path: doc.relativePath,
      title: doc.metadata?.title || this.titleFromPath(doc.relativePath),
      section: this.getSectionFromPath(doc.relativePath),
      tags: doc.tags || [],
      description: doc.metadata?.description || doc.metadata?.notes || ""
    }));

    const script = `#!/usr/bin/env node
/**
 * MCP Server for ${this.projectName} Documentation
 * Generated by catalog
 *
 * Run: node mcp-server.js
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Document index
const DOCUMENTS = ${JSON.stringify(docIndex, null, 2)};

// Simple search implementation
function searchDocs(query, limit = 5) {
  const queryLower = query.toLowerCase();
  const results = DOCUMENTS
    .map(doc => {
      let score = 0;
      if (doc.title.toLowerCase().includes(queryLower)) score += 10;
      if (doc.path.toLowerCase().includes(queryLower)) score += 5;
      if (doc.description.toLowerCase().includes(queryLower)) score += 3;
      if (doc.tags.some(t => t.toLowerCase().includes(queryLower))) score += 7;
      return { ...doc, score };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}

// Get document content
async function getDocument(path) {
  const doc = DOCUMENTS.find(d => d.path === path);
  if (!doc) return null;

  try {
    const content = await readFile(join(__dirname, "..", path), "utf8");
    return { ...doc, content };
  } catch {
    return null;
  }
}

// List documents with optional filters
function listDocuments(section = null, tags = []) {
  return DOCUMENTS.filter(doc => {
    if (section && doc.section !== section) return false;
    if (tags.length > 0 && !tags.some(t => doc.tags.includes(t))) return false;
    return true;
  });
}

// Get section documents
function getSection(section) {
  return DOCUMENTS.filter(doc => doc.section === section);
}

// MCP Protocol Handler
class MCPServer {
  constructor() {
    this.handlers = {
      "tools/list": () => this.listTools(),
      "tools/call": (params) => this.callTool(params),
      "resources/list": () => this.listResources(),
      "resources/read": (params) => this.readResource(params),
      "prompts/list": () => this.listPrompts(),
      "prompts/get": (params) => this.getPrompt(params)
    };
  }

  listTools() {
    return {
      tools: [
        {
          name: "search_docs",
          description: "Search documentation for relevant information",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              limit: { type: "number", default: 5 }
            },
            required: ["query"]
          }
        },
        {
          name: "get_document",
          description: "Get the full content of a specific document",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"]
          }
        },
        {
          name: "list_documents",
          description: "List all available documents",
          inputSchema: {
            type: "object",
            properties: {
              section: { type: "string" },
              tags: { type: "array", items: { type: "string" } }
            }
          }
        },
        {
          name: "get_section",
          description: "Get all documents in a specific section",
          inputSchema: {
            type: "object",
            properties: { section: { type: "string" } },
            required: ["section"]
          }
        }
      ]
    };
  }

  async callTool({ name, arguments: args }) {
    switch (name) {
      case "search_docs":
        return { content: [{ type: "text", text: JSON.stringify(searchDocs(args.query, args.limit), null, 2) }] };
      case "get_document":
        const doc = await getDocument(args.path);
        return { content: [{ type: "text", text: doc ? doc.content : "Document not found" }] };
      case "list_documents":
        return { content: [{ type: "text", text: JSON.stringify(listDocuments(args.section, args.tags || []), null, 2) }] };
      case "get_section":
        return { content: [{ type: "text", text: JSON.stringify(getSection(args.section), null, 2) }] };
      default:
        throw new Error(\`Unknown tool: \${name}\`);
    }
  }

  listResources() {
    return {
      resources: [
        { uri: "docs://llms.txt", name: "Documentation Index", mimeType: "text/markdown" },
        { uri: "docs://llms-full.txt", name: "Full Documentation", mimeType: "text/markdown" }
      ]
    };
  }

  async readResource({ uri }) {
    const filename = uri.replace("docs://", "");
    try {
      const content = await readFile(join(__dirname, filename), "utf8");
      return { contents: [{ uri, mimeType: "text/markdown", text: content }] };
    } catch {
      throw new Error(\`Resource not found: \${uri}\`);
    }
  }

  listPrompts() {
    return {
      prompts: [
        { name: "explain_concept", description: "Explain a concept from the documentation" },
        { name: "find_example", description: "Find code examples related to a topic" },
        { name: "summarize_section", description: "Summarize a section of documentation" }
      ]
    };
  }

  getPrompt({ name, arguments: args }) {
    const prompts = {
      explain_concept: \`Please explain the following concept from the documentation: \${args?.concept || "[concept]"}\\n\\nUse the search_docs and get_document tools to find relevant information.\`,
      find_example: \`Find code examples related to: \${args?.topic || "[topic]"}\\n\\nSearch the documentation and extract relevant code snippets.\`,
      summarize_section: \`Summarize the following section of documentation: \${args?.section || "[section]"}\\n\\nUse get_section to retrieve all documents in that section.\`
    };
    return { messages: [{ role: "user", content: { type: "text", text: prompts[name] || "" } }] };
  }

  async handleMessage(message) {
    const { method, params, id } = message;

    try {
      if (method === "initialize") {
        return { id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "${this.projectName}-docs", version: "1.0.0" } } };
      }

      const handler = this.handlers[method];
      if (!handler) {
        return { id, error: { code: -32601, message: \`Method not found: \${method}\` } };
      }

      const result = await handler(params);
      return { id, result };
    } catch (error) {
      return { id, error: { code: -32603, message: error.message } };
    }
  }
}

// Start server
const server = new MCPServer();

process.stdin.setEncoding("utf8");

let buffer = "";
process.stdin.on("data", async (chunk) => {
  buffer += chunk;

  const lines = buffer.split("\\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);
      const response = await server.handleMessage(message);
      console.log(JSON.stringify(response));
    } catch (e) {
      console.error("Parse error:", e.message);
    }
  }
});

process.stdin.on("end", () => {
  process.exit(0);
});

console.error("MCP Server started for ${this.projectName} documentation");
`;

    await writeFile(scriptPath, script, "utf8");
    return scriptPath;
  }

  /**
   * Generate Claude Code specific configuration
   *
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<string>} Path to generated config
   */
  async generateClaudeCodeConfig(serverConfig) {
    const configPath = join(this.outputDir, ".claude", "mcp.json");
    await mkdir(join(this.outputDir, ".claude"), { recursive: true });

    const config = {
      mcpServers: {
        [serverConfig.name]: {
          command: "node",
          args: [join(this.outputDir, "mcp-server.js")]
        }
      }
    };

    await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    return configPath;
  }

  /**
   * Get section name from path
   */
  getSectionFromPath(relativePath) {
    const parts = relativePath.split("/");
    return parts.length > 1 ? parts[0] : "root";
  }

  /**
   * Convert path to title
   */
  titleFromPath(relativePath) {
    const filename = basename(relativePath);
    return filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Convert string to title case
   */
  titleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Log a message if not in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }
}
