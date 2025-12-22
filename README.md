# Catalog

A comprehensive CLI that scans a directory of Markdown and HTML files to generate `llms.txt` (structured index) and `llms-full.txt` (full content) with advanced PAI (Programmable AI) features, designed for AI-powered documentation workflows and seamless integration with the fwdslsh ecosystem.

**Latest Version:** 0.2.0 ([CHANGELOG](CHANGELOG.md))

## Philosophy

**Catalog** embodies the fwdslsh ethos: minimal, readable, and effective. It bridges content crawling (via `inform`) to AI-ready documentation formats (`llms.txt`), using familiar, easy-to-understand CLI patterns with enterprise-grade reliability.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/fwdslsh/catalog/main/install.sh | bash
```

### Manual Downloads

Download pre-built binaries from [GitHub Releases](https://github.com/fwdslsh/catalog/releases).

### Docker

```bash
docker run fwdslsh/catalog:latest --help
```

## Quick Start

```bash
# Default (scan current directory, output to current directory)
catalog

# Specify input and output directories
catalog --input docs --output build

# Use configuration file
catalog --config catalog.yaml

# Generate with absolute URLs and sitemap
catalog --input docs --output build --base-url https://example.com/ --sitemap

# Generate with table of contents for navigation
catalog --input docs --output build --index --toc

# Generate AST index for code files
catalog --input src --output build --ast js,ts,py

# Complete PAI (Programmable AI) workflow
catalog -i docs -o build --base-url https://docs.example.com \
  --optional "drafts/**/*" --sitemap --validate --index --toc --ast js,ts \
  --chunks --tags --graph --bundles --mcp

# AI-optimized content generation for RAG systems
catalog -i docs -o ai-context \
  --optional "examples/**/*" --optional "appendix/**/*" \
  --chunks --chunk-profile code-heavy --tags --graph --bundles
```

## Core Features

### 🚀 **Version 0.2.0 - PAI (Programmable AI) Features**

#### Core llms.txt Features
- **llms.txt Standard Compliance**: Complete H1 → blockquote → sections format
- **HTML Processing**: Full support for HTML files with conversion to Markdown
- **Table of Contents Generation**: Human-readable TOC files with line counts for directory navigation
- **AST Index Generation**: Project-wide code structure analysis for multiple languages (JS, TS, Python, Go, Rust, etc.)
- **Sitemap Generation**: XML sitemaps for SEO optimization
- **Site Metadata Extraction**: Automatic detection from frontmatter and HTML meta tags
- **Path-Based Section Generation**: Intelligent organization using directory structure
- **Optional Content Patterns**: Mark files as optional using glob patterns
- **Validation System**: Ensure output complies with llms.txt standard
- **Performance Monitoring**: Real-time performance and memory usage tracking
- **Security Enhancements**: Path validation, file scanning, and input sanitization
- **Graceful Error Handling**: Actionable error messages and recovery suggestions

#### PAI (Programmable AI) Features
- **Document Manifest Generation**: Creates `catalog.manifest.json` with unique document IDs, content hashes, and provenance
- **RAG-Ready Document Chunking**: Intelligent document splitting at heading boundaries with multiple chunking profiles
  - `default`: Standard chunking for general content
  - `code-heavy`: Optimized for documentation with code examples
  - `faq`: Q&A format preservation
  - `granular`: Small chunks for precise retrieval
  - `large-context`: Fewer, larger chunks for models with bigger context windows
- **Context Bundle Generation**: Creates `llms-ctx-{size}.txt` files for different LLM context windows (2k, 8k, 32k tokens)
- **Semantic Tag Generation**: Rule-based content classification with `tags.json` for filtering and search
- **Link Graph Analysis**: Creates `graph.json` with document relationships, importance scoring, and broken link detection
- **MCP Server Generation**: Model Context Protocol server for IDE integration (Cursor, Claude Code)
- **Source Integration**: Pull documentation from remote sources (GitHub, Git, HTTP, S3) before processing
- **Framework Integrations**: Ready-to-use integrations for LangChain and LlamaIndex
- **Per-Pattern Configuration**: Apply different settings (chunk profiles, tags, priorities) by glob pattern
- **Incremental Builds**: Faster rebuilds with intelligent caching
- **File System Watching**: Automatic rebuilds when source files change
- **Configuration File Support**: Persistent project configuration with YAML, JSON, and JavaScript config files

- **llms.txt Standard Compliance**: Complete H1 → blockquote → sections format
- **HTML Processing**: Full support for HTML files with conversion to Markdown
- **Table of Contents Generation**: Human-readable TOC files with line counts for directory navigation
- **AST Index Generation**: Project-wide code structure analysis for multiple languages (JS, TS, Python, Go, Rust, etc.)
- **Sitemap Generation**: XML sitemaps for SEO optimization
- **Site Metadata Extraction**: Automatic detection from frontmatter and HTML meta tags
- **Path-Based Section Generation**: Intelligent organization using directory structure
- **Optional Content Patterns**: Mark files as optional using glob patterns
- **Validation System**: Ensure output complies with llms.txt standard
- **Performance Monitoring**: Real-time performance and memory usage tracking
- **Security Enhancements**: Path validation, file scanning, and input sanitization
- **Graceful Error Handling**: Actionable error messages and recovery suggestions

## Usage

### Basic Commands

```bash
# Default behavior
catalog

