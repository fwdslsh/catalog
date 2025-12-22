# Catalog CLI Tool - Complete Application Specification

> Catalog is a lightweight, efficient CLI tool designed to scan Markdown and HTML directories and generate llms.txt files compliant with the official llms.txt standard. Additionally, it can generate index.json files for directory navigation and metadata collection. The tool follows convention over configuration principles and is designed for seamless integration with AI systems, documentation workflows, and the fwdslsh ecosystem following the philosophy of minimal, readable, composable tools.

Catalog transforms source Markdown and HTML files into structured, AI-friendly documentation formats that strictly comply with the llms.txt standard, while optionally generating comprehensive navigation metadata, making it the perfect companion tool to [`inform`](https://github.com/fwdslsh/inform) for creating complete documentation workflows.

## Target Users

- **AI Engineers and LLM Developers** who need structured documentation for training or inference
- **Documentation Teams** who want to generate comprehensive, navigable indexes of their content
- **Content Creators** who maintain large Markdown documentation sets
- **Developers** integrating with documentation toolchains requiring programmatic navigation
- **Technical Writers** who need to generate consolidated documentation views

## Core Features

### Standard llms.txt Features
- **Recursive Markdown and HTML Scanning**: Discovers `.md`, `.mdx`, and `.html` files across directory structures
- **llms.txt Standard Compliance**: Generates files strictly conforming to the official llms.txt specification
- **Convention over Configuration**: Automatic section generation based on file path structure with no manual configuration
- **HTML-to-Markdown Conversion**: Automatically converts HTML files to `.html.md` for LLM-friendly consumption
- **Metadata-based Link Notes**: Optional link descriptions via YAML frontmatter or HTML meta tags
- **Flexible Optional Sections**: Configurable patterns for marking content as optional/skippable
- **Absolute and Relative URL Support**: Configurable base URL for deployment-ready absolute links
- **Built-in Validation**: Ensures generated output complies with llms.txt standard requirements
- **Multiple Output Variants**: Standard `llms.txt` plus convenience `llms-ctx.txt` and `llms-full.txt` files
- **Sitemap Generation**: Creates XML sitemaps using metadata from front matter or meta elements
- **Table of Contents Generation**: Creates `toc.md` files for directory navigation and `toc-full.md` for complete project overview
- **Optional Directory Navigation**: Generates JSON metadata for programmatic navigation

### PAI (Programmable AI) Features
- **Document Manifest Generation**: Creates `catalog.manifest.json` with document IDs, hashes, and metadata for programmatic access
- **Chunk Generation**: Creates `chunks.jsonl` for RAG/memory systems with configurable chunking profiles
- **Semantic Tagging**: Generates `tags.json` with rule-based semantic tags for content classification
- **Link Graph Analysis**: Creates `graph.json` with link analysis, importance scores, and content relationships
- **Context Bundles**: Generates sized context bundles (`llms-ctx-2k.txt`, `llms-ctx-8k.txt`, `llms-ctx-32k.txt`) for different LLM context windows
- **MCP Server Generation**: Creates Model Context Protocol server configuration for IDE integration (Cursor, Claude Code)
- **AST Index Generation**: Creates AST index for code files with configurable file extensions

### Development & Workflow Features
- **Configuration Files**: Support for `catalog.yaml` and `.catalogrc` configuration files
- **Caching & Incremental Builds**: Smart caching for faster rebuilds with content hashing
- **Watch Mode**: File system watching for automatic rebuilds during development
- **AI Readiness Validation**: Comprehensive validation including code fences, links, and secret detection
- **Pattern-based Configuration**: Per-file/pattern configuration overrides using glob patterns

### Operational Features
- **Configurable Exclusion Patterns**: Automatically excludes common build artifacts and dependencies
- **Relative Link Preservation**: Maintains proper markdown linking in outputs
- **Project-wide Metadata Collection**: Aggregates statistics and file information
- **Silent Mode Operation**: Supports automated workflows with minimal output
- **Cross-platform Compatibility**: Works on Windows, macOS, and Linux
- **Provenance Tracking**: Records origin URLs and git repository references

## Command Line Interface

### Application Name

`catalog`

### Main Command

#### `catalog` (Default Command)

Processes Markdown files and generates outputs.

**Syntax:**

```bash
catalog [options]
```

**Workflow:**

1. Validates source directory exists and is accessible
2. Recursively scans for `.md`, `.mdx`, and `.html` files
3. Extracts site title and description from root index file metadata (index.md, index.mdx, or index.html)
4. Reads and processes files, stripping YAML frontmatter from Markdown
5. Converts HTML files to `.html.md` format for LLM consumption
6. Automatically generates sections based on first path segment of each file
7. Applies optional patterns to categorize content under `## Optional` section
8. Generates llms.txt standard-compliant output with proper structure (H1 → blockquote → details → H2 sections)
9. Creates additional convenience files (`llms-ctx.txt`, `llms-ctx-full.txt`)
10. Optionally generates `index.json` files for directory navigation (with `--index`)
11. Optionally generates `sitemap.xml` for search engines (with `--sitemap` and `--base-url`)
12. Validates output compliance with llms.txt standard
13. Reports processing summary with file counts and output information

**Expected Output:**

- `llms.txt`: Standard-compliant structured index with auto-generated sections
- `llms-ctx.txt`: Same as llms.txt but excludes `## Optional` links (convenience file)
- `llms-ctx-full.txt`: Includes all links including `## Optional` (convenience file)
- `sitemap.xml`: XML sitemap for search engines using metadata from source files
- `index.json`: Directory-specific navigation metadata (optional)
- Console summary with file counts and processing statistics
- Exit code 0 on success, 1 on recoverable errors, 2 on fatal errors

### Command Line Options

#### Directory Options

**`--input, -i <directory>`**

- **Purpose:** Specify source directory containing Markdown and HTML files
- **Default:** `.` (current directory)
- **Validation:** Must be existing, readable directory
- **Behavior:** Recursively scanned for `.md`, `.mdx`, and `.html` files

**`--output, -o <directory>`**

- **Purpose:** Specify destination directory for generated files
- **Default:** `.` (current directory)
- **Validation:** Must be in a writable location
- **Behavior:** Created if doesn't exist, files overwritten if present

**`--base-url <url>`**

- **Purpose:** Base URL for generating absolute links in llms.txt output
- **Default:** None (generates relative paths)
- **Format:** Must be valid URL (e.g., `https://example.com/`)
- **Behavior:** When provided, all links in output files use absolute URLs
- **Required for:** Deployment at site root `/llms.txt` with absolute links

#### Content Options

**`--optional <pattern>`**

- **Purpose:** Mark files matching glob pattern as optional (can be used multiple times)
- **Default:** No optional patterns
- **Pattern Format:** Standard glob patterns with wildcards (`*`, `**`, `?`, `[...]`)
- **Behavior:** Matching files placed under `## Optional` section
- **Examples:** `--optional "drafts/**/*"`, `--optional "**/changelog.md"`, `--optional "legacy/**/*.{md,html}"`

#### Feature Options

**`--include <pattern>`**

- **Purpose:** Include files matching glob pattern (can be used multiple times)
- **Default:** All supported files included
- **Pattern Format:** Standard glob patterns with full wildcard support
- **Behavior:** Only files matching at least one include pattern are processed
- **Examples:** `--include "*.md"`, `--include "docs/**/*.{md,html}"`, `--include "**/api-*"`

**`--exclude <pattern>`**

- **Purpose:** Exclude files matching glob pattern (can be used multiple times)
- **Default:** Standard exclusion patterns applied (node_modules, .git, etc.)
- **Pattern Format:** Standard glob patterns with negation support
- **Behavior:** Files matching any exclude pattern are skipped
- **Examples:** `--exclude "*.draft.md"`, `--exclude "temp/**/*"`, `--exclude "**/test/**"`

**`--index`**

- **Purpose:** Enable generation of `index.json` navigation files
- **Default:** `false` (disabled)
- **Effect:** Creates directory-specific `index.json` files and project-wide `master-index.json`
- **Use Cases:** LLM integration, dynamic menu generation, programmatic navigation

**`--toc`**

- **Purpose:** Enable generation of `toc.md` table of contents files
- **Default:** `false` (disabled)
- **Dependencies:** Requires `--index` flag to be enabled
- **Effect:** Creates `toc.md` files for each directory and `toc-full.md` for complete project overview
- **Use Cases:** Manual directory navigation, documentation browsing, project structure overview

**`--sitemap`**

- **Purpose:** Enable generation of XML sitemap for search engines
- **Default:** `false` (disabled)
- **Effect:** Creates `sitemap.xml` file using metadata from front matter or HTML meta elements
- **Base URL:** Requires `--base-url` option for generating absolute URLs in sitemap
- **Use Cases:** SEO optimization, search engine indexing, website discovery

**`--sitemap-no-extensions`**

- **Purpose:** Generate sitemap URLs without file extensions for static sites with URL rewriting
- **Default:** `false` (disabled, uses `.html` extensions by default)
- **Effect:** Creates extensionless URLs in sitemap.xml (e.g., `/docs/guide` instead of `/docs/guide.html`)
- **Requires:** `--sitemap` flag must also be enabled
- **Use Cases:** Static site generators that use clean URLs, JAMstack deployments

#### Operational Options

**`--validate`**

- **Purpose:** Validate generated llms.txt compliance with standard
- **Default:** Validation always runs, this flag makes it the primary action
- **Effect:** Checks H1, blockquote, section structure, and link format compliance
- **Exit Codes:** 0 if valid, 1 if validation errors found

**`--validate-ai`**

- **Purpose:** Comprehensive AI readiness validation
- **Default:** `false` (disabled)
- **Effect:** Validates code fences, links, detects potential secrets, and checks overall AI-readiness
- **Output:** Creates `catalog.report.json` with detailed validation results

#### PAI (Programmable AI) Options

**`--manifest`**

- **Purpose:** Generate document manifest with IDs and metadata
- **Default:** `false` (disabled)
- **Effect:** Creates `catalog.manifest.json` with unique document IDs, content hashes, and metadata
- **Use Cases:** Programmatic document access, content versioning, RAG systems

**`--chunks`**

- **Purpose:** Generate document chunks for RAG/memory systems
- **Default:** `false` (disabled)
- **Effect:** Creates `chunks.jsonl` with semantically meaningful document chunks
- **Use Cases:** Vector databases, RAG pipelines, memory systems

**`--chunk-profile <name>`**

- **Purpose:** Select chunking profile for chunk generation
- **Default:** `default`
- **Profiles:** `default`, `code-heavy`, `faq`, `granular`, `large-context`
- **Effect:** Adjusts chunk sizes and splitting strategies based on content type

**`--tags`**

- **Purpose:** Generate semantic tags for documents
- **Default:** `false` (disabled)
- **Effect:** Creates `tags.json` with rule-based semantic tags for content classification
- **Use Cases:** Content filtering, search enhancement, topic clustering

**`--graph`**

- **Purpose:** Generate link graph with importance scores
- **Default:** `false` (disabled)
- **Effect:** Creates `graph.json` with link analysis and document importance rankings
- **Use Cases:** Navigation optimization, content discovery, dead link detection

**`--bundles`**

- **Purpose:** Generate sized context bundles
- **Default:** `false` (disabled)
- **Effect:** Creates `llms-ctx-{size}.txt` files for different LLM context windows
- **Default Sizes:** 2000, 8000, 32000 tokens

**`--bundle-sizes <sizes>`**

- **Purpose:** Custom token sizes for context bundles
- **Default:** `2000,8000,32000`
- **Format:** Comma-separated list of integers
- **Effect:** Generates bundles for each specified token size

**`--mcp`**

- **Purpose:** Generate MCP server configuration for IDE integration
- **Default:** `false` (disabled)
- **Effect:** Creates `mcp/` directory with server implementation and IDE configs
- **Outputs:** `mcp-server.js`, `mcp-config.json`, `cursor-config.json`, `claude-config.json`
- **Use Cases:** Cursor IDE, Claude Code, VS Code with MCP extension

**`--ast <extensions>`**

- **Purpose:** Generate AST index for code files
- **Default:** `false` (disabled)
- **Format:** Comma-separated list of file extensions (e.g., `js,ts,py`)
- **Effect:** Creates AST-based index for specified code file types

#### Configuration Options

**`--config <path>`**

- **Purpose:** Load configuration from file
- **Default:** Auto-detects `catalog.yaml` or `.catalogrc` in input directory
- **Format:** YAML or JSON configuration file
- **Effect:** Loads all options from configuration file, CLI options override

**`--init`**

- **Purpose:** Generate sample configuration file
- **Default:** Outputs to stdout
- **Effect:** Generates a sample `catalog.yaml` with all available options documented
- **Usage:** `catalog --init > catalog.yaml`

#### Caching & Incremental Options

**`--cache`**

- **Purpose:** Enable incremental rebuilds with caching
- **Default:** `false` (disabled)
- **Effect:** Uses content hashing to skip unchanged files, faster rebuilds
- **Cache Location:** `.cache/` directory or custom location

**`--cache-dir <path>`**

- **Purpose:** Custom cache directory location
- **Default:** `.cache/` in output directory
- **Effect:** Stores cache files in specified directory, enables caching automatically

**`--force-rebuild`**

- **Purpose:** Ignore cache and rebuild everything
- **Default:** `false`
- **Effect:** Forces full rebuild regardless of cache state

#### Watch Mode Options

**`--watch`**

- **Purpose:** Watch for file changes and rebuild automatically
- **Default:** `false` (disabled)
- **Effect:** Monitors input directory for changes, triggers incremental rebuilds
- **Use Cases:** Development workflows, live documentation preview

**`--watch-debounce <ms>`**

- **Purpose:** Debounce delay for watch mode
- **Default:** `500` (milliseconds)
- **Effect:** Groups rapid file changes into single rebuild operations

#### Provenance Options

**`--origin <url>`**

- **Purpose:** Record origin URL for content provenance
- **Default:** None
- **Effect:** Embeds origin URL in manifest for traceability (e.g., crawl source)

**`--repo-ref <ref>`**

- **Purpose:** Record git repository reference
- **Default:** None
- **Effect:** Embeds git reference in manifest (branch, tag, or commit hash)

#### Operational Options

**`--silent`**

- **Purpose:** Suppress non-error output for automated workflows
- **Default:** `false` (verbose output enabled)
- **Effect:** Only errors and warnings are displayed

**`--help, -h`**

- **Purpose:** Display comprehensive usage information
- **Effect:** Shows syntax, options, examples, and exits with code 0

**`--version`**

- **Purpose:** Display current version number
- **Effect:** Shows version string and exits with code 0

### Glob Pattern Support

Catalog supports standard glob patterns for file matching in `--include`, `--exclude`, and `--optional` options:

#### Glob Pattern Syntax

- **`*`**: Matches any number of characters within a single path segment
  - `*.md` matches `README.md`, `guide.md`
  - `api-*.html` matches `api-v1.html`, `api-reference.html`

- **`**`**: Matches any number of directories and subdirectories
  - `docs/**/*.md` matches `docs/guide.md`, `docs/api/reference.md`
  - `**/test/**` matches any file in any `test` directory

- **`?`**: Matches exactly one character
  - `file?.md` matches `file1.md`, `fileA.md`

- **`[...]`**: Matches any character within brackets
  - `file[12].md` matches `file1.md`, `file2.md`
  - `[a-z]*.md` matches files starting with lowercase letters

- **`{...}`**: Matches any of the comma-separated patterns
  - `*.{md,html}` matches `*.md` and `*.html` files
  - `{docs,guides}/**/*.md` matches Markdown files in either directory

#### Pattern Matching Examples

```bash
# Include specific file extensions
--include "**/*.{md,mdx,html}"

# Exclude test and backup files
--exclude "**/{test,tests,spec}/**" --exclude "**/*.{backup,tmp}"

# Optional content patterns
--optional "drafts/**/*" --optional "**/archive/**"

# Complex combinations
--include "src/**/*.md" --exclude "**/node_modules/**" --optional "**/*.draft.*"
```

### Examples

#### Basic Usage

```bash
# Process current directory
catalog

# Specify input and output directories
catalog --input docs --output build

# Generate with navigation metadata
catalog --input docs --output build --index

# Generate with table of contents files
catalog --input docs --output build --index --toc

# Generate with XML sitemap for SEO
catalog --input docs --output build --sitemap --base-url https://example.com/

# Generate sitemap with clean URLs (no extensions)
catalog --input docs --output build --sitemap --sitemap-no-extensions --base-url https://example.com/

# Generate with both navigation and sitemap
catalog --input docs --output build --index --sitemap --base-url https://docs.company.com/

# Complete generation with all features
catalog --input docs --output build --index --toc --sitemap --base-url https://docs.company.com/

# Silent operation for automation
catalog -i docs -o build --silent

# Generate with absolute URLs for deployment
catalog --input docs --output build --base-url https://example.com/
```

#### Optional Content Management

```bash
# Mark draft files as optional using glob patterns
catalog --optional "drafts/**/*"

# Mark specific files and directories as optional
catalog --optional "**/changelog.md" --optional "legacy/**/*.{md,html}"

# Exclude draft and temporary files with glob patterns
catalog --exclude "*.draft.md" --exclude "temp/**/*" --exclude "**/test/**"

# Advanced glob pattern combinations
catalog --include "docs/**/*.{md,mdx,html}" --exclude "**/draft*" --exclude "**/temp*"

# Process specific file types and patterns
catalog --include "**/*{catalog,tutorial,guide}*" --include "api/**/*.md"

# Complex pattern matching for large projects
catalog --include "src/**/*.md" --include "docs/**/*.{md,html}" --exclude "**/*.{draft,temp,backup}.*"
```

#### PAI Features

```bash
# Generate full PAI pipeline with all features
catalog -i docs -o build \
  --base-url https://docs.example.com \
  --manifest --chunks --tags --graph --bundles \
  --validate-ai --sitemap

# Generate RAG-ready chunks with code-heavy profile
catalog -i docs -o build --chunks --chunk-profile code-heavy

# Generate custom-sized context bundles
catalog -i docs -o build --bundles --bundle-sizes 4000,16000,64000

# Generate MCP server for IDE integration
catalog -i docs -o build --mcp --base-url https://docs.example.com

# Generate manifest with provenance tracking
catalog -i docs -o build --manifest --origin https://github.com/org/repo --repo-ref main

# AI readiness validation with report
catalog -i docs -o build --validate-ai
```

#### Configuration Files

```bash
# Generate sample configuration
catalog --init > catalog.yaml

# Use configuration file
catalog --config catalog.yaml

# Override config options with CLI flags
catalog --config catalog.yaml --output custom-build --cache
```

#### Caching & Incremental Builds

```bash
# Enable caching for faster rebuilds
catalog -i docs -o build --cache

# Use custom cache directory
catalog -i docs -o build --cache-dir .my-cache

# Force full rebuild ignoring cache
catalog -i docs -o build --cache --force-rebuild
```

#### Watch Mode

```bash
# Watch mode for development
catalog -i docs -o build --watch --cache

# Custom debounce timing
catalog -i docs -o build --watch --watch-debounce 1000
```

#### Advanced Workflows

```bash
# Documentation deployment pipeline with all features
catalog --input documentation --output dist --index --toc --sitemap --base-url https://docs.company.com/ --optional "internal/" --validate

# Complete documentation processing with navigation
catalog --input knowledge-base --output training-data --index --toc --validate --silent

# Multi-format processing with TOC generation
catalog --include "*.md" --include "*.html" --exclude "draft*" --index --toc --output processed

# SEO-optimized documentation site
catalog --input content --output public --sitemap --index --base-url https://docs.example.com/

# Full PAI pipeline for AI-ready documentation
catalog -i docs -o build \
  --base-url https://docs.example.com \
  --manifest --chunks --tags --graph --bundles \
  --mcp --sitemap --validate-ai --cache

# Multi-project processing
for dir in project1 project2 project3; do
  catalog --input "$dir/docs" --output "output/$dir" --index --sitemap --base-url "https://docs.company.com/$dir/"
done
```

## Architecture

### SOLID Design Principles

The application follows SOLID design principles with clear separation of concerns:

#### Single Responsibility Principle (SRP)

**Core Components:**
- **`CatalogProcessor`**: Main orchestrator coordinating workflow
- **`DirectoryScanner`**: File discovery and directory traversal
- **`ContentProcessor`**: Content processing and document ordering
- **`OutputGenerator`**: llms.txt file generation
- **`IndexGenerator`**: JSON metadata file creation
- **`TocGenerator`**: Table of contents markdown file creation
- **`SitemapGenerator`**: XML sitemap generation for search engines
- **`Validator`**: llms.txt standard compliance validation

**PAI Components:**
- **`ManifestGenerator`**: Document manifest with IDs and metadata
- **`ChunkGenerator`**: Document chunking for RAG systems
- **`ContextBundler`**: Sized context bundle generation
- **`TagGenerator`**: Semantic tag generation
- **`LinkGraphGenerator`**: Link analysis and importance scoring
- **`MCPGenerator`**: MCP server configuration generation

**Infrastructure Components:**
- **`ConfigLoader`**: Configuration file loading and merging
- **`CacheManager`**: Incremental build caching
- **`WatchMode`**: File system watching and rebuild
- **`PatternConfig`**: Per-pattern configuration overrides

#### Open/Closed Principle

- Classes are open for extension through dependency injection
- Closed for modification through well-defined interfaces
- Customizable exclusion patterns and processing functions

#### Dependency Inversion

- High-level modules depend on abstractions
- File system operations abstracted for testability
- Configurable functions for markdown detection and exclusion logic

### Core Classes

#### `CatalogProcessor`

**Purpose:** Main orchestrator that coordinates the entire workflow

**Responsibilities:**

- Initialize and configure specialized components
- Coordinate workflow execution
- Handle top-level error management
- Provide unified interface for CLI
- Ensure llms.txt standard compliance

**Key Methods:**

- `process()`: Execute complete workflow
- `validate()`: Validate output compliance with llms.txt standard
- Constructor accepts input/output directories and options

#### `DirectoryScanner`

**Purpose:** Discover and filter files in directory structures

**Responsibilities:**

- Recursive directory traversal
- File type detection (markdown vs. HTML)
- Optional pattern matching for `## Optional` section
- Directory validation
- Automatic exclusion of common build artifacts

**Key Methods:**

- `scanDirectory(dir)`: Recursively find markdown and HTML files
- `validateDirectory(path)`: Ensure directory exists and is readable
- `matchesOptionalPattern(path)`: Check if file should be in Optional section

#### `ContentProcessor`

**Purpose:** Process markdown and HTML content and apply automatic section generation

**Responsibilities:**

- Extract site title and description from root index files (index.md, index.mdx, index.html)
- Read and parse markdown files
- Strip YAML frontmatter from markdown
- Convert HTML files to `.html.md` format
- Extract notes from frontmatter or HTML meta tags
- Generate sections automatically based on file paths
- Apply llms.txt standard structure requirements

**Key Methods:**

- `extractSiteMetadata()`: Get site title and description from root index file
- `processFiles(filePaths)`: Read and clean content from all file types
- `convertHtmlToMarkdown(htmlContent)`: Convert HTML to clean markdown
- `generateSections(documents)`: Create sections based on first path segment
- `extractNotes(file)`: Get notes from YAML frontmatter or HTML meta tags

#### `OutputGenerator`

**Purpose:** Generate llms.txt compliant output files

**Responsibilities:**

- Create standard-compliant llms.txt structure
- Generate convenience llms-ctx.txt and llms-ctx-full.txt files
- Format content with proper H1 → blockquote → details → H2 structure
- Build absolute or relative URLs based on base-url setting
- Ensure proper link formatting with optional notes

**Key Methods:**

- `generateOutputs(projectName, sections, optional)`: Create all output files
- `generateLlmsTxt()`: Create standard llms.txt file
- `generateLlmsCtx()`: Create context file without Optional section
- `generateLlmsCtxFull()`: Create full context file with Optional section
- `buildUrl(filePath, baseUrl)`: Generate absolute or relative URLs

#### `IndexGenerator`

**Purpose:** Generate JSON navigation and metadata files

**Responsibilities:**

- Directory metadata collection
- File statistics aggregation
- JSON structure creation
- Full index compilation

**Key Methods:**

- `generateAll()`: Create all index files
- `generateDirectoryIndex()`: Create directory-specific index
- `generateFullIndex()`: Create project-wide index

#### `TocGenerator`

**Purpose:** Generate table of contents markdown files for human-readable navigation

**Responsibilities:**

- Directory-specific TOC generation
- Hierarchical structure creation
- Parent/child directory navigation
- Complete project overview generation

**Key Methods:**

- `generateAll()`: Create all TOC files
- `generateDirectoryToc()`: Create directory-specific toc.md
- `generateFullToc()`: Create complete toc-full.md

#### `SitemapGenerator`

**Purpose:** Generate XML sitemap for search engine optimization

**Responsibilities:**

- Extract metadata from front matter and HTML meta elements
- Generate XML sitemap entries with proper URLs
- Handle URL extension options (default `.html` or extensionless)
- Set appropriate priority and change frequency values
- Handle last modification dates from file system or metadata

**Key Methods:**

- `generateSitemap(files, baseUrl, options)`: Create XML sitemap with proper structure
- `extractSitemapMetadata(file)`: Get sitemap-specific metadata from front matter/meta tags
- `buildSitemapUrl(filePath, baseUrl, useExtensions)`: Generate absolute URLs for sitemap entries
- `calculatePriority(file)`: Determine priority based on file path and metadata

#### `Validator`

**Purpose:** Validate llms.txt compliance with official standard

**Responsibilities:**

- Check H1 presence and format
- Validate blockquote presence
- Ensure no headings in details section
- Verify H2 section structure
- Validate link format and Optional section spelling
- Check absolute URL format when base-url provided

**Key Methods:**

- `validateStructure(content)`: Check overall llms.txt structure
- `validateLinks(content)`: Verify link format compliance
- `validateSections(content)`: Check section structure and naming

#### `ManifestGenerator`

**Purpose:** Generate document manifest with unique IDs and metadata

**Responsibilities:**

- Generate unique document IDs using content hashing
- Track document versions and changes
- Embed provenance information (origin, repo ref)
- Create structured manifest for programmatic access

**Key Methods:**

- `generate(documents)`: Create complete manifest from documents
- `generateDocumentId(doc)`: Create unique ID for document
- `calculateHash(content)`: Compute content hash for versioning

#### `ChunkGenerator`

**Purpose:** Split documents into semantic chunks for RAG systems

**Responsibilities:**

- Split content by semantic boundaries (headings, paragraphs)
- Apply chunking profiles for different content types
- Maintain chunk metadata and relationships
- Generate JSONL output for vector databases

**Key Methods:**

- `generate(documents, profile)`: Create chunks using specified profile
- `splitByHeadings(content)`: Split at heading boundaries
- `applyProfile(chunks, profile)`: Apply profile-specific settings

**Chunking Profiles:**

- `default`: Balanced chunking (500-1500 tokens)
- `code-heavy`: Larger chunks for code documentation (1000-3000 tokens)
- `faq`: Question-answer oriented chunking
- `granular`: Fine-grained chunks (200-500 tokens)
- `large-context`: Large chunks for models with big context windows

#### `ContextBundler`

**Purpose:** Generate sized context bundles for different LLM context windows

**Responsibilities:**

- Select high-priority content for limited context
- Generate bundles at specified token sizes
- Maintain content coherence in bundles
- Prioritize based on document importance

**Key Methods:**

- `generate(documents, sizes)`: Create bundles for specified sizes
- `selectContent(documents, tokenLimit)`: Select content within limit
- `estimateTokens(content)`: Estimate token count for content

#### `TagGenerator`

**Purpose:** Generate semantic tags for content classification

**Responsibilities:**

- Apply rule-based tagging to documents
- Extract topics and categories from content
- Generate tag taxonomy and relationships
- Support custom tagging rules

**Key Methods:**

- `generate(documents)`: Create tags for all documents
- `applyRules(document)`: Apply tagging rules to document
- `extractTopics(content)`: Extract topic tags from content

#### `LinkGraphGenerator`

**Purpose:** Analyze document links and compute importance scores

**Responsibilities:**

- Build link graph from document references
- Compute PageRank-style importance scores
- Detect broken links and orphan documents
- Generate graph visualization data

**Key Methods:**

- `generate(documents)`: Build complete link graph
- `computeImportance(graph)`: Calculate importance scores
- `findBrokenLinks(graph)`: Detect dead links

#### `MCPGenerator`

**Purpose:** Generate Model Context Protocol server configuration

**Responsibilities:**

- Create MCP server implementation script
- Generate IDE-specific configuration files
- Define tools for document search and retrieval
- Create resource definitions for document access

**Key Methods:**

- `generate(documents, manifest)`: Create all MCP files
- `generateServerScript(documents)`: Create server implementation
- `generateClientConfigs(serverConfig)`: Create IDE configs

**Output Files:**

- `mcp-server.js`: Executable MCP server
- `mcp-server.json`: Server configuration
- `cursor-mcp.json`: Cursor IDE integration
- `claude-mcp.json`: Claude Code integration

#### `ConfigLoader`

**Purpose:** Load and merge configuration from files and CLI

**Responsibilities:**

- Load YAML/JSON configuration files
- Merge configuration with CLI options
- Validate configuration values
- Generate sample configuration

**Key Methods:**

- `load(configPath, cliOptions)`: Load and merge configuration
- `generateSampleConfig(format)`: Create sample config file
- `validateConfig(config)`: Validate configuration values

#### `CacheManager`

**Purpose:** Manage incremental build caching

**Responsibilities:**

- Store and retrieve cached build results
- Compute content hashes for change detection
- Invalidate cache on configuration changes
- Clean up stale cache entries

**Key Methods:**

- `get(key)`: Retrieve cached value
- `set(key, value)`: Store value in cache
- `isValid(document)`: Check if cached result is still valid
- `clear()`: Clear all cached data

#### `WatchMode`

**Purpose:** Watch file system for changes and trigger rebuilds

**Responsibilities:**

- Monitor input directory for file changes
- Debounce rapid file changes
- Trigger incremental rebuilds
- Emit change events for streaming updates

**Key Methods:**

- `start()`: Begin watching for changes
- `stop()`: Stop watching
- `handleChange(path, event)`: Process file change event

#### `PatternConfig`

**Purpose:** Apply per-pattern configuration overrides

**Responsibilities:**

- Match file paths against configuration patterns
- Merge pattern-specific options with defaults
- Support glob patterns for flexible matching
- Calculate pattern specificity for override ordering

**Key Methods:**

- `getConfigForPath(path)`: Get merged config for file path
- `addPattern(pattern, config)`: Add pattern configuration
- `matchesAny(path)`: Check if path matches any pattern

**Overridable Options:**

- `chunkProfile`: Chunking profile for specific files
- `tags`: Additional tags for matching files
- `optional`: Mark matching files as optional
- `priority`: Content priority for bundle generation
- `exclude`: Exclude matching files from processing
- `maxChunkSize`: Maximum chunk size for matching files

### Data Flow

1. **Configuration**: `ConfigLoader` loads configuration from files and CLI options
2. **Initialization**: `CatalogProcessor` creates and configures specialized components
3. **Cache Check**: `CacheManager` checks for cached results (if caching enabled)
4. **Discovery**: `DirectoryScanner` finds all markdown and HTML files, applying optional patterns
5. **Pattern Config**: `PatternConfig` applies per-file configuration overrides
6. **Site Metadata Extraction**: `ContentProcessor` extracts site title and description from root index file
7. **Processing**: `ContentProcessor` reads files, converts HTML to markdown, extracts notes, and generates automatic sections
8. **Output Generation**: `OutputGenerator` creates llms.txt standard-compliant files plus convenience variants
9. **PAI Generation** (if enabled):
   - `ManifestGenerator` creates document manifest with IDs and metadata
   - `ChunkGenerator` creates document chunks for RAG systems
   - `TagGenerator` generates semantic tags for classification
   - `LinkGraphGenerator` builds link graph with importance scores
   - `ContextBundler` creates sized context bundles
10. **Optional Indexing**: `IndexGenerator` creates navigation metadata (if enabled)
11. **Optional TOC Generation**: `TocGenerator` creates table of contents files (if enabled)
12. **Optional Sitemap**: `SitemapGenerator` creates XML sitemap for search engines (if enabled)
13. **MCP Generation**: `MCPGenerator` creates MCP server files (if enabled)
14. **Validation**: `Validator` ensures output compliance with llms.txt standard
15. **AI Validation**: Extended validation for AI readiness (if enabled)
16. **Cache Update**: `CacheManager` stores results for incremental builds
17. **Watch Mode**: `WatchMode` monitors for changes and triggers rebuilds (if enabled)

### File Formats

#### llms.txt Structure (Standard Compliant)

```markdown
# ProjectName

> One-line summary for humans and LLMs.

A few sentences of context about how to use these docs. No extra headings here.

## Root

- [README](README.md): Overview of the project

## docs

- [Getting Started](docs/getting-started.md): Quick intro
- [API Reference](docs/api.html.md): Generated from HTML

## tutorials

- [Beginner Tutorial](tutorials/basics.md)

## Optional

- [Changelog](docs/CHANGELOG.md)
```

#### llms-ctx.txt Structure (Convenience File)

Same as llms.txt but excludes the `## Optional` section entirely.

#### llms-full.txt Structure (Full Content)

Contains the complete content of all documents concatenated with separators:

```markdown
# ProjectName

> One-line summary for humans and LLMs.

## README.md
[Full content of README.md]
---
## docs/getting-started.md
[Full content of getting-started.md]
---
[... continues for all files]
```

#### llms-ctx-{size}.txt Structure (Context Bundles)

Sized context bundles for different LLM context windows:

- `llms-ctx-2k.txt`: ~2000 tokens of highest priority content
- `llms-ctx-8k.txt`: ~8000 tokens of high priority content
- `llms-ctx-32k.txt`: ~32000 tokens of content

Content is selected based on document importance scores and includes the most relevant documentation for the specified context window size.

#### catalog.manifest.json Structure

Document manifest with unique IDs and metadata:

```json
{
  "version": "1.0.0",
  "generated": "2024-01-01T00:00:00Z",
  "provenance": {
    "origin": "https://github.com/org/repo",
    "repoRef": "main",
    "generatorVersion": "0.2.0"
  },
  "documents": [
    {
      "id": "doc_abc123",
      "path": "docs/getting-started.md",
      "title": "Getting Started",
      "hash": "sha256:def456...",
      "size": 2345,
      "modified": "2024-01-01T00:00:00Z",
      "metadata": {
        "description": "Quick intro to the project",
        "tags": ["tutorial", "beginner"]
      }
    }
  ],
  "summary": {
    "totalDocuments": 25,
    "totalSize": 125000,
    "categories": ["docs", "api", "tutorials"]
  }
}
```

#### chunks.jsonl Structure

Document chunks for RAG/memory systems (JSON Lines format):

```json
{"id":"chunk_001","docId":"doc_abc123","path":"docs/getting-started.md","content":"## Installation\n\nTo install...","metadata":{"heading":"Installation","level":2,"position":0,"tokens":150}}
{"id":"chunk_002","docId":"doc_abc123","path":"docs/getting-started.md","content":"## Quick Start\n\nFirst...","metadata":{"heading":"Quick Start","level":2,"position":1,"tokens":200}}
```

Each chunk includes:
- `id`: Unique chunk identifier
- `docId`: Parent document ID from manifest
- `path`: Source file path
- `content`: Chunk text content
- `metadata`: Heading, position, token count

#### tags.json Structure

Semantic tags for content classification:

```json
{
  "version": "1.0.0",
  "generated": "2024-01-01T00:00:00Z",
  "documents": {
    "docs/getting-started.md": {
      "tags": ["tutorial", "beginner", "installation"],
      "categories": ["documentation", "guide"],
      "topics": ["setup", "configuration"]
    },
    "api/endpoints.md": {
      "tags": ["api", "reference", "rest"],
      "categories": ["api-documentation"],
      "topics": ["http", "authentication"]
    }
  },
  "taxonomy": {
    "tags": ["tutorial", "beginner", "api", "reference", "installation"],
    "categories": ["documentation", "guide", "api-documentation"],
    "topics": ["setup", "configuration", "http", "authentication"]
  }
}
```

#### graph.json Structure

Link graph with importance scores:

```json
{
  "version": "1.0.0",
  "generated": "2024-01-01T00:00:00Z",
  "nodes": [
    {
      "id": "docs/getting-started.md",
      "title": "Getting Started",
      "importance": 0.85,
      "inLinks": 5,
      "outLinks": 3
    }
  ],
  "edges": [
    {
      "source": "docs/getting-started.md",
      "target": "api/endpoints.md",
      "type": "reference"
    }
  ],
  "analysis": {
    "totalNodes": 25,
    "totalEdges": 42,
    "orphanNodes": 2,
    "brokenLinks": 1
  }
}
```

#### catalog.report.json Structure

AI readiness validation report:

```json
{
  "version": "1.0.0",
  "generated": "2024-01-01T00:00:00Z",
  "summary": {
    "totalDocuments": 25,
    "passedValidation": 23,
    "warnings": 5,
    "errors": 2
  },
  "checks": {
    "codeFences": {"passed": 24, "failed": 1},
    "links": {"passed": 25, "failed": 0},
    "secrets": {"passed": 23, "failed": 2}
  },
  "issues": [
    {
      "path": "docs/config.md",
      "type": "secret",
      "severity": "error",
      "message": "Potential API key detected",
      "line": 45
    }
  ]
}
```

#### mcp/ Directory Structure

MCP server configuration files for IDE integration:

```
mcp/
├── mcp-server.js      # Executable MCP server implementation
├── mcp-server.json    # Server configuration and capabilities
├── cursor-mcp.json    # Cursor IDE integration config
└── claude-mcp.json    # Claude Code integration config
```

**mcp-server.json:**
```json
{
  "name": "catalog-docs",
  "version": "1.0.0",
  "server": {
    "type": "stdio",
    "command": "node",
    "args": ["mcp-server.js"]
  },
  "tools": [
    {
      "name": "search_docs",
      "description": "Search documentation",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"}
        }
      }
    },
    {
      "name": "get_document",
      "description": "Get document content by path",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {"type": "string"}
        }
      }
    }
  ],
  "resources": [
    {
      "uri": "docs://index",
      "name": "Documentation Index",
      "mimeType": "text/markdown"
    }
  ]
}
```

#### catalog.yaml Configuration File

Sample configuration file structure:

```yaml
# Catalog Configuration
input: ./docs
output: ./build
baseUrl: https://docs.example.com

# Pattern matching
include:
  - "**/*.md"
  - "**/*.mdx"
exclude:
  - "**/drafts/**"
  - "**/*.draft.md"
optional:
  - "**/changelog.md"
  - "**/archive/**"

# Standard outputs
generateIndex: true
generateToc: true
generateSitemap: true
sitemapNoExtensions: false

# PAI features
generateManifest: true
generateChunks: true
chunkProfile: default
generateTags: true
generateGraph: true
generateBundles: true
bundleSizes: [2000, 8000, 32000]
generateMcp: true

# Caching
enableCache: true
cacheDir: .cache

# Validation
validate: true
validateAI: true

# Provenance
origin: https://github.com/org/repo
repoRef: main

# Pattern-specific configuration
patterns:
  "api/**/*.md":
    chunkProfile: code-heavy
    tags: [api, reference]
  "tutorials/**/*.md":
    chunkProfile: default
    tags: [tutorial, guide]
    priority: 80
```

#### sitemap.xml Structure

**Default behavior (with `.html` extensions):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/docs/getting-started.html</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/api/reference.html</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

**With `--sitemap-no-extensions` flag:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/docs/getting-started</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/api/reference</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

#### HTML to Markdown Conversion

- Input: `docs/api.html`
- Output: `docs/api.html.md` (cleaned markdown content)
- Link in llms.txt: `- [API Reference](docs/api.html.md): Generated from HTML`

#### Notes from Metadata

**Markdown files with YAML frontmatter:**

```yaml
---
title: "Getting Started"
notes: "Quick intro to the project"
---
```

**HTML files with meta tags:**

```html
<meta name="notes" content="Generated from HTML" />
```

Both result in: `- [Title](url): the notes value`

#### Sitemap Metadata from Front Matter and Meta Elements

**Markdown files with YAML frontmatter:**

```yaml
---
title: "Getting Started"
sitemap:
  priority: 0.8
  changefreq: "monthly"
  lastmod: "2024-01-01"
---
```

**Advanced sitemap metadata examples:**

```yaml
---
title: "API Reference"
description: "Complete API documentation"
sitemap:
  priority: 0.9        # High priority for important pages
  changefreq: "weekly" # Updated frequently
  lastmod: "2024-08-15T10:30:00Z"
  # Additional custom metadata
  exclude: false       # Explicitly include in sitemap
---
```

```yaml
---
title: "Legacy Documentation"
sitemap:
  priority: 0.2        # Low priority
  changefreq: "yearly" # Rarely updated
  exclude: true        # Exclude from sitemap entirely
---
```

**HTML files with meta tags:**

```html
<meta name="sitemap-priority" content="0.9" />
<meta name="sitemap-changefreq" content="weekly" />
<meta name="sitemap-lastmod" content="2024-01-01T00:00:00Z" />
```

**Advanced HTML meta tag examples:**

```html
<!DOCTYPE html>
<html>
<head>
    <title>API Reference</title>
    <meta name="description" content="Complete API documentation">
    
    <!-- Sitemap configuration -->
    <meta name="sitemap-priority" content="0.9">
    <meta name="sitemap-changefreq" content="weekly">
    <meta name="sitemap-lastmod" content="2024-08-15T10:30:00Z">
    
    <!-- Optional: exclude from sitemap -->
    <meta name="sitemap-exclude" content="false">
</head>
<body>
    <h1>API Reference</h1>
    <p>Complete documentation for our API...</p>
</body>
</html>
```

**Valid sitemap property values:**

- **Priority**: `0.0` to `1.0` (decimal values)
  - `1.0` = Highest priority (homepage, key landing pages)
  - `0.8` = High priority (main content pages)
  - `0.5` = Normal priority (regular content)
  - `0.2` = Low priority (archived content)
- **Change frequency**: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`
- **Last modified**: ISO 8601 date format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`)
- **Exclude**: `true` or `false` (whether to exclude from sitemap)

