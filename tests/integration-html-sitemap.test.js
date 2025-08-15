import { CatalogProcessor } from '../src/CatalogProcessor.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('HTML and Sitemap Integration Tests', () => {
  const testInputDir = './tests/integration_html_input';
  const testOutputDir = './tests/integration_html_output';
  const baseUrl = 'https://docs.example.com';

  beforeAll(async () => {
    // Create test input directory with mixed HTML and Markdown files
    await mkdir(testInputDir, { recursive: true });
    
    // Create index.html with site metadata
    await writeFile(join(testInputDir, 'index.html'), `---
title: "Documentation Site"
description: "Complete documentation for our platform"
instructions: "Use this site to learn about our APIs and features"
---
<!DOCTYPE html>
<html>
<head>
    <title>Documentation Site</title>
    <meta name="description" content="Complete documentation for our platform">
    <meta name="instructions" content="Use this site to learn about our APIs and features">
    <meta name="sitemap-priority" content="1.0">
    <meta name="sitemap-changefreq" content="weekly">
</head>
<body>
    <h1>Welcome to Our Documentation</h1>
    <p>This is the main landing page for our documentation site.</p>
    <ul>
        <li><a href="/api/">API Documentation</a></li>
        <li><a href="/guides/">User Guides</a></li>
    </ul>
</body>
</html>`);

    // Create API directory with HTML documentation
    await mkdir(join(testInputDir, 'api'), { recursive: true });
    await writeFile(join(testInputDir, 'api/overview.html'), `<!DOCTYPE html>
<html>
<head>
    <title>API Overview</title>
    <meta name="description" content="Overview of our REST API">
    <meta name="sitemap-priority" content="0.8">
    <meta name="sitemap-changefreq" content="monthly">
</head>
<body>
    <h1>API Overview</h1>
    <p>Our REST API provides access to all platform features.</p>
    
    <h2>Authentication</h2>
    <p>Use API keys for authentication.</p>
    
    <h2>Endpoints</h2>
    <table>
        <thead>
            <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>GET</td>
                <td>/api/v1/users</td>
                <td>List users</td>
            </tr>
            <tr>
                <td>POST</td>
                <td>/api/v1/users</td>
                <td>Create user</td>
            </tr>
        </tbody>
    </table>
</body>
</html>`);

    // Create guides directory with mixed Markdown and HTML
    await mkdir(join(testInputDir, 'guides'), { recursive: true });
    
    await writeFile(join(testInputDir, 'guides/getting-started.md'), `---
title: "Getting Started Guide"
description: "Quick start guide for new users"
priority: "0.9"
changefreq: "monthly"
---

# Getting Started

Welcome to our platform! This guide will help you get up and running quickly.

## Step 1: Account Setup

Create your account and verify your email.

## Step 2: First Project

Create your first project and explore the interface.
`);

    await writeFile(join(testInputDir, 'guides/advanced.html'), `<!DOCTYPE html>
<html>
<head>
    <title>Advanced Configuration</title>
    <meta name="description" content="Advanced configuration options">
    <meta name="sitemap-priority" content="0.6">
    <meta name="sitemap-changefreq" content="yearly">
</head>
<body>
    <h1>Advanced Configuration</h1>
    <p>This guide covers advanced configuration options for power users.</p>
    
    <h2>Environment Variables</h2>
    <pre><code>
    API_KEY=your_api_key
    DEBUG=true
    </code></pre>
</body>
</html>`);

    // Create a reference directory with Markdown only
    await mkdir(join(testInputDir, 'reference'), { recursive: true });
    await writeFile(join(testInputDir, 'reference/cli.md'), `# CLI Reference

Command-line interface reference documentation.

## Commands

- \`catalog --help\` - Show help
- \`catalog --input DIR\` - Set input directory
`);
  });

  afterAll(async () => {
    await rm(testInputDir, { recursive: true, force: true });
    await rm(testOutputDir, { recursive: true, force: true });
    await rm(testOutputDir + '_sitemap', { recursive: true, force: true });
    await rm(testOutputDir + '_no_sitemap', { recursive: true, force: true });
  });

  describe('Complete HTML Processing Workflow', () => {
    test('should process mixed HTML and Markdown files with sitemap generation', async () => {
      const sitemapOutputDir = testOutputDir + '_sitemap';
      const processor = new CatalogProcessor(testInputDir, sitemapOutputDir, {
        generateSitemap: true,
        sitemapNoExtensions: true,
        baseUrl: baseUrl,
        silent: true
      });

      await processor.process();

      // Verify output files were created
      const llmsContent = await readFile(join(sitemapOutputDir, 'llms.txt'), 'utf8');
      const sitemapContent = await readFile(join(sitemapOutputDir, 'sitemap.xml'), 'utf8');

      // Check llms.txt structure
      expect(llmsContent).toContain('# Documentation Site');
      expect(llmsContent).toContain('> Complete documentation for our platform');
      expect(llmsContent).toContain('## Root');
      expect(llmsContent).toContain('## api');
      expect(llmsContent).toContain('## guides'); 
      expect(llmsContent).toContain('## reference');

      // HTML files should be converted and included
      expect(llmsContent).toContain('index.html.md'); // Shows HTML conversion
      expect(llmsContent).toContain('overview.html.md');
      expect(llmsContent).toContain('advanced.html.md');
      
      // Markdown files should be included normally
      expect(llmsContent).toContain('getting-started.md');
      expect(llmsContent).toContain('cli.md');

      // Check sitemap.xml structure
      expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemapContent).toContain('</urlset>');

      // Check URLs (extensions stripped)
      expect(sitemapContent).toContain('<loc>https://docs.example.com/</loc>'); // index converted
      expect(sitemapContent).toContain('<loc>https://docs.example.com/api/overview</loc>');
      expect(sitemapContent).toContain('<loc>https://docs.example.com/guides/getting-started</loc>');
      expect(sitemapContent).toContain('<loc>https://docs.example.com/guides/advanced</loc>');
      expect(sitemapContent).toContain('<loc>https://docs.example.com/reference/cli</loc>');

      // Check sitemap metadata from HTML files
      expect(sitemapContent).toContain('<priority>1</priority>'); // index.html metadata (trailing .0 stripped)
      expect(sitemapContent).toContain('<changefreq>weekly</changefreq>'); // index.html metadata
      expect(sitemapContent).toContain('<priority>0.8</priority>'); // overview.html metadata  
      expect(sitemapContent).toContain('<changefreq>monthly</changefreq>'); // from both HTML and MD
      expect(sitemapContent).toContain('<priority>0.6</priority>'); // advanced.html metadata
      expect(sitemapContent).toContain('<changefreq>yearly</changefreq>'); // advanced.html metadata

      // Note: getting-started.md uses frontmatter priority but falls back to path-based logic
    });

    test('should process HTML files without sitemap generation', async () => {
      const noSitemapOutputDir = testOutputDir + '_no_sitemap';
      const processor = new CatalogProcessor(testInputDir, noSitemapOutputDir, {
        generateSitemap: false,
        baseUrl: baseUrl,
        silent: true
      });

      await processor.process();

      // Verify llms.txt was created but not sitemap.xml
      const llmsContent = await readFile(join(noSitemapOutputDir, 'llms.txt'), 'utf8');
      expect(llmsContent).toContain('# Documentation Site');
      expect(llmsContent).toContain('overview.html.md');

      // Sitemap should not exist
      try {
        await readFile(join(noSitemapOutputDir, 'sitemap.xml'), 'utf8');
        throw new Error('sitemap.xml should not exist when generateSitemap is false');
      } catch (error) {
        expect(error.code).toBe('ENOENT');
      }
    });

    test('should handle HTML files with complex content conversion', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        silent: true
      });

      await processor.process();

      const llmsFullContent = await readFile(join(testOutputDir, 'llms-full.txt'), 'utf8');

      // Check that HTML was converted to Markdown
      expect(llmsFullContent).toContain('# API Overview'); // H1 converted
      expect(llmsFullContent).toContain('## Authentication'); // H2 converted
      expect(llmsFullContent).toContain('## Endpoints'); // H2 converted
      
      // Lists should be converted
      expect(llmsFullContent).toContain('*   [API Documentation]'); // HTML list converted
      
      // Code blocks should be converted
      expect(llmsFullContent).toContain('API_KEY=your_api_key'); // Pre/code converted
      
      // Original HTML structure should not be present
      expect(llmsFullContent).not.toContain('<table>');
      expect(llmsFullContent).not.toContain('<thead>');
      expect(llmsFullContent).not.toContain('<tbody>');
      expect(llmsFullContent).not.toContain('<!DOCTYPE html>');
    });

    test('should extract comprehensive metadata from HTML files', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true,
        baseUrl: baseUrl,
        silent: true
      });

      // Process files and check that metadata extraction worked
      const scanner = processor.directoryScanner;
      const files = await scanner.scanDirectory(testInputDir);
      const documents = await processor.contentProcessor.processFiles(files);

      // Find the HTML documents
      const indexDoc = documents.find(d => d.originalPath === 'index.html');
      const overviewDoc = documents.find(d => d.originalPath === 'api/overview.html');
      const advancedDoc = documents.find(d => d.originalPath === 'guides/advanced.html');

      // Check index.html metadata
      expect(indexDoc).toBeDefined();
      expect(indexDoc.metadata.title).toBe('Documentation Site');
      expect(indexDoc.metadata.description).toBe('Complete documentation for our platform');
      expect(indexDoc.metadata.instructions).toBe('Use this site to learn about our APIs and features');
      expect(indexDoc.metadata['sitemap-priority']).toBe('1.0');
      expect(indexDoc.metadata['sitemap-changefreq']).toBe('weekly');

      // Check API overview metadata
      expect(overviewDoc).toBeDefined();
      expect(overviewDoc.metadata.title).toBe('API Overview');
      expect(overviewDoc.metadata.description).toBe('Overview of our REST API');
      expect(overviewDoc.metadata['sitemap-priority']).toBe('0.8');
      expect(overviewDoc.metadata['sitemap-changefreq']).toBe('monthly');

      // Check advanced guide metadata
      expect(advancedDoc).toBeDefined();
      expect(advancedDoc.metadata.title).toBe('Advanced Configuration');
      expect(advancedDoc.metadata.description).toBe('Advanced configuration options');
      expect(advancedDoc.metadata['sitemap-priority']).toBe('0.6');
      expect(advancedDoc.metadata['sitemap-changefreq']).toBe('yearly');
    });
  });

  describe('Error Handling', () => {
    test('should require base URL for sitemap generation', async () => {
      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true,
        baseUrl: null, // Missing base URL
        silent: true
      });

      await expect(processor.process()).rejects.toThrow('--base-url is required when using --sitemap');
    });

    test('should handle HTML files with malformed metadata gracefully', async () => {
      // Create a temporary HTML file with malformed metadata
      const malformedHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Malformed</title>
    <meta name="description" content="Test without closing quote>
    <meta name="priority" content="invalid-priority">
</head>
<body>
    <h1>Test</h1>
</body>
</html>`;

      await writeFile(join(testInputDir, 'malformed.html'), malformedHtml);

      const processor = new CatalogProcessor(testInputDir, testOutputDir, {
        generateSitemap: true,
        baseUrl: baseUrl,
        silent: true
      });

      // Should not throw error, should handle gracefully
      await expect(processor.process()).resolves.toBeUndefined();

      // Clean up
      await rm(join(testInputDir, 'malformed.html'));
    });
  });
});