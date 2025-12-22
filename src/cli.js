#!/usr/bin/env bun

import { CatalogProcessor } from './CatalogProcessor.js';
import { ConfigLoader } from './ConfigLoader.js';
import { WatchMode } from './WatchMode.js';
import { MCPGenerator } from './MCPGenerator.js';
import { EXIT_CODES, CatalogError } from './errors.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load package.json using fs.readFileSync for Node.js compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Version is embedded at build time or taken from package.json in development
const VERSION = pkg.version || '0.0.1';

function showHelp() {
  console.log(`
Catalog v${VERSION} - Content packaging primitive for AI agents

Generate llms.txt and advanced AI-ready content packages from documentation.

Usage:
  catalog [options]

Core Options:
  --input, -i <path>       Source directory of Markdown/HTML files (default: .)
  --output, -o <path>      Output directory for generated files (default: .)
  --config <path>          Load configuration from file (catalog.yaml, .catalogrc)
  --base-url <url>         Base URL for absolute links

Pattern Matching:
  --include <pattern>      Include files matching glob pattern (repeatable)
  --exclude <pattern>      Exclude files matching glob pattern (repeatable)
  --optional <pattern>     Mark files as optional content (repeatable)

Standard Outputs:
  --index                  Generate index.json files for navigation
  --toc                    Generate toc.md files (requires --index)
  --ast <extensions>       Generate AST index (e.g., js,ts,py)
  --sitemap                Generate XML sitemap (requires --base-url)
  --sitemap-no-extensions  Clean URLs without file extensions
  --validate               Validate llms.txt compliance

PAI (Programmable AI) Features:
  --manifest               Generate catalog.manifest.json with doc IDs and metadata
  --chunks                 Generate chunks.jsonl for RAG/memory systems
  --chunk-profile <name>   Chunking profile: default, code-heavy, faq, granular, large-context
  --tags                   Generate tags.json with rule-based semantic tags
  --graph                  Generate graph.json with link analysis and importance scores
  --bundles                Generate context bundles (llms-ctx-2k.txt, etc.)
  --bundle-sizes <sizes>   Comma-separated token sizes (default: 2000,8000,32000)
  --mcp                    Generate MCP server config for IDE integration (Cursor, Claude Code)

Caching & Incremental:
  --cache                  Enable incremental rebuilds with caching
  --cache-dir <path>       Custom cache directory
  --force-rebuild          Ignore cache, rebuild everything

Watch Mode:
  --watch                  Watch for file changes and rebuild
  --watch-debounce <ms>    Debounce delay in milliseconds (default: 500)

Validation:
  --validate-ai            Comprehensive AI readiness validation (code fences, links, secrets)

Provenance:
  --origin <url>           Origin URL (e.g., crawl source)
  --repo-ref <ref>         Git repository reference

Other:
  --silent                 Suppress non-error output
  --init                   Generate sample catalog.yaml configuration
  --help, -h               Show this help message
  --version                Show version

Examples:
  # Basic usage
  catalog -i docs -o build

  # Full PAI pipeline with all features
  catalog -i docs -o build \\
    --base-url https://docs.example.com \\
    --manifest --chunks --tags --graph --bundles \\
    --validate-ai --sitemap

  # Use configuration file
  catalog --config catalog.yaml

  # Watch mode for development
  catalog -i docs -o build --watch --cache

  # Incremental builds
  catalog -i docs -o build --cache

  # Generate sample config
  catalog --init > catalog.yaml

Output Files:
  llms.txt                 Structured index (llms.txt standard)
  llms-full.txt            Full concatenated content
  llms-ctx.txt             Context-only (no Optional section)
  llms-ctx-{size}.txt      Sized context bundles (with --bundles)
  toc.md                   Table of contents (with --toc)
  toc-full.md              Full table of contents (with --toc)
  catalog.manifest.json    Document manifest with IDs (with --manifest)
  chunks.jsonl             Document chunks for RAG (with --chunks)
  tags.json                Semantic tags (with --tags)
  graph.json               Link graph with importance (with --graph)
  catalog.report.json      AI readiness report (with --validate-ai)
  sitemap.xml              XML sitemap (with --sitemap)
  mcp/                     MCP server files (with --mcp)
    mcp-server.js          MCP server implementation
    mcp-config.json        Server configuration
    cursor-config.json     Cursor IDE integration
    claude-config.json     Claude Code integration
`);
}

