import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { TocGenerator } from "../src/TocGenerator.js";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";

const testInputDir = './tests/toc_test_input';
const testOutputDir = './tests/toc_test_output';

describe('TocGenerator', () => {
  beforeAll(async () => {
    // Create test input directory structure
    await mkdir(testInputDir, { recursive: true });
    await mkdir(join(testInputDir, 'docs'), { recursive: true });
    await mkdir(join(testInputDir, 'api'), { recursive: true });
    
    // Create test output directory structure with index.json files
    await mkdir(testOutputDir, { recursive: true });
    await mkdir(join(testOutputDir, 'docs'), { recursive: true });
    await mkdir(join(testOutputDir, 'api'), { recursive: true });
    
    // Create sample index.json files
    const rootIndex = {
      directory: '.',
      generated: '2024-01-01T00:00:00Z',
      files: [
        {
          name: 'index.md',
          path: 'index.md',
          size: 1234,
          modified: '2024-01-01T00:00:00Z',
          type: 'md',
          extension: '.md',
          isMarkdown: true
        },
        {
          name: 'README.md',
          path: 'README.md',
          size: 567,
          modified: '2024-01-01T00:00:00Z',
          type: 'md',
          extension: '.md',
          isMarkdown: true
        }
      ],
      subdirectories: [
        {
          name: 'docs',
          path: 'docs',
          indexPath: 'docs/index.json'
        },
        {
          name: 'api',
          path: 'api',
          indexPath: 'api/index.json'
        }
      ],
      summary: {
        totalFiles: 2,
        totalSubdirectories: 2,
        markdownFiles: 2,
        totalSize: 1801
      }
    };
    
    const docsIndex = {
      directory: 'docs',
      generated: '2024-01-01T00:00:00Z',
      files: [
        {
          name: 'tutorial.md',
          path: 'docs/tutorial.md',
          size: 890,
          modified: '2024-01-01T00:00:00Z',
          type: 'md',
          extension: '.md',
          isMarkdown: true
        },
        {
          name: 'guide.md',
          path: 'docs/guide.md',
          size: 1200,
          modified: '2024-01-01T00:00:00Z',
          type: 'md',
          extension: '.md',
          isMarkdown: true
        }
      ],
      subdirectories: [],
      summary: {
        totalFiles: 2,
        totalSubdirectories: 0,
        markdownFiles: 2,
        totalSize: 2090
      }
    };
    
    const apiIndex = {
      directory: 'api',
      generated: '2024-01-01T00:00:00Z',
      files: [
        {
          name: 'reference.md',
          path: 'api/reference.md',
          size: 1500,
          modified: '2024-01-01T00:00:00Z',
          type: 'md',
          extension: '.md',
          isMarkdown: true
        }
      ],
      subdirectories: [],
      summary: {
        totalFiles: 1,
        totalSubdirectories: 0,
        markdownFiles: 1,
        totalSize: 1500
      }
    };
    
    await writeFile(join(testOutputDir, 'index.json'), JSON.stringify(rootIndex, null, 2));
    await writeFile(join(testOutputDir, 'docs', 'index.json'), JSON.stringify(docsIndex, null, 2));
    await writeFile(join(testOutputDir, 'api', 'index.json'), JSON.stringify(apiIndex, null, 2));
  });

  afterAll(async () => {
    await rm(testInputDir, { recursive: true, force: true });
    await rm(testOutputDir, { recursive: true, force: true });
  });

  test('constructs with required parameters', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    expect(generator.inputDir).toBe(testInputDir);
    expect(generator.outputDir).toBe(testOutputDir);
  });

  test('constructs with custom options', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir, {
      silent: true,
      baseUrl: 'https://example.com'
    });
    expect(generator.silent).toBe(true);
    expect(generator.baseUrl).toBe('https://example.com');
  });

  test('collectAllIndexes finds all index.json files', async () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    const indexes = await generator.collectAllIndexes(testOutputDir);
    
    expect(indexes).toHaveLength(3);
    
    const rootIndex = indexes.find(idx => idx.relativePath === '.');
    const docsIndex = indexes.find(idx => idx.relativePath === 'docs');
    const apiIndex = indexes.find(idx => idx.relativePath === 'api');
    
    expect(rootIndex).toBeDefined();
    expect(docsIndex).toBeDefined();
    expect(apiIndex).toBeDefined();
    
    expect(rootIndex.content.files).toHaveLength(2);
    expect(docsIndex.content.files).toHaveLength(2);
    expect(apiIndex.content.files).toHaveLength(1);
  });

  test('generateTocContent creates correct structure for root directory', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    const indexContent = {
      files: [
        { name: 'index.md', path: 'index.md', isMarkdown: true },
        { name: 'README.md', path: 'README.md', isMarkdown: true }
      ],
      subdirectories: [
        { name: 'docs', path: 'docs' },
        { name: 'api', path: 'api' }
      ]
    };
    
    const tocContent = generator.generateTocContent(indexContent, '.');
    
    expect(tocContent).toContain('# Table of Contents');
    expect(tocContent).toContain('## Files');
    expect(tocContent).toContain('[index](index.md)');
    expect(tocContent).toContain('[README](README.md)');
    expect(tocContent).toContain('## Subdirectories');
    expect(tocContent).toContain('[docs/](docs/toc.md)');
    expect(tocContent).toContain('[api/](api/toc.md)');
  });

  test('generateTocContent includes parent link for subdirectory', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    const indexContent = {
      files: [
        { name: 'tutorial.md', path: 'docs/tutorial.md', isMarkdown: true }
      ],
      subdirectories: []
    };
    
    const tocContent = generator.generateTocContent(indexContent, 'docs');
    
    expect(tocContent).toContain('# Table of Contents - docs');
    expect(tocContent).toContain('[← Parent Directory](toc.md)');
    expect(tocContent).toContain('[tutorial](docs/tutorial.md)');
  });

  test('buildFileUrl generates relative URLs by default', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    const url = generator.buildFileUrl('docs/tutorial.md');
    expect(url).toBe('docs/tutorial.md');
  });

  test('buildFileUrl generates absolute URLs with baseUrl', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir, {
      baseUrl: 'https://example.com'
    });
    const url = generator.buildFileUrl('docs/tutorial.md');
    expect(url).toBe('https://example.com/docs/tutorial.md');
  });

  test('getDisplayName removes markdown extensions', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    expect(generator.getDisplayName('tutorial.md')).toBe('tutorial');
    expect(generator.getDisplayName('guide.mdx')).toBe('guide');
    expect(generator.getDisplayName('readme.MD')).toBe('readme');
    expect(generator.getDisplayName('other.txt')).toBe('other.txt');
  });

  test('buildHierarchy creates correct nested structure', () => {
    const generator = new TocGenerator(testInputDir, testOutputDir);
    const allIndexes = [
      {
        relativePath: '.',
        content: {
          files: [{ name: 'index.md', isMarkdown: true }]
        }
      },
      {
        relativePath: 'docs',
        content: {
          files: [{ name: 'tutorial.md', isMarkdown: true }]
        }
      }
    ];
    
    const hierarchy = generator.buildHierarchy(allIndexes);
    
    expect(hierarchy.path).toBe('.');
    expect(hierarchy.files).toHaveLength(1);
    expect(hierarchy.subdirectories).toHaveLength(1);
    expect(hierarchy.subdirectories[0].name).toBe('docs');
    expect(hierarchy.subdirectories[0].files).toHaveLength(1);
  });

  test('generateDirectoryToc creates toc.md file', async () => {
    const generator = new TocGenerator(testInputDir, testOutputDir, { silent: true });
    const indexData = {
      relativePath: 'docs',
      content: {
        files: [
          { name: 'tutorial.md', path: 'docs/tutorial.md', isMarkdown: true }
        ],
        subdirectories: []
      }
    };
    
    await generator.generateDirectoryToc(indexData);
    
    const tocContent = await readFile(join(testOutputDir, 'docs', 'toc.md'), 'utf8');
    expect(tocContent).toContain('# Table of Contents - docs');
    expect(tocContent).toContain('[tutorial](docs/tutorial.md)');
  });

  test('generateAll creates all TOC files', async () => {
    const generator = new TocGenerator(testInputDir, testOutputDir, { silent: true });
    
    await generator.generateAll();
    
    // Check that toc.md files were created
    const rootToc = await readFile(join(testOutputDir, 'toc.md'), 'utf8');
    const docsToc = await readFile(join(testOutputDir, 'docs', 'toc.md'), 'utf8');
    const apiToc = await readFile(join(testOutputDir, 'api', 'toc.md'), 'utf8');
    const fullToc = await readFile(join(testOutputDir, 'toc-full.md'), 'utf8');
    
    expect(rootToc).toContain('# Table of Contents');
    expect(docsToc).toContain('# Table of Contents - docs');
    expect(apiToc).toContain('# Table of Contents - api');
    expect(fullToc).toContain('# Complete Table of Contents');
    
    // Check content structure
    expect(rootToc).toContain('[index](index.md)');
    expect(rootToc).toContain('[docs/](docs/toc.md)');
    expect(docsToc).toContain('[tutorial](docs/tutorial.md)');
    expect(apiToc).toContain('[reference](api/reference.md)');
    expect(fullToc).toContain('- [index](index.md)');
    expect(fullToc).toContain('- **docs/**');
  });

  test('generateAll throws error when no index.json files found', async () => {
    const emptyOutputDir = './tests/empty_toc_output';
    await mkdir(emptyOutputDir, { recursive: true });
    
    const generator = new TocGenerator(testInputDir, emptyOutputDir, { silent: true });
    
    await expect(generator.generateAll()).rejects.toThrow('No index.json files found');
    
    await rm(emptyOutputDir, { recursive: true, force: true });
  });

  test('log method respects silent option', () => {
    const silentGenerator = new TocGenerator(testInputDir, testOutputDir, { silent: true });
    const verboseGenerator = new TocGenerator(testInputDir, testOutputDir, { silent: false });
    
    // Test that silent generator doesn't log (no direct way to test console.log, but we can verify the flag)
    expect(silentGenerator.silent).toBe(true);
    expect(verboseGenerator.silent).toBe(false);
  });
});