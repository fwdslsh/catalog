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

  // ==========================================
  // AI READINESS VALIDATION TESTS
  // ==========================================

  describe('SECRET_PATTERNS', () => {
    test('should have common secret patterns defined', () => {
      expect(Validator.SECRET_PATTERNS.length).toBeGreaterThan(0);
      expect(Validator.SECRET_PATTERNS.find(p => p.name === 'AWS Access Key')).toBeDefined();
      expect(Validator.SECRET_PATTERNS.find(p => p.name === 'GitHub Token')).toBeDefined();
      expect(Validator.SECRET_PATTERNS.find(p => p.name === 'API Key Pattern')).toBeDefined();
    });
  });

  describe('PII_PATTERNS', () => {
    test('should have PII patterns defined', () => {
      expect(Validator.PII_PATTERNS.length).toBeGreaterThan(0);
      expect(Validator.PII_PATTERNS.find(p => p.name === 'Email Address')).toBeDefined();
      expect(Validator.PII_PATTERNS.find(p => p.name === 'Phone Number (US)')).toBeDefined();
    });
  });

  describe('validateCodeFences', () => {
    test('should detect unclosed code fences', () => {
      const doc = {
        relativePath: 'test.md',
        content: '```javascript\nconst x = 1;\n// no closing fence'
      };

      const issues = validator.validateCodeFences(doc);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('unclosed_code_fence');
      expect(issues[0].severity).toBe('error');
    });

    test('should pass valid code fences', () => {
      const doc = {
        relativePath: 'test.md',
        content: '```javascript\nconst x = 1;\n```\n\nMore text.'
      };

      const issues = validator.validateCodeFences(doc);
      const errors = issues.filter(i => i.type === 'unclosed_code_fence');
      expect(errors).toHaveLength(0);
    });

    test('should handle nested code blocks', () => {
      const doc = {
        relativePath: 'test.md',
        content: '```markdown\nSome markdown with `inline` code\n```'
      };

      const issues = validator.validateCodeFences(doc);
      const errors = issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('should detect unusual indentation', () => {
      const doc = {
        relativePath: 'test.md',
        content: '    ```javascript\nconst x = 1;\n    ```'
      };

      const issues = validator.validateCodeFences(doc);
      expect(issues.some(i => i.type === 'code_fence_indentation')).toBe(true);
    });
  });

  describe('validateInternalLinks', () => {
    test('should detect broken internal links', () => {
      const doc = {
        relativePath: 'docs/guide.md',
        content: 'See [missing doc](missing.md) for more.'
      };

      const docPaths = new Set(['docs/guide.md', 'docs/api.md']);
      const issues = validator.validateInternalLinks(doc, docPaths);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('broken_internal_link');
    });

    test('should skip external links', () => {
      const doc = {
        relativePath: 'test.md',
        content: 'See [external](https://example.com) for more.'
      };

      const docPaths = new Set(['test.md']);
      const issues = validator.validateInternalLinks(doc, docPaths);

      expect(issues).toHaveLength(0);
    });

    test('should skip anchor links', () => {
      const doc = {
        relativePath: 'test.md',
        content: 'See [section](#heading) below.'
      };

      const docPaths = new Set(['test.md']);
      const issues = validator.validateInternalLinks(doc, docPaths);

      expect(issues).toHaveLength(0);
    });

    test('should validate relative paths correctly', () => {
      const doc = {
        relativePath: 'docs/guide.md',
        content: 'See [api](api.md) for more.'
      };

      const docPaths = new Set(['docs/guide.md', 'docs/api.md']);
      const issues = validator.validateInternalLinks(doc, docPaths);

      expect(issues).toHaveLength(0);
    });
  });

  describe('resolveRelativePath', () => {
    test('should resolve relative paths from source directory', () => {
      expect(validator.resolveRelativePath('api.md', 'docs/guide.md')).toBe('docs/api.md');
      expect(validator.resolveRelativePath('./api.md', 'docs/guide.md')).toBe('docs/api.md');
    });

    test('should handle parent directory references', () => {
      expect(validator.resolveRelativePath('../api.md', 'docs/sub/guide.md')).toBe('docs/api.md');
    });

    test('should handle root-level sources', () => {
      expect(validator.resolveRelativePath('api.md', 'guide.md')).toBe('api.md');
    });

    test('should strip anchors', () => {
      expect(validator.resolveRelativePath('api.md#section', 'docs/guide.md')).toBe('docs/api.md');
    });
  });

  describe('pathExists', () => {
    test('should find exact path', () => {
      const paths = new Set(['docs/api.md', 'guide.md']);
      expect(validator.pathExists('docs/api.md', paths)).toBe(true);
    });

    test('should try adding .md extension', () => {
      const paths = new Set(['docs/api.md']);
      expect(validator.pathExists('docs/api', paths)).toBe(true);
    });

    test('should try index.md', () => {
      const paths = new Set(['docs/index.md']);
      expect(validator.pathExists('docs', paths)).toBe(true);
    });

    test('should return false for non-existent paths', () => {
      const paths = new Set(['docs/api.md']);
      expect(validator.pathExists('missing', paths)).toBe(false);
    });
  });

  describe('detectRedundancy', () => {
    test('should detect duplicate content', () => {
      const docs = [
        { relativePath: 'a.md', content: 'Same content here', metadata: {} },
        { relativePath: 'b.md', content: 'Same content here', metadata: {} }
      ];

      const issues = validator.detectRedundancy(docs);
      expect(issues.some(i => i.type === 'duplicate_content')).toBe(true);
    });

    test('should detect duplicate titles', () => {
      const docs = [
        { relativePath: 'a.md', content: 'Content A', metadata: { title: 'Getting Started' } },
        { relativePath: 'b.md', content: 'Content B', metadata: { title: 'getting started' } }
      ];

      const issues = validator.detectRedundancy(docs);
      expect(issues.some(i => i.type === 'duplicate_title')).toBe(true);
    });

    test('should detect repeated section headings', () => {
      const docs = Array(6).fill(null).map((_, i) => ({
        relativePath: `doc${i}.md`,
        content: '# Welcome\n\nSome intro.\n\n## Getting Started\n\nContent.',
        metadata: {}
      }));

      const issues = validator.detectRedundancy(docs);
      expect(issues.some(i => i.type === 'repeated_section')).toBe(true);
    });

    test('should not flag unique content', () => {
      const docs = [
        { relativePath: 'a.md', content: 'Unique content A', metadata: { title: 'A' } },
        { relativePath: 'b.md', content: 'Different content B', metadata: { title: 'B' } }
      ];

      const issues = validator.detectRedundancy(docs);
      expect(issues.filter(i => i.type === 'duplicate_content')).toHaveLength(0);
    });
  });

  describe('scanForSecrets', () => {
    test('should detect AWS access keys', () => {
      const doc = {
        relativePath: 'config.md',
        content: 'Use AKIAIOSFODNN7EXAMPLE for testing'
      };

      const issues = validator.scanForSecrets(doc);
      expect(issues.some(i => i.secret_type === 'AWS Access Key')).toBe(true);
    });

    test('should detect GitHub tokens', () => {
      const doc = {
        relativePath: 'auth.md',
        content: 'Token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      };

      const issues = validator.scanForSecrets(doc);
      expect(issues.some(i => i.secret_type === 'GitHub Token')).toBe(true);
    });

    test('should skip example patterns', () => {
      const doc = {
        relativePath: 'docs.md',
        content: 'Use example@example.com for testing'
      };

      const issues = validator.scanForSecrets(doc);
      // Should not flag example.com emails
      expect(issues.filter(i => i.pii_type === 'Email Address')).toHaveLength(0);
    });

    test('should skip patterns in code blocks for PII', () => {
      const doc = {
        relativePath: 'example.md',
        content: '```\nemail: user@test.com\n```'
      };

      const issues = validator.scanForSecrets(doc);
      expect(issues.filter(i => i.type === 'potential_pii')).toHaveLength(0);
    });

    test('should skip documentation about secret detection', () => {
      const doc = {
        relativePath: 'security.md',
        content: 'This guide explains secret patterns and how to avoid them.'
      };

      const issues = validator.scanForSecrets(doc);
      expect(issues).toHaveLength(0);
    });
  });

  describe('isLikelyExample', () => {
    test('should identify placeholder patterns', () => {
      expect(validator.isLikelyExample('your_api_key')).toBe(true);
      expect(validator.isLikelyExample('test_token_123')).toBe(true);
      expect(validator.isLikelyExample('example@example.com')).toBe(true);
      expect(validator.isLikelyExample('localhost')).toBe(true);
      expect(validator.isLikelyExample('127.0.0.1')).toBe(true);
    });

    test('should not flag real-looking values', () => {
      expect(validator.isLikelyExample('sk-ant-api03-real')).toBe(false);
      expect(validator.isLikelyExample('user@company.com')).toBe(false);
    });
  });

  describe('maskSecret', () => {
    test('should mask secrets preserving length info', () => {
      const masked = validator.maskSecret('AKIAIOSFODNN7EXAMPLE');
      expect(masked).toContain('AKIA');
      expect(masked).toContain('****');
      expect(masked.length).toBe(20);
    });

    test('should fully mask short secrets', () => {
      const masked = validator.maskSecret('short');
      expect(masked).toBe('*****');
    });
  });

  describe('validateChunkQuality', () => {
    test('should flag small chunks', () => {
      const chunks = [
        { chunk_id: '1', source_path: 'test.md', content: 'Small', token_count: 20 }
      ];

      const issues = validator.validateChunkQuality(chunks);
      expect(issues.some(i => i.type === 'chunk_too_small')).toBe(true);
    });

    test('should flag large chunks', () => {
      const chunks = [
        { chunk_id: '1', source_path: 'test.md', content: 'x'.repeat(10000), token_count: 5000 }
      ];

      const issues = validator.validateChunkQuality(chunks);
      expect(issues.some(i => i.type === 'chunk_too_large')).toBe(true);
    });

    test('should flag code-only chunks', () => {
      const chunks = [
        {
          chunk_id: '1',
          source_path: 'test.md',
          content: '```js\nconst x = 1;\n```',
          token_count: 100,
          has_code: true
        }
      ];

      const issues = validator.validateChunkQuality(chunks);
      expect(issues.some(i => i.type === 'chunk_missing_explanation')).toBe(true);
    });

    test('should pass well-sized chunks with explanation', () => {
      const chunks = [
        {
          chunk_id: '1',
          source_path: 'test.md',
          content: 'This is a detailed explanation of how to use the API.\n\n```js\nconst x = 1;\n```\n\nMore explanation here with many words.',
          token_count: 200,
          has_code: true
        }
      ];

      const issues = validator.validateChunkQuality(chunks);
      expect(issues.filter(i => i.type === 'chunk_missing_explanation')).toHaveLength(0);
    });
  });

  describe('calculateBoilerplateRatio', () => {
    test('should calculate boilerplate ratio', () => {
      const content = 'Click here for more information. See also the other docs. Read more about it.';
      const ratio = validator.calculateBoilerplateRatio(content);
      expect(ratio).toBeGreaterThan(0);
    });

    test('should return low ratio for unique content', () => {
      const content = 'This is unique technical documentation about the specific API implementation.';
      const ratio = validator.calculateBoilerplateRatio(content);
      expect(ratio).toBeLessThan(0.2);
    });
  });

  describe('hasExplanation', () => {
    test('should return true for content with text', () => {
      const content = 'Here is some explanatory text that describes what the code does.\n\n```js\ncode\n```';
      expect(validator.hasExplanation(content)).toBe(true);
    });

    test('should return false for code-only content', () => {
      const content = '```js\nconst x = 1;\n```';
      expect(validator.hasExplanation(content)).toBe(false);
    });
  });

  describe('generateRecommendations', () => {
    test('should generate high priority for unclosed code fences', () => {
      const report = {
        code_fence_issues: [{ type: 'unclosed_code_fence' }],
        security_issues: [],
        link_issues: [],
        redundancy_issues: [],
        chunk_quality_issues: []
      };

      const recs = validator.generateRecommendations(report);
      expect(recs.some(r => r.priority === 'high' && r.category === 'code_quality')).toBe(true);
    });

    test('should generate critical priority for secrets', () => {
      const report = {
        code_fence_issues: [],
        security_issues: [{ type: 'potential_secret' }],
        link_issues: [],
        redundancy_issues: [],
        chunk_quality_issues: []
      };

      const recs = validator.generateRecommendations(report);
      expect(recs.some(r => r.priority === 'critical' && r.category === 'security')).toBe(true);
    });

    test('should generate medium priority for broken links', () => {
      const report = {
        code_fence_issues: [],
        security_issues: [],
        link_issues: [{ type: 'broken_internal_link' }],
        redundancy_issues: [],
        chunk_quality_issues: []
      };

      const recs = validator.generateRecommendations(report);
      expect(recs.some(r => r.priority === 'medium' && r.category === 'content_quality')).toBe(true);
    });
  });

  describe('validateAIReadiness', () => {
    test('should return comprehensive report', async () => {
      const docs = [
        { relativePath: 'test.md', content: 'Valid content here.', metadata: {} }
      ];

      const report = await validator.validateAIReadiness(docs);

      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.documents_checked).toBe(1);
      expect(report.code_fence_issues).toBeDefined();
      expect(report.link_issues).toBeDefined();
      expect(report.security_issues).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should check internal links when docPaths provided', async () => {
      const docs = [
        { relativePath: 'test.md', content: 'See [missing](missing.md).', metadata: {} }
      ];

      const report = await validator.validateAIReadiness(docs, {
        docPaths: new Set(['test.md'])
      });

      expect(report.link_issues.length).toBeGreaterThan(0);
    });

    test('should validate chunks when provided', async () => {
      const docs = [{ relativePath: 'test.md', content: 'Content', metadata: {} }];
      const chunks = [
        { chunk_id: '1', source_path: 'test.md', content: 'x', token_count: 10 }
      ];

      const report = await validator.validateAIReadiness(docs, { chunks });

      expect(report.chunk_quality_issues.length).toBeGreaterThan(0);
    });

    test('should set valid to false when errors found', async () => {
      const docs = [
        {
          relativePath: 'test.md',
          content: '```js\nunclosed code block',
          metadata: {}
        }
      ];

      const report = await validator.validateAIReadiness(docs);

      expect(report.valid).toBe(false);
      expect(report.summary.errors).toBeGreaterThan(0);
    });
  });

  describe('simpleHash', () => {
    test('should generate consistent hash', () => {
      const hash1 = validator.simpleHash('test content');
      const hash2 = validator.simpleHash('test content');
      expect(hash1).toBe(hash2);
    });

    test('should generate different hash for different content', () => {
      const hash1 = validator.simpleHash('content a');
      const hash2 = validator.simpleHash('content b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isInCodeBlock', () => {
    test('should detect position in code block', () => {
      const content = 'Before ```code block``` after';
      expect(validator.isInCodeBlock(content, 10)).toBe(true);
      expect(validator.isInCodeBlock(content, 25)).toBe(false);
    });
  });
});