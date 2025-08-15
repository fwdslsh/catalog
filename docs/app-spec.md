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

- **Recursive Markdown and HTML Scanning**: Discovers `.md`, `.mdx`, and `.html` files across directory structures
- **llms.txt Standard Compliance**: Generates files strictly conforming to the official llms.txt specification
- **Convention over Configuration**: Automatic section generation based on file path structure with no manual configuration
- **HTML-to-Markdown Conversion**: Automatically converts HTML files to `.html.md` for LLM-friendly consumption
- **Metadata-based Link Notes**: Optional link descriptions via YAML frontmatter or HTML meta tags
- **Flexible Optional Sections**: Configurable patterns for marking content as optional/skippable
- **Absolute and Relative URL Support**: Configurable base URL for deployment-ready absolute links
- **Built-in Validation**: Ensures generated output complies with llms.txt standard requirements
- **Multiple Output Variants**: Standard `llms.txt` plus convenience `llms-ctx.txt` and `llms-ctx-full.txt` files
- **Optional Directory Navigation**: Generates JSON metadata for programmatic navigation
- **Configurable Exclusion Patterns**: Automatically excludes common build artifacts and dependencies
- **Relative Link Preservation**: Maintains proper markdown linking in outputs
- **Project-wide Metadata Collection**: Aggregates statistics and file information
- **Silent Mode Operation**: Supports automated workflows with minimal output
- **Cross-platform Compatibility**: Works on Windows, macOS, and Linux

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
3. Reads and processes files, stripping YAML frontmatter from Markdown
4. Converts HTML files to `.html.md` format for LLM consumption
5. Automatically generates sections based on first path segment of each file
6. Applies optional patterns to categorize content under `## Optional` section
7. Generates llms.txt standard-compliant output with proper structure (H1 → blockquote → details → H2 sections)
8. Creates additional convenience files (`llms-ctx.txt`, `llms-ctx-full.txt`)
9. Optionally generates `index.json` files for directory navigation (with `--index`)
10. Validates output compliance with llms.txt standard
11. Reports processing summary with file counts and output information

**Expected Output:**

- `llms.txt`: Standard-compliant structured index with auto-generated sections
- `llms-ctx.txt`: Same as llms.txt but excludes `## Optional` links (convenience file)
- `llms-ctx-full.txt`: Includes all links including `## Optional` (convenience file)
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

- **Purpose:** Mark files matching pattern as optional (can be used multiple times)
- **Default:** No optional patterns
- **Pattern Format:** File glob patterns (e.g., `/drafts/**/*.*`, `changelog.md`)
- **Behavior:** Matching files placed under `## Optional` section
- **Examples:** `--optional "/archive"`, `--optional "changelog.md"`

#### Feature Options

**`--include <pattern>`**

- **Purpose:** Include files matching glob pattern (can be used multiple times)
- **Default:** All supported files included
- **Pattern Format:** Standard glob patterns (e.g., `*.md`, `docs/**/*.html`, `*catalog*`)
- **Behavior:** Only files matching at least one include pattern are processed
- **Examples:** `--include "*.md"`, `--include "docs/*.html"`, `--include "**/catalog*"`

**`--exclude <pattern>`**

- **Purpose:** Exclude files matching glob pattern (can be used multiple times)
- **Default:** Standard exclusion patterns applied (node_modules, .git, etc.)
- **Pattern Format:** Standard glob patterns (e.g., `draft*`, `temp/*`, `**/*test*`)
- **Behavior:** Files matching any exclude pattern are skipped
- **Examples:** `--exclude "*.draft.md"`, `--exclude "temp/*"`, `--exclude "**/backup/**"`

**`--index`**

- **Purpose:** Enable generation of `index.json` navigation files
- **Default:** `false` (disabled)
- **Effect:** Creates directory-specific `index.json` files and project-wide `master-index.json`
- **Use Cases:** LLM integration, dynamic menu generation, programmatic navigation

#### Operational Options

**`--validate`**

