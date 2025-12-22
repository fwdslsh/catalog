import { resolve, basename, join } from "path";
import { readFile, mkdir } from "fs/promises";
import { DirectoryScanner } from "./DirectoryScanner.js";
import { ContentProcessor } from "./ContentProcessor.js";
import { OutputGenerator } from "./OutputGenerator.js";
import { IndexGenerator } from "./IndexGenerator.js";
import { TocGenerator } from "./TocGenerator.js";
import { AstGenerator } from "./AstGenerator.js";
import { SitemapGenerator } from "./SitemapGenerator.js";
import { Validator } from "./Validator.js";
import { ManifestGenerator } from "./ManifestGenerator.js";
import { ChunkGenerator } from "./ChunkGenerator.js";
import { ContextBundler } from "./ContextBundler.js";
import { TagGenerator } from "./TagGenerator.js";
import { LinkGraphGenerator } from "./LinkGraphGenerator.js";
import { CacheManager } from "./CacheManager.js";
import {
  ErrorHandler,
  InvalidInputError,
  FileAccessError,
  ValidationError,
  categorizeError
} from "./errors.js";
import { PerformanceMonitor, FileSizeMonitor } from "./PerformanceMonitor.js";

/**
 * CatalogProcessor - Main orchestrator for the Catalog tool
 *
 * Coordinates the entire workflow from file discovery to output generation,
 * following Single Responsibility Principle by delegating specific tasks
 * to specialized classes. Extended with PAI (Programmable AI) features
 * for advanced content packaging.
 *
 * @example
 * const processor = new CatalogProcessor('./docs', './output', {
 *   validate: true,
 *   generateManifest: true,
 *   generateChunks: true,
 *   baseUrl: 'https://example.com'
 * });
 * await processor.process();
 */
