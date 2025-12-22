# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Catalog** is a comprehensive CLI tool for generating `llms.txt` and AI-ready documentation packages from Markdown/HTML directories. Beyond llms.txt standard compliance, it provides PAI (Programmable AI) features including document chunking for RAG systems, semantic tagging, link graph analysis, context window bundles, and MCP server generation for IDE integration. Part of the fwdslsh ecosystem, it follows the philosophy of minimal, readable, and effective tools designed to work together.

## Commands

### Development
```bash
bun install                    # Install dependencies
bun test                       # Run all tests (260+ tests across 12 files)
bun test:watch                 # Watch mode for tests
bun dev                        # Development mode with hot reload
bun src/cli.js --help         # Run CLI directly
```

### Build & Release
```bash
bun build                      # Build single platform executable
bun build:all                  # Build for all platforms (Linux, macOS, Windows)
bun release:prepare            # Full release pipeline (clean, test, build all)
bun clean                      # Remove build artifacts
```

### Docker
```bash
bun docker:build               # Build Docker image
bun docker:run                 # Run Docker container
bun docker:test                # Test with Docker
```

## Architecture

The codebase follows SOLID design principles with enterprise-grade reliability and clear separation of concerns:

### Core Components

1. **`src/CatalogProcessor.js`** - Main orchestrator coordinating the entire workflow
   - Initializes and configures all components with security and performance monitoring
   - Manages workflow execution with graceful error handling and recovery
   - Integrates all processing phases from discovery to validation

2. **`src/DirectoryScanner.js`** - File discovery and filtering with security validation
   - Recursive directory traversal with glob pattern support
   - Handles include/exclude patterns and intelligent default exclusions
   - Supports both Markdown (.md, .mdx) and HTML (.html) files
   - Default exclusions: `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`, framework outputs

3. **`src/ContentProcessor.js`** - Advanced content processing and metadata extraction
   - Strips YAML frontmatter and processes HTML meta tags
   - Extracts site metadata from root index files
   - Applies intelligent document ordering with path-based section generation
   - Supports HTML-to-Markdown conversion using Turndown
   - Handles optional pattern matching for content categorization

4. **`src/OutputGenerator.js`** - Multiple output format generation
   - Creates `llms.txt` (structured index with proper H1 → blockquote → sections format)
   - Creates `llms-full.txt` (full concatenated content with separators)
   - Creates `llms-ctx.txt` (context-only without optional sections)
   - Supports absolute URL generation with base URL
   - Integrates site metadata and notes from document processing

5. **`src/SitemapGenerator.js`** - SEO-optimized XML sitemap generation
   - Creates XML sitemaps with proper metadata
   - Supports extension stripping for clean URLs
   - Applies intelligent priority and change frequency based on content
   - Validates URLs and handles encoding properly

6. **`src/IndexGenerator.js`** - Comprehensive JSON metadata generation
   - Creates `index.json` files for directory navigation
   - Generates project-wide statistics and file metadata
   - Creates `master-index.json` for aggregated navigation

7. **`src/Validator.js`** - llms.txt standard compliance validation
   - Validates H1 → blockquote → sections structure
   - Checks section ordering and link format compliance
   - Validates absolute URLs when base URL provided
   - Provides detailed issue reporting for non-compliance

8. **`src/cli.js`** - Enhanced command-line interface
   - Comprehensive argument parsing with validation
   - Support for all CLI options including PAI features, caching, and watch mode
   - Proper exit codes and error handling

### PAI (Programmable AI) Components

9. **`src/ManifestGenerator.js`** - Document manifest generation
   - Creates `catalog.manifest.json` with unique document IDs
   - Tracks document versions using content hashes
   - Embeds provenance information (origin, repo ref)

10. **`src/ChunkGenerator.js`** - Document chunking for RAG systems
    - Splits documents into semantic chunks at heading boundaries
    - Supports multiple chunking profiles (default, code-heavy, faq, granular, large-context)
    - Generates `chunks.jsonl` for vector database ingestion

11. **`src/ContextBundler.js`** - Sized context bundle generation
    - Creates `llms-ctx-{size}.txt` files for different context windows
    - Prioritizes content based on document importance
    - Default sizes: 2k, 8k, 32k tokens

12. **`src/TagGenerator.js`** - Semantic tag generation
    - Creates `tags.json` with rule-based content classification
    - Extracts topics and categories from document content
    - Builds tag taxonomy for filtering and search

