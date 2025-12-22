# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### PAI (Programmable AI) Features
- **Document Manifest Generation**: Creates `catalog.manifest.json` with unique document IDs, content hashes, and provenance information
- **RAG-Ready Document Chunking**: Intelligent document splitting at heading boundaries with multiple chunking profiles
  - `default`: Standard chunking for general content
  - `code-heavy`: Optimized for documentation with code examples
  - `faq`: Q&A format preservation
  - `granular`: Small chunks for precise retrieval
  - `large-context`: Fewer, larger chunks for models with bigger context windows
- **Context Bundle Generation**: Creates `llms-ctx-{size}.txt` files for different LLM context windows (2k, 8k, 32k tokens)
- **Semantic Tag Generation**: Rule-based content classification with `tags.json` for filtering and search
- **Link Graph Analysis**: Creates `graph.json` with document relationships, importance scoring, and broken link detection
- **MCP Server Generation**: Model Context Protocol server for IDE integration
  - Generates executable MCP server with search_docs, get_document, list_documents tools
  - Creates configuration files for Cursor IDE and Claude Code
  - Supports stdio, http, and websocket server types

#### Source Integration
- **SourceConnector**: Pull documentation from remote sources before processing
  - GitHub shorthand support (`owner/repo`)
  - Git repository support (`git://url`)
  - HTTP/HTTPS sources (`https://url`)
  - S3 bucket support (`s3://bucket/path`)
  - Local file system (`file://path`)
  - Branch selection and caching options
- **Framework Integrations**:
  - `@catalog/langchain`: CatalogLoader, CatalogChunkLoader, CatalogRetriever for LangChain
  - `@catalog/llamaindex`: CatalogReader, CatalogNodeParser, CatalogIndex for LlamaIndex

#### Advanced Configuration
- **PatternConfig**: Per-pattern configuration overrides
  - Apply different chunk profiles, tags, and priorities by glob pattern
  - Pattern specificity calculation for proper override ordering
  - Per-file configuration based on path matching

#### CLI Options
- `--mcp`: Generate MCP server for IDE integration
- `--source <url>`: Pull documentation from remote source before processing
- `--source-branch <branch>`: Specify branch for git sources
- `--source-cache <dir>`: Enable source caching with custom directory
- `--chunk-profile <name>`: Specify chunking profile (default, code-heavy, faq, granular, large-context)
- `--chunks`: Generate RAG-ready document chunks
- `--tags`: Generate semantic tags for content classification
- `--graph`: Generate link graph analysis and importance scoring
- `--bundles`: Generate context bundles for different LLM context windows
- `--bundle-sizes <sizes>`: Custom bundle sizes (comma-separated token counts)
- `--cache`: Enable incremental build caching
- `--cache-dir <dir>`: Custom cache directory location
- `--watch`: Enable file system watching for automatic rebuilds

#### Build & Distribution
- **Multi-Platform Docker**: Docker images for Linux, macOS, and Windows (x86_64 and ARM64)
- **Automated Installation Script**: One-command installation with platform detection
- **Enhanced CI/CD**: Comprehensive GitHub Actions with matrix builds and automated releases

### Changed

#### Core Improvements
- **Document Ordering**: Enhanced priority system with path-based section generation
- **Content Processing**: Improved HTML-to-Markdown conversion and metadata extraction
- **Output Formats**: Expanded output generation with AI-optimized formats
- **Error Handling**: Enhanced error categorization and recovery suggestions
- **Performance**: Optimized file processing and memory usage for large document sets

### Fixed

#### CLI Integration
- **Test Assertions**: Fixed validation message expectations in CLI tests
  - Corrected expected output from "Output validation passed" to "✔ llms.txt validation passed"
  - Resolved 2 failing CLI integration tests

#### Dependencies
- **Updated Dependencies**: Latest versions of glob, minimatch, and turndown for compatibility and security

## [0.2.0] - 2025-12-22

### Added