export class CatalogProcessor {
  /**
   * Create a new CatalogProcessor instance
   *
   * @param {string} [inputDir="."] - Source directory containing Markdown/HTML files
   * @param {string} [outputDir="."] - Destination directory for generated files
   * @param {Object} [options={}] - Configuration options
   */
  constructor(inputDir = ".", outputDir = ".", options = {}) {
    this.inputDir = resolve(inputDir);
    this.outputDir = resolve(outputDir);
    this.silent = options.silent || false;

    // Standard options
    this.generateIndex = options.generateIndex || false;
    this.generateToc = options.generateToc || false;
    this.generateAst = options.generateAst || false;
    this.astExtensions = options.astExtensions || [];
    this.generateSitemap = options.generateSitemap || false;
    this.sitemapNoExtensions = options.sitemapNoExtensions || false;
    this.validate = options.validate || false;
    this.baseUrl = options.baseUrl || null;
    this.optionalPatterns = options.optionalPatterns || [];

    // PAI features
    this.generateManifest = options.generateManifest || false;
    this.generateChunks = options.generateChunks || false;
    this.chunkProfile = options.chunkProfile || 'default';
    this.generateTags = options.generateTags || false;
    this.generateGraph = options.generateGraph || false;
    this.generateBundles = options.generateBundles || false;
    this.bundleSizes = options.bundleSizes || [2000, 8000, 32000];

    // Caching
    this.enableCache = options.enableCache || false;
    this.cacheDir = options.cacheDir || null;
    this.forceRebuild = options.forceRebuild || false;

    // Validation
    this.validateAI = options.validateAI || false;

    // Provenance
    this.origin = options.origin || null;
    this.repoRef = options.repoRef || null;
    this.generatorVersion = options.generatorVersion || null;

    // Error handling
    this.continueOnError = options.continueOnError !== false;
    this.enablePerformanceMonitoring = options.enablePerformanceMonitoring !== false;

    // Initialize error handler
    this.errorHandler = new ErrorHandler({
      silent: this.silent,
      continueOnError: this.continueOnError
    });

    // Initialize performance monitoring
    if (this.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor({
        silent: this.silent
      });
      this.fileSizeMonitor = new FileSizeMonitor({
        maxFileSize: options.maxFileSize || 10 * 1024 * 1024,
        warnFileSize: options.warnFileSize || 5 * 1024 * 1024
      });
    }

    // Initialize core components
    this.directoryScanner = new DirectoryScanner({
      excludePatterns: [
        "node_modules", ".git", "dist", "build", "out", "coverage",
        ".next", ".nuxt", ".output", ".vercel", ".netlify"
      ],
      includeGlobs: options.includeGlobs || [],
      excludeGlobs: options.excludeGlobs || []
    });

    this.contentProcessor = new ContentProcessor(this.inputDir, {
      silent: this.silent
    });

    this.outputGenerator = new OutputGenerator(this.outputDir, {
      silent: this.silent,
      baseUrl: this.baseUrl
    });

    this.validator = new Validator({
      silent: this.silent
    });

    // Initialize optional standard generators
    if (this.generateIndex) {
      this.indexGenerator = new IndexGenerator(this.inputDir, this.outputDir, {
        excludePatterns: this.directoryScanner.excludePatterns,
        shouldExcludeFn: this.directoryScanner.shouldExclude.bind(this.directoryScanner),
        isMarkdownFileFn: this.directoryScanner.defaultIsMarkdownFile.bind(this.directoryScanner)
      });
    }

    if (this.generateToc) {
      this.tocGenerator = new TocGenerator(this.inputDir, this.outputDir, {
        silent: this.silent,
        baseUrl: this.baseUrl
      });
    }

    if (this.generateAst) {
      this.astGenerator = new AstGenerator(this.inputDir, this.outputDir, {
        silent: this.silent,
        extensions: this.astExtensions
      });
    }

    if (this.generateSitemap) {
      this.sitemapGenerator = new SitemapGenerator({
        silent: this.silent,
        stripExtensions: this.sitemapNoExtensions
      });
    }

    // Initialize PAI generators
    if (this.generateManifest) {
      this.manifestGenerator = new ManifestGenerator(this.outputDir, {
        silent: this.silent,
        origin: this.origin,
        repoRef: this.repoRef,
        generatorVersion: this.generatorVersion
      });
    }

    if (this.generateChunks) {
      this.chunkGenerator = new ChunkGenerator(this.outputDir, {
        silent: this.silent,
        profile: this.chunkProfile
      });
    }

    if (this.generateTags) {
      this.tagGenerator = new TagGenerator(this.outputDir, {
        silent: this.silent
      });
    }

    if (this.generateGraph) {
      this.linkGraphGenerator = new LinkGraphGenerator(this.outputDir, {
        silent: this.silent
      });
    }

    if (this.generateBundles) {
      this.contextBundler = new ContextBundler(this.outputDir, {
        silent: this.silent,
        bundleSizes: this.bundleSizes,
        baseUrl: this.baseUrl
      });
    }

    // Initialize cache manager
    if (this.enableCache) {
      this.cacheManager = new CacheManager({
        inputDir: this.inputDir,
        outputDir: this.outputDir,
        cacheDir: this.cacheDir,
        silent: this.silent,
        forceRebuild: this.forceRebuild
      });
    }
  }

  /**
   * Log a message if not in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }

  /**
   * Process the input directory and generate all output files
   */
  async process() {
    const startTime = Date.now();

    if (this.performanceMonitor) {
      this.performanceMonitor.startTimer('total_processing');
    }

    try {
      // Ensure output directory exists
      await mkdir(this.outputDir, { recursive: true });

      // Initialize cache if enabled
      if (this.cacheManager) {
        await this.cacheManager.initialize();
      }

      // 1. Validate input directory
      if (this.performanceMonitor) {
        this.performanceMonitor.startTimer('directory_validation');
      }
      try {
        await this.directoryScanner.validateDirectory(this.inputDir);
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('directory_validation');
        }
      } catch (error) {
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('directory_validation');
        }
        throw new InvalidInputError(
          `Invalid input directory: ${this.inputDir}`,
          error.message
        );
      }

