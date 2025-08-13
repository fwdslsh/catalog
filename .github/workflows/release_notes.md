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