# Specify directories
catalog --input docs --output build
catalog -i docs -o build

# With base URL for absolute links
catalog --input docs --output build --base-url https://example.com/

# Mark files as optional
catalog --optional "drafts/**/*" --optional "**/CHANGELOG.md"

# Generate sitemap for SEO
catalog --sitemap --base-url https://docs.example.com/

# Validate output compliance
catalog --validate

# Generate navigation index
catalog --index

# Generate table of contents for human navigation  
catalog --index --toc

# Silent mode
catalog --silent

# Use configuration file
catalog --config catalog.yaml

# Generate sample configuration
catalog --init > catalog.yaml
```

### Advanced Workflows

```bash
# Complete documentation pipeline
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --optional "drafts/**/*" \
  --sitemap --sitemap-no-extensions \
  --validate --index --toc

# Include/exclude specific patterns
catalog --include "*.md" --include "tutorials/*.html" \
  --exclude "**/*draft*" --exclude "temp/*"

# Integration with inform crawler
inform https://docs.example.com --output-dir docs
catalog --input docs --output build --base-url https://docs.example.com --sitemap --index --toc
```

## Command Reference

### Core Options

- `--input, -i <path>`: Source directory of Markdown/HTML files (default: current directory)
- `--output, -o <path>`: Destination directory for generated files (default: current directory)
- `--base-url <url>`: Base URL for generating absolute links in output files
- `--config <path>`: Path to configuration file (auto-detects if not specified)
- `--silent`: Suppress non-error output

### Content Selection

- `--include <pattern>`: Include files matching glob pattern (can be used multiple times)
- `--exclude <pattern>`: Exclude files matching glob pattern (can be used multiple times)
- `--optional <pattern>`: Mark files matching glob pattern as optional (can be used multiple times)

### Output Generation

#### Core Output Options
- `--index`: Generate index.json files for directory navigation and metadata
- `--toc`: Generate table of contents files with line counts for human-readable navigation (requires --index)
- `--ast <extensions>`: Generate AST index for comma-separated file extensions (e.g., js,ts,py,go,rs)
- `--sitemap`: Generate XML sitemap for search engines (requires --base-url)
- `--sitemap-no-extensions`: Generate sitemap URLs without file extensions for clean URLs
- `--validate`: Validate generated llms.txt compliance with standard

#### PAI (Programmable AI) Features
- `--chunks`: Generate RAG-ready document chunks as `chunks.jsonl`
- `--chunk-profile <name>`: Specify chunking strategy (default, code-heavy, faq, granular, large-context)
- `--tags`: Generate semantic tags for content classification as `tags.json`
- `--graph`: Generate link graph analysis and importance scoring as `graph.json`
- `--bundles`: Generate context bundles for different LLM context windows
- `--bundle-sizes <sizes>`: Custom bundle sizes (comma-separated token counts, default: 2000,8000,32000)
- `--mcp`: Generate MCP server for IDE integration (Cursor, Claude Code)

#### Source Integration & Caching
- `--source <url>`: Pull documentation from remote source before processing
- `--source-branch <branch>`: Specify branch for git sources
- `--source-cache <dir>`: Enable source caching with custom directory
- `--cache`: Enable incremental build caching
- `--cache-dir <dir>`: Custom cache directory location
- `--watch`: Enable file system watching for automatic rebuilds

### Utility

- `--help, -h`: Show usage information
- `--version`: Show current version
- `--init`: Generate sample configuration file to stdout

## File Processing

### Supported File Types

- **Markdown**: `.md`, `.mdx` files with YAML frontmatter support
- **HTML**: `.html` files with automatic conversion to Markdown
- **Content Extraction**: Automatic extraction of titles, descriptions, and metadata

### Intelligent Document Ordering

1. **Index/Root Files**: `index.md`, `readme.md`, `home.md` (prioritized by type and name)
2. **Important Documentation**: Files containing keywords like `catalog`, `tutorial`, `intro`, `getting-started`
3. **Path-Based Sections**: Automatic organization by directory structure
4. **Alphabetical Fallback**: Remaining files sorted alphabetically

### Content Processing

- **YAML Frontmatter Stripping**: Removes frontmatter while preserving content
- **HTML Meta Tag Extraction**: Extracts title, description, and other metadata
- **Site Metadata Detection**: Automatic detection from root index files
- **Relative Path Management**: Maintains proper linking between documents

## Output Formats

### llms.txt (Structured Index)

Complies with the llms.txt standard format:

```markdown
# Project Name
> Brief description from site metadata