      // 2. Scan for files
      if (this.performanceMonitor) {
        this.performanceMonitor.startTimer('file_scanning');
      }
      let files;
      try {
        files = await this.directoryScanner.scanDirectory(this.inputDir);
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('file_scanning');
          this.performanceMonitor.recordMetric('files_found', files.length);
        }
      } catch (error) {
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('file_scanning');
        }
        throw new FileAccessError(
          `Failed to scan directory: ${this.inputDir}`,
          error.message
        );
      }

      if (files.length === 0) {
        this.log("No documents found.");
        return;
      }

      this.log(`Scanned input: ${basename(this.inputDir)} (${files.length} files)`);

      // 3. Check cache for changed files (if caching enabled)
      let filesToProcess = files;
      if (this.cacheManager && !this.forceRebuild) {
        const changeInfo = await this.cacheManager.getChangedFiles(files);
        if (!changeInfo.requiresFullRebuild && changeInfo.changed.length === 0 && changeInfo.added.length === 0) {
          this.log('✔ No changes detected, using cached output');
          return;
        }
        if (changeInfo.changed.length > 0 || changeInfo.added.length > 0) {
          this.log(`📝 ${changeInfo.changed.length + changeInfo.added.length} file(s) changed`);
        }
        // For now, we still process all files but cache helps detect changes
        // Future: implement true incremental processing
      }

      // 4. Extract site metadata
      if (this.performanceMonitor) {
        this.performanceMonitor.startTimer('metadata_extraction');
      }
      let siteMetadata;
      try {
        siteMetadata = await this.contentProcessor.extractSiteMetadata();
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('metadata_extraction');
        }
      } catch (error) {
        if (this.performanceMonitor) {
          this.performanceMonitor.endTimer('metadata_extraction');
        }
        this.errorHandler.addWarning(
          'Could not extract site metadata, using defaults',
          'metadata extraction'
        );
        siteMetadata = { title: basename(this.inputDir), description: '' };
      }

      // 5. Process files with graceful degradation
      if (this.performanceMonitor) {
        this.performanceMonitor.startTimer('file_processing');
      }

      const documents = [];
      const failedFiles = [];

      for (const file of filesToProcess) {
        try {
          const processed = await this.contentProcessor.processFiles([file]);
          documents.push(...processed);
        } catch (error) {
          const fileError = this.errorHandler.handleError(
            error,
            `processing ${file}`
          );
          if (fileError.recoverable) {
            failedFiles.push(file);
          } else {
            throw fileError;
          }
        }
      }

      if (this.performanceMonitor) {
        this.performanceMonitor.endTimer('file_processing');
      }

      if (failedFiles.length > 0) {
        this.errorHandler.addWarning(
          `Failed to process ${failedFiles.length} file(s)`,
          'file processing'
        );
      }

      if (documents.length === 0) {
        throw new FileAccessError(
          'No files could be processed successfully',
          `Total files found: ${files.length}, Failed: ${failedFiles.length}`
        );
      }

      // Build document paths set for link validation
      const docPaths = new Set(documents.map(d => d.relativePath));

      // 6. Generate sections automatically
      const sections = this.contentProcessor.generateSections(documents);

      // 7. Apply optional patterns
      const { regularSections, optionalDocs } =
        this.contentProcessor.applyOptionalPatterns(sections, this.optionalPatterns);

      // 8. Generate standard outputs
      await this.outputGenerator.generateAllOutputs(
        siteMetadata, regularSections, optionalDocs, this.baseUrl
      );

      // ==========================================
      // PAI FEATURE GENERATION
      // ==========================================

      // Store generated artifacts for cross-referencing
      let chunks = null;
      let tags = null;
      let linkGraph = null;

      // 9. Generate link graph (needed for manifest and bundles)
      if (this.generateGraph) {
        this.log('Generating link graph...');
        linkGraph = await this.linkGraphGenerator.generate(documents);
      }

      // 10. Generate tags (needed for manifest)
      if (this.generateTags) {
        this.log('Generating semantic tags...');
        tags = await this.tagGenerator.generate(documents);
      }

      // 11. Generate chunks (needed for manifest and AI validation)
      if (this.generateChunks) {
        this.log('Generating chunks...');
        chunks = await this.chunkGenerator.generate(documents);
      }

      // 12. Generate manifest (uses graph, tags, chunks)
      if (this.generateManifest) {
        this.log('Generating manifest...');
        await this.manifestGenerator.generate(documents, siteMetadata, {
          linkGraph,
          tags,
          chunks
        });
      }

      // 13. Generate context bundles
      if (this.generateBundles) {
        this.log('Generating context bundles...');
        await this.contextBundler.generate(documents, siteMetadata, sections, {
          linkGraph
        });
      }

      // ==========================================
      // STANDARD OPTIONAL OUTPUTS
      // ==========================================

      // 14. Generate sitemap
      if (this.generateSitemap) {
        if (!this.baseUrl) {
          throw new InvalidInputError(
            '--base-url is required when using --sitemap',
            'Use --base-url <url> to specify the base URL for sitemap generation'
          );
        }
        this.log('Generating sitemap...');
        await this.sitemapGenerator.generateSitemap(documents, this.baseUrl, this.outputDir);
        this.log('✔ Sitemap generated');
      }

      // 15. Generate index files
      if (this.generateIndex) {
        this.log('Generating index.json files...');
        await this.indexGenerator.generateAll();
        this.log('✔ index.json files generated');
      }

      // 16. Generate TOC files
      if (this.generateToc) {
        if (!this.generateIndex) {
          throw new InvalidInputError(
            '--toc requires --index to be enabled',
            'TOC generation depends on index.json files'
          );
        }
        this.log('Generating TOC files...');
        await this.tocGenerator.generateAll();
        this.log('✔ TOC files generated');
      }

      // 17. Generate AST index
      if (this.generateAst) {
        this.log('Generating AST index...');
        await this.astGenerator.generateAll();
        this.log('✔ AST index generated');
      }

      // ==========================================
      // VALIDATION
      // ==========================================

      // 18. Standard llms.txt validation
      if (this.validate) {
        this.log('Validating llms.txt output...');
        const llmsPath = join(this.outputDir, 'llms.txt');
        const llmsContent = await readFile(llmsPath, 'utf8');

        const validation = this.validator.validateStructure(llmsContent);
        if (this.baseUrl) {
          const urlValidation = this.validator.validateAbsoluteUrls(llmsContent, this.baseUrl);
          validation.issues.push(...urlValidation.issues);
          validation.valid = validation.valid && urlValidation.valid;
        }

        if (!validation.valid) {
          throw new ValidationError(
            'Output validation failed',
            validation.issues
          );
        } else {
          this.log('✔ llms.txt validation passed');
        }
      }

      // 19. AI readiness validation
      if (this.validateAI) {
        this.log('Running AI readiness validation...');
        const aiReport = await this.validator.validateAIReadiness(documents, {
          chunks,
          docPaths
        });
        await this.validator.writeReport(aiReport, this.outputDir);

        if (!aiReport.valid) {
          this.log(`⚠️ AI readiness issues found: ${aiReport.summary.errors} error(s), ${aiReport.summary.warnings} warning(s)`);
        } else {
          this.log('✔ AI readiness validation passed');
        }
      }

      // ==========================================
      // FINALIZATION
      // ==========================================

      // 20. Update cache
      if (this.cacheManager) {
        const buildDuration = Date.now() - startTime;
        await this.cacheManager.updateCache(documents, {
          generatorVersion: this.generatorVersion,
          buildDuration
        });
      }

      // Print error summary
      const summary = this.errorHandler.getSummary();
      if (summary.warnings > 0 || summary.recoverableErrors > 0) {
        this.log('\n📊 Processing Summary:');
        if (summary.warnings > 0) {
          this.log(`  ⚠️  ${summary.warnings} warning(s)`);
        }
        if (summary.recoverableErrors > 0) {
          this.log(`  ⚠️  ${summary.recoverableErrors} recoverable error(s)`);
        }
        this.log(`  ✅ Processing completed with minor issues`);
      }

      // Print performance report
      if (this.performanceMonitor) {
        this.performanceMonitor.endTimer('total_processing');

        if (this.fileSizeMonitor) {
          const fileSizeStats = this.fileSizeMonitor.getStats();
          this.performanceMonitor.recordMetric('total_file_size',
            this.fileSizeMonitor.formatSize(fileSizeStats.totalSize));
          this.performanceMonitor.recordMetric('average_file_size',
            this.fileSizeMonitor.formatSize(fileSizeStats.averageSize));

          if (fileSizeStats.largeFiles > 0) {
            this.performanceMonitor.recordMetric('large_files', fileSizeStats.largeFiles);
          }
        }

        this.performanceMonitor.printReport();

        if (this.performanceMonitor.checkMemoryThreshold(500)) {
          this.errorHandler.addWarning(
            'High memory usage detected (>500MB)',
            'performance monitoring'
          );
        }
      }

    } catch (error) {
      // Ensure performance monitoring is stopped even on error
      if (this.performanceMonitor) {
        try {
          this.performanceMonitor.endTimer('total_processing');
        } catch (timerError) {
          // Timer might not be running, ignore
        }
      }

      const catalogError = categorizeError(error);

      if (!this.silent) {
        console.error('\n' + catalogError.getActionableMessage());
      }

      throw catalogError;
    }
  }
}