**Sitemap defaults when metadata is missing:**

- Priority: 0.5 for most files, 0.8 for index files, 0.3 for optional files
- Change frequency: "monthly" for most files, "weekly" for index files
- Last modified: File system modification time

**Sitemap URL generation:**

- **Default behavior**: Assumes `.html` file extension for all URLs in the sitemap
  - `docs/getting-started.md` → `https://example.com/docs/getting-started.html`
  - `api/reference.mdx` → `https://example.com/api/reference.html`
- **Extensionless URLs**: May require a `--sitemap-no-extensions` option for static sites that use URL rewriting
  - `docs/getting-started.md` → `https://example.com/docs/getting-started`
  - `api/reference.mdx` → `https://example.com/api/reference`

#### Site Title and Description from Root Index File

The site title and description for the llms.txt H1 heading and blockquote are extracted from the root index file's metadata. Catalog looks for index files in this priority order: `index.md`, `index.mdx`, `index.html`.

**Markdown/MDX index files with YAML frontmatter:**

```yaml
---
title: "Documentation Hub"
description: "Comprehensive documentation for our platform and APIs."
instructions: A few sentences of context about how to use these docs. No extra headings here.
---
# Welcome to Our Docs

Content here...
```

**HTML index files with meta tags:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Documentation Hub</title>
    <meta
      name="description"
      content="Comprehensive documentation for our platform and APIs."
    />
    <meta
      name="instructions"
      content="A few sentences of context about how to use these docs. No extra headings here."
    />
  </head>
  <body>
    <h1>Welcome to Our Docs</h1>
    <p>Content here...</p>
  </body>