## Core Documentation
- [index.md](index.md) - Project overview
- [tutorial.md](tutorial.md) - Getting started guide

## API Reference  
- [api/authentication.md](api/authentication.md) - Authentication methods
- [api/endpoints.md](api/endpoints.md) - API endpoints

## Optional
- [drafts/future-plans.md](drafts/future-plans.md) - Future development plans
```

### llms-full.txt (Complete Content)

Full concatenated content with clear separators:

```markdown
# Project Name
> Brief description from site metadata

## index.md
[Full content of index.md with frontmatter stripped]
---
## tutorial.md
[Full content of tutorial.md]
---
[... continues for all files]
```

### llms-ctx.txt (Context-Only)

Structured index without optional sections (for context-limited scenarios).

### sitemap.xml (SEO Optimization)

XML sitemap with metadata-based priorities and change frequencies:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://docs.example.com/</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://docs.example.com/tutorial</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### index.json (Navigation Metadata)

Comprehensive directory and file metadata for programmatic navigation:

```json
{
  "directory": ".",
  "generated": "2024-01-01T00:00:00Z",
  "files": [
    {
      "name": "index.md",
      "path": "index.md", 
      "size": 1234,
      "modified": "2024-01-01T00:00:00Z",
      "type": "md",
      "extension": ".md",
      "isMarkdown": true
    }
  ],
  "subdirectories": [
    {
      "name": "api",
      "path": "api",
      "indexPath": "api/index.json"
    }
  ],
  "summary": {
    "totalFiles": 5,
    "totalSubdirectories": 2,
    "markdownFiles": 3,
    "totalSize": 12543
  }
}
```

### toc.md (Directory Navigation)

Human-readable table of contents files for easy directory navigation:

```markdown
# Table of Contents - docs

- [← Parent Directory](../toc.md)

## Files
- [Getting Started](getting-started.md)
- [API Reference](api-reference.md)  
- [Tutorial](tutorial.md)

## Subdirectories
- [examples/](examples/toc.md)
- [guides/](guides/toc.md)
```

### toc-full.md (Complete Project Overview)

Complete hierarchical table of contents generated at the root directory:

```markdown
# Complete Table of Contents

> Generated from ProjectName

