# Contributing to Catalog

Thank you for your interest in contributing to Catalog! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Format](#commit-message-format)
- [Documentation](#documentation)
- [Security Vulnerability Reporting](#security-vulnerability-reporting)
- [Getting Help](#getting-help)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, background, or identity.

### Expected Behavior

- Be respectful and considerate in all interactions
- Provide constructive feedback
- Focus on what is best for the project and community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or insulting/derogatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

- **Bun** >= 1.0.0 ([Install Bun](https://bun.sh))
- **Git** for version control
- A code editor (VS Code, Cursor, etc.)

### Quick Start

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/catalog.git
cd catalog

# Install dependencies
bun install

# Run tests to verify setup
bun test

# Run in development mode
bun dev
```

---

## Development Setup

### 1. Fork the Repository

Click the "Fork" button on the [Catalog repository](https://github.com/fwdslsh/catalog) to create your own copy.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/catalog.git
cd catalog
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/fwdslsh/catalog.git
```

### 4. Install Dependencies

```bash
# Install all project dependencies
bun install
```

**Important:** Always run `bun install` after:
- Cloning the repository
- Pulling updates from upstream
- Switching branches
- Merging changes

Dependencies include:
- `glob` - File pattern matching
- `minimatch` - Glob pattern utility
- `turndown` - HTML to Markdown conversion

### 5. Verify Installation

```bash
# Check Bun version
bun --version

# Run tests
bun test

# Run CLI
bun src/cli.js --help
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a new branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Branch Naming Conventions

- `feature/` - New features (e.g., `feature/add-pdf-support`)
- `fix/` - Bug fixes (e.g., `fix/path-traversal-issue`)
- `docs/` - Documentation changes (e.g., `docs/update-readme`)
- `test/` - Test additions/fixes (e.g., `test/add-security-tests`)
- `refactor/` - Code refactoring (e.g., `refactor/simplify-processor`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### 2. Make Your Changes

- Write clean, readable code following our style guidelines
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/YourTest.test.js

# Run in watch mode during development
bun test:watch

# Manual testing
bun src/cli.js --input tests/fixtures/test-docs --output /tmp/test-output
```

### 4. Commit Your Changes

Follow our [commit message format](#commit-message-format).

```bash
git add .
git commit -m "feat: add support for PDF files"
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

Go to the [Catalog repository](https://github.com/fwdslsh/catalog) and click "New Pull Request".

---

## Code Style Guidelines

### General Principles

- **SOLID Principles**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
- **Clean Code**: Write self-documenting code with clear variable and function names
- **DRY**: Don't Repeat Yourself - extract common logic into reusable functions
- **KISS**: Keep It Simple, Stupid - prefer simplicity over cleverness

### ES Modules

```javascript
// ✅ Good - Use ES module syntax
import { readFile } from 'fs/promises';
import { join } from 'path';

export class MyClass {
  // ...
}

export function myFunction() {
  // ...
}

// ❌ Avoid - Don't use CommonJS
const fs = require('fs');
module.exports = MyClass;
```

### Naming Conventions

```javascript
// Classes: PascalCase
class ContentProcessor { }
class DirectoryScanner { }

// Functions and Variables: camelCase
function processFiles() { }
const fileCount = 10;

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_EXTENSIONS = ['.md', '.html'];

// Private Methods: prefix with underscore (convention)
class MyClass {
  _privateHelper() { }
  publicMethod() { }
}
```

### Code Formatting

```javascript
// Indentation: 2 spaces (no tabs)
function example() {
  if (condition) {
    doSomething();
  }
}

// Strings: Prefer single quotes for strings, backticks for templates
const name = 'Catalog';
const message = `Processing ${count} files`;

// Line Length: Prefer < 100 characters, max 120
// Break long lines logically

// Trailing Commas: Use in multi-line arrays/objects
const options = {
  input: '.',
  output: '.',
  validate: true,  // trailing comma
};
```

### Error Handling

```javascript
// ✅ Good - Use specific error types
throw new InvalidInputError('Path does not exist', { path });

// ✅ Good - Provide context and recovery suggestions
catch (error) {
  const catalogError = categorizeError(error);
  console.error(catalogError.getActionableMessage());
}

// ❌ Avoid - Generic errors without context
throw new Error('Something went wrong');
```

### Async/Await

```javascript
// ✅ Good - Use async/await
async function processFiles(files) {
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    // process content
  }
}

// ✅ Good - Handle errors properly
async function safeProcess() {
  try {
    await processFiles(files);
  } catch (error) {
    handleError(error);
  }
}

// ❌ Avoid - Callback hell
readFile(file, (err, data) => {
  if (err) return callback(err);
  processData(data, (err, result) => {
    // nested callbacks
  });
});
```

### Comments

```javascript
// ✅ Good - Explain WHY, not WHAT
// Strip frontmatter to avoid duplication in output
const content = this.stripFrontmatter(fileContent);

// ✅ Good - Document complex logic
/**
 * Apply optional patterns to move matching files to Optional section
 *
 * @param {Map} sections - Document sections organized by path
 * @param {string[]} optionalPatterns - Glob patterns for optional content
 * @returns {{regularSections: Map, optionalDocs: Array}}
 */
applyOptionalPatterns(sections, optionalPatterns) {
  // ...
}

// ❌ Avoid - Stating the obvious
// Increment counter by 1
counter++;
```

---

## Testing Requirements

### Test Coverage Expectations

- **Minimum Coverage**: 90% for all new code
- **Test Types**: Unit tests, integration tests, security tests
- **Test All Edge Cases**: Success cases, error cases, boundary conditions

### Test Structure

```javascript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { YourClass } from '../src/YourClass.js';

describe('YourClass', () => {
  let instance;

  beforeEach(() => {
    instance = new YourClass();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('yourMethod', () => {
    test('should handle normal input correctly', () => {
      const result = instance.yourMethod('input');
      expect(result).toBe('expected');
    });

    test('should throw error for invalid input', () => {
      expect(() => instance.yourMethod(null)).toThrow(InvalidInputError);
    });

    test('should handle edge case', () => {
      const result = instance.yourMethod('');
      expect(result).toBe('');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/ContentProcessor.test.js

# Run tests in watch mode
bun test:watch

# Run tests with coverage (if configured)
bun test --coverage
```

### Writing Good Tests

```javascript
// ✅ Good - Clear, descriptive test names
test('should extract title from frontmatter when present', () => {
  // ...
});

test('should throw InvalidInputError when path contains .. sequence', () => {
  // ...
});

// ✅ Good - Arrange, Act, Assert pattern
test('should process HTML files correctly', () => {
  // Arrange
  const htmlContent = '<html><body><h1>Title</h1></body></html>';
  const processor = new ContentProcessor('.');

  // Act
  const result = processor.convertHtmlToMarkdown(htmlContent);

  // Assert
  expect(result).toContain('# Title');
});

// ❌ Avoid - Vague test names
test('it works', () => {
  // ...
});

// ❌ Avoid - Testing too much in one test
test('should do everything', () => {
  // testing 10 different things
});
```

### Test Files Organization

- Place tests in `tests/` directory
- Name test files: `SourceFile.test.js`
- Example: `src/ContentProcessor.js` → `tests/ContentProcessor.test.js`
- Use `tests/fixtures/` for test data files

---

## Pull Request Process

### Before Creating a PR

- [ ] All tests pass locally (`bun test`)
- [ ] Code follows style guidelines
- [ ] New code has tests (>90% coverage)
- [ ] Documentation updated (README, JSDoc, etc.)
- [ ] Commit messages follow format
- [ ] Branch is up to date with main

### Creating a PR

1. **Title**: Clear, concise description
   - Good: "feat: add PDF file processing support"
   - Good: "fix: resolve path traversal vulnerability in scanner"
   - Bad: "Update code"

2. **Description**: Use the PR template (if provided) and include:
   - **Summary**: What does this PR do?
   - **Motivation**: Why is this change needed?
   - **Changes**: List of specific changes made
   - **Testing**: How was this tested?
   - **Screenshots**: If UI changes (not applicable for CLI)
   - **Checklist**: Confirm requirements met

3. **Link Issues**: Reference related issues
   - "Fixes #123"
   - "Closes #456"
   - "Related to #789"

### PR Review Process

1. **Automated Checks**: CI/CD runs tests automatically
2. **Code Review**: Maintainers review your code
3. **Feedback**: Address review comments
4. **Approval**: PR must be approved before merging
5. **Merge**: Maintainer will merge when ready

### Responding to Reviews

- Be open to feedback and constructive criticism
- Ask questions if you don't understand feedback
- Make requested changes promptly
- Push additional commits to the same branch
- Don't force-push after review has started

---

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear, structured commit history.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or fixing tests
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `chore`: Maintenance tasks (dependencies, build, etc.)
- `ci`: CI/CD changes
- `style`: Code style changes (formatting, etc.)

### Scope (Optional)

- Component affected: `cli`, `processor`, `scanner`, `validator`, etc.

### Subject

- Imperative mood: "add feature" not "added feature"
- Lowercase first letter
- No period at the end
- Max 72 characters

### Examples

```bash
# Feature
git commit -m "feat: add support for PDF file processing"

# Bug fix
git commit -m "fix: resolve path traversal vulnerability in DirectoryScanner"

# Documentation
git commit -m "docs: update README with new CLI options"

# Test
git commit -m "test: add security tests for path validation"

# Refactor
git commit -m "refactor: extract metadata extraction into separate method"

# With body and footer
git commit -m "feat: add sitemap generation

Implements XML sitemap generation with SEO optimization:
- Intelligent priority assignment based on content type
- Change frequency detection from file modification times
- URL validation and proper XML encoding

Closes #42"
```

---

## Documentation

### Code Documentation

- Add JSDoc comments to all public methods
- Document parameters, return values, and exceptions
- Provide examples for complex functions

```javascript
/**
 * Process a list of file paths into document objects
 *
 * @param {string[]} filePaths - Array of absolute file paths to process
 * @returns {Promise<Document[]>} Array of processed document objects with metadata
 * @throws {FileAccessError} If files cannot be read
 *
 * @example
 * const docs = await processor.processFiles(['/path/to/file.md']);
 * console.log(docs[0].content); // Processed content without frontmatter
 */
async processFiles(filePaths) {
  // ...
}
```

### README Updates

Update README.md when adding:
- New CLI options
- New features
- New installation methods
- Breaking changes

### CHANGELOG Updates

- Don't update CHANGELOG.md in your PR
- Maintainers will update it during release

---

## Security Vulnerability Reporting

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead:
1. Email security contact (if provided in README)
2. Or create a private security advisory on GitHub
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Responsible Disclosure

- Allow maintainers time to fix (typically 90 days)
- Don't publicly disclose until fix is released
- Coordinate disclosure timing with maintainers

### Security Best Practices

When contributing code:
- Validate all user inputs
- Prevent path traversal attacks
- Avoid command injection vulnerabilities
- Don't expose sensitive data in logs
- Follow OWASP Top 10 guidelines

---

## Getting Help

### Questions About Contributing

- **GitHub Discussions**: Ask questions in [Discussions](https://github.com/fwdslsh/catalog/discussions)
- **Issues**: Search existing issues for similar questions
- **README**: Check the main README for usage documentation
- **CLAUDE.md**: Review for architecture details

### Issues

- **Bug Reports**: Use the bug report template
- **Feature Requests**: Use the feature request template
- **Questions**: Use GitHub Discussions instead

### Contact

- **GitHub**: [@fwdslsh](https://github.com/fwdslsh)
- **Issues**: https://github.com/fwdslsh/catalog/issues

---

## Development Tips

### Useful Commands

```bash
# Run in development mode with auto-reload
bun dev

# Build for all platforms
bun build:all

# Build for current platform only
bun build

# Clean build artifacts
bun clean

# Full release preparation (clean, test, build all)
bun release:prepare

# Docker build and test
bun docker:build
bun docker:test
```

### Debugging

```bash
# Run CLI with Bun debugger
bun --inspect src/cli.js --input test-docs

# Add console.log statements (remove before committing)
console.log('Debug:', variable);

# Use the debugger statement
debugger;
```

### Testing Specific Scenarios

```bash
# Test with minimal fixture
bun src/cli.js --input tests/fixtures/test-docs --output /tmp/test-out

# Test with validation
bun src/cli.js --input tests/fixtures/test-docs --validate

# Test with all options
bun src/cli.js \
  --input tests/fixtures/test-docs \
  --output /tmp/test-out \
  --base-url https://example.com \
  --optional "drafts/**" \
  --sitemap \
  --validate \
  --index
```

---

## CI/CD Information

### Automated Testing

- Tests run automatically on all pull requests
- Must pass before PR can be merged
- Workflow: `.github/workflows/test.yml`

### Dependencies

- Workflow automatically runs `bun install` before tests
- Includes dependency caching for performance
- Uses reusable workflow from `fwdslsh/toolkit`

### Build Process

- Multi-platform builds run on release tags
- Creates binaries for Linux, macOS, Windows
- Publishes Docker images and NPM packages
- Workflow: `.github/workflows/release.yml`

---

## License

By contributing to Catalog, you agree that your contributions will be licensed under the CC-BY-4.0 License.

---

## Thank You!

Thank you for contributing to Catalog! Your efforts help make this project better for everyone. 🎉
