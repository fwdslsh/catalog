import { CatalogProcessor } from '../src/CatalogProcessor.js';
import { DirectoryScanner } from '../src/DirectoryScanner.js';
import { ContentProcessor } from '../src/ContentProcessor.js';
import { OutputGenerator } from '../src/OutputGenerator.js';
import { IndexGenerator } from '../src/IndexGenerator.js';
import { mkdir, writeFile, rm, readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';

describe('CatalogProcessor', () => {
  const testInputDir = './tests/tmp_input';
  const testOutputDir = './tests/tmp_output';

  beforeAll(async () => {
    await mkdir(testInputDir, { recursive: true });
    await mkdir(testOutputDir, { recursive: true });
    // Create markdown files
    await writeFile(join(testInputDir, 'index.md'), '# Index\n---\nIndex content');
    await writeFile(join(testInputDir, 'catalog.md'), '# Catalog\nCatalog content');
    await writeFile(join(testInputDir, 'other.txt'), 'Not markdown');
    await mkdir(join(testInputDir, 'node_modules'), { recursive: true });
    await writeFile(join(testInputDir, 'node_modules', 'ignore.md'), '# Should be ignored');
    
    // Create subdirectory with files for index testing
    await mkdir(join(testInputDir, 'subdir'), { recursive: true });
    await writeFile(join(testInputDir, 'subdir', 'nested.md'), '# Nested\nNested content');
    await writeFile(join(testInputDir, 'subdir', 'data.json'), '{"test": true}');
  });

  afterAll(async () => {
    await rm(testInputDir, { recursive: true, force: true });
    await rm(testOutputDir, { recursive: true, force: true });
  });

  test('DirectoryScanner finds only markdown files and excludes patterns', async () => {
    const scanner = new DirectoryScanner();
    const files = await scanner.scanDirectory(testInputDir);
    expect(files.length).toBe(3); // index.md, catalog.md, subdir/nested.md
    expect(files.some(f => f.endsWith('index.md'))).toBe(true);
    expect(files.some(f => f.endsWith('catalog.md'))).toBe(true);
    expect(files.some(f => f.endsWith('nested.md'))).toBe(true);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
  });

  test('DirectoryScanner correctly identifies markdown files', () => {
    const scanner = new DirectoryScanner();
    expect(scanner.defaultIsMarkdownFile('foo.md')).toBe(true);
    expect(scanner.defaultIsMarkdownFile('foo.mdx')).toBe(true);
    expect(scanner.defaultIsMarkdownFile('foo.txt')).toBe(false);
  });

  test('DirectoryScanner shouldExclude works for excluded patterns', () => {
    const scanner = new DirectoryScanner();
    expect(scanner.shouldExclude('node_modules', 'node_modules/ignore.md')).toBe(true);
    expect(scanner.shouldExclude('foo', 'foo')).toBe(false);
  });

  test('ContentProcessor strips frontmatter and reads content', async () => {
    const scanner = new DirectoryScanner();
    const processor = new ContentProcessor(testInputDir);
    const files = await scanner.scanDirectory(testInputDir);
    const docs = await processor.processFiles(files);
    
    // Find the index.md document
    const indexDoc = docs.find(doc => doc.relativePath === 'index.md');
    expect(indexDoc).toBeDefined();
    expect(indexDoc.content).not.toMatch(/^---/);
    expect(indexDoc.content).toContain('Index content');
  });

  test('ContentProcessor categorizes documents', async () => {
    const scanner = new DirectoryScanner();
    const processor = new ContentProcessor(testInputDir);
    const files = await scanner.scanDirectory(testInputDir);
    const docs = await processor.processFiles(files);
    const ordered = processor.orderDocuments(docs);
    expect(ordered.index.length).toBe(1); // index.md
    expect(ordered.important.length).toBe(1); // catalog.md
    expect(ordered.other.length).toBe(1); // subdir/nested.md
  });

  test('OutputGenerator creates llms.txt and llms-full.txt', async () => {
    const scanner = new DirectoryScanner();
    const markdownProcessor = new ContentProcessor(testInputDir);
    const outputGenerator = new OutputGenerator(testOutputDir);
    const files = await scanner.scanDirectory(testInputDir);
    const docs = await markdownProcessor.processFiles(files);
    const ordered = markdownProcessor.orderDocuments(docs);
    await outputGenerator.generateOutputs('test', ordered);
    const outFiles = await readdir(testOutputDir);
    expect(outFiles).toContain('llms.txt');
    expect(outFiles).toContain('llms-full.txt');
    const stats = await stat(join(testOutputDir, 'llms.txt'));
    expect(stats.size).toBeGreaterThan(0);
  });

  describe('Index JSON Generation', () => {
    test('generateIndexFiles creates index.json files when enabled', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, { generateIndex: true });
      await processor.process();
      
      // Check root index.json exists
      const rootIndexPath = join(testOutputDir, 'index.json');
      const rootIndexStats = await stat(rootIndexPath);
      expect(rootIndexStats.isFile()).toBe(true);
      
      // Check subdirectory index.json exists
      const subIndexPath = join(testOutputDir, 'subdir', 'index.json');
      const subIndexStats = await stat(subIndexPath);
      expect(subIndexStats.isFile()).toBe(true);
      
      // Check master index exists
      const masterIndexPath = join(testOutputDir, 'master-index.json');
      const masterIndexStats = await stat(masterIndexPath);
      expect(masterIndexStats.isFile()).toBe(true);
    });

    test('index.json contains expected metadata structure', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, { generateIndex: true });
      await processor.process();
      
      const indexContent = JSON.parse(await readFile(join(testOutputDir, 'index.json'), 'utf8'));
      
      // Check structure
      expect(indexContent).toHaveProperty('directory');
      expect(indexContent).toHaveProperty('generated');
      expect(indexContent).toHaveProperty('files');
      expect(indexContent).toHaveProperty('subdirectories');
      expect(indexContent).toHaveProperty('summary');
      
      // Check files metadata
      expect(Array.isArray(indexContent.files)).toBe(true);
      if (indexContent.files.length > 0) {
        const file = indexContent.files[0];
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('modified');
        expect(file).toHaveProperty('type');
        expect(file).toHaveProperty('extension');
        expect(file).toHaveProperty('isMarkdown');
      }
      
      // Check subdirectories
      expect(Array.isArray(indexContent.subdirectories)).toBe(true);
      if (indexContent.subdirectories.length > 0) {
        const subdir = indexContent.subdirectories[0];
        expect(subdir).toHaveProperty('name');
        expect(subdir).toHaveProperty('path');
        expect(subdir).toHaveProperty('indexPath');
      }
      
      // Check summary
      expect(indexContent.summary).toHaveProperty('totalFiles');
      expect(indexContent.summary).toHaveProperty('totalSubdirectories');
      expect(indexContent.summary).toHaveProperty('markdownFiles');
      expect(indexContent.summary).toHaveProperty('totalSize');
    });

    test('master-index.json aggregates all directory data', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, { generateIndex: true });
      await processor.process();
      
      const masterIndex = JSON.parse(await readFile(join(testOutputDir, 'master-index.json'), 'utf8'));
      
      // Check structure
      expect(masterIndex).toHaveProperty('project');
      expect(masterIndex).toHaveProperty('generated');
      expect(masterIndex).toHaveProperty('totalDirectories');
      expect(masterIndex).toHaveProperty('totalFiles');
      expect(masterIndex).toHaveProperty('totalMarkdownFiles');
      expect(masterIndex).toHaveProperty('totalSize');
      expect(masterIndex).toHaveProperty('directories');
      
      // Check directories array
      expect(Array.isArray(masterIndex.directories)).toBe(true);
      expect(masterIndex.directories.length).toBeGreaterThan(0);
      
      const directory = masterIndex.directories[0];
      expect(directory).toHaveProperty('path');
      expect(directory).toHaveProperty('indexPath');
      expect(directory).toHaveProperty('summary');
    });

    test('index generation excludes excluded patterns', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, { generateIndex: true });
      await processor.process();
      
      const indexContent = JSON.parse(await readFile(join(testOutputDir, 'index.json'), 'utf8'));
      
      // Should not include node_modules as subdirectory
      const hasNodeModules = indexContent.subdirectories.some(sub => sub.name === 'node_modules');
      expect(hasNodeModules).toBe(false);
    });

    test('getFileExtension extracts file extensions correctly', () => {
      const indexGenerator = new IndexGenerator();
      expect(indexGenerator.getFileExtension('file.md')).toBe('.md');
      expect(indexGenerator.getFileExtension('file.txt')).toBe('.txt');
      expect(indexGenerator.getFileExtension('file')).toBe('');
      expect(indexGenerator.getFileExtension('file.name.ext')).toBe('.ext');
    });

    test('index generation does not run when disabled', async () => {
      // Clean output directory first
      await rm(testOutputDir, { recursive: true, force: true });
      await mkdir(testOutputDir, { recursive: true });
      
      const processor = new CatalogProcessor(testInputDir, testOutputDir, { generateIndex: false });
      await processor.process();
      
      // Check that index files are not created
      try {
        await stat(join(testOutputDir, 'index.json'));
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.code).toBe('ENOENT'); // File not found
      }
    });
  });

  describe('New Options Integration', () => {
    test('should handle baseUrl option correctly', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        baseUrl: 'https://docs.example.com'
      });
      await processor.process();

      const llmsContent = await readFile(join(testOutputDir, 'llms.txt'), 'utf8');
      expect(llmsContent).toContain('https://docs.example.com');
    });

    test('should handle optionalPatterns option correctly', async () => {
      // Create a draft file to be marked as optional
      await writeFile(join(testInputDir, 'draft.md'), '# Draft\nDraft content');

      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        optionalPatterns: ['**/draft.md']
      });
      await processor.process();

      const llmsContent = await readFile(join(testOutputDir, 'llms.txt'), 'utf8');
      expect(llmsContent).toContain('## Optional');
      expect(llmsContent).toContain('draft.md');

      // Clean up
      await rm(join(testInputDir, 'draft.md'));
    });

    test('should handle validation option correctly', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        validate: true,
        silent: true // Prevent console output during tests
      });
      
      await expect(processor.process()).resolves.toBeUndefined();
    });

    test('should handle sitemap generation correctly', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true,
        baseUrl: 'https://docs.example.com'
      });
      await processor.process();

      const sitemapContent = await readFile(join(testOutputDir, 'sitemap.xml'), 'utf8');
      expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemapContent).toContain('https://docs.example.com');
    });

    test('should handle sitemap with no extensions correctly', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true,
        sitemapNoExtensions: true,
        baseUrl: 'https://docs.example.com'
      });
      await processor.process();

      const sitemapContent = await readFile(join(testOutputDir, 'sitemap.xml'), 'utf8');
      expect(sitemapContent).toContain('https://docs.example.com/</loc>'); // Index file becomes root
      expect(sitemapContent).not.toContain('.md</loc>');
    });

    test('should require baseUrl for sitemap generation', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true
        // Missing baseUrl
      });
      
      await expect(processor.process()).rejects.toThrow('--base-url is required when using --sitemap');
    });

    test('should construct with correct options', () => {
      const options = {
        silent: true,
        generateIndex: true,
        generateSitemap: true,
        sitemapNoExtensions: true,
        validate: true,
        baseUrl: 'https://example.com',
        optionalPatterns: ['**/draft.md'],
        includeGlobs: ['*.md'],
        excludeGlobs: ['**/temp.md']
      };

      const processor = new CatalogProcessor(testInputDir, testOutputDir, options);
      
      expect(processor.silent).toBe(true);
      expect(processor.generateIndex).toBe(true);
      expect(processor.generateSitemap).toBe(true);
      expect(processor.sitemapNoExtensions).toBe(true);
      expect(processor.validate).toBe(true);
      expect(processor.baseUrl).toBe('https://example.com');
      expect(processor.optionalPatterns).toEqual(['**/draft.md']);
    });
  });
});