- [README](README.md)
- [Getting Started](docs/getting-started.md)
- **docs/**
  - [API Reference](docs/api-reference.md)
  - [Tutorial](docs/tutorial.md)
- **examples/**
  - [Basic Example](examples/basic.md)
- **guides/**
  - [Configuration](guides/configuration.md)
```

Key features of TOC files:
- **Parent Navigation**: Each subdirectory TOC includes a link back to the parent directory
- **Line Counts**: Each file entry shows the number of lines for quick reference
- **Clean Display**: File extensions (.md, .mdx) are automatically removed for cleaner presentation
- **Directory Structure**: Hierarchical view shows the complete project organization
- **URL Support**: Works with both relative and absolute URLs via `--base-url`

### PAI (Programmable AI) Formats

#### catalog.manifest.json (Document Manifest)
Document manifest with unique IDs for programmatic access:

```json
{
  "version": "1.0.0",
  "documents": [
    {"id": "doc_abc123", "path": "guide.md", "hash": "sha256:..."}
  ]
}
```

#### chunks.jsonl (RAG Chunks)
Document chunks for vector database ingestion (JSON Lines format):

```json
{"id":"chunk_001","docId":"doc_abc123","content":"## Installation...","metadata":{"heading":"Installation"}}
```

#### tags.json (Semantic Tags)
Semantic content classification for filtering and search:

```json
{
  "documents": {
    "guide.md": {"tags": ["tutorial"], "categories": ["docs"]}
  }
}
```

#### graph.json (Link Graph)
Document relationship analysis with importance scoring:

```json
{
  "nodes": [{"id": "guide.md", "importance": 0.85}],
  "edges": [{"source": "guide.md", "target": "api.md"}]
}
```

#### llms-ctx-{size}.txt (Context Bundles)
Context bundles sized for different LLM context windows:

```markdown
# Project Name
> Brief description from site metadata

## Core Documentation
- [index.md](index.md) - Project overview

## API Reference  
- [api/authentication.md](api/authentication.md) - Authentication methods
```

#### mcp/ Directory (MCP Server)
Model Context Protocol server for IDE integration:

- `mcp-server.js` - Executable MCP server
- `mcp-server.json` - Server configuration  
- `cursor-mcp.json` - Cursor IDE config
- `claude-mcp.json` - Claude Code config

### ast-index.json (Code Structure Analysis)

Project-wide AST index with code structure for specified file types:

```json
{
  "generated": "2025-11-19T00:00:00.000Z",
  "extensions": ["js", "ts"],
  "totalFiles": 15,
  "files": [
    {
      "file": "src/index.js",
      "extension": "js",
      "lines": 120,
      "size": 3456,
      "imports": [
        {"line": 1, "statement": "import { foo } from './bar.js'", "module": "./bar.js"}
      ],
      "exports": [
        {"line": 10, "type": "class", "name": "MyClass", "default": false}
      ],
      "functions": [
        {"line": 25, "name": "myFunction", "type": "function"}
      ],
      "classes": [
        {"line": 10, "name": "MyClass"}
      ],
      "constants": [
        {"line": 5, "name": "MY_CONSTANT"}
      ]
    }
  ],
  "summary": {
    "totalLines": 1850,
    "totalFunctions": 45,
    "totalClasses": 12,
    "totalImports": 78,
    "byExtension": {
      "js": {"files": 10, "lines": 1200, "functions": 32, "classes": 8},
      "ts": {"files": 5, "lines": 650, "functions": 13, "classes": 4}
    }
  }
}
```

### ast-full.txt (Detailed AST Report)

Human-readable AST report with detailed code structure:

```markdown
# Project AST Index

> Generated for extensions: js, ts

## Summary

- Total Files: 15
- Total Lines: 1850
- Total Functions: 45
- Total Classes: 12

## Files

### src/index.js

- Lines: 120
- Extension: js

**Imports:**
- Line 1: import { foo } from './bar.js'

**Functions:**
- Line 25: myFunction

**Classes:**
- Line 10: MyClass
```

Supported Languages:
- **JavaScript/TypeScript**: .js, .jsx, .ts, .tsx, .mjs, .cjs
- **Python**: .py
- **Go**: .go
- **Rust**: .rs
- **Java**: .java
- **Ruby**: .rb
- **PHP**: .php
- **C/C++**: .c, .cpp, .cc, .h, .hpp

## Output Formats

### Core Formats

#### llms.txt (Structured Index)

Real-time performance tracking with detailed reporting:

```
📊 Performance Report:
  Total Time: 147ms
  Memory Usage:
    Heap Used: 12.45MB
    RSS: 89.23MB
  Memory Delta:
    Heap: +2.1MB
    RSS: +5.7MB
  Operations:
    file_scanning: 23ms
    content_processing: 89ms
    sitemap_generation: 12ms
    files_processed: 42
    total_file_size: 2.3MB
```

### Security Features

- **Path Traversal Prevention**: Blocks `../` and other directory traversal attempts
- **File Size Limits**: Configurable limits to prevent processing of extremely large files
- **Content Scanning**: Detection of suspicious patterns, scripts, and malicious URLs
- **Input Sanitization**: All user inputs are validated and sanitized
- **Security Auditing**: Comprehensive security reports with issue categorization

### Error Handling

Enhanced error handling with actionable messages:

```
❌ Error in file processing: Permission denied: /protected/file.md

Details:
  EACCES: permission denied

Suggestions:
  → Check file permissions
  → Ensure the directory is not locked by another process
  → Try running with appropriate permissions
```

### Validation System

Comprehensive validation ensuring llms.txt standard compliance:

- **Structure Validation**: Verifies H1 → blockquote → sections format
- **Link Format Validation**: Ensures proper Markdown link syntax
- **Section Ordering**: Validates correct section hierarchy
- **URL Validation**: Checks absolute URL correctness when base URL is provided

## Configuration Files

Catalog supports persistent configuration through multiple file formats, making it easy to maintain consistent settings across projects and teams.

### Supported Configuration Files

Catalog automatically detects configuration files in this order of preference:

1. `catalog.yaml` / `catalog.yml` (YAML format - recommended)
2. `catalog.json` (JSON format)
3. `catalog.config.js` (JavaScript module - for dynamic configs)
4. `.catalogrc` (JSON format)
5. `.catalogrc.json` (JSON format)
6. `.catalogrc.yaml` (YAML format)

### Configuration File Format

#### YAML Configuration (Recommended)

```yaml
# catalog.yaml
input: ./docs
output: ./build
base-url: https://docs.example.com/

# Content patterns
include:
  - "**/*.md"
  - "**/*.html"
