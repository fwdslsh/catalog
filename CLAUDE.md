# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Catalog** is a lightweight CLI tool for generating `llms.txt` (structured index) and `llms-full.txt` (full content) from Markdown/HTML directories. Version 0.1.0 provides full llms.txt standard compliance with enterprise-grade features including HTML processing, sitemap generation, performance monitoring, security enhancements, and comprehensive validation. Part of the fwdslsh ecosystem, it follows the philosophy of minimal, readable, and effective tools designed to work together.

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
   - Support for all new v0.1.0 options (base-url, optional, sitemap, validate, index)
   - Proper exit codes and error handling

### Performance & Monitoring Components

9. **`src/PerformanceMonitor.js`** - Real-time performance monitoring
   - Tracks timing for all major workflow operations
   - Monitors memory usage and provides detailed reporting
   - Supports concurrent processing utilities
   - Provides performance wrapping for functions

10. **`src/FileSizeMonitor.js`** - File size monitoring and optimization
    - Tracks large files and provides warnings
    - Configurable size limits to prevent memory issues
    - Statistical reporting on file sizes and counts

### Security & Error Handling Components

11. **`src/errors.js`** - Comprehensive error handling system
    - Categorized error types with proper exit codes
    - Actionable error messages with recovery suggestions
    - Graceful degradation and error aggregation
    - Security-focused error classification

12. **`src/security.js`** - Enterprise-grade security features
    - Path traversal prevention and validation
    - File security scanning and content analysis
    - Input sanitization for all user inputs
    - Security auditing with comprehensive reporting

### Workflow Pipeline

1. **Initialization**: Configure all components with security and performance monitoring
2. **Discovery**: Scan directories with pattern matching and security validation
3. **Processing**: Extract metadata, process content with graceful error handling
4. **Organization**: Apply intelligent ordering and path-based section generation
5. **Generation**: Create all output formats (llms.txt, llms-full.txt, llms-ctx.txt)
6. **Enhancement**: Generate sitemaps and navigation indexes if requested
7. **Validation**: Ensure compliance with llms.txt standard if requested
8. **Reporting**: Provide performance and security summaries

## Testing

- **Framework**: Bun's built-in test runner
- **Structure**: Each source file has corresponding `.test.js` file in `tests/`
- **Fixtures**: Test documents in `tests/fixtures/` with comprehensive scenarios
- **Coverage**: 260+ tests with 899+ expect() calls across 12 test files
- **Test Types**: Unit tests, integration tests, security tests, performance tests

### Test Files
- `tests/CatalogProcessor.test.js` - Main workflow integration tests
- `tests/ContentProcessor.test.js` - Content processing and metadata extraction
- `tests/DirectoryScanner.test.js` - File discovery and pattern matching
- `tests/OutputGenerator.test.js` - Output format generation
- `tests/SitemapGenerator.test.js` - Sitemap generation and SEO features
- `tests/Validator.test.js` - llms.txt standard compliance validation
- `tests/errors.test.js` - Error handling and categorization
- `tests/security.test.js` - Security features and vulnerability prevention
- `tests/PerformanceMonitor.test.js` - Performance monitoring and optimization
- `tests/cli.test.js` - Command-line interface and option handling

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
catalog --input docs --output build

# With all v0.1.0 features
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --optional "drafts/**/*" \
  --sitemap --validate --index
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
catalog --input docs --output build \
  --base-url https://docs.example.com \
  --sitemap --validate --index

# AI-optimized content generation
catalog --input docs --output ai-context \
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