</html>
```

**Generated llms.txt structure:**

```markdown
# Documentation Hub

> Comprehensive documentation for our platform and APIs.

A few sentences of context about how to use these docs. No extra headings here.

## Root

- [Welcome](index.md): Welcome to Our Docs

## docs

- [Getting Started](docs/getting-started.md): Quick intro
```

**Fallback behavior when no root index file or metadata is found:**

- Title: Uses the directory name (capitalized)
- Description: "Documentation and resources for [directory name]."

#### index.json Structure

The index.json files will only include Markdown files and other index.json files. The structure includes indexed date, source file hash, and metadata object. The `path` property represents the relative path from the root of the site:

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
      "indexed": "2024-01-01T00:00:00Z",
      "hash": "sha256:abc123...",
      "metadata": {
        "title": "Getting Started",
        "description": "Quick intro to the project",
        "sitemap": {
          "priority": 0.8,
          "changefreq": "monthly"
        }
      }
    }
  ],
  "subdirectories": [
    {
      "name": "catalogs",
      "path": "catalogs",
      "indexPath": "catalogs/index.json"
    }
  ],
  "summary": {
    "totalFiles": 5,
    "totalSubdirectories": 2,
    "totalSize": 12543
  }
}
```

#### toc.md Structure

Each directory receives a `toc.md` file that provides human-readable navigation for that specific directory:

