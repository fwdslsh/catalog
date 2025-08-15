import { SitemapGenerator } from '../src/SitemapGenerator.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('SitemapGenerator', () => {
  const testOutputDir = './tests/sitemap_test_output';
  const baseUrl = 'https://example.com';
  
  beforeAll(async () => {
    await mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testOutputDir, { recursive: true, force: true });
  });

  describe('Constructor', () => {
    test('should construct with default options', () => {
      const generator = new SitemapGenerator();
      expect(generator.silent).toBe(false);
      expect(generator.stripExtensions).toBe(false);
    });

    test('should construct with custom options', () => {
      const generator = new SitemapGenerator({ 
        silent: true, 
        stripExtensions: true 
      });
      expect(generator.silent).toBe(true);
      expect(generator.stripExtensions).toBe(true);
    });
  });

  describe('URL Building', () => {
    test('should build basic sitemap URL', () => {
      const generator = new SitemapGenerator();
      const doc = { relativePath: 'docs/guide.md' };
      
      const url = generator.buildSitemapUrl(doc, baseUrl);
      expect(url).toBe('https://example.com/docs/guide.md');
    });

    test('should build URL with trailing slash removed from base URL', () => {
      const generator = new SitemapGenerator();
      const doc = { relativePath: 'docs/guide.md' };
      
      const url = generator.buildSitemapUrl(doc, 'https://example.com/');
      expect(url).toBe('https://example.com/docs/guide.md');
    });

    test('should build URL with extensions stripped', () => {
      const generator = new SitemapGenerator({ stripExtensions: true });
      const doc = { relativePath: 'docs/guide.md' };
      
      const url = generator.buildSitemapUrl(doc, baseUrl);
      expect(url).toBe('https://example.com/docs/guide');
    });

    test('should handle index files correctly', () => {
      const generator = new SitemapGenerator({ stripExtensions: true });
      
      const indexDoc = { relativePath: 'docs/index.md' };
      const rootIndexDoc = { relativePath: 'index.md' };
      
      expect(generator.buildSitemapUrl(indexDoc, baseUrl))
        .toBe('https://example.com/docs/');
      expect(generator.buildSitemapUrl(rootIndexDoc, baseUrl))
        .toBe('https://example.com/');
    });

    test('should use originalPath for HTML converted files', () => {
      const generator = new SitemapGenerator();
      const doc = { 
        relativePath: 'docs/guide.html.md',
        originalPath: 'docs/guide.html'
      };
      
      const url = generator.buildSitemapUrl(doc, baseUrl);
      expect(url).toBe('https://example.com/docs/guide.html');
    });

    test('should handle paths without leading slash', () => {
      const generator = new SitemapGenerator();
      const doc = { relativePath: 'guide.md' };
      
      const url = generator.buildSitemapUrl(doc, baseUrl);
      expect(url).toBe('https://example.com/guide.md');
    });
  });

  describe('Change Frequency Detection', () => {
    test('should use metadata changefreq if available', () => {
      const generator = new SitemapGenerator();
      const doc = { 
        relativePath: 'docs/guide.md',
        metadata: { changefreq: 'daily' }
      };
      
      expect(generator.getChangeFreq(doc)).toBe('daily');
    });

    test('should use sitemap-changefreq meta tag', () => {
      const generator = new SitemapGenerator();
      const doc = { 
        relativePath: 'docs/guide.md',
        metadata: { 'sitemap-changefreq': 'weekly' }
      };
      
      expect(generator.getChangeFreq(doc)).toBe('weekly');
    });

    test('should detect change frequency from file path', () => {
      const generator = new SitemapGenerator();
      
      expect(generator.getChangeFreq({ relativePath: 'index.md' }))
        .toBe('weekly');
      expect(generator.getChangeFreq({ relativePath: 'docs/tutorial.md' }))
        .toBe('monthly');
      expect(generator.getChangeFreq({ relativePath: 'api/reference.md' }))
        .toBe('monthly');
      expect(generator.getChangeFreq({ relativePath: 'other/file.md' }))
        .toBe('yearly');
    });
  });

  describe('Priority Detection', () => {
    test('should use metadata priority if available', () => {
      const generator = new SitemapGenerator();
      const doc = { 
        relativePath: 'docs/guide.md',
        metadata: { priority: '0.9' }
      };
      
      expect(generator.getPriority(doc)).toBe('0.9');
    });

    test('should use sitemap-priority meta tag', () => {
      const generator = new SitemapGenerator();
      const doc = { 
        relativePath: 'docs/guide.md',
        metadata: { 'sitemap-priority': '0.8' }
      };
      
      expect(generator.getPriority(doc)).toBe('0.8');
    });

    test('should validate priority range', () => {
      const generator = new SitemapGenerator();
      
      // Valid priority
      expect(generator.getPriority({ 
        relativePath: 'test.md',
        metadata: { priority: '0.5' }
      })).toBe('0.5');
      
      // Invalid priority (too high) - should fall back to default
      expect(generator.getPriority({ 
        relativePath: 'test.md',
        metadata: { priority: '1.5' }
      })).toBe('0.5');
      
      // Invalid priority (negative) - should fall back to default
      expect(generator.getPriority({ 
        relativePath: 'test.md',
        metadata: { priority: '-0.1' }
      })).toBe('0.5');
    });

    test('should detect priority from file path', () => {
      const generator = new SitemapGenerator();
      
      expect(generator.getPriority({ relativePath: 'index.md' }))
        .toBe('1.0');
      expect(generator.getPriority({ relativePath: 'docs/tutorial.md' }))
        .toBe('0.8');
      expect(generator.getPriority({ relativePath: 'api/reference.md' }))
        .toBe('0.7');
      expect(generator.getPriority({ relativePath: 'other/file.md' }))
        .toBe('0.5');
    });
  });

  describe('XML Generation', () => {
    test('should generate valid XML sitemap', () => {
      const generator = new SitemapGenerator();
      const entries = [
        {
          url: 'https://example.com/',
          lastmod: '2023-01-01T00:00:00.000Z',
          changefreq: 'weekly',
          priority: '1.0'
        },
        {
          url: 'https://example.com/docs/guide',
          lastmod: '2023-01-02T00:00:00.000Z',
          changefreq: 'monthly',
          priority: '0.8'
        }
      ];
      
      const xml = generator.generateSitemapXml(entries);
      
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain('<loc>https://example.com/</loc>');
      expect(xml).toContain('<loc>https://example.com/docs/guide</loc>');
      expect(xml).toContain('<lastmod>2023-01-01T00:00:00.000Z</lastmod>');
      expect(xml).toContain('<changefreq>weekly</changefreq>');
      expect(xml).toContain('<priority>1.0</priority>');
      expect(xml).toContain('</urlset>');
    });

    test('should escape XML special characters', () => {
      const generator = new SitemapGenerator();
      
      expect(generator.escapeXml('<test>')).toBe('&lt;test&gt;');
      expect(generator.escapeXml('A & B')).toBe('A &amp; B');
      expect(generator.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(generator.escapeXml("'single'")).toBe('&apos;single&apos;');
    });
  });

  describe('Sitemap Entry Creation', () => {
    test('should create sitemap entries from documents', async () => {
      const generator = new SitemapGenerator();
      const documents = [
        {
          relativePath: 'index.md',
          fullPath: '/fake/path/index.md',
          metadata: {}
        },
        {
          relativePath: 'docs/guide.md',
          fullPath: '/fake/path/docs/guide.md',
          metadata: { priority: '0.9' }
        }
      ];
      
      const entries = await generator.createSitemapEntries(documents, baseUrl);
      
      expect(entries).toHaveLength(2);
      expect(entries[0].url).toBe('https://example.com/index.md');
      expect(entries[0].priority).toBe('1.0'); // Index priority
      expect(entries[1].url).toBe('https://example.com/docs/guide.md');
      expect(entries[1].priority).toBe('0.9'); // From metadata
    });

    test('should handle documents with missing file paths gracefully', async () => {
      const generator = new SitemapGenerator({ silent: true });
      const documents = [
        {
          relativePath: 'missing.md',
          metadata: {}
        }
      ];
      
      const entries = await generator.createSitemapEntries(documents, baseUrl);
      
      expect(entries).toHaveLength(1);
      expect(entries[0].url).toBe('https://example.com/missing.md');
      expect(entries[0].lastmod).toBeDefined(); // Should have current date as fallback
    });
  });

  describe('Full Sitemap Generation', () => {
    test('should generate complete sitemap file', async () => {
      const generator = new SitemapGenerator();
      const documents = [
        {
          relativePath: 'index.md',
          metadata: {}
        },
        {
          relativePath: 'docs/guide.md',
          metadata: { changefreq: 'daily', priority: '0.9' }
        }
      ];
      
      const sitemapPath = await generator.generateSitemap(documents, baseUrl, testOutputDir);
      
      expect(sitemapPath).toBe(join(testOutputDir, 'sitemap.xml'));
      
      // Verify file was created and has valid content
      const content = await readFile(sitemapPath, 'utf8');
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<loc>https://example.com/index.md</loc>');
      expect(content).toContain('<loc>https://example.com/docs/guide.md</loc>');
      expect(content).toContain('<changefreq>daily</changefreq>');
      expect(content).toContain('<priority>0.9</priority>');
    });

    test('should throw error when baseUrl is missing', async () => {
      const generator = new SitemapGenerator();
      const documents = [{ relativePath: 'index.md', metadata: {} }];
      
      await expect(generator.generateSitemap(documents, null, testOutputDir))
        .rejects.toThrow('Base URL is required for sitemap generation');
    });

    test('should generate sitemap with extension stripping', async () => {
      const generator = new SitemapGenerator({ stripExtensions: true });
      const documents = [
        {
          relativePath: 'docs/guide.md',
          metadata: {}
        },
        {
          relativePath: 'api/reference.html',
          originalPath: 'api/reference.html', // HTML converted file
          metadata: {}
        }
      ];
      
      const sitemapPath = await generator.generateSitemap(documents, baseUrl, testOutputDir);
      const content = await readFile(sitemapPath, 'utf8');
      
      expect(content).toContain('<loc>https://example.com/docs/guide</loc>');
      expect(content).toContain('<loc>https://example.com/api/reference</loc>');
    });
  });

  describe('Last Modified Date', () => {
    test('should get current date as fallback when file stats unavailable', async () => {
      const generator = new SitemapGenerator();
      const doc = { relativePath: 'test.md' }; // No fullPath
      
      const lastmod = await generator.getLastModified(doc);
      
      // Should be a valid ISO date string
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      
      // Should be recent (within last minute)
      const date = new Date(lastmod);
      const now = new Date();
      expect(now.getTime() - date.getTime()).toBeLessThan(60000);
    });
  });

  describe('Silent Mode', () => {
    test('should not log in silent mode', async () => {
      const generator = new SitemapGenerator({ silent: true });
      const consoleSpy = jest.spyOn(console, 'log');
      
      generator.log('test message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should log in non-silent mode', () => {
      const generator = new SitemapGenerator({ silent: false });
      const consoleSpy = jest.spyOn(console, 'log');
      
      generator.log('test message');
      
      expect(consoleSpy).toHaveBeenCalledWith('test message');
      consoleSpy.mockRestore();
    });
  });
});