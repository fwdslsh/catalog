# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Catalog** is a lightweight CLI tool for generating `llms.txt` (structured index) and `llms-full.txt` (full content) from Markdown/HTML directories. Part of the fwdslsh ecosystem, it follows the philosophy of minimal, readable, and effective tools designed to work together.

## Commands

### Development
```bash
bun install                    # Install dependencies
bun test                       # Run all tests (81 tests across 6 files)
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

The codebase follows SOLID design principles with clear separation of concerns:

### Core Components

1. **`src/CatalogProcessor.js`** - Main orchestrator coordinating the entire workflow
   - Initializes and configures all components
   - Manages workflow execution and error handling

2. **`src/DirectoryScanner.js`** - File discovery and filtering
   - Recursive directory traversal with glob pattern support
   - Handles include/exclude patterns and default exclusions
   - Default exclusions: `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`, framework outputs

3. **`src/MarkdownProcessor.js`** - Content processing and document ordering
   - Strips YAML frontmatter from files
   - Applies intelligent ordering: index files → important docs → alphabetical
   - Important docs: files containing `doc`, `catalog`, `tutorial`, `intro`, `getting-started`

4. **`src/OutputGenerator.js`** - Generates output files
   - Creates `llms.txt` (structured index with Core/Optional sections)
   - Creates `llms-full.txt` (full concatenated content with separators)

5. **`src/IndexGenerator.js`** - Optional JSON metadata generation
   - Creates `index.json` files for directory navigation
   - Generates project-wide statistics and file metadata

6. **`src/cli.js`** - Command-line interface
   - Argument parsing with support for short/long flags
   - Error handling and help display

### Workflow

1. `CatalogProcessor` validates directories and initializes components
2. `DirectoryScanner` finds all `.md`, `.mdx`, and `.html` files
3. `MarkdownProcessor` reads, cleans, and orders documents
4. `OutputGenerator` creates llms.txt and llms-full.txt
5. `IndexGenerator` optionally creates JSON navigation files

## Testing

- **Framework**: Bun's built-in test runner
- **Structure**: Each source file has corresponding `.test.js` file in `tests/`
- **Fixtures**: Test documents in `tests/fixtures/test-docs/`
- **Coverage**: 81 tests with 346 expect() calls

## Key Implementation Details

### File Processing
- Supports `.md`, `.mdx`, and `.html` files
- Strips YAML frontmatter using regex: `/^---\s*\n([\s\S]*?)\n---\s*\n/`
- Maintains relative paths in output for proper linking

### Document Ordering Priority
1. **Index files**: `index.md`, `readme.md`, `home.md` (and .mdx/.html variants)
2. **Important docs**: Files containing keywords like `doc`, `catalog`, `tutorial`
3. **Others**: Alphabetical order

### Glob Pattern Support
- Uses `minimatch` library for pattern matching
- Include patterns: whitelist specific files
- Exclude patterns: blacklist specific files
- Patterns evaluated against relative paths from input directory

### Output Formats

**llms.txt Structure:**
```markdown
# [directory-name]
> Documentation for [directory-name]

## Core Documentation
- [relative/path/to/index.md](relative/path/to/index.md)
- [relative/path/to/important.md](relative/path/to/important.md)

## Optional
- [relative/path/to/other.md](relative/path/to/other.md)
```

**llms-full.txt Structure:**
```markdown
# [directory-name]
> Documentation for [directory-name]

## relative/path/to/file.md
[content with frontmatter stripped]
---
## relative/path/to/another.md
[content]
---
```

## Dependencies

- `glob` (^11.0.3) - File pattern matching
- `minimatch` (^10.0.3) - Glob pattern matching utility

## Error Handling

- **Exit code 0**: Success
- **Exit code 1**: Recoverable errors (individual file failures)
- **Exit code 2**: Fatal errors (directory access, permissions)
- Continues processing when individual files fail
- Logs errors with clear, actionable messages

## Integration with fwdslsh Ecosystem

Designed to work with [`inform`](https://github.com/fwdslsh/inform):
```bash
# Crawl website with inform
inform https://docs.example.com --output-dir docs

# Generate LLM artifacts with catalog
catalog --input docs --output build --generate-index
```