```markdown
# Table of Contents - docs

- [← Parent Directory](toc.md)

## Files

- [Getting Started](docs/getting-started.md)
- [API Reference](docs/api-reference.md)
- [Tutorial](docs/tutorial.md)

## Subdirectories

- [examples/](examples/toc.md)
- [guides/](guides/toc.md)
```

#### toc-full.md Structure

The root directory receives a `toc-full.md` file that provides a complete hierarchical view of all pages:

```markdown
# Complete Table of Contents

> Generated from ProjectName

- [README](README.md)
- [Getting Started](docs/getting-started.md)
- **docs/**
  - [API Reference](docs/api-reference.md)
  - [Tutorial](docs/tutorial.md)
  - **examples/**
    - [Basic Example](docs/examples/basic.md)
    - [Advanced Example](docs/examples/advanced.md)
- **guides/**
  - [Installation Guide](guides/installation.md)
  - [Configuration](guides/configuration.md)
```

**Key Features:**

- **Parent Navigation**: Each subdirectory TOC includes a link back to the parent directory
- **File Listings**: All markdown files in the current directory are listed under "Files"
- **Subdirectory Links**: Links to subdirectory TOC files for easy navigation
- **Hierarchical Structure**: `toc-full.md` shows the complete project structure with nested lists
- **Display Names**: File extensions (.md, .mdx) are removed for cleaner display
- **URL Generation**: Supports both relative and absolute URLs based on `--base-url` setting