13. **`src/LinkGraphGenerator.js`** - Link analysis and importance scoring
    - Creates `graph.json` with document relationship data
    - Computes PageRank-style importance scores
    - Detects broken links and orphan documents

14. **`src/MCPGenerator.js`** - MCP server generation
    - Creates Model Context Protocol server for IDE integration
    - Generates configs for Cursor IDE and Claude Code
    - Provides search_docs, get_document, list_documents, get_section tools

### Infrastructure Components

15. **`src/ConfigLoader.js`** - Configuration file handling
    - Loads `catalog.yaml` or `.catalogrc` configuration files
    - Merges file config with CLI options (CLI takes precedence)
    - Generates sample configuration with `--init`

16. **`src/CacheManager.js`** - Incremental build caching
    - Stores build results with content hashing
    - Enables fast incremental rebuilds
    - Invalidates cache on configuration changes

17. **`src/WatchMode.js`** - File system watching
    - Monitors input directory for changes
    - Debounces rapid file changes
    - Triggers incremental rebuilds automatically

18. **`src/PatternConfig.js`** - Per-pattern configuration
    - Applies configuration overrides based on glob patterns
    - Supports per-file chunk profiles, tags, and priority
    - Calculates pattern specificity for proper override ordering

### Performance & Monitoring Components

19. **`src/PerformanceMonitor.js`** - Real-time performance monitoring
    - Tracks timing for all major workflow operations
    - Monitors memory usage and provides detailed reporting
    - Supports concurrent processing utilities
    - Provides performance wrapping for functions

20. **`src/FileSizeMonitor.js`** - File size monitoring and optimization
    - Tracks large files and provides warnings
    - Configurable size limits to prevent memory issues
    - Statistical reporting on file sizes and counts

### Security & Error Handling Components

21. **`src/errors.js`** - Comprehensive error handling system
    - Categorized error types with proper exit codes
    - Actionable error messages with recovery suggestions
    - Graceful degradation and error aggregation
    - Security-focused error classification

22. **`src/security.js`** - Enterprise-grade security features
    - Path traversal prevention and validation
    - File security scanning and content analysis
    - Input sanitization for all user inputs
    - Security auditing with comprehensive reporting

### Workflow Pipeline

1. **Configuration**: Load config from files and CLI options (ConfigLoader)
2. **Initialization**: Configure all components with security and performance monitoring
3. **Cache Check**: Check for cached results if caching enabled (CacheManager)
4. **Discovery**: Scan directories with pattern matching and security validation
5. **Pattern Config**: Apply per-file configuration overrides (PatternConfig)
6. **Processing**: Extract metadata, process content with graceful error handling
7. **Organization**: Apply intelligent ordering and path-based section generation
8. **Generation**: Create all output formats (llms.txt, llms-full.txt, llms-ctx.txt)
9. **PAI Generation** (if enabled):
   - ManifestGenerator creates document manifest
   - ChunkGenerator creates RAG-ready chunks
   - TagGenerator generates semantic tags
   - LinkGraphGenerator builds link graph
   - ContextBundler creates sized bundles
10. **Enhancement**: Generate sitemaps and navigation indexes if requested
11. **MCP Generation**: Create MCP server files if requested (MCPGenerator)
12. **Validation**: Ensure compliance with llms.txt standard and AI readiness
13. **Cache Update**: Store results for incremental builds (CacheManager)
14. **Watch Mode**: Monitor for changes if enabled (WatchMode)
15. **Reporting**: Provide performance and security summaries

## Testing

- **Framework**: Bun's built-in test runner
- **Structure**: Each source file has corresponding `.test.js` file in `tests/`
- **Fixtures**: Test documents in `tests/fixtures/` with comprehensive scenarios
- **Coverage**: 260+ tests with 899+ expect() calls across 12 test files
- **Test Types**: Unit tests, integration tests, security tests, performance tests

### Test Files

**Core Tests:**
- `tests/CatalogProcessor.test.js` - Main workflow integration tests
- `tests/ContentProcessor.test.js` - Content processing and metadata extraction
- `tests/DirectoryScanner.test.js` - File discovery and pattern matching
- `tests/OutputGenerator.test.js` - Output format generation
- `tests/SitemapGenerator.test.js` - Sitemap generation and SEO features
- `tests/Validator.test.js` - llms.txt standard compliance validation
- `tests/cli.test.js` - Command-line interface and option handling

