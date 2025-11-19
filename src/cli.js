#!/usr/bin/env bun

import { CatalogProcessor } from './CatalogProcessor.js';
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
Catalog - Generate llms.txt from a directory of markdown and HTML files

Usage:
  catalog [options]

Options:
  --input, -i <path>     Source directory of Markdown/HTML files (default: current directory)
  --output, -o <path>    Destination directory for generated files (default: current directory)
  --base-url <url>       Base URL for generating absolute links in output files
  --optional <pattern>   Mark files matching glob pattern as optional (can be used multiple times)
  --include <pattern>    Include files matching glob pattern (can be used multiple times)
  --exclude <pattern>    Exclude files matching glob pattern (can be used multiple times)
  --index                Generate index.json files for directory navigation and metadata
  --toc                  Generate toc.md files for directory navigation (requires --index)
  --ast <extensions>     Generate AST index for comma-separated file extensions (e.g. js,ts,py)
  --sitemap              Generate XML sitemap for search engines (requires --base-url)
  --sitemap-no-extensions Generate sitemap URLs without file extensions for clean URLs
  --validate             Validate generated llms.txt compliance with standard
  --silent               Suppress non-error output
  --help, -h             Show this help message
  --version              Show the current version

Examples:
  # Default (current directory)
  catalog

  # Specify input and output directories
  catalog --input docs --output build

  # Generate with absolute URLs and sitemap
  catalog --input docs --output build --base-url https://example.com/ --sitemap

  # Mark draft files as optional
  catalog --optional "drafts/**/*" --optional "**/CHANGELOG.md"

  # Include only specific patterns
  catalog --include "*.md" --include "catalog/*.html"

  # Exclude specific patterns
  catalog --exclude "*.draft.md" --exclude "temp/*"

  # Generate with navigation index and validation
  catalog -i docs -o build --index --validate

  # Generate with table of contents files
  catalog -i docs -o build --index --toc

  # Generate AST index for JavaScript and TypeScript files
  catalog -i docs -o build --ast js,ts,jsx,tsx

  # Full example with all options
  catalog -i docs -o build --base-url https://docs.example.com/ --sitemap --index --toc --ast js,ts --optional "internal/**" --validate

  # Silent mode
  catalog -i docs -o build --silent

File Types:
  - Markdown files (.md, .mdx)
  - HTML files (.html)

Output:
  - llms.txt: Structured index with Core Documentation and Optional sections
  - llms-full.txt: Full concatenated content with headers and separators
  - index.json: Directory navigation and file metadata (with --index)
  - toc.md: Directory table of contents files (with --toc)
  - toc-full.md: Complete nested table of contents (with --toc)
  - ast-index.json: Project-wide AST index with code structure (with --ast)
  - ast-full.txt: Detailed AST information for all files (with --ast)

The tool follows the LLMS standard for AI-friendly documentation format.
Document ordering: index/readme files first, then important docs (catalogs, tutorials), then remainder.
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  const options = {
    input: '.',
    output: '.',
    baseUrl: null,
    optionalPatterns: [],
    silent: false,
    generateIndex: false,
    generateToc: false,
    generateAst: false,
    astExtensions: [],
    generateSitemap: false,
    sitemapNoExtensions: false,
    validate: false,
    includeGlobs: [],
    excludeGlobs: []
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
        
      case '--input':
      case '-i':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --input requires a path argument');
          process.exit(1);
        }
        options.input = nextArg;
        i++; // Skip next argument
        break;
        
      case '--output':
      case '-o':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --output requires a path argument');
          process.exit(1);
        }
        options.output = nextArg;
        i++; // Skip next argument
        break;
        
      case '--include':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --include requires a glob pattern argument');
          process.exit(1);
        }
        options.includeGlobs.push(nextArg);
        i++; // Skip next argument
        break;
        
      case '--exclude':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --exclude requires a glob pattern argument');
          process.exit(1);
        }
        options.excludeGlobs.push(nextArg);
        i++; // Skip next argument
        break;
        
      case '--silent':
        options.silent = true;
        break;
        
      case '--base-url':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('--base-url requires a URL argument');
          process.exit(1);
        }
        options.baseUrl = nextArg;
        i++; // Skip next argument
        break;
        
      case '--optional':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --optional requires a glob pattern argument');
          process.exit(1);
        }
        options.optionalPatterns.push(nextArg);
        i++; // Skip next argument
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
        
      case '--index':
        options.generateIndex = true;
        break;

      case '--toc':
        options.generateToc = true;
        break;

      case '--ast':
        if (!nextArg || nextArg.startsWith('-')) {
          console.error('Error: --ast requires a comma-separated list of file extensions');
          console.error('Example: --ast js,ts,py');
          process.exit(1);
        }
        options.generateAst = true;
        options.astExtensions = nextArg.split(',').map(ext => ext.trim());
        i++; // Skip next argument
        break;

      case '--generate-index':
        options.generateIndex = true;
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
    const options = parseArgs();
    
    const processor = new CatalogProcessor(options.input, options.output, {
      silent: options.silent,
      generateIndex: options.generateIndex,
      generateToc: options.generateToc,
      generateAst: options.generateAst,
      astExtensions: options.astExtensions,
      generateSitemap: options.generateSitemap,
      sitemapNoExtensions: options.sitemapNoExtensions,
      validate: options.validate,
      baseUrl: options.baseUrl,
      optionalPatterns: options.optionalPatterns,
      includeGlobs: options.includeGlobs,
      excludeGlobs: options.excludeGlobs
    });
    
    await processor.process();
    
    process.exit(EXIT_CODES.SUCCESS);
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