- **Purpose:** Validate generated llms.txt compliance with standard
- **Default:** Validation always runs, this flag makes it the primary action
- **Effect:** Checks H1, blockquote, section structure, and link format compliance
- **Exit Codes:** 0 if valid, 1 if validation errors found

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

### Examples

#### Basic Usage

```bash
# Process current directory
catalog

# Specify input and output directories
catalog --input docs --output build

# Generate with navigation metadata
catalog --input docs --output build --index

# Silent operation for automation
catalog -i docs -o build --silent

# Generate with absolute URLs for deployment
catalog --input docs --output build --base-url https://example.com/
```

#### Optional Content Management

```bash
# Mark draft files as optional
catalog --optional "drafts"

# Mark changelog and legacy content as optional
catalog --optional "changelog.md" --optional "(^|/)legacy/"

# Exclude draft and temporary files
catalog --exclude "*.draft.md" --exclude "temp/*"

# Combine include/exclude patterns
catalog --include "docs/**/*" --exclude "**/draft*" --exclude "**/temp*"

# Process only catalogs and tutorials
catalog --include "*catalog*" --include "*tutorial*"
```

#### Advanced Workflows

```bash
# Documentation deployment pipeline
catalog --input documentation --output dist --base-url https://docs.company.com/ --optional "internal/"

# Multi-format processing with validation
catalog --input knowledge-base --output training-data --validate --silent

# Multi-format processing
catalog --include "*.md" --include "*.html" --exclude "draft*" --output processed

# Multi-project processing
for dir in project1 project2 project3; do
  catalog --input "$dir/docs" --output "output/$dir" --index
done
```

## Architecture

### SOLID Design Principles

The application follows SOLID design principles with clear separation of concerns:

#### Single Responsibility Principle (SRP)

- **`CatalogProcessor`**: Main orchestrator coordinating workflow
- **`DirectoryScanner`**: File discovery and directory traversal
- **`MarkdownProcessor`**: Content processing and document ordering
- **`OutputGenerator`**: llms.txt file generation
- **`IndexGenerator`**: JSON metadata file creation

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

- Read and parse markdown files
- Strip YAML frontmatter from markdown
- Convert HTML files to `.html.md` format
- Extract notes from frontmatter or HTML meta tags
- Generate sections automatically based on file paths
- Apply llms.txt standard structure requirements

**Key Methods:**

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

**Purpose:** Generate JSON navigation and metadata files (unchanged from original spec)

**Responsibilities:**

- Directory metadata collection
- File statistics aggregation
- JSON structure creation
- Full index compilation

**Key Methods:**

- `generateAll()`: Create all index files
- `generateDirectoryIndex()`: Create directory-specific index
- `generateFullIndex()`: Create project-wide index

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

### Data Flow

1. **Initialization**: `CatalogProcessor` creates and configures specialized components
2. **Discovery**: `DirectoryScanner` finds all markdown and HTML files, applying optional patterns
3. **Processing**: `ContentProcessor` reads files, converts HTML to markdown, extracts notes, and generates automatic sections
4. **Output Generation**: `OutputGenerator` creates llms.txt standard-compliant files plus convenience variants
5. **Optional Indexing**: `IndexGenerator` creates navigation metadata (if enabled)
6. **Validation**: `Validator` ensures output compliance with llms.txt standard

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

#### llms-ctx-full.txt Structure (Convenience File)

Identical to llms.txt including all sections and Optional content.

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
<meta name="notes" content="Generated from HTML">
```

Both result in: `- [Title](url): the notes value`

#### index.json Structure

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
      "name": "catalogs",
      "path": "catalogs",
      "indexPath": "catalogs/index.json"
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

### Format Support

- Additional markdown variants (CommonMark, GitHub Flavored)
- Support for other documentation formats (AsciiDoc, reStructuredText)
- Custom frontmatter processors
- Binary asset handling and indexing

### Advanced Features

- Incremental processing with change detection
- Parallel processing for improved performance
- Network-based input sources
- Integration with version control systems
- Real-time documentation monitoring
