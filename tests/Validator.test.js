import { Validator } from '../src/Validator.js';

describe('Validator', () => {
  let validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('H1 Validation', () => {
    test('should validate correct H1 heading', () => {
      const content = '# Project Title\n\n> Description';
      expect(validator.hasValidH1(content)).toBe(true);
    });

    test('should reject missing H1', () => {
      const content = '> Description\n\n## Section';
      expect(validator.hasValidH1(content)).toBe(false);
    });

    test('should reject H1 not at start', () => {
      const content = 'Some text\n# Project Title';
      expect(validator.hasValidH1(content)).toBe(false);
    });

    test('should reject empty H1', () => {
      const content = '#\n\n> Description';
      expect(validator.hasValidH1(content)).toBe(false);
    });
  });

  describe('Blockquote Validation', () => {
    test('should validate correct blockquote after H1', () => {
      const content = '# Project Title\n\n> Description of the project';
      expect(validator.hasValidBlockquote(content)).toBe(true);
    });

    test('should reject missing blockquote', () => {
      const content = '# Project Title\n\n## Section';
      expect(validator.hasValidBlockquote(content)).toBe(false);
    });

    test('should reject blockquote without content', () => {
      const content = '# Project Title\n\n>';
      expect(validator.hasValidBlockquote(content)).toBe(false);
    });

    test('should handle whitespace around blockquote', () => {
      const content = '# Project Title\n\n\n> Description\n\n';
      expect(validator.hasValidBlockquote(content)).toBe(true);
    });
  });

  describe('Details Section Validation', () => {
    test('should allow text in details section', () => {
      const content = `# Project Title

> Description

This is context about the project.
More details here.

## First Section

- [file](file.md)`;

      const issues = validator.validateDetailsSection(content);
      expect(issues).toHaveLength(0);
    });

    test('should reject headings in details section', () => {
      const content = `# Project Title

> Description

### Illegal Heading

More details here.

## First Section

- [file](file.md)`;

      const issues = validator.validateDetailsSection(content);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Illegal heading in details section');
    });

    test('should allow headings after first section', () => {
      const content = `# Project Title

> Description

Details here.

## First Section

- [file](file.md)

### This is fine

More content.`;

      const issues = validator.validateDetailsSection(content);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Section Structure Validation', () => {
    test('should validate correct section structure', () => {
      const content = `# Project Title

> Description

## Root

- [file](file.md)

## docs

- [guide](docs/guide.md)

## Optional

- [draft](draft.md)`;

      const issues = validator.validateSections(content);
      expect(issues).toHaveLength(0);
    });

    test('should require at least one non-Optional section', () => {
      const content = `# Project Title

> Description

## Optional

- [draft](draft.md)`;

      const issues = validator.validateSections(content);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toBe('Must have at least one non-Optional section');
    });

    test('should reject multiple Optional sections', () => {
      const content = `# Project Title

> Description

## Root

- [file](file.md)

## Optional

- [draft1](draft1.md)

## Optional

- [draft2](draft2.md)`;

      const issues = validator.validateSections(content);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toBe('Multiple Optional sections found');
    });

    test('should require Optional section to be last', () => {
      const content = `# Project Title

> Description

## Optional

- [draft](draft.md)

## Root

- [file](file.md)`;

      const issues = validator.validateSections(content);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toBe('Optional section must be the last section');
    });
  });

  describe('Link Format Validation', () => {
    test('should validate correct link format', () => {
      const content = `# Project Title

> Description

## Root

- [File Name](file.md)
- [With Notes](file.md): Additional description`;

      const issues = validator.validateLinks(content);
      expect(issues).toHaveLength(0);
    });

    test('should reject invalid link format', () => {
      const content = `# Project Title

> Description

## Root

- Invalid link format
- [Missing URL]
- [](empty-url.md)`;

      const issues = validator.validateLinks(content);
      expect(issues).toHaveLength(3);
      expect(issues[0]).toContain('Invalid link format');
    });

    test('should validate notes format', () => {
      const content = `# Project Title

> Description

## Root

- [File](file.md):Invalid notes format
- [File](file.md): Valid notes format`;

      const issues = validator.validateLinks(content);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain('Invalid notes format');
    });
  });

  describe('Absolute URL Validation', () => {
    test('should validate absolute URLs when base URL provided', () => {
      const content = `# Project Title

> Description

## Root

- [File](https://example.com/file.md)`;

      const result = validator.validateAbsoluteUrls(content, 'https://example.com/');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should reject relative URLs when base URL provided', () => {
      const content = `# Project Title

> Description

## Root

- [File](file.md)`;

      const result = validator.validateAbsoluteUrls(content, 'https://example.com/');
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Relative URL found');
    });

    test('should allow relative URLs when no base URL provided', () => {
      const content = `# Project Title

> Description

## Root

- [File](file.md)`;

      const result = validator.validateAbsoluteUrls(content, null);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Complete Structure Validation', () => {
    test('should validate compliant llms.txt content', () => {
      const content = `# Documentation Hub

> Comprehensive documentation for our platform and APIs.

A few sentences of context about how to use these docs. No extra headings here.

## Root

- [README](README.md): Overview of the project

## docs

- [Getting Started](docs/getting-started.md): Quick intro
- [API Reference](docs/api-reference.md)

## Optional

- [Changelog](docs/CHANGELOG.md)`;

      const result = validator.validateStructure(content);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should identify multiple validation issues', () => {
      const content = `# Documentation Hub

> Valid blockquote here

### Illegal heading in details

## Root

- Invalid link
- [](empty-url.md)

## Optional

- [draft](draft.md)

## After Optional

- [file](file.md)`;

      const result = validator.validateStructure(content);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const issueText = result.issues.join(' ');
      expect(issueText).toContain('Illegal heading');
      expect(issueText).toContain('Optional section must be the last');
      expect(issueText).toContain('Invalid link format');
    });
  });

  describe('URL Checking', () => {
    test('should correctly identify absolute URLs', () => {
      expect(validator.isAbsoluteUrl('https://example.com/file.md')).toBe(true);
      expect(validator.isAbsoluteUrl('http://example.com/file.md')).toBe(true);
      expect(validator.isAbsoluteUrl('file.md')).toBe(false);
      expect(validator.isAbsoluteUrl('./file.md')).toBe(false);
      expect(validator.isAbsoluteUrl('../file.md')).toBe(false);
    });
  });
});