## Section Generation Logic (Convention over Configuration)

### Automatic Section Creation

Sections are generated automatically based on file path structure with no manual configuration required:

1. **Section Name = First Path Segment**

   - `docs/getting-started.md` → `## docs`
   - `api/reference.html` → `## api`
   - `tutorials/basics.html` → `## tutorials`

2. **Root-Level Files**

   - Files with no path segment go under `## Root`
   - Examples: `README.md`, `index.md`, `changelog.md`

3. **Optional Section**
   - Added last if any files match `--optional` patterns
   - Always labeled exactly `## Optional` to preserve spec semantics
   - Files matching optional patterns excluded from regular sections

### Section Ordering Rules

1. **Deterministic Ordering**: Sections ordered alphabetically by folder name
2. **Root Section**: Always first if present
3. **Optional Section**: Always last if present
4. **File Ordering**: Within each section, files sorted lexicographically

### Link Format with Notes

- **Without Notes**: `- [Title](url)`
- **With Notes**: `- [Title](url): description from metadata`
- **Notes Sources**:
  - Markdown: `notes` property in YAML frontmatter
  - HTML: `<meta name="notes" content="description">`

### URL Building Rules

- **Relative Mode** (default): `- [Title](path/to/file.md)`
- **Absolute Mode** (with `--base-url`): `- [Title](https://example.com/path/to/file.md)`
- **HTML Files**: Always link to `.html.md` version in output
- **Markdown Files**: Link directly without adding extra `.md` extension