function parseArgs() {
  const args = process.argv.slice(2);

  const options = {
    // Core
    input: '.',
    output: '.',
    configPath: null,
    baseUrl: null,

    // Patterns
    optionalPatterns: [],
    includeGlobs: [],
    excludeGlobs: [],

    // Standard outputs
    generateIndex: false,
    generateToc: false,
    generateAst: false,
    astExtensions: [],
    generateSitemap: false,
    sitemapNoExtensions: false,
    validate: false,

    // PAI features
    generateManifest: false,
    generateChunks: false,
    chunkProfile: 'default',
    generateTags: false,
    generateGraph: false,
    generateBundles: false,
    bundleSizes: [2000, 8000, 32000],
    generateMcp: false,

    // Caching
    enableCache: false,
    cacheDir: null,
    forceRebuild: false,

    // Watch mode
    watch: false,
    watchDebounce: 500,

    // Validation
    validateAI: false,

    // Provenance
    origin: null,
    repoRef: null,

    // Other
    silent: false,
    init: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;

      case '--version':
        console.log(VERSION);
        process.exit(0);
        break;

      case '--init':
        options.init = true;
        break;

      case '--input':
      case '-i':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --input requires a path argument');
          process.exit(1);
        }
        options.input = nextArg;
        i++;
        break;

      case '--output':
      case '-o':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --output requires a path argument');
          process.exit(1);
        }
        options.output = nextArg;
        i++;
        break;

      case '--config':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --config requires a path argument');
          process.exit(1);
        }
        options.configPath = nextArg;
        i++;
        break;

      case '--base-url':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --base-url requires a URL argument');
          process.exit(1);
        }
        options.baseUrl = nextArg;
        i++;
        break;

      case '--include':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --include requires a glob pattern argument');
          process.exit(1);
        }
        options.includeGlobs.push(nextArg);
        i++;
        break;

      case '--exclude':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --exclude requires a glob pattern argument');
          process.exit(1);
        }
        options.excludeGlobs.push(nextArg);
        i++;
        break;

      case '--optional':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --optional requires a glob pattern argument');
          process.exit(1);
        }
        options.optionalPatterns.push(nextArg);
        i++;
        break;

      case '--index':
      case '--generate-index':
        options.generateIndex = true;
        break;

      case '--toc':
        options.generateToc = true;
        break;

      case '--ast':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --ast requires a comma-separated list of file extensions');
          process.exit(1);
        }
        options.generateAst = true;
        options.astExtensions = nextArg.split(',').map(ext => ext.trim());
        i++;
        break;

      case '--sitemap':
        options.generateSitemap = true;
        break;

      case '--sitemap-no-extensions':
        options.sitemapNoExtensions = true;
        break;

      case '--validate':
        options.validate = true;
        break;

      case '--validate-ai':
        options.validateAI = true;
        break;

      // PAI features
      case '--manifest':
        options.generateManifest = true;
        break;

      case '--chunks':
        options.generateChunks = true;
        break;

      case '--chunk-profile':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --chunk-profile requires a profile name');
          console.error('Valid profiles: default, code-heavy, faq, granular, large-context');
          process.exit(1);
        }
        options.chunkProfile = nextArg;
        i++;
        break;

      case '--tags':
        options.generateTags = true;
        break;

      case '--graph':
        options.generateGraph = true;
        break;

      case '--bundles':
        options.generateBundles = true;
        break;

      case '--bundle-sizes':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --bundle-sizes requires comma-separated numbers');
          process.exit(1);
        }
        options.bundleSizes = nextArg.split(',').map(s => parseInt(s.trim(), 10));
        i++;
        break;

      case '--mcp':
        options.generateMcp = true;
        break;

      // Caching
      case '--cache':
        options.enableCache = true;
        break;

      case '--cache-dir':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --cache-dir requires a path argument');
          process.exit(1);
        }
        options.cacheDir = nextArg;
        options.enableCache = true;
        i++;
        break;

      case '--force-rebuild':
        options.forceRebuild = true;
        break;

      // Watch mode
      case '--watch':
        options.watch = true;
        break;

      case '--watch-debounce':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --watch-debounce requires a number (milliseconds)');
          process.exit(1);
        }
        options.watchDebounce = parseInt(nextArg, 10);
        i++;
        break;

      // Provenance
      case '--origin':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --origin requires a URL argument');
          process.exit(1);
        }
        options.origin = nextArg;
        i++;
        break;

      case '--repo-ref':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --repo-ref requires a reference argument');
          process.exit(1);
        }
        options.repoRef = nextArg;
        i++;
        break;

      case '--silent':
        options.silent = true;
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Error: Unknown option ${arg}`);
          console.error('Use --help to see available options');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

async function main() {
  try {
    const cliOptions = parseArgs();

    // Handle --init: generate sample config
    if (cliOptions.init) {
      const loader = new ConfigLoader();
      console.log(loader.generateSampleConfig('yaml'));
      process.exit(0);
    }

    // Load and merge configuration
    const configLoader = new ConfigLoader({ silent: cliOptions.silent });
    const config = await configLoader.load(
      cliOptions.configPath,
      cliOptions,
      cliOptions.input
    );

    // Create processor with merged config
    const processor = new CatalogProcessor(config.input, config.output, {
      silent: config.silent,

      // Standard options
      generateIndex: config.generateIndex,
      generateToc: config.generateToc,
      generateAst: config.generateAst,
      astExtensions: config.astExtensions,
      generateSitemap: config.generateSitemap,
      sitemapNoExtensions: config.sitemapNoExtensions,
      validate: config.validate,
      baseUrl: config.baseUrl,
      optionalPatterns: config.optionalPatterns,
      includeGlobs: config.includeGlobs,
      excludeGlobs: config.excludeGlobs,

      // PAI features
      generateManifest: config.generateManifest,
      generateChunks: config.generateChunks,
      chunkProfile: config.chunkProfile,
      generateTags: config.generateTags,
      generateGraph: config.generateGraph,
      generateBundles: config.generateBundles,
      bundleSizes: config.bundleSizes,
      generateMcp: config.generateMcp,

      // Caching
      enableCache: config.enableCache,
      cacheDir: config.cacheDir,
      forceRebuild: config.forceRebuild,

      // Validation
      validateAI: config.validateAI,

      // Provenance
      origin: config.origin,
      repoRef: config.repoRef,
      generatorVersion: VERSION
    });

    // Helper to generate MCP after processing
    async function generateMcpIfNeeded(result) {
      if (config.generateMcp && result) {
        if (!config.silent) {
          console.log('Generating MCP server configuration...');
        }

        const mcpGenerator = new MCPGenerator(config.output, {
          serverType: 'stdio',
          serverName: 'catalog-docs',
          baseUrl: config.baseUrl
        });

        const mcpResult = await mcpGenerator.generate(
          result.documents || [],
          result.manifest || null,
          { includeBundles: config.generateBundles }
        );

        if (!config.silent) {
          console.log(`MCP files written to: ${mcpResult.outputDir}`);
        }
      }
    }

    // Watch mode
    if (config.watch) {
      const watcher = new WatchMode(config.input, {
        processor,
        outputDir: config.output,
        silent: config.silent,
        debounceMs: config.watchDebounce,
        emitJsonl: true
      });

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        await watcher.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await watcher.stop();
        process.exit(0);
      });

      // Initial build
      const result = await processor.process();
      await generateMcpIfNeeded(result);

      // Start watching
      await watcher.start();

      // Keep process alive
      await new Promise(() => {});
    } else {
      // Single run
      const result = await processor.process();
      await generateMcpIfNeeded(result);
      process.exit(EXIT_CODES.SUCCESS);
    }

  } catch (error) {
    // Handle CatalogError with proper exit codes
    if (error instanceof CatalogError) {
      process.exit(error.exitCode);
    } else {
      // Unexpected error
      console.error(`\nUnexpected error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(EXIT_CODES.FATAL_ERROR);
    }
  }
}

// Run the CLI
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