exclude:
  - "**/drafts/**"
  - "**/internal/**"
optional:
  - "**/changelog.md"
  - "**/appendix/**"

# Standard outputs
generate-index: true
generate-toc: true
generate-sitemap: true
validate: true

# PAI features
generate-manifest: true
generate-chunks: true
chunk-profile: default
generate-tags: true
generate-graph: true
generate-bundles: true
bundle-sizes:
  - 2000
  - 8000
  - 32000

# Caching and performance
enable-cache: true
cache-dir: ./.catalog-cache
continue-on-error: true

# Validation
validate-ai-readiness: true

# Source integration
source: https://github.com/example/docs
source-branch: main
```

#### JSON Configuration

```json
{
  "input": "./docs",
  "output": "./build",
  "baseUrl": "https://docs.example.com/",
  "include": ["**/*.md", "**/*.html"],
  "exclude": ["**/drafts/**", "**/internal/**"],
  "generateIndex": true,
  "generateToc": true,
  "generateSitemap": true,
  "validate": true,
  "generateChunks": true,
  "chunkProfile": "default",
  "generateTags": true,
  "enableCache": true
}
```

#### JavaScript Configuration

```javascript
// catalog.config.js
export default {
  input: './docs',
  output: './build',
  baseUrl: process.env.DOCS_BASE_URL || 'https://docs.example.com/',
  
  // Dynamic configuration based on environment
  generateSitemap: process.env.NODE_ENV === 'production',
  validate: process.env.NODE_ENV === 'production',
  
  // Pattern-based configuration
  include: [
    '**/*.md',
    '**/*.html'
  ],
  
  // Conditional features
  generateChunks: process.env.ENABLE_AI_FEATURES === 'true',
  chunkProfile: process.env.CODE_HEAVY ? 'code-heavy' : 'default'
};
```

### Using Configuration Files

```bash
# Auto-detect configuration in current directory
catalog

# Specify configuration file path
catalog --config ./configs/docs-catalog.yaml

# Generate sample configuration file
catalog --init > catalog.yaml

