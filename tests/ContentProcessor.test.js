import { ContentProcessor } from '../src/ContentProcessor.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('ContentProcessor', () => {
  const testDir = './tests/markdown_test';
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    
    // Create test markdown files with various content
    await writeFile(join(testDir, 'index.md'), '---\ntitle: Index\ndate: 2023-01-01\n---\n\n# Index\nIndex content');
    await writeFile(join(testDir, 'readme.md'), '# Readme\nReadme content');
    await writeFile(join(testDir, 'catalog.md'), '# Catalog\nCatalog content');
    await writeFile(join(testDir, 'tutorial.md'), '---\nauthor: Test\n---\n# Tutorial\nTutorial content');
    await writeFile(join(testDir, 'getting-started.md'), '# Getting Started\nGetting started content');
    await writeFile(join(testDir, 'reference.md'), '# Reference\nReference content');
    await writeFile(join(testDir, 'other.md'), '# Other\nOther content');
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Site Metadata Extraction', () => {
    test('should extract metadata from markdown frontmatter', () => {
      const processor = new ContentProcessor(testDir);
      const content = `---
title: "My Documentation Site"
description: "Comprehensive docs for our platform"
instructions: "Use these docs to learn about our APIs"
---

# Welcome

This is the content.`;

      const metadata = processor.extractFromMarkdownFrontmatter(content);
      
      expect(metadata.title).toBe('My Documentation Site');
      expect(metadata.description).toBe('Comprehensive docs for our platform');
      expect(metadata.instructions).toBe('Use these docs to learn about our APIs');
    });

    test('should return defaults when no frontmatter found', () => {
      const processor = new ContentProcessor(testDir);
      const content = `# Welcome

This is the content without frontmatter.`;

      const metadata = processor.extractFromMarkdownFrontmatter(content);
      
      expect(metadata.title).toBe('markdown_test');
      expect(metadata.description).toBe('Documentation and resources for markdown_test.');
      expect(metadata.instructions).toBe(null);
    });

    test('should extract metadata from HTML meta tags', () => {
      const processor = new ContentProcessor(testDir);
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>HTML Documentation Site</title>
  <meta name="description" content="Comprehensive HTML docs">
  <meta name="instructions" content="Learn about our HTML APIs">
</head>
<body>
  <h1>Welcome</h1>
</body>
</html>`;

      const metadata = processor.extractFromHtmlMeta(htmlContent);
      
      expect(metadata.title).toBe('HTML Documentation Site');
      expect(metadata.description).toBe('Comprehensive HTML docs');
      expect(metadata.instructions).toBe('Learn about our HTML APIs');
    });

    test('should return defaults when no HTML meta tags found', () => {
      const processor = new ContentProcessor(testDir);
      const htmlContent = `<!DOCTYPE html>
<html>
<body>
  <h1>Welcome</h1>
</body>
</html>`;

      const metadata = processor.extractFromHtmlMeta(htmlContent);
      
      expect(metadata.title).toBe('markdown_test');
      expect(metadata.description).toBe('Documentation and resources for markdown_test.');
      expect(metadata.instructions).toBe(null);
    });

    test('should find root index file in priority order', async () => {
      const processor = new ContentProcessor(testDir);
      
      // Create test files
      await writeFile(join(testDir, 'index.html'), '<html><title>HTML Index</title></html>');
      await writeFile(join(testDir, 'index.mdx'), '---\ntitle: MDX Index\n---\n# MDX');
      
      const rootFile = await processor.findRootIndexFile();
      expect(rootFile).toBe(join(testDir, 'index.md')); // Should prioritize .md over others
      
      // Clean up
      await rm(join(testDir, 'index.html'));
      await rm(join(testDir, 'index.mdx'));
    });

    test('should extract site metadata from existing index file', async () => {
      const processor = new ContentProcessor(testDir);
      
      const metadata = await processor.extractSiteMetadata();
      
      // Should use the index.md file we created in beforeAll
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();
    });
  });

  describe('Section Generation', () => {
    test('should generate sections based on file paths', () => {
      const processor = new ContentProcessor(testDir);
      const documents = [
        { relativePath: 'index.md', content: 'Index content' },
        { relativePath: 'docs/guide.md', content: 'Guide content' },
        { relativePath: 'docs/tutorial.md', content: 'Tutorial content' },
        { relativePath: 'api/reference.md', content: 'API content' },
        { relativePath: 'README.md', content: 'README content' }
      ];

      const sections = processor.generateSections(documents);
      
      expect(sections.has('Root')).toBe(true);
      expect(sections.has('docs')).toBe(true);
      expect(sections.has('api')).toBe(true);
      
      expect(sections.get('Root')).toHaveLength(2); // index.md and README.md
      expect(sections.get('docs')).toHaveLength(2);
      expect(sections.get('api')).toHaveLength(1);
    });

    test('should get first path segment correctly', () => {
      const processor = new ContentProcessor(testDir);
      
      expect(processor.getFirstPathSegment('index.md')).toBe('Root');
      expect(processor.getFirstPathSegment('docs/guide.md')).toBe('docs');
      expect(processor.getFirstPathSegment('api/v1/reference.md')).toBe('api');
    });

    test('should apply optional patterns correctly', () => {
      const processor = new ContentProcessor(testDir);
      const sections = new Map([
        ['Root', [{ relativePath: 'README.md' }]],
        ['docs', [
          { relativePath: 'docs/guide.md' },
          { relativePath: 'docs/draft.md' }
        ]],
        ['api', [{ relativePath: 'api/reference.md' }]]
      ]);

      const result = processor.applyOptionalPatterns(sections, ['**/draft.md']);
      
      expect(result.regularSections.get('docs')).toHaveLength(1);
      expect(result.regularSections.get('docs')[0].relativePath).toBe('docs/guide.md');
      expect(result.optionalDocs).toHaveLength(1);
      expect(result.optionalDocs[0].relativePath).toBe('docs/draft.md');
    });

    test('should match optional patterns correctly', () => {
      const processor = new ContentProcessor(testDir);
      
      expect(processor.matchesOptionalPattern('docs/draft.md', ['**/draft.md'])).toBe(true);
      expect(processor.matchesOptionalPattern('docs/guide.md', ['**/draft.md'])).toBe(false);
      expect(processor.matchesOptionalPattern('draft/file.md', ['draft/**'])).toBe(true);
    });
  });

  test('constructs with correct input directory', () => {
    const processor = new ContentProcessor(testDir);
    expect(processor.inputDir).toBe(testDir);
  });

  test('constructs with silent option', () => {
    const processor = new ContentProcessor(testDir, { silent: true });
    expect(processor.silent).toBe(true);
  });

  test('stripFrontmatter removes YAML frontmatter', () => {
    const processor = new ContentProcessor(testDir);
    
    const withFrontmatter = '---\ntitle: Test\ndate: 2023-01-01\n---\n\n# Content\nTest content';
    const withoutFrontmatter = '# Content\nTest content';
    
    expect(processor.stripFrontmatter(withFrontmatter)).toBe(withoutFrontmatter);
  });

  test('stripFrontmatter handles content without frontmatter', () => {
    const processor = new ContentProcessor(testDir);
    
    const content = '# Content\nTest content';
    expect(processor.stripFrontmatter(content)).toBe(content);
  });

  test('stripFrontmatter handles empty content', () => {
    const processor = new ContentProcessor(testDir);
    
    expect(processor.stripFrontmatter('')).toBe('');
  });

  test('stripFrontmatter handles frontmatter only', () => {
    const processor = new ContentProcessor(testDir);
    
    const frontmatterOnly = '---\ntitle: Test\n---\n';
    expect(processor.stripFrontmatter(frontmatterOnly)).toBe('');
  });

  test('stripFrontmatter handles malformed frontmatter', () => {
    const processor = new ContentProcessor(testDir);
    
    const malformed = '---\ntitle: Test\n# Content without closing frontmatter';
    expect(processor.stripFrontmatter(malformed)).toBe(malformed);
  });

  test('processFiles reads and processes multiple files', async () => {
    const processor = new ContentProcessor(testDir);
    const files = [
      join(testDir, 'index.md'),
      join(testDir, 'tutorial.md'),
      join(testDir, 'readme.md')
    ];
    
    const documents = await processor.processFiles(files);
    
    expect(documents).toHaveLength(3);
    
    const indexDoc = documents.find(doc => doc.relativePath === 'index.md');
    expect(indexDoc).toBeDefined();
    expect(indexDoc.content).toContain('Index content');
    expect(indexDoc.content).not.toMatch(/^---/); // Frontmatter stripped
    
    const tutorialDoc = documents.find(doc => doc.relativePath === 'tutorial.md');
    expect(tutorialDoc).toBeDefined();
    expect(tutorialDoc.content).toContain('Tutorial content');
    expect(tutorialDoc.content).not.toMatch(/^---/); // Frontmatter stripped
  });

  test('processFiles handles empty file list', async () => {
    const processor = new ContentProcessor(testDir);
    const documents = await processor.processFiles([]);
    
    expect(documents).toEqual([]);
  });

  test('processFiles handles non-existent files gracefully', async () => {
    const processor = new ContentProcessor(testDir);
    const files = [join(testDir, 'non-existent.md'), join(testDir, 'readme.md')];
    
    const documents = await processor.processFiles(files);
    
    // Should only process the existing file
    expect(documents).toHaveLength(1);
    expect(documents[0].relativePath).toBe('readme.md');
  });

  test('isIndexDocument identifies index files correctly', () => {
    const processor = new ContentProcessor(testDir);
    
    expect(processor.isIndexDocument('index.md')).toBe(true);
    expect(processor.isIndexDocument('INDEX.md')).toBe(true);
    expect(processor.isIndexDocument('readme.md')).toBe(true);
    expect(processor.isIndexDocument('README.MD')).toBe(true);
    expect(processor.isIndexDocument('home.md')).toBe(true);
    expect(processor.isIndexDocument('Home.mdx')).toBe(true);
    expect(processor.isIndexDocument('catalog.md')).toBe(false);
    expect(processor.isIndexDocument('tutorial.md')).toBe(false);
  });

  test('isImportantDocument identifies important files correctly', () => {
    const processor = new ContentProcessor(testDir);
    
    expect(processor.isImportantDocument('catalog.md')).toBe(true);
    expect(processor.isImportantDocument('tutorial.md')).toBe(true);
    expect(processor.isImportantDocument('getting-started.md')).toBe(true);
    expect(processor.isImportantDocument('GETTING-STARTED.MDX')).toBe(true);
    expect(processor.isImportantDocument('quickstart.md')).toBe(true);
    expect(processor.isImportantDocument('intro.md')).toBe(true);
    expect(processor.isImportantDocument('introduction.md')).toBe(true);
    expect(processor.isImportantDocument('docs.md')).toBe(true);
    expect(processor.isImportantDocument('doc.md')).toBe(true);
    expect(processor.isImportantDocument('start.md')).toBe(true);
    
    expect(processor.isImportantDocument('reference.md')).toBe(false);
    expect(processor.isImportantDocument('other.md')).toBe(false);
    expect(processor.isImportantDocument('random.md')).toBe(false);
  });

  test('orderDocuments categorizes documents correctly', async () => {
    const processor = new ContentProcessor(testDir);
    const files = [
      join(testDir, 'index.md'),
      join(testDir, 'readme.md'),
      join(testDir, 'catalog.md'),
      join(testDir, 'tutorial.md'),
      join(testDir, 'getting-started.md'),
      join(testDir, 'reference.md'),
      join(testDir, 'other.md')
    ];
    
    const documents = await processor.processFiles(files);
    const ordered = processor.orderDocuments(documents);
    
    // Check index category
    expect(ordered.index).toHaveLength(2); // index.md, readme.md
    expect(ordered.index.some(doc => doc.relativePath === 'index.md')).toBe(true);
    expect(ordered.index.some(doc => doc.relativePath === 'readme.md')).toBe(true);
    
    // Check important category
    expect(ordered.important).toHaveLength(3); // catalog.md, tutorial.md, getting-started.md
    expect(ordered.important.some(doc => doc.relativePath === 'catalog.md')).toBe(true);
    expect(ordered.important.some(doc => doc.relativePath === 'tutorial.md')).toBe(true);
    expect(ordered.important.some(doc => doc.relativePath === 'getting-started.md')).toBe(true);
    
    // Check other category
    expect(ordered.other).toHaveLength(2); // reference.md, other.md
    expect(ordered.other.some(doc => doc.relativePath === 'reference.md')).toBe(true);
    expect(ordered.other.some(doc => doc.relativePath === 'other.md')).toBe(true);
  });

  test('orderDocuments sorts categories alphabetically', async () => {
    const processor = new ContentProcessor(testDir);
    const files = [
      join(testDir, 'other.md'),
      join(testDir, 'reference.md'),
      join(testDir, 'tutorial.md'),
      join(testDir, 'catalog.md')
    ];
    
    const documents = await processor.processFiles(files);
    const ordered = processor.orderDocuments(documents);
    
    // Important files should be sorted alphabetically
    expect(ordered.important[0].relativePath).toBe('catalog.md');
    expect(ordered.important[1].relativePath).toBe('tutorial.md');
    
    // Other files should be sorted alphabetically
    expect(ordered.other[0].relativePath).toBe('other.md');
    expect(ordered.other[1].relativePath).toBe('reference.md');
  });

  test('orderDocuments handles empty document list', () => {
    const processor = new ContentProcessor(testDir);
    const ordered = processor.orderDocuments([]);
    
    expect(ordered.index).toEqual([]);
    expect(ordered.important).toEqual([]);
    expect(ordered.other).toEqual([]);
  });

  test('processFiles creates correct document structure', async () => {
    const processor = new ContentProcessor(testDir);
    const files = [join(testDir, 'index.md')];
    
    const documents = await processor.processFiles(files);
    const doc = documents[0];
    
    expect(doc).toHaveProperty('fullPath');
    expect(doc).toHaveProperty('relativePath');
    expect(doc).toHaveProperty('content');
    
    expect(doc.fullPath).toBe(join(testDir, 'index.md'));
    expect(doc.relativePath).toBe('index.md');
    expect(typeof doc.content).toBe('string');
  });

  test('isIndexDocument identifies HTML index files correctly', () => {
    const processor = new ContentProcessor(testDir);
    
    expect(processor.isIndexDocument('index.html')).toBe(true);
    expect(processor.isIndexDocument('readme.html')).toBe(true);
    expect(processor.isIndexDocument('home.html')).toBe(true);
    expect(processor.isIndexDocument('docs/index.html')).toBe(true);
    expect(processor.isIndexDocument('catalog.html')).toBe(false);
  });

  test('getIndexPriority handles HTML files correctly', () => {
    const processor = new ContentProcessor(testDir);
    
    expect(processor.getIndexPriority('index.html')).toBe(1);
    expect(processor.getIndexPriority('readme.html')).toBe(2);
    expect(processor.getIndexPriority('home.html')).toBe(3);
    expect(processor.getIndexPriority('docs/index.html')).toBe(1); // basename is still index.html, so priority 1
  });

  test('stripFrontmatter works with HTML files', () => {
    const processor = new ContentProcessor(testDir);
    const htmlWithFrontmatter = `---
title: Test HTML
layout: default
---
<h1>HTML Content</h1>
<p>This is HTML content.</p>`;
    
    const cleaned = processor.stripFrontmatter(htmlWithFrontmatter);
    expect(cleaned).toBe('<h1>HTML Content</h1>\n<p>This is HTML content.</p>');
    expect(cleaned).not.toContain('---');
    expect(cleaned).not.toContain('title: Test HTML');
  });

  describe('HTML Processing', () => {
    const testDocsDir = './tests/fixtures/test-docs';
    
    test('should process HTML files from test fixtures', async () => {
      const processor = new ContentProcessor(testDocsDir);
      const htmlFiles = [
        join(testDocsDir, '../html-test/index.html'),
        join(testDocsDir, '../html-test/api.html')
      ];
      
      const documents = await processor.processFiles(htmlFiles);
      
      expect(documents).toHaveLength(2);
      
      // Check first HTML file (index.html)
      const indexDoc = documents.find(doc => doc.relativePath.includes('index.html.md'));
      expect(indexDoc).toBeDefined();
      expect(indexDoc.relativePath).toBe('../html-test/index.html.md');
      expect(indexDoc.originalPath).toBe('../html-test/index.html');
      expect(indexDoc.isHtmlConverted).toBe(true);
      expect(indexDoc.metadata.title).toBe('HTML Test Documentation');
      expect(indexDoc.metadata.description).toBe('Test HTML documentation for conversion');
      expect(indexDoc.content).toContain('# Welcome to HTML Docs');
      expect(indexDoc.content).toContain('HTML to Markdown conversion');
      
      // Check second HTML file (api.html)  
      const apiDoc = documents.find(doc => doc.relativePath.includes('api.html.md'));
      expect(apiDoc).toBeDefined();
      expect(apiDoc.relativePath).toBe('../html-test/api.html.md');
      expect(apiDoc.originalPath).toBe('../html-test/api.html');
      expect(apiDoc.isHtmlConverted).toBe(true);
      expect(apiDoc.metadata.title).toBe('API Documentation');
      expect(apiDoc.metadata.description).toBe('API reference documentation');
      expect(apiDoc.content).toContain('# API Reference');
      expect(apiDoc.content).toContain('GET'); // Table content gets converted but not to markdown table format
      expect(apiDoc.content).toContain('/api/users');
    });

    test('should convert HTML to Markdown correctly', () => {
      const processor = new ContentProcessor(testDocsDir);
      const htmlContent = `
        <h1>Main Title</h1>
        <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <h2>Subsection</h2>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <pre><code>console.log('Hello World!');</code></pre>
        <blockquote>
          <p>This is a quote</p>
        </blockquote>
      `;
      
      const markdown = processor.convertHtmlToMarkdown(htmlContent);
      
      expect(markdown).toContain('# Main Title');
      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('_italic_');
      expect(markdown).toContain('## Subsection');
      expect(markdown).toContain('*   First item'); // Turndown uses * for lists
      expect(markdown).toContain('*   Second item');
      expect(markdown).toContain('```');
      expect(markdown).toContain("console.log('Hello World!');");
      expect(markdown).toContain('> This is a quote');
    });

    test('should handle HTML files with YAML frontmatter', () => {
      const processor = new ContentProcessor(testDocsDir);
      const htmlContentWithFrontmatter = `---
title: "Frontmatter Title"
description: "Frontmatter description"
---
<!DOCTYPE html>
<html>
<head>
  <title>HTML Title</title>
  <meta name="description" content="HTML description">
</head>
<body>
  <h1>Content</h1>
  <p>Test content</p>
</body>
</html>`;
      
      const processedDoc = processor.processHtmlFile(
        'test.html', 
        htmlContentWithFrontmatter, 
        'test.html'
      );
      
      // Should extract metadata from HTML meta tags, not frontmatter
      expect(processedDoc.metadata.title).toBe('HTML Title');
      expect(processedDoc.metadata.description).toBe('HTML description');
      expect(processedDoc.content).toContain('# Content');
      expect(processedDoc.content).not.toContain('---');
      expect(processedDoc.isHtmlConverted).toBe(true);
    });

    test('should handle HTML conversion errors gracefully', () => {
      const processor = new ContentProcessor(testDocsDir);
      
      // Mock turndown service to throw error
      const originalTurndown = processor.turndownService.turndown;
      processor.turndownService.turndown = () => {
        throw new Error('Conversion failed');
      };
      
      const result = processor.convertHtmlToMarkdown('<h1>Test</h1>');
      
      // Should return original HTML as fallback
      expect(result).toBe('<h1>Test</h1>');
      
      // Restore original method
      processor.turndownService.turndown = originalTurndown;
    });

    test('should process HTML file and create proper document structure', () => {
      const processor = new ContentProcessor(testDocsDir);
      const htmlContent = `
        <html>
        <head>
          <title>Test Document</title>
          <meta name="description" content="Test description">
        </head>
        <body>
          <h1>Test Content</h1>
          <p>This is test content.</p>
        </body>
        </html>
      `;
      
      const result = processor.processHtmlFile('/path/to/test.html', htmlContent, 'test.html');
      
      expect(result.relativePath).toBe('test.html.md');
      expect(result.originalPath).toBe('test.html');
      expect(result.isHtmlConverted).toBe(true);
      expect(result.fullPath).toBe('/path/to/test.html');
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.description).toBe('Test description');
      expect(result.content).toContain('# Test Content');
    });

    test('should handle mixed Markdown and HTML files', async () => {
      const processor = new ContentProcessor(testDocsDir);
      const files = [
        join(testDocsDir, 'index.md'), // Markdown file
        join(testDocsDir, '../html-test/index.html') // HTML file
      ];
      
      const documents = await processor.processFiles(files);
      
      expect(documents).toHaveLength(2);
      
      const mdDoc = documents.find(doc => doc.relativePath === 'index.md');
      const htmlDoc = documents.find(doc => doc.relativePath.includes('index.html.md'));
      
      expect(mdDoc).toBeDefined();
      expect(mdDoc.isHtmlConverted).toBeUndefined(); // Should not have this property
      
      expect(htmlDoc).toBeDefined();
      expect(htmlDoc.isHtmlConverted).toBe(true);
      expect(htmlDoc.originalPath).toBe('../html-test/index.html');
      expect(htmlDoc.relativePath).toBe('../html-test/index.html.md');
    });

    test('should extract sitemap metadata from HTML meta tags', () => {
      const processor = new ContentProcessor(testDocsDir);
      const htmlContent = `
        <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Test description">
          <meta name="sitemap-priority" content="0.8">
          <meta name="sitemap-changefreq" content="daily">
        </head>
        <body>
          <h1>Test</h1>
        </body>
        </html>
      `;
      
      // For now, basic metadata extraction works
      // Sitemap-specific extraction will be implemented in SitemapGenerator
      const metadata = processor.extractFromHtmlMeta(htmlContent);
      
      expect(metadata.title).toBe('Test Page');
      expect(metadata.description).toBe('Test description');
    });
  });
});