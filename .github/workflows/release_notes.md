# Catalog CLI __VERSION__

A lightweight CLI that scans a directory of Markdown files to generate `llms.txt` (structured index), `llms-full.txt` (full content), and optional `index.json` files for directory navigation and metadata.

## Installation

### Quick Install Script
```bash
curl -fsSL https://raw.githubusercontent.com/${{ github.repository }}/main/install.sh | sh
```

### Manual Downloads

| Platform | Architecture | Download |
|----------|--------------|----------|
| Linux | x86_64 | [catalog-linux-x86_64](https://github.com/${{ github.repository }}/releases/download/${{ steps.release-info.outputs.tag }}/catalog-linux-x86_64) |
| Linux | ARM64 | [catalog-linux-arm64](https://github.com/${{ github.repository }}/releases/download/${{ steps.release-info.outputs.tag }}/catalog-linux-arm64) |
| macOS | Intel | [catalog-darwin-x86_64](https://github.com/${{ github.repository }}/releases/download/${{ steps.release-info.outputs.tag }}/catalog-darwin-x86_64) |
| macOS | Apple Silicon | [catalog-darwin-arm64](https://github.com/${{ github.repository }}/releases/download/${{ steps.release-info.outputs.tag }}/catalog-darwin-arm64) |
| Windows | x86_64 | [catalog-windows-x86_64.exe](https://github.com/${{ github.repository }}/releases/download/${{ steps.release-info.outputs.tag }}/catalog-windows-x86_64.exe) |

> Verify your download using the checksums in `checksums.txt`.

### Docker
```bash
docker run ${{ github.repository }}:${{ steps.release-info.outputs.version }} --help
docker run ${{ github.repository }}:latest --help
```

## Usage

```bash
# Scan current directory, output to current directory
catalog

# Specify input and output directories
catalog --input docs --output build

# Generate index.json files for directory navigation
catalog --input docs --output build --generate-index

# Silent mode
catalog --input docs --output build --silent
```

## Integration with inform

Catalog information seamlessly with [inform](https://github.com/fwdslsh/inform) for complete documentation workflows:

```bash
# Crawl documentation site
inform https://docs.example.com --output-dir docs

# Generate LLMS artifacts
catalog --input docs --output build --generate-index
```