# Use configuration with CLI overrides
catalog --config catalog.yaml --output ./custom-build --verbose
```

### Configuration Precedence

Settings are merged in the following order (later sources override earlier ones):

1. **Default values** (built-in defaults)
2. **Configuration file** (catalog.yaml, etc.)
3. **CLI flags** (command-line arguments)

This allows you to:
- Set project defaults in configuration files
- Override specific settings via CLI flags
- Maintain environment-specific configurations

### Advanced Configuration Features

#### Per-Pattern Configuration

Apply different settings based on file patterns:

```yaml
# catalog.yaml
patterns:
  # Code-heavy documentation gets specialized chunking
  - pattern: "api/**/*"
    chunk-profile: code-heavy
    tags: ["api", "reference"]
    
  # Tutorial content gets granular chunks
  - pattern: "tutorials/**/*"
    chunk-profile: granular
    tags: ["tutorial", "getting-started"]
    
  # Internal docs are marked as optional
  - pattern: "internal/**/*"
    optional: true
    priority: low
```

#### Environment-Specific Configuration

```javascript
// catalog.config.js
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export default {
  input: './docs',
  output: './build',
  
  // Production-only features
  generateSitemap: isProduction,
  validate: isProduction,
  validateAIReadiness: isProduction,
  
  // Development-friendly settings
  enableCache: isDevelopment,
  watch: isDevelopment,
  silent: !isDevelopment,
  
  // Base URL based on environment
  baseUrl: isProduction 
    ? 'https://docs.example.com/'
    : 'http://localhost:3000/'
};
```

### Configuration Validation

Catalog validates configuration files and provides helpful error messages:

```bash
# Invalid configuration example
catalog --config broken-config.yaml

# Error output:
# ❌ Configuration Error: Invalid chunk profile "invalid-profile"
# Valid options: default, code-heavy, faq, granular, large-context
```

### Configuration Tips

- **Use YAML for readability**: Human-friendly with comments support
- **Commit configuration files**: Include them in version control for team consistency
- **Environment variables**: Use JavaScript configs for environment-specific settings
- **Validation**: Always test configurations with `--validate` in production
- **Documentation**: Comment complex configurations for team clarity

## Glob Pattern Examples

### Include Patterns (Whitelist)

```bash
# Include only markdown files
catalog --include "*.md"

# Include specific directories and file types
catalog --include "docs/*.md" --include "guides/*.html"

# Include files with specific naming patterns
catalog --include "*tutorial*" --include "*getting-started*"

# Complex patterns
catalog --include "**/{docs,guides}/**/*.{md,html}"
```

### Exclude Patterns (Blacklist)

```bash
# Exclude draft files
catalog --exclude "*.draft.md" --exclude "*draft*"

# Exclude temporary directories
catalog --exclude "temp/*" --exclude "backup/*"

# Exclude test and development files
catalog --exclude "**/*test*" --exclude "**/*.spec.md"
```

### Optional Patterns

```bash
# Mark draft content as optional
catalog --optional "drafts/**/*"

# Mark changelog and legal docs as optional
catalog --optional "**/CHANGELOG.md" --optional "**/LICENSE.md"

# Multiple optional patterns
catalog --optional "drafts/**/*" --optional "archive/**/*" --optional "**/*deprecated*"
```

## Integration Examples

### With inform Crawler

```bash
# Crawl documentation site
inform https://docs.example.com --output-dir docs

# Generate llms.txt with sitemap and navigation
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --sitemap --validate --index --toc
```

### CI/CD Pipeline

```bash
#!/bin/bash
# Documentation build pipeline

# Crawl latest docs
inform https://docs.example.com --output-dir temp/docs

# Generate artifacts with validation and navigation
catalog --input temp/docs --output dist \
  --base-url https://docs.example.com \
  --optional "archive/**/*" \
  --sitemap --validate --index --toc

# Upload to CDN or deploy
```

### AI Integration

```bash
# Generate context-optimized documentation with navigation
catalog --input docs --output ai-context \
  --optional "examples/**/*" --optional "appendix/**/*" \
  --validate --index --toc