### Optional Pattern Matching

- **Pattern Type**: Global pattern
- **Match Target**: Relative file path from input directory
- **Multiple Patterns**: File is optional if it matches ANY pattern
- **Common Patterns**:
  - `(^|/)drafts(/|$)` - Files in any `drafts` directory
  - `changelog\.md$` - Any changelog.md file
  - `(^|/)legacy/` - Files in legacy directories

## Standard Compliance Requirements

### Required Structure Order

1. **H1**: Project/site name (exactly one)
2. **Blockquote**: One-sentence summary (required)
3. **Details**: Context paragraphs without headings (optional)
4. **H2 Sections**: Link lists organized by folder (at least one non-Optional)
5. **H2 Optional**: Optional/skippable content (if any matches)

### Validation Rules

- **H1 Present**: Must have exactly one H1 at the start
- **Blockquote Present**: Must have blockquote after H1
- **No Headings in Details**: No H2-H6 between blockquote and first H2 section
- **Optional Spelling**: If present, must be exactly `## Optional`
- **Link Format**: Each list item must be `- [text](url)` or `- [text](url): notes`
- **Absolute URLs**: When `--base-url` provided, all links must be absolute

## Error Handling

### Error Categories

#### Fatal Errors (Exit Code 2)

- Input directory doesn't exist or isn't readable
- Output directory creation fails
- Insufficient permissions for file operations

