# Catalog v0.2.0 Release Notes

A comprehensive CLI that scans a directory of Markdown and HTML files to generate `llms.txt` (structured index) and `llms-full.txt` (full content) with advanced PAI (Programmable AI) features, designed for AI-powered documentation workflows and seamless integration with fwdslsh ecosystem.

## 🚀 What's New in Version 0.2.0

Version 0.2.0 is a major release that introduces PAI (Programmable AI) features and configuration file support:

### ✨ Configuration File Support (NEW!)
- **Multiple Formats**: Support for YAML, JSON, and JavaScript configuration files
- **Auto-Discovery**: Automatically detects `catalog.yaml`, `catalog.json`, or `.catalogrc` files
- **Merge Hierarchy**: Intelligent merging of defaults → config file → CLI flags
- **Validation**: Comprehensive configuration validation with helpful error messages
- **Sample Generation**: `--init` flag generates sample configuration files
- **Environment Support**: JavaScript configs enable environment-specific settings

### 🤖 PAI (Programmable AI) Features
- **Document Manifest**: Unique IDs, content hashes, and provenance tracking
- **RAG-Ready Chunks**: Intelligent document splitting with multiple profiles
- **Context Bundles**: Sized bundles for different LLM context windows
- **Semantic Tags**: Content classification for filtering and search
- **Link Graph**: Document relationships and importance scoring
- **MCP Server**: IDE integration for Cursor and Claude Code
- **Source Integration**: Pull documentation from remote sources
- **Per-Pattern Config**: Different settings per file pattern
- **Incremental Builds**: Faster rebuilds with intelligent caching
- **File Watching**: Automatic rebuilds on file changes

### 🔧 Enhanced Core Features
- **AST Index Generation**: Project-wide code structure analysis
- **Performance Monitoring**: Real-time memory and timing tracking
- **Security Enhancements**: Path validation and content scanning
- **Error Handling**: Actionable error messages with recovery suggestions

## Usage

```bash
# Scan current directory, output to current directory
catalog

# Specify input and output directories
catalog --input docs --output build

# Use configuration file (NEW in v0.2.0)
catalog --config catalog.yaml

# Generate sample configuration file
catalog --init > catalog.yaml

# Generate index.json files for directory navigation
catalog --input docs --output build --generate-index

# Silent mode
catalog --input docs --output build --silent
```

## Configuration File Support (NEW in v0.2.0)

Version 0.2.0 introduces comprehensive configuration file support, making it easier to maintain consistent settings across projects:

### Supported Formats
- **YAML** (`catalog.yaml`) - Recommended format with full comment support
- **JSON** (`catalog.json`) - Standard JSON format
- **JavaScript** (`catalog.config.js`) - Dynamic configuration with environment variables
- **RC Files** (`.catalogrc`, `.catalogrc.json`, `.catalogrc.yaml`) - Dotfile variants

### Key Features
- **Auto-discovery**: Automatically finds configuration files in current directory
- **Merge hierarchy**: Defaults → Config file → CLI flags (CLI overrides file settings)
- **Validation**: Comprehensive validation with helpful error messages
- **Environment support**: JavaScript configs support environment-specific settings
- **Sample generation**: `--init` flag generates sample configuration

### Example Configuration
```yaml
# catalog.yaml
input: ./docs
output: ./build
base-url: https://docs.example.com/

# Content patterns
include: ["**/*.md", "**/*.html"]
exclude: ["**/drafts/**"]
optional: ["**/changelog.md"]

# PAI features (NEW in v0.2.0)
generate-manifest: true
generate-chunks: true
chunk-profile: default
generate-tags: true
generate-graph: true
generate-bundles: true

# Performance and caching
enable-cache: true
continue-on-error: true
```

## Integration with inform

Catalog information seamlessly with [inform](https://github.com/fwdslsh/inform) for complete documentation workflows:

```bash
# Crawl documentation site
inform https://docs.example.com --output-dir docs

# Generate LLMS artifacts with configuration file
catalog --input docs --output build --config catalog.yaml
```
