import { mkdir, rm, readdir, stat, readFile, writeFile } from "fs/promises";
import { join, basename, dirname } from "path";
import { spawn } from "child_process";
import { createHash } from "crypto";

/**
 * SourceConnector - Connect to remote documentation sources
 *
 * Supports pulling documentation from:
 * - git:// or github:// - Git repositories
 * - http:// or https:// - Web URLs (integrates with inform)
 * - s3:// - AWS S3 buckets
 * - file:// - Local file paths
 *
 * @example
 * const connector = new SourceConnector({ cacheDir: '.cache/sources' });
 * const localPath = await connector.fetch('github://owner/repo/docs');
 */
export class SourceConnector {
  /**
   * Supported source protocols
   */
  static PROTOCOLS = ["git", "github", "http", "https", "s3", "file"];

  /**
   * Default cache directory
   */
  static DEFAULT_CACHE_DIR = ".cache/catalog/sources";

  /**
   * Create a new SourceConnector instance
   *
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.silent=false] - Suppress log output
   * @param {string} [options.cacheDir] - Directory to cache fetched sources
   * @param {boolean} [options.force=false] - Force re-fetch even if cached
   * @param {string} [options.branch='main'] - Git branch to fetch
   * @param {number} [options.depth=1] - Git clone depth
   * @param {Object} [options.auth={}] - Authentication credentials
   */
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.cacheDir = options.cacheDir || SourceConnector.DEFAULT_CACHE_DIR;
    this.force = options.force || false;
    this.branch = options.branch || "main";
    this.depth = options.depth || 1;
    this.auth = options.auth || {};
  }

  /**
   * Fetch documentation from a source URI
   *
   * @param {string} source - Source URI (e.g., 'github://owner/repo/path')
   * @param {Object} [options={}] - Fetch options
   * @returns {Promise<Object>} Fetch result with local path and metadata
   */
  async fetch(source, options = {}) {
    const parsed = this.parseSource(source);

    if (!parsed) {
      throw new Error(`Invalid source URI: ${source}`);
    }

    this.log(`Fetching from ${parsed.protocol}://${parsed.host}${parsed.path}`);

    // Create cache directory
    await mkdir(this.cacheDir, { recursive: true });

    // Generate cache key
    const cacheKey = this.generateCacheKey(source);
    const cachePath = join(this.cacheDir, cacheKey);

    // Check cache
    if (!this.force && !options.force) {
      const cached = await this.checkCache(cachePath, source);
      if (cached) {
        this.log(`Using cached source: ${cachePath}`);
        return cached;
      }
    }

    // Fetch based on protocol
    let result;
    switch (parsed.protocol) {
      case "git":
      case "github":
        result = await this.fetchGit(parsed, cachePath, options);
        break;
      case "http":
      case "https":
        result = await this.fetchHttp(parsed, cachePath, options);
        break;
      case "s3":
        result = await this.fetchS3(parsed, cachePath, options);
        break;
      case "file":
        result = await this.fetchFile(parsed, cachePath, options);
        break;
      default:
        throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    // Save cache metadata
    await this.saveCacheMetadata(cachePath, source, result);

    return result;
  }

  /**
   * Parse a source URI into components
   *
   * @param {string} source - Source URI
   * @returns {Object|null} Parsed components or null if invalid
   */
  parseSource(source) {
    // Handle shorthand github syntax: owner/repo or owner/repo/path
    if (/^[\w-]+\/[\w.-]+/.test(source) && !source.includes("://")) {
      const parts = source.split("/");
      const owner = parts[0];
      const repo = parts[1];
      const path = parts.slice(2).join("/") || "";
      return {
        protocol: "github",
        host: "github.com",
        owner,
        repo,
        path: path ? `/${path}` : "",
        original: source
      };
    }

    // Handle full URI syntax
    const match = source.match(/^(\w+):\/\/([^\/]+)(\/.*)?$/);
    if (!match) {
      return null;
    }

    const [, protocol, host, path = ""] = match;

    if (!SourceConnector.PROTOCOLS.includes(protocol)) {
      return null;
    }

    // Parse GitHub-specific format
    if (protocol === "github") {
      const pathParts = (host + path).split("/");
      const owner = pathParts[0];
      const repo = pathParts[1];
      const subpath = pathParts.slice(2).join("/");
      return {
        protocol,
        host: "github.com",
        owner,
        repo,
        path: subpath ? `/${subpath}` : "",
        original: source
      };
    }

    return {
      protocol,
      host,
      path,
      original: source
    };
  }

  /**
   * Fetch from a Git repository
   *
   * @param {Object} parsed - Parsed source
   * @param {string} cachePath - Cache destination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Fetch result
   */
  async fetchGit(parsed, cachePath, options = {}) {
    const { owner, repo, path, host } = parsed;
    const branch = options.branch || this.branch;
    const depth = options.depth || this.depth;

    // Build clone URL
    let cloneUrl;
    if (parsed.protocol === "github") {
      cloneUrl = `https://github.com/${owner}/${repo}.git`;
    } else {
      cloneUrl = `${parsed.protocol}://${host}${parsed.path}`;
    }

    // Clone repository
    const repoPath = join(cachePath, "repo");
    await rm(repoPath, { recursive: true, force: true });
    await mkdir(repoPath, { recursive: true });

    await this.execCommand("git", [
      "clone",
      "--depth", String(depth),
      "--branch", branch,
      "--single-branch",
      cloneUrl,
      repoPath
    ]);

    // Get commit info
    const commitHash = await this.execCommand("git", [
      "-C", repoPath,
      "rev-parse", "HEAD"
    ]).then(r => r.stdout.trim());

    // Determine the final path
    const finalPath = path ? join(repoPath, path.replace(/^\//, "")) : repoPath;

    // Verify path exists
    try {
      await stat(finalPath);
    } catch {
      throw new Error(`Path not found in repository: ${path || "/"}`);
    }

    return {
      path: finalPath,
      source: parsed.original,
      protocol: parsed.protocol,
      metadata: {
        type: "git",
        repository: `${owner}/${repo}`,
        branch,
        commit: commitHash,
        subpath: path || "/",
        fetched_at: new Date().toISOString()
      }
    };
  }

  /**
   * Fetch from HTTP/HTTPS URL
   *
   * @param {Object} parsed - Parsed source
   * @param {string} cachePath - Cache destination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Fetch result
   */
  async fetchHttp(parsed, cachePath, options = {}) {
    const url = `${parsed.protocol}://${parsed.host}${parsed.path}`;
    const docsPath = join(cachePath, "docs");

    await rm(docsPath, { recursive: true, force: true });
    await mkdir(docsPath, { recursive: true });

    // Check if inform CLI is available for web crawling
    const hasInform = await this.checkCommand("inform");

    if (hasInform) {
      // Use inform for full web crawling
      this.log(`Using inform to crawl ${url}`);
      await this.execCommand("inform", [
        url,
        "--output-dir", docsPath,
        "--format", "markdown"
      ]);
    } else {
      // Fallback: Simple fetch of the URL
      this.log(`Fetching ${url} (install inform for full crawl support)`);
      await this.fetchSingleUrl(url, docsPath);
    }

    // Get file count
    const files = await this.listFilesRecursive(docsPath);

    return {
      path: docsPath,
      source: parsed.original,
      protocol: parsed.protocol,
      metadata: {
        type: "http",
        url,
        file_count: files.length,
        fetched_at: new Date().toISOString(),
        crawler: hasInform ? "inform" : "simple"
      }
    };
  }

  /**
   * Fetch a single URL
   *
   * @param {string} url - URL to fetch
   * @param {string} destDir - Destination directory
   * @returns {Promise<void>}
   */
  async fetchSingleUrl(url, destDir) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const content = await response.text();

    // Determine filename and format
    let filename = "index.md";
    let finalContent = content;

    if (contentType.includes("text/html")) {
      // Simple HTML to markdown conversion
      finalContent = this.simpleHtmlToMarkdown(content);
    } else if (contentType.includes("text/markdown") || url.endsWith(".md")) {
      filename = basename(url) || "index.md";
    }

    await writeFile(join(destDir, filename), finalContent, "utf8");
  }

  /**
   * Simple HTML to Markdown conversion
   *
   * @param {string} html - HTML content
   * @returns {string} Markdown content
   */
  simpleHtmlToMarkdown(html) {
    let md = html;

    // Remove script and style tags
    md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Convert headings
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");

    // Convert paragraphs
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

    // Convert links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

    // Convert lists
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
    md = md.replace(/<\/?[uo]l[^>]*>/gi, "\n");

    // Convert code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n");
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

    // Convert bold and italic
    md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

    // Remove remaining tags
    md = md.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    md = md.replace(/&nbsp;/g, " ");
    md = md.replace(/&amp;/g, "&");
    md = md.replace(/&lt;/g, "<");
    md = md.replace(/&gt;/g, ">");
    md = md.replace(/&quot;/g, '"');

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, "\n\n");
    md = md.trim();

    return md;
  }

  /**
   * Fetch from S3 bucket
   *
   * @param {Object} parsed - Parsed source
   * @param {string} cachePath - Cache destination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Fetch result
   */
  async fetchS3(parsed, cachePath, options = {}) {
    const bucket = parsed.host;
    const prefix = parsed.path.replace(/^\//, "");
    const docsPath = join(cachePath, "docs");

    await rm(docsPath, { recursive: true, force: true });
    await mkdir(docsPath, { recursive: true });

    // Check if AWS CLI is available
    const hasAws = await this.checkCommand("aws");

    if (!hasAws) {
      throw new Error("AWS CLI is required for S3 sources. Install it from https://aws.amazon.com/cli/");
    }

    // Sync from S3
    const s3Uri = prefix ? `s3://${bucket}/${prefix}` : `s3://${bucket}`;

    await this.execCommand("aws", [
      "s3", "sync",
      s3Uri,
      docsPath,
      "--exclude", "*",
      "--include", "*.md",
      "--include", "*.mdx",
      "--include", "*.html"
    ]);

    const files = await this.listFilesRecursive(docsPath);

    return {
      path: docsPath,
      source: parsed.original,
      protocol: "s3",
      metadata: {
        type: "s3",
        bucket,
        prefix: prefix || "/",
        file_count: files.length,
        fetched_at: new Date().toISOString()
      }
    };
  }

  /**
   * Fetch from local file path
   *
   * @param {Object} parsed - Parsed source
   * @param {string} cachePath - Cache destination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Fetch result
   */
  async fetchFile(parsed, cachePath, options = {}) {
    const sourcePath = parsed.host + parsed.path;

    // Verify source exists
    try {
      await stat(sourcePath);
    } catch {
      throw new Error(`Local path not found: ${sourcePath}`);
    }

    // For file:// we just return the path directly, no caching needed
    const files = await this.listFilesRecursive(sourcePath);

    return {
      path: sourcePath,
      source: parsed.original,
      protocol: "file",
      metadata: {
        type: "file",
        path: sourcePath,
        file_count: files.length,
        fetched_at: new Date().toISOString()
      }
    };
  }

  /**
   * Check if a source is cached and valid
   *
   * @param {string} cachePath - Cache path
   * @param {string} source - Original source URI
   * @returns {Promise<Object|null>} Cached result or null
   */
  async checkCache(cachePath, source) {
    const metadataPath = join(cachePath, "catalog-source.json");

    try {
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

      // Check if cache is still valid (default: 1 hour)
      const cacheAge = Date.now() - new Date(metadata.fetched_at).getTime();
      const maxAge = 60 * 60 * 1000; // 1 hour

      if (cacheAge > maxAge) {
        return null;
      }

      // Verify the cached path exists
      await stat(metadata.path);

      return {
        path: metadata.path,
        source: metadata.source,
        protocol: metadata.protocol,
        metadata: metadata.metadata,
        cached: true
      };
    } catch {
      return null;
    }
  }

  /**
   * Save cache metadata
   *
   * @param {string} cachePath - Cache path
   * @param {string} source - Original source URI
   * @param {Object} result - Fetch result
   * @returns {Promise<void>}
   */
  async saveCacheMetadata(cachePath, source, result) {
    const metadataPath = join(cachePath, "catalog-source.json");
    await mkdir(dirname(metadataPath), { recursive: true });

    await writeFile(metadataPath, JSON.stringify({
      source,
      ...result,
      fetched_at: new Date().toISOString()
    }, null, 2), "utf8");
  }

  /**
   * Generate a cache key for a source
   *
   * @param {string} source - Source URI
   * @returns {string} Cache key
   */
  generateCacheKey(source) {
    return createHash("sha256")
      .update(source)
      .digest("hex")
      .substring(0, 12);
  }

  /**
   * Execute a shell command
   *
   * @param {string} command - Command to execute
   * @param {Array<string>} args - Command arguments
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  execCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", data => { stdout += data; });
      proc.stderr.on("data", data => { stderr += data; });

      proc.on("close", code => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(" ")}\n${stderr}`));
        }
      });

      proc.on("error", reject);
    });
  }

  /**
   * Check if a command is available
   *
   * @param {string} command - Command to check
   * @returns {Promise<boolean>}
   */
  async checkCommand(command) {
    try {
      await this.execCommand("which", [command]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List files recursively in a directory
   *
   * @param {string} dir - Directory to list
   * @param {Array<string>} [files=[]] - Accumulator
   * @returns {Promise<Array<string>>}
   */
  async listFilesRecursive(dir, files = []) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.listFilesRecursive(fullPath, files);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return files;
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