#### PAI (Programmable AI) Features
- **Document Manifest Generation**: Creates `catalog.manifest.json` with unique document IDs, content hashes, and provenance information
- **RAG-Ready Document Chunking**: Intelligent document splitting at heading boundaries with multiple chunking profiles
  - `default`: Standard chunking for general content
  - `code-heavy`: Optimized for documentation with code examples
  - `faq`: Q&A format preservation
  - `granular`: Small chunks for precise retrieval
  - `large-context`: Fewer, larger chunks for models with bigger context windows
- **Context Bundle Generation**: Creates `llms-ctx-{size}.txt` files for different LLM context windows (2k, 8k, 32k tokens)
- **Semantic Tag Generation**: Rule-based content classification with `tags.json` for filtering and search
- **Link Graph Analysis**: Creates `graph.json` with document relationships, importance scoring, and broken link detection
- **MCP Server Generation**: Model Context Protocol server for IDE integration
  - Generates executable MCP server with search_docs, get_document, list_documents tools
  - Creates configuration files for Cursor IDE and Claude Code
  - Supports stdio, http, and websocket server types

#### Source Integration
- **SourceConnector**: Pull documentation from remote sources before processing
  - GitHub shorthand support (`owner/repo`)
  - Git repository support (`git://url`)
  - HTTP/HTTPS sources (`https://url`)
  - S3 bucket support (`s3://bucket/path`)
  - Local file system (`file://path`)
  - Branch selection and caching options
- **Framework Integrations**:
  - `@catalog/langchain`: CatalogLoader, CatalogChunkLoader, CatalogRetriever for LangChain
  - `@catalog/llamaindex`: CatalogReader, CatalogNodeParser, CatalogIndex for LlamaIndex

#### Advanced Configuration
- **PatternConfig**: Per-pattern configuration overrides
  - Apply different chunk profiles, tags, and priorities by glob pattern
  - Pattern specificity calculation for proper override ordering
  - Per-file configuration based on path matching

#### CLI Options
- `--mcp`: Generate MCP server for IDE integration
- `--source <url>`: Pull documentation from remote source before processing
- `--source-branch <branch>`: Specify branch for git sources
- `--source-cache <dir>`: Enable source caching with custom directory
- `--chunk-profile <name>`: Specify chunking profile (default, code-heavy, faq, granular, large-context)
- `--chunks`: Generate RAG-ready document chunks
- `--tags`: Generate semantic tags for content classification
- `--graph`: Generate link graph analysis and importance scoring
- `--bundles`: Generate context bundles for different LLM context windows
- `--bundle-sizes <sizes>`: Custom bundle sizes (comma-separated token counts)
- `--cache`: Enable incremental build caching
- `--cache-dir <dir>`: Custom cache directory location
- `--watch`: Enable file system watching for automatic rebuilds

#### Build & Distribution
- **Multi-Platform Docker**: Docker images for Linux, macOS, and Windows (x86_64 and ARM64)
- **Automated Installation Script**: One-command installation with platform detection
- **Enhanced CI/CD**: Comprehensive GitHub Actions with matrix builds and automated releases

### Changed

#### Core Improvements
- **Document Ordering**: Enhanced priority system with path-based section generation
- **Content Processing**: Improved HTML-to-Markdown conversion and metadata extraction
- **Output Formats**: Expanded output generation with AI-optimized formats
- **Error Handling**: Enhanced error categorization and recovery suggestions
- **Performance**: Optimized file processing and memory usage for large document sets

### Fixed

#### CLI Integration
- **Test Assertions**: Fixed validation message expectations in CLI tests
  - Corrected expected output from "Output validation passed" to "✔ llms.txt validation passed"
  - Resolved 2 failing CLI integration tests

#### Dependencies
- **Updated Dependencies**: Latest versions of glob, minimatch, and turndown for compatibility and security

---

## [0.1.0] - 2025-11-19

### Added

#### Core Features
- **Full llms.txt Standard Compliance**: Complete implementation of H1 → blockquote → sections format as specified by the llms.txt standard
- **HTML File Processing**: Native support for `.html` files with automatic conversion to Markdown using Turndown library
- **XML Sitemap Generation**: SEO-optimized sitemap.xml generation with intelligent priority assignment and change frequency detection
- **Site Metadata Extraction**: Automatic extraction from YAML frontmatter in Markdown files and HTML meta tags
- **Path-Based Section Generation**: Intelligent automatic organization of documents using directory structure
- **Optional Content Patterns**: Mark files as optional/supplementary using glob patterns via `--optional` flag
- **Multiple Output Formats**:
  - `llms.txt`: Structured index with proper sections
  - `llms-full.txt`: Full concatenated content with separators
  - `llms-ctx.txt`: Context-only format without optional sections