#### Recoverable Errors (Exit Code 1)

- Individual file read failures (logged, processing continues)
- Malformed JSON during index generation
- Network issues in distributed environments

#### Warnings (No Exit)

- Files that can't be read (permissions, corruption)
- Unexpectedly large files that may impact performance
- Unusual directory structures

### Error Messages

- Clear, actionable error descriptions
- Full file paths for context
- Suggested solutions where applicable
- Proper logging levels (error, warn, info)

## Performance Requirements

### Processing Performance

- Handle projects with 1000+ markdown files
- Process individual files up to 10MB efficiently
- Complete typical documentation projects (<100 files) in <5 seconds
- Memory usage remains <200MB for large projects

### File System Performance

- Efficient recursive directory traversal
- Minimal file system calls through batched operations
- Streaming file reads for large documents
- Concurrent processing where safe

### Scalability Targets

- Support documentation sets up to 10GB total size
- Handle deep directory structures (>20 levels)
- Process files with extensive frontmatter efficiently
- Maintain responsiveness with large binary exclusions

## Integration Requirements

### fwdslsh Ecosystem

- Compatible with `inform` for documentation crawling
- Follows fwdslsh philosophy of minimal, composable tools
- Outputs suitable for direct consumption by AI systems
- Maintains relative linking for web publishing

