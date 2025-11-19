import { resolve, basename, join } from "path";
import { readFile } from "fs/promises";
import { DirectoryScanner } from "./DirectoryScanner.js";
import { ContentProcessor } from "./ContentProcessor.js";
import { OutputGenerator } from "./OutputGenerator.js";
import { IndexGenerator } from "./IndexGenerator.js";
import { TocGenerator } from "./TocGenerator.js";
import { SitemapGenerator } from "./SitemapGenerator.js";
import { Validator } from "./Validator.js";
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
 * to specialized classes (DirectoryScanner, ContentProcessor, OutputGenerator, etc.)
 *
 * @example
 * const processor = new CatalogProcessor('./docs', './output', {
 *   validate: true,
 *   generateSitemap: true,
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
   * @param {boolean} [options.silent=false] - Suppress non-error output
   * @param {boolean} [options.generateIndex=false] - Generate index.json navigation files
   * @param {boolean} [options.generateSitemap=false] - Generate XML sitemap
   * @param {boolean} [options.sitemapNoExtensions=false] - Strip file extensions from sitemap URLs
   * @param {boolean} [options.validate=false] - Validate output against llms.txt standard
   * @param {string} [options.baseUrl=null] - Base URL for generating absolute links
   * @param {string[]} [options.optionalPatterns=[]] - Glob patterns for optional content
   * @param {string[]} [options.includeGlobs=[]] - Glob patterns to include
   * @param {string[]} [options.excludeGlobs=[]] - Glob patterns to exclude
   * @param {boolean} [options.continueOnError=true] - Continue processing on non-fatal errors
   * @param {boolean} [options.enablePerformanceMonitoring=true] - Enable performance tracking
   * @param {number} [options.maxFileSize=10485760] - Maximum file size in bytes (default 10MB)
   * @param {number} [options.warnFileSize=5242880] - File size warning threshold (default 5MB)
   */
  constructor(inputDir = ".", outputDir = ".", options = {}) {
    this.inputDir = resolve(inputDir);
    this.outputDir = resolve(outputDir);
    this.silent = options.silent || false;
    this.generateIndex = options.generateIndex || false;
    this.generateToc = options.generateToc || false;
    this.generateSitemap = options.generateSitemap || false;
    this.sitemapNoExtensions = options.sitemapNoExtensions || false;
    this.validate = options.validate || false;
    this.baseUrl = options.baseUrl || null;
    this.optionalPatterns = options.optionalPatterns || [];
    this.continueOnError = options.continueOnError !== false; // Default to true for graceful degradation
    this.enablePerformanceMonitoring = options.enablePerformanceMonitoring !== false; // Default to true
    
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
        maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
        warnFileSize: options.warnFileSize || 5 * 1024 * 1024  // 5MB
      });
    }
    
    // Initialize specialized components
    this.directoryScanner = new DirectoryScanner({
      excludePatterns: [
        "node_modules",
        ".git", 
        "dist",
        "build", 
        "out",
        "coverage",
        ".next",
        ".nuxt",
        ".output",
        ".vercel",
        ".netlify"
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
    
    if (this.generateSitemap) {
      this.sitemapGenerator = new SitemapGenerator({
        silent: this.silent,
        stripExtensions: this.sitemapNoExtensions
      });
    }
  }

  /**
   * Log a message if not in silent mode
   *
   * @param {...*} args - Arguments to log
   * @private
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }

  /**
   * Process the input directory and generate all output files
   *
   * Executes the complete workflow:
   * 1. Validates input directory
   * 2. Scans for Markdown and HTML files
   * 3. Extracts site metadata from root index
   * 4. Processes files with graceful error handling
   * 5. Generates sections automatically
   * 6. Applies optional patterns
   * 7. Generates outputs (llms.txt, llms-full.txt, llms-ctx.txt)
   * 8. Generates sitemap if requested
   * 9. Generates navigation indexes if requested
   * 10. Validates output if requested
   *
   * @returns {Promise<void>}
   * @throws {InvalidInputError} If input directory is invalid
   * @throws {FileAccessError} If files cannot be accessed or read
   * @throws {ValidationError} If validation is enabled and output doesn't comply with llms.txt standard
   *
   * @example
   * const processor = new CatalogProcessor('./docs', './build');
   * try {
   *   await processor.process();
   *   console.log('Processing complete!');
   * } catch (error) {
   *   console.error('Processing failed:', error.message);
   *   process.exit(error.exitCode || 1);
   * }
   */
  async process() {
    if (this.performanceMonitor) {
      this.performanceMonitor.startTimer('total_processing');
    }
    
    try {
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

      // 3. Extract site metadata
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
        // Site metadata extraction is optional, continue with defaults
        this.errorHandler.addWarning(
          'Could not extract site metadata, using defaults',
          'metadata extraction'
        );
        siteMetadata = { title: basename(this.inputDir), description: '' };
      }

      // 4. Process files with graceful degradation
      const documents = [];
      const failedFiles = [];
      
      for (const file of files) {
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
      
      // 5. Generate sections automatically
      const sections = this.contentProcessor.generateSections(documents);
      
      // 6. Apply optional patterns
      const { regularSections, optionalDocs } = 
        this.contentProcessor.applyOptionalPatterns(sections, this.optionalPatterns);

      // 7. Generate outputs
      await this.outputGenerator.generateAllOutputs(
        siteMetadata, regularSections, optionalDocs, this.baseUrl
      );
      
      // 8. Generate sitemap if requested
      if (this.generateSitemap) {
        if (!this.baseUrl) {
          throw new InvalidInputError(
            '--base-url is required when using --sitemap',
            'Use --base-url <url> to specify the base URL for sitemap generation'
          );
        }
        this.log('Generating sitemap...');
        const allDocuments = [...documents]; // Include all documents in sitemap
        await this.sitemapGenerator.generateSitemap(allDocuments, this.baseUrl, this.outputDir);
        this.log('✔ Sitemap generated');
      }
      
      // 9. Generate index files if requested
      if (this.generateIndex) {
        this.log('Generating index.json files...');
        await this.indexGenerator.generateAll();
        this.log('✔ index.json files generated');
      }
      
      // 10. Generate TOC files if requested
      if (this.generateToc) {
        if (!this.generateIndex) {
          throw new InvalidInputError(
            '--toc requires --index to be enabled',
            'TOC generation depends on index.json files. Use --index flag along with --toc'
          );
        }
        this.log('Generating TOC files...');
        await this.tocGenerator.generateAll();
        this.log('✔ TOC files generated');
      }

      // 11. Validate output if requested
      if (this.validate) {
        this.log('Validating output...');
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
          this.log('✔ Output validation passed');
        }
      }

      // Print error summary if there were any warnings or recoverable errors
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
        
        // Add file size statistics
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
        
        // Check memory usage
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
      
      // Re-throw the error with proper exit code
      throw catalogError;
    }
  }
}