# The resulting llms-ctx.txt contains only essential documentation
# for feeding to AI systems, while toc.md files provide human navigation
```

## Architecture

Catalog follows SOLID design principles with enterprise-grade reliability:

### Core Components

- **`CatalogProcessor`**: Main orchestrator coordinating the entire workflow
- **`DirectoryScanner`**: File discovery and filtering with glob pattern support
- **`ContentProcessor`**: Content processing, metadata extraction, and document ordering
- **`OutputGenerator`**: Generation of llms.txt, llms-full.txt, and llms-ctx.txt files
- **`SitemapGenerator`**: XML sitemap generation with SEO optimization
- **`IndexGenerator`**: JSON navigation and metadata file creation
- **`Validator`**: llms.txt standard compliance validation
- **`PerformanceMonitor`**: Real-time performance and memory tracking
- **`ErrorHandler`**: Graceful error handling and recovery

### Security Architecture

- **`PathSecurity`**: Path validation and traversal prevention
- **`FileSecurity`**: File size limits, type validation, and content scanning
- **`InputSanitizer`**: User input validation and sanitization
- **`SecurityAuditor`**: Comprehensive security auditing and reporting

### Workflow Pipeline

1. **Initialization**: Configure components with security and performance monitoring
2. **Discovery**: Scan directories with pattern matching and security validation  
3. **Processing**: Extract metadata, process content with graceful error handling
4. **Organization**: Apply intelligent ordering and section generation
5. **Generation**: Create all output formats with validation
6. **Enhancement**: Generate sitemaps and navigation indexes
7. **Validation**: Ensure compliance and security
8. **Reporting**: Provide performance and security summaries

## Error Handling & Exit Codes

Catalog uses standard exit codes for reliable automation:

- **0**: Success
- **1**: General error (recoverable)
- **2**: Fatal error (unrecoverable)
- **3**: Invalid input (missing files, bad arguments)
- **4**: File access error (permissions, not found)
- **5**: Validation error (output doesn't meet standards)
- **6**: Dependency error (missing required packages)

## Performance Considerations

- **Memory Efficient**: Processes files incrementally to handle large document sets
- **Concurrent Processing**: Parallel file processing where safe
- **File Size Limits**: Configurable limits prevent memory exhaustion
- **Performance Monitoring**: Real-time tracking of bottlenecks
- **Graceful Degradation**: Continues processing when individual files fail

## Security Considerations

- **Path Validation**: Prevents directory traversal attacks
- **Content Scanning**: Detects malicious patterns and suspicious URLs
- **File Type Restrictions**: Configurable allow/deny lists for file extensions
- **Input Sanitization**: All user inputs are validated and cleaned
- **Security Auditing**: Comprehensive security reporting with issue categorization

## Development

### Local Development

```bash
# Install dependencies
bun install

# Run CLI directly
bun src/cli.js --help

# Development mode with hot reload
bun --watch src/cli.js

# Run tests
bun test

# Run tests in watch mode
bun test:watch
```

### Testing

```bash
# Run all tests (260+ tests across 12 files)
bun test

# Run specific test files
bun test tests/CatalogProcessor.test.js
bun test tests/security.test.js

# Run with coverage
bun test --coverage

# Performance testing
bun test tests/PerformanceMonitor.test.js
```

### Building

```bash
# Build for current platform
bun build

# Build for all platforms
bun build:all

# Full release pipeline
bun release:prepare
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed information on:

- Development setup and workflow
- Code style guidelines
- Testing requirements
- Pull request process
- Commit message format
- Security vulnerability reporting

Quick start for contributors:

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/catalog.git
cd catalog

# Install dependencies
bun install

# Run tests
bun test

# Make changes and submit PR
```

## Integration with fwdslsh Ecosystem

**Catalog** is designed to work seamlessly with other fwdslsh tools:

- **[inform](https://github.com/fwdslsh/inform)**: Web content crawler for documentation sites
- **[unify](https://github.com/fwdslsh/unify)**: Static site generator that can consume llms.txt files
- **[giv](https://github.com/fwdslsh/giv)**: AI-powered Git workflow automation

This composable approach follows the fwdslsh philosophy of minimal, focused tools that work excellently together.

## Release Automation

This project includes comprehensive release automation with:

- **Cross-platform binaries**: Linux, macOS, Windows (x86_64 and ARM64)
- **Automated releases**: GitHub releases with AI-generated release notes
- **Docker images**: Multi-platform images published to Docker Hub
- **Installation script**: One-command installation from GitHub releases

For detailed information about the release process, see [RELEASE_AUTOMATION.md](docs/RELEASE_AUTOMATION.md).

## License

CC-BY-4.0