### External Integrations

#### AI/LLM Systems

- llms.txt format optimized for context windows
- Structured metadata enables intelligent document selection
- Clean content without formatting artifacts
- Consistent document ordering for training data

#### Build Pipelines

- Exit codes suitable for CI/CD integration
- Silent mode for automated processing
- Deterministic output for reproducible builds
- Fast incremental processing capabilities

#### Documentation Workflows

- Preserves markdown linking and structure
- Maintains relative paths for portability
- Compatible with static site generators
- Supports documentation versioning workflows

## Runtime Requirements

### Bun Runtime

- **Minimum Version:** Bun 1.0.0
- **Recommended:** Latest stable Bun release
- **ESM Modules:** Pure ES module implementation
- **Built-in APIs:** Leverages Bun's fast file system operations

### Cross-Platform Support

- **Windows:** Full support with proper path handling
- **macOS:** Native support with all features
- **Linux:** Optimized performance on Unix systems
- **Path Handling:** Normalized for cross-platform compatibility

## Testing Requirements

### Unit Testing

- Individual class testing with dependency injection
- Mock file system operations for deterministic tests
- Comprehensive error condition coverage
- Performance regression testing

### Integration Testing

- End-to-end CLI workflow testing
- Real file system integration tests
- Cross-platform compatibility validation
- Large dataset processing verification

### Test Coverage

- Minimum 85% line coverage for core functionality
- 100% coverage for critical path operations
- Edge case testing for file system errors
- Performance benchmarking for regression detection

## Security Requirements

### Path Safety

- Prevention of directory traversal attacks
- Validation of all file path inputs
- Restriction to specified input directories
- Safe handling of symbolic links

### File System Security

- Read-only access to input directories
- Controlled write access to output directories
- Proper permission validation before operations
- Safe handling of large files to prevent DoS

### Input Validation

- Sanitization of command line arguments
- Validation of directory paths
- Safe parsing of markdown content
- Protection against malformed frontmatter

## Success Criteria

### Functional Requirements

- **Core Processing:** Successfully processes markdown files and generates outputs
- **Document Ordering:** Correctly prioritizes index, important, and other documents
- **Index Generation:** Creates valid JSON navigation metadata when enabled
- **Sitemap Generation:** Creates valid XML sitemap when enabled with proper metadata extraction
- **Error Handling:** Graceful degradation with informative error messages
- **Cross-platform:** Consistent behavior across Windows, macOS, and Linux

### Performance Requirements

- **Processing Speed:** Completes typical projects (<100 files) in <5 seconds
- **Memory Efficiency:** Uses <200MB for large projects (1000+ files)
- **File Size Support:** Handles individual files up to 10MB
- **Scalability:** Processes documentation sets up to 10GB total size

### Usability Requirements

- **Zero Configuration:** Works with sensible defaults out of the box
- **Clear Documentation:** Comprehensive help and usage examples
- **Intuitive CLI:** Logical option names and clear error messages
- **Silent Mode:** Supports automation without verbose output

### Reliability Requirements

- **Error Recovery:** Continues processing when individual files fail
- **Consistent Output:** Deterministic results for identical inputs
- **Resource Management:** Proper cleanup of temporary resources
- **Graceful Shutdown:** Handles interruption signals appropriately

### Integration Requirements

#### llms.txt Ecosystem Integration

- **Standard Compliance:** Strict adherence to official llms.txt specification structure and format
- **Deployment Ready:** Generated files ready for deployment at `/llms.txt` site root
- **Absolute URLs:** Proper absolute URL generation for public deployment
- **Convenience Extensions:** llms-ctx.txt and llms-ctx-full.txt clearly labeled as non-standard

#### fwdslsh Ecosystem

- **Compatible with inform:** Seamless integration for documentation crawling workflows
- **Minimal Philosophy:** Follows fwdslsh philosophy of minimal, composable tools
- **AI-Optimized Outputs:** Direct consumption by AI systems with clean formatting
- **Cross-Tool Workflows:** Maintains relative linking for web publishing integration

#### External System Integration

- **AI/LLM Systems:** Outputs optimized for LLM consumption with proper structure
- **Build Pipelines:** Suitable exit codes and validation for CI/CD integration
- **Documentation Workflows:** Preserves linking and maintains markdown structure
- **Static Site Generators:** Compatible URL building and content preservation

## Future Extensibility

### Plugin Architecture

- Configurable document processors for different formats
- Custom ordering algorithms through dependency injection
- Extensible exclusion pattern systems
- Pluggable output format generators
- Custom chunking strategies for ChunkGenerator
- Additional tagging rules for TagGenerator

### Format Support

- Additional markdown variants (CommonMark, GitHub Flavored)
- Support for other documentation formats (AsciiDoc, reStructuredText)
- Custom frontmatter processors
- Binary asset handling and indexing
- Additional vector database output formats

### IDE & Tool Integrations

- Additional MCP server transport types (HTTP, WebSocket)
- VS Code extension for live preview
- GitHub Actions integration
- Pre-commit hooks for validation

### Advanced Features (Planned)

- Parallel processing for improved performance
- Network-based input sources (HTTP/S3)
- Integration with external LLM APIs for smart chunking
- Semantic similarity-based content organization
- Multi-language documentation support

### Implemented Advanced Features

The following advanced features are now available:

- ✓ Incremental processing with change detection (CacheManager)
- ✓ Real-time documentation monitoring (WatchMode)
- ✓ Configuration file support (ConfigLoader)
- ✓ Per-pattern configuration overrides (PatternConfig)
- ✓ Document chunking for RAG (ChunkGenerator)
- ✓ Semantic tagging (TagGenerator)
- ✓ Link graph analysis (LinkGraphGenerator)
- ✓ Context window bundles (ContextBundler)
- ✓ MCP server generation (MCPGenerator)