**PAI Tests:**
- `tests/ManifestGenerator.test.js` - Document manifest generation
- `tests/ChunkGenerator.test.js` - Document chunking for RAG
- `tests/ContextBundler.test.js` - Context bundle generation
- `tests/TagGenerator.test.js` - Semantic tag generation
- `tests/LinkGraphGenerator.test.js` - Link graph analysis
- `tests/MCPGenerator.test.js` - MCP server generation
- `tests/PatternConfig.test.js` - Pattern-based configuration

**Infrastructure Tests:**
- `tests/ConfigLoader.test.js` - Configuration file handling
- `tests/CacheManager.test.js` - Incremental build caching
- `tests/WatchMode.test.js` - File system watching
- `tests/errors.test.js` - Error handling and categorization
- `tests/security.test.js` - Security features and vulnerability prevention
- `tests/PerformanceMonitor.test.js` - Performance monitoring and optimization

## Key Implementation Details

### File Processing
- Supports `.md`, `.mdx`, and `.html` files with intelligent processing
- Strips YAML frontmatter using regex: `/^---\s*\n([\s\S]*?)\n---\s*\n/`
- Converts HTML to Markdown using Turndown library
- Extracts metadata from both frontmatter and HTML meta tags
- Maintains relative paths in output for proper cross-linking

### llms.txt Standard Compliance
- **H1 → Blockquote Format**: `# Title` followed by `> Description`
- **Section Structure**: Proper H2 sections for organization
- **Link Format**: `- [title](path) - optional description`
- **Path-Based Sections**: Automatic organization using directory structure
- **Optional Content**: Separate section for optional/supplementary content

### Document Ordering Priority
1. **Root/Index Files**: `index.md`, `readme.md`, `home.md` (prioritized by type and name)
2. **Important Documentation**: Files containing keywords like `catalog`, `tutorial`, `intro`, `getting-started`
3. **Path-Based Sections**: Organized by first path segment (e.g., `api/`, `guides/`)
4. **Alphabetical Fallback**: Within sections, files sorted alphabetically

### Advanced Features

#### Site Metadata Extraction
- Automatic detection from root index files
- YAML frontmatter parsing for `title`, `description`
- HTML meta tag extraction for `<title>`, `<meta name="description">`
- Fallback to directory name if no metadata found

#### HTML Processing
- Full HTML file support with content extraction
- HTML-to-Markdown conversion preserving structure
- Meta tag processing for SEO information
- Content cleaning and formatting

#### Sitemap Generation
- XML sitemap with proper metadata and encoding
- Intelligent priority assignment based on content type
- Change frequency detection from file modification times
- Support for extension stripping for clean URLs
- Full URL validation and proper escaping

#### Security Features
- Path traversal prevention (blocks `../` sequences)
- File size limits and monitoring
- Content scanning for malicious patterns
- Input sanitization for all user inputs
- Comprehensive security auditing and reporting

#### Performance Optimization
- Real-time performance monitoring with detailed metrics
- Memory usage tracking and optimization
- Concurrent processing capabilities
- File size monitoring and warnings
- Graceful degradation for large document sets

### Glob Pattern Support
- Uses `minimatch` library for advanced pattern matching
- Include patterns: whitelist specific files or directories
- Exclude patterns: blacklist unwanted content
- Optional patterns: mark content as supplementary
- Complex patterns: `**/{docs,guides}/**/*.{md,html}`

### Output Formats

#### llms.txt (Standard Compliant Index)
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

#### llms-full.txt (Complete Content)
```markdown
# Project Name
> Brief description from site metadata

## index.md
[Full content with frontmatter stripped]
---
## tutorial.md
[Full content]
---
[... continues for all files]
```

#### llms-ctx.txt (Context-Only)
Same as llms.txt but without the Optional section (for context-limited AI scenarios).

#### llms-ctx-{size}.txt (Sized Bundles)
Context bundles sized for different LLM context windows:
- `llms-ctx-2k.txt` - ~2000 tokens
- `llms-ctx-8k.txt` - ~8000 tokens
- `llms-ctx-32k.txt` - ~32000 tokens

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
Document chunks for vector databases (JSON Lines format):
```json
{"id":"chunk_001","docId":"doc_abc123","content":"## Installation...","metadata":{"heading":"Installation"}}
```

#### tags.json (Semantic Tags)
```json
{
  "documents": {
    "guide.md": {"tags": ["tutorial"], "categories": ["docs"]}
  }
}
```

#### graph.json (Link Graph)
```json
{
  "nodes": [{"id": "guide.md", "importance": 0.85}],
  "edges": [{"source": "guide.md", "target": "api.md"}]
}
```