- **Navigation Metadata**: JSON-based navigation files (`index.json`, `master-index.json`) via `--index` flag

#### Advanced Features
- **Comprehensive Validation System**: Full llms.txt standard compliance validation with detailed error reporting
  - Structure validation (H1 → blockquote → sections)
  - Link format validation
  - Section ordering validation
  - Absolute URL validation when base URL provided
- **Real-Time Performance Monitoring**: Detailed performance tracking with operation timing, memory usage monitoring, and human-readable reporting
- **Enterprise-Grade Security**:
  - Path traversal prevention (blocks `../` sequences)
  - File size limits and monitoring (configurable, default 10MB max)
  - Malicious content scanning (script injection, suspicious URLs, base64 payloads)
  - Input sanitization for all user inputs
  - Comprehensive security auditing with reporting
- **Graceful Error Handling**:
  - Hierarchical error system with 6 standard exit codes (0-6)
  - Actionable error messages with recovery suggestions
  - Error categorization and aggregation
  - Continue-on-error mode for resilient processing

#### CLI Options
- `--input, -i <path>`: Source directory (default: current directory)
- `--output, -o <path>`: Destination directory (default: current directory)
- `--base-url <url>`: Base URL for absolute links
- `--optional <pattern>`: Mark files as optional (repeatable)
- `--include <pattern>`: Include files matching pattern (repeatable)
- `--exclude <pattern>`: Exclude files matching pattern (repeatable)
- `--index`: Generate navigation index.json files
- `--sitemap`: Generate XML sitemap (requires --base-url)
- `--sitemap-no-extensions`: Strip extensions from sitemap URLs
- `--validate`: Validate output for llms.txt compliance
- `--silent`: Suppress non-error output

#### Build & Distribution
- **Multi-Platform Builds**: Pre-built binaries for Linux (x86_64), macOS (x86_64), and Windows (x86_64)
- **Docker Support**: Official Docker image with multi-platform support and automated publishing
- **NPM Package**: Published as `@fwdslsh/catalog` with Bun runtime requirement
- **Installation Script**: One-command installation from GitHub releases
- **Automated Releases**: Comprehensive CI/CD with GitHub Actions using reusable workflows

#### Testing & Quality
- **Comprehensive Test Suite**: 260+ tests across 12 test files with 899+ assertions
- **Test Coverage**: 100% of source files covered (11/11 modules)
- **Test Types**: Unit tests, integration tests, security tests, performance tests
- **Test-to-Code Ratio**: 1.22:1 (3,979 lines of tests vs 3,266 lines of code)

### Changed
- **Document Ordering**: Enhanced intelligent ordering with priority system
  1. Index/root files (index.md, readme.md, home.md)
  2. Important documentation (catalog, tutorial, getting-started)
  3. Path-based sections
  4. Alphabetical fallback
- **Default Exclusions**: Expanded to include framework-specific outputs
  - Added: `.next`, `.nuxt`, `.output`, `.vercel`, `.netlify`
  - Existing: `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`

### Fixed
- **Import Assertion Compatibility**: Replaced ES module import assertions with `fs.readFileSync` for Node.js compatibility
  - Fixes CLI execution in Node.js child processes
  - Resolves 24 CLI integration test failures
  - Maintains compatibility with both Bun and Node.js runtimes

### Security
- **Path Traversal Prevention**: Blocks directory traversal attempts with `../` sequences and null bytes
- **Content Scanning**: Detects and reports malicious patterns:
  - Script injection (`<script>`, `javascript:`, `data:text/html`, `vbscript:`)
  - Event handlers (`onload=`, `onerror=`, `onclick=`)
  - Suspicious URLs (URL shorteners, IP addresses, local addresses)
  - Large base64 payloads (potential data exfiltration)
