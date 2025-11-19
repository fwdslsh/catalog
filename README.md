# Catalog

A lightweight CLI that scans a directory of Markdown and HTML files to generate `llms.txt` (structured index) and `llms-full.txt` (full content), designed for AI-powered documentation workflows and seamless integration with the fwdslsh ecosystem.

**Latest Version:** 0.1.0 ([CHANGELOG](CHANGELOG.md))

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

# Generate with absolute URLs and sitemap
catalog --input docs --output build --base-url https://example.com/ --sitemap

# Complete workflow with all features
catalog -i docs -o build --base-url https://docs.example.com \
  --optional "drafts/**/*" --sitemap --validate --index
```

## Core Features

### 🚀 **Version 0.1.0 - Full llms.txt Standard Compliance**

- **llms.txt Standard Compliance**: Complete H1 → blockquote → sections format
- **HTML Processing**: Full support for HTML files with conversion to Markdown
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

# Silent mode
catalog --silent
```

### Advanced Workflows

```bash
# Complete documentation pipeline
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --optional "drafts/**/*" \
  --sitemap --sitemap-no-extensions \
  --validate --index

# Include/exclude specific patterns
catalog --include "*.md" --include "tutorials/*.html" \
  --exclude "**/*draft*" --exclude "temp/*"

# Integration with inform crawler
inform https://docs.example.com --output-dir docs
catalog --input docs --output build --base-url https://docs.example.com --sitemap
```

## Command Reference

### Core Options

- `--input, -i <path>`: Source directory of Markdown/HTML files (default: current directory)
- `--output, -o <path>`: Destination directory for generated files (default: current directory)
- `--base-url <url>`: Base URL for generating absolute links in output files
- `--silent`: Suppress non-error output

### Content Selection

- `--include <pattern>`: Include files matching glob pattern (can be used multiple times)
- `--exclude <pattern>`: Exclude files matching glob pattern (can be used multiple times)
- `--optional <pattern>`: Mark files matching glob pattern as optional (can be used multiple times)

### Output Generation

- `--index`: Generate index.json files for directory navigation and metadata
- `--sitemap`: Generate XML sitemap for search engines (requires --base-url)
- `--sitemap-no-extensions`: Generate sitemap URLs without file extensions for clean URLs
- `--validate`: Validate generated llms.txt compliance with standard

### Utility

- `--help, -h`: Show usage information
- `--version`: Show current version

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

## Advanced Features

### Performance Monitoring

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

# Generate llms.txt with sitemap
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --sitemap --validate
```

### CI/CD Pipeline

```bash
#!/bin/bash
# Documentation build pipeline

# Crawl latest docs
inform https://docs.example.com --output-dir temp/docs

# Generate artifacts with validation
catalog --input temp/docs --output dist \
  --base-url https://docs.example.com \
  --optional "archive/**/*" \
  --sitemap --validate --index

# Upload to CDN or deploy
```

### AI Integration

```bash
# Generate context-optimized documentation
catalog --input docs --output ai-context \
  --optional "examples/**/*" --optional "appendix/**/*" \
  --validate

# The resulting llms-ctx.txt contains only essential documentation
# for feeding to AI systems with context limits
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