#### mcp/ Directory (MCP Server)
- `mcp-server.js` - Executable MCP server
- `mcp-server.json` - Server configuration
- `cursor-mcp.json` - Cursor IDE config
- `claude-mcp.json` - Claude Code config

#### sitemap.xml (SEO Optimization)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://docs.example.com/</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

## Dependencies

### Core Dependencies
- `glob` (^11.0.3) - File pattern matching
- `minimatch` (^10.0.3) - Glob pattern matching utility
- `turndown` (^7.1.2) - HTML to Markdown conversion

### Runtime
- **Bun** (>=1.0.0) - JavaScript runtime and package manager
- **ES Modules** - Modern module system with import/export

## Error Handling & Exit Codes

Comprehensive error handling with standard exit codes for automation:

- **Exit code 0**: Success
- **Exit code 1**: General error (recoverable)
- **Exit code 2**: Fatal error (unrecoverable)
- **Exit code 3**: Invalid input (missing files, bad arguments)
- **Exit code 4**: File access error (permissions, not found)
- **Exit code 5**: Validation error (output doesn't meet standards)
- **Exit code 6**: Dependency error (missing required packages)

### Error Features
- Graceful degradation when individual files fail
- Actionable error messages with recovery suggestions
- Comprehensive error categorization and reporting
- Security-focused error handling

## CLI Usage Examples

### Basic Usage
```bash
# Default behavior
catalog

# Specify directories
catalog docs --output-dir build

# Use configuration file
catalog --config catalog.yaml

# Generate sample config
catalog --init > catalog.yaml
```

### PAI Features
```bash
# Full PAI pipeline with all features
catalog -i docs -o build \
  --base-url https://docs.example.com \
  --manifest --chunks --tags --graph --bundles \
  --validate-ai --sitemap

# Generate RAG-ready chunks with code-heavy profile
catalog -i docs -o build --chunks --chunk-profile code-heavy

# Generate MCP server for IDE integration
catalog -i docs -o build --mcp --base-url https://docs.example.com

# Custom-sized context bundles
catalog -i docs -o build --bundles --bundle-sizes 4000,16000,64000
```

### Caching & Watch Mode
```bash
# Enable caching for faster rebuilds
catalog -i docs -o build --cache

# Watch mode for development
catalog -i docs -o build --watch --cache

# Force full rebuild ignoring cache
catalog -i docs -o build --cache --force-rebuild
```

### Pattern Matching
```bash
# Include specific patterns
catalog --include "*.md" --include "guides/*.html"

# Exclude unwanted content
catalog --exclude "**/*draft*" --exclude "temp/*"

# Mark content as optional
catalog --optional "appendix/**/*" --optional "**/CHANGELOG.md"
```

### Validation and SEO
```bash
# Validate llms.txt compliance
catalog --validate

# Comprehensive AI readiness validation
catalog --validate-ai

# Generate sitemap for SEO
catalog --sitemap --base-url https://docs.example.com

# Clean URLs without extensions
catalog --sitemap --sitemap-no-extensions --base-url https://docs.example.com
```

## Integration with fwdslsh Ecosystem

Designed to work seamlessly with other fwdslsh tools:

```bash
# Complete documentation pipeline
inform https://docs.example.com --output-dir docs
catalog docs --output-dir build \
  --base-url https://docs.example.com \
  --sitemap --validate --index

# AI-optimized content generation
catalog docs --output-dir ai-context \
  --optional "examples/**/*" --optional "appendix/**/*" \
  --validate
```

### Tool Integration
- **[inform](https://github.com/fwdslsh/inform)**: Web content crawler
- **[unify](https://github.com/fwdslsh/unify)**: Static site generator
- **[giv](https://github.com/fwdslsh/giv)**: AI-powered Git workflows

## Development Guidelines

### Code Style
- **ES Modules**: Use import/export syntax
- **SOLID Principles**: Single responsibility, clear interfaces
- **Error Handling**: Comprehensive with actionable messages
- **Security First**: Validate all inputs, prevent common vulnerabilities
- **Performance**: Monitor and optimize for large document sets

### Adding New Features
1. Follow existing architecture patterns
2. Add comprehensive tests (unit + integration)
3. Update CLI help text and documentation
4. Ensure security validation and error handling
5. Add performance monitoring where appropriate
6. Test with real-world documentation projects

### Testing Requirements
- Maintain >90% test coverage
- Include security and performance tests
- Test error conditions and edge cases
- Validate CLI option handling
- Test integration scenarios with multiple tools