- **File Security**: Extension validation, file size limits, regular file type enforcement
- **Input Sanitization**: All user inputs sanitized (URLs, glob patterns, log messages)
- **Security Auditing**: Comprehensive audit logging with security scoring

### Performance
- **Incremental Processing**: Memory-efficient file processing for large document sets
- **Concurrent Processing**: Batch processing with configurable concurrency limits
- **Performance Metrics**: Real-time tracking of:
  - Operation timing (per-operation breakdown)
  - Memory usage (heap, RSS, external)
  - File size statistics
  - Processing throughput
- **Memory Monitoring**: Automatic warnings for high memory usage (>500MB threshold)

### Documentation
- **Comprehensive README**: 544 lines covering installation, usage, features, architecture
- **AI Assistant Guide**: CLAUDE.md with development instructions and architecture details
- **Technical Specification**: Complete app-spec.md with detailed feature documentation
- **Inline Documentation**: Clear code comments and self-documenting patterns
- **Examples**: Multiple usage examples for common workflows
- **Integration Guides**: Documentation for fwdslsh ecosystem integration

### Architecture
- **SOLID Principles**: Single Responsibility Principle followed throughout
- **Modular Design**: 11 focused modules with clear separation of concerns:
  - `CatalogProcessor`: Main orchestrator
  - `DirectoryScanner`: File discovery and filtering
  - `ContentProcessor`: Content processing and metadata extraction
  - `OutputGenerator`: Multi-format output generation
  - `SitemapGenerator`: XML sitemap creation
  - `IndexGenerator`: Navigation metadata generation
  - `Validator`: Standard compliance validation
  - `PerformanceMonitor`: Performance and memory tracking
  - `ErrorHandler`: Error management and recovery
  - `Security`: Path, file, and content security
- **Dependency Injection**: Components receive dependencies via constructor
- **Error Hierarchy**: Structured error classes with automatic categorization

## [0.0.11] - 2024-XX-XX

### Changed
- Version bump for maintenance release

## [0.0.10] - 2024-XX-XX

### Changed
- Version bump for maintenance release

## [0.0.9] - 2024-XX-XX

### Changed
- Version bump for maintenance release

## [0.0.8] - 2024-XX-XX

### Added
- Docker support reintroduced with updated configuration

### Fixed
- Workflow references updated to correct file names
- Import statement for package.json updated to use JSON module assertion

---

## Migration Guide: v0.1.0 to v0.2.0

### Breaking Changes

There are no known breaking changes in v0.2.0. All v0.1.0 usage patterns continue to work.

### New PAI (Programmable AI) Features You Should Know About

1. **RAG-Ready Document Chunking**: Split documents for vector database ingestion
   ```bash
   catalog --chunks --chunk-profile code-heavy
   # Generates chunks.jsonl with heading-based splits
   ```

2. **Context Bundle Generation**: Create context bundles for different LLM windows
   ```bash
   catalog --bundles --bundle-sizes 2000,8000,32000
   # Generates llms-ctx-2k.txt, llms-ctx-8k.txt, llms-ctx-32k.txt
   ```

3. **Semantic Tagging**: Automatic content classification for better retrieval
   ```bash
   catalog --tags  # Generates tags.json with topic categories
   ```

4. **Link Graph Analysis**: Understand document relationships and importance
   ```bash
   catalog --graph  # Generates graph.json with PageRank-style scoring
   ```

5. **MCP Server Generation**: IDE integration for Cursor and Claude Code
   ```bash
   catalog --mcp  # Creates mcp/ directory with server and configs
   ```

6. **Source Integration**: Pull from remote sources before processing
   ```bash
   catalog --source github.com/owner/repo --source-branch main
   catalog --source https://docs.example.com
   ```

7. **Per-Pattern Configuration**: Different settings for different file types
   ```bash
   # In catalog.yaml
   patterns:
     - pattern: "**/*.md"
       chunkProfile: "default"
       tags: ["docs"]
     - pattern: "**/*.js"
       chunkProfile: "code-heavy"
       tags: ["code", "examples"]
   ```

8. **Incremental Builds**: Faster rebuilds with caching
   ```bash
   catalog --cache --watch  # Enable caching and file watching
   ```

### Framework Integrations

1. **LangChain Integration**:
   ```python
   from catalog.langchain import CatalogLoader, CatalogRetriever
   loader = CatalogLoader("path/to/catalog-output")
   retriever = CatalogRetriever(loader)
   ```

2. **LlamaIndex Integration**:
   ```python
   from catalog.llamaindex import CatalogReader, CatalogIndex
   reader = CatalogReader("path/to/catalog-output")
   index = CatalogIndex.from_documents(reader.load_data())
   ```

### Performance Improvements

- v0.2.0 includes comprehensive PAI processing while maintaining v0.1.0 performance
- Small projects (<10 files): <100ms with PAI features
- Medium projects (10-100 files): 200ms-1s with PAI features
- Large projects (100+ files): 2-10s with full PAI pipeline

---

## Migration Guide: v0.0.x to v0.1.0

### Breaking Changes

There are no known breaking changes in v0.1.0. All v0.0.x usage patterns continue to work.

### New Features You Should Know About

1. **HTML Support**: You can now process `.html` files alongside Markdown
   ```bash
   catalog --input docs  # Now processes both .md and .html files
   ```

2. **Optional Content**: Mark supplementary content as optional
   ```bash
   catalog --optional "drafts/**/*" --optional "archive/**/*"
   ```

3. **Validation**: Ensure your output meets llms.txt standards
   ```bash
   catalog --validate
   ```

4. **Sitemaps**: Generate SEO-optimized sitemaps
   ```bash
   catalog --sitemap --base-url https://docs.example.com
   ```

5. **Navigation Indexes**: Generate JSON metadata for programmatic use
   ```bash
   catalog --index
   ```

### Performance Improvements

- v0.1.0 includes comprehensive performance monitoring
- Small projects (<10 files): <50ms
- Medium projects (10-100 files): 100-500ms
- Large projects (100+ files): 1-5s

### Security Enhancements

- All file paths are now validated for security
- Content is scanned for malicious patterns
- File size limits prevent resource exhaustion
- See README.md for security considerations

---

## Upgrade Instructions

### From v0.0.x to v0.1.0

**Via Installation Script:**
```bash
curl -fsSL https://raw.githubusercontent.com/fwdslsh/catalog/main/install.sh | bash
```

**Via NPM:**
```bash
npm install -g @fwdslsh/catalog@0.1.0
```

**Via Docker:**
```bash
docker pull fwdslsh/catalog:0.1.0
```

**Via Binary Download:**
Download from [GitHub Releases](https://github.com/fwdslsh/catalog/releases/tag/v0.1.0)

### Verifying Installation

```bash
catalog --version
# Should output: 0.1.0

catalog --help
# Should show all new options
```

---

## Development

### Running Tests

```bash
# Install dependencies
bun install

# Run all tests (260+ tests)
bun test

# Run specific test file
bun test tests/CatalogProcessor.test.js
```

### Building

```bash
# Build for current platform
bun build

# Build for all platforms
bun build:all

# Full release preparation
bun release:prepare
```

---

## Links

- **Repository**: https://github.com/fwdslsh/catalog
- **Issues**: https://github.com/fwdslsh/catalog/issues
- **Releases**: https://github.com/fwdslsh/catalog/releases
- **NPM Package**: https://www.npmjs.com/package/@fwdslsh/catalog
- **Docker Image**: https://hub.docker.com/r/fwdslsh/catalog

---

## Contributors

Thank you to all contributors who made v0.1.0 possible!

---

[Unreleased]: https://github.com/fwdslsh/catalog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fwdslsh/catalog/releases/tag/v0.1.0
[0.0.11]: https://github.com/fwdslsh/catalog/releases/tag/v0.0.11
[0.0.10]: https://github.com/fwdslsh/catalog/releases/tag/v0.0.10
[0.0.9]: https://github.com/fwdslsh/catalog/releases/tag/v0.0.9
[0.0.8]: https://github.com/fwdslsh/catalog/releases/tag/v0.0.8
