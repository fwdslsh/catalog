/**
 * Security utilities for Catalog CLI
 * Provides path validation, sanitization, and security checks
 */

import { resolve, normalize, isAbsolute, relative, dirname } from "path";
import { stat, readlink } from "fs/promises";
const RESERVED_NAMES = [
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
];
const SUSPICIOUS_DOMAINS = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "t.co", // URL shorteners
  "localhost",
  "127.0.0.1",
  "0.0.0.0", // Local addresses
  "file://",
  "ftp://", // Non-HTTP protocols
];

const SUSPICIOUS_PATTERNS = [
  /\d+\.\d+\.\d+\.\d+/, // IP addresses
  /(.)\1{10,}/, // Repeated characters (domain generation algorithms)
];

/**
 * Path security validator
 */
export class PathSecurity {
  constructor(options = {}) {
    this.allowSymlinks = options.allowSymlinks || false;
    this.maxPathLength = options.maxPathLength || 4096;
    this.allowedPathPrefixes = options.allowedPathPrefixes || [];
    this.blockedPathSegments = options.blockedPathSegments || [
      "..",
      "..",
      "node_modules",
      ".git",
      ".env",
      "secrets",
      "private",
      "confidential",
    ];
  }

  /**
   * Validate a file path for security issues
   */
  validatePath(filePath, basePath = null) {
    const issues = [];

    // Check path length
    if (filePath.length > this.maxPathLength) {
      issues.push(
        `Path too long: ${filePath.length} > ${this.maxPathLength} characters`
      );
    }

    // Check for null bytes (path traversal attempt)
    if (filePath.includes("\0")) {
      issues.push("Path contains null bytes");
    }

    // Check for suspicious characters
    const suspiciousChars = /[<>:"|?*\x00-\x1f]/;
    if (suspiciousChars.test(filePath)) {
      issues.push("Path contains suspicious characters");
    }

    // Normalize and resolve path - convert to forward slashes for cross-platform consistency
    const normalizedPath = normalize(filePath).replace(/\\/g, "/");
    const resolvedPath = basePath
      ? resolve(basePath, filePath)
      : resolve(filePath);

    // Check for path traversal
    if (normalizedPath.includes("..")) {
      issues.push("Path contains directory traversal sequences (..)");
    }

    // Check against blocked segments
    const pathSegments = normalizedPath.split(/[/\\]/);
    for (const segment of pathSegments) {
      if (this.blockedPathSegments.includes(segment.toLowerCase())) {
        issues.push(`Path contains blocked segment: ${segment}`);
      }
    }

    // Check if path is within allowed prefixes (if specified)
    if (this.allowedPathPrefixes.length > 0 && basePath) {
      const isAllowed = this.allowedPathPrefixes.some((prefix) => {
        const fullPrefix = resolve(basePath, prefix);
        return resolvedPath.startsWith(fullPrefix);
      });

      if (!isAllowed) {
        issues.push("Path is outside allowed directories");
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      normalizedPath,
      resolvedPath,
    };
  }

  /**
   * Check if a path is safe to access
   */
  async isPathSafe(filePath, basePath = null) {
    const validation = this.validatePath(filePath, basePath);
    if (!validation.valid) {
      return { safe: false, issues: validation.issues };
    }

    try {
      const stats = await stat(validation.resolvedPath);

      // Check if it's a symbolic link
      if (stats.isSymbolicLink()) {
        if (!this.allowSymlinks) {
          return { safe: false, issues: ["Symbolic links not allowed"] };
        }

        // Validate the symlink target
        const linkTarget = await readlink(validation.resolvedPath);
        const targetValidation = this.validatePath(
          linkTarget,
          dirname(validation.resolvedPath)
        );
        if (!targetValidation.valid) {
          return {
            safe: false,
            issues: [
              `Symlink target unsafe: ${targetValidation.issues.join(", ")}`,
            ],
          };
        }
      }

      return { safe: true, stats };
    } catch (error) {
      if (error.code === "ENOENT") {
        return { safe: true, exists: false }; // Non-existent paths are safe to create
      }
      return { safe: false, issues: [`Filesystem error: ${error.message}`] };
    }
  }

  /**
   * Sanitize a filename for safe usage
   */
  sanitizeFilename(filename) {
    // Remove or replace dangerous characters
    let sanitized = filename
      .replace(/[<>:"|?*\x00-\x1f]/g, "_") // Replace control chars and dangerous chars
      .replace(/^\.+/, "") // Remove leading dots
      .replace(/\.+$/, "") // Remove trailing dots
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/_+/g, "_") // Collapse multiple underscores
      .slice(0, 255); // Limit length

    // Ensure it's not empty
    if (!sanitized) {
      sanitized = "sanitized_file";
    }

    // Check for reserved names (Windows)
    if (RESERVED_NAMES.includes(sanitized.toUpperCase())) {
      sanitized = "_" + sanitized;
    }

    return sanitized;
  }

  /**
   * Create a secure relative path
   */
  createSecureRelativePath(fromPath, toPath) {
    try {
      const relativePath = relative(fromPath, toPath).replace(/\\/g, "/");
      const validation = this.validatePath(relativePath);

      if (!validation.valid) {
        throw new Error(
          `Unsafe relative path: ${validation.issues.join(", ")}`
        );
      }

      return relativePath;
    } catch (error) {
      throw new Error(`Cannot create secure relative path: ${error.message}`);
    }
  }
}

/**
 * File security validator
 */
export class FileSecurity {
  constructor(options = {}) {
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB default
    this.allowedExtensions = options.allowedExtensions || [
      ".md",
      ".mdx",
      ".html",
      ".txt",
      ".json",
    ];
    this.blockedExtensions = options.blockedExtensions || [
      ".exe",
      ".bat",
      ".sh",
      ".ps1",
      ".cmd",
    ];
    this.maxFilesPerDirectory = options.maxFilesPerDirectory || 10000;
    this.scanForMaliciousContent = options.scanForMaliciousContent !== false;
  }

  /**
   * Validate file security
   */
  async validateFile(filePath, stats = null) {
    const issues = [];

    try {
      const fileStats = stats || (await stat(filePath));

      // Check file size
      if (fileStats.size > this.maxFileSize) {
        issues.push(
          `File too large: ${fileStats.size} bytes > ${this.maxFileSize} bytes`
        );
      }

      // Check file extension
      const extension = filePath.toLowerCase().slice(filePath.lastIndexOf("."));

      if (this.blockedExtensions.includes(extension)) {
        issues.push(`Blocked file extension: ${extension}`);
      }

      if (
        this.allowedExtensions.length > 0 &&
        !this.allowedExtensions.includes(extension)
      ) {
        issues.push(`File extension not in allowed list: ${extension}`);
      }

      // Check if it's a regular file
      if (!fileStats.isFile()) {
        issues.push("Not a regular file");
      }

      return {
        valid: issues.length === 0,
        issues,
        stats: fileStats,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Cannot validate file: ${error.message}`],
      };
    }
  }

  /**
   * Scan file content for malicious patterns
   */
  async scanContent(content, filePath = "unknown") {
    if (!this.scanForMaliciousContent) {
      return { safe: true };
    }

    const issues = [];

    // Check for script injections
    const scriptPatterns = [
      /<script[^>]*>.*?<\/script>/gis,
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /onclick\s*=/gi,
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        issues.push(`Potential script injection detected in ${filePath}`);
        break;
      }
    }

    // Check for potential malicious URLs
    const urlPattern = /https?:\/\/[^\s<>"]+/gi;
    const urls = content.match(urlPattern) || [];

    for (const url of urls) {
      if (this.isSuspiciousURL(url)) {
        issues.push(`Suspicious URL detected: ${url}`);
      }
    }

    // Check for base64 encoded content (potential data exfiltration)
    const base64Pattern =
      /(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?/g;
    const base64Matches = content.match(base64Pattern) || [];

    for (const match of base64Matches) {
      if (match.length > 1000) {
        // Only flag very long base64 strings
        issues.push(
          `Large base64 encoded content detected (${match.length} chars)`
        );
      }
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  /**
   * Check if a URL looks suspicious
   */
  isSuspiciousURL(url) {
    const urlLower = url.toLowerCase();

    // Check against suspicious domains
    for (const domain of SUSPICIOUS_DOMAINS) {
      if (urlLower.includes(domain)) {
        return true;
      }
    }

    // Check against suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(urlLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate directory for file count limits
   */
  async validateDirectory(dirPath, fileCount) {
    const issues = [];

    if (fileCount > this.maxFilesPerDirectory) {
      issues.push(
        `Too many files in directory: ${fileCount} > ${this.maxFilesPerDirectory}`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize user input for logging
   */
  static sanitizeForLog(input) {
    if (typeof input !== "string") {
      input = String(input);
    }

    return input
      .replace(/[\x00-\x1f\x7f-\x9f]/g, "") // Remove control characters
      .replace(/[<>&"']/g, (char) => {
        // Escape HTML chars
        const escapes = {
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#x27;",
        };
        return escapes[char];
      })
      .slice(0, 1000); // Limit length
  }

  /**
   * Sanitize URL input
   */
  static sanitizeURL(url) {
    if (typeof url !== "string") {
      throw new Error("URL must be a string");
    }

    // Basic URL validation
    try {
      const urlObj = new URL(url);

      // Only allow HTTP and HTTPS
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are allowed");
      }

      // Rebuild URL to normalize it
      return urlObj.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }

  /**
   * Sanitize glob pattern
   */
  static sanitizeGlobPattern(pattern) {
    if (typeof pattern !== "string") {
      throw new Error("Glob pattern must be a string");
    }

    // Remove dangerous characters but keep glob-specific ones
    const sanitized = pattern
      .replace(/[\x00-\x1f]/g, "") // Remove control characters
      .replace(/[<>:"|]/g, "") // Remove dangerous file chars but keep *, ?, [], {}
      .slice(0, 500); // Limit length

    if (!sanitized) {
      throw new Error("Empty glob pattern after sanitization");
    }

    return sanitized;
  }
}

/**
 * Security audit utilities
 */
export class SecurityAuditor {
  constructor(options = {}) {
    this.pathSecurity = new PathSecurity(options.pathSecurity);
    this.fileSecurity = new FileSecurity(options.fileSecurity);
    this.auditLog = [];
  }

  /**
   * Audit a file path and content
   */
  async auditFile(filePath, content = null, basePath = null) {
    const audit = {
      filePath,
      timestamp: new Date(),
      pathSecurity: null,
      fileSecurity: null,
      contentSecurity: null,
      overall: "unknown",
    };

    try {
      // Path security check
      const pathCheck = await this.pathSecurity.isPathSafe(filePath, basePath);
      audit.pathSecurity = pathCheck;

      if (pathCheck.safe) {
        // File security check
        const fileCheck = await this.fileSecurity.validateFile(
          filePath,
          pathCheck.stats
        );
        audit.fileSecurity = fileCheck;

        // Content security check (if content provided)
        if (content) {
          const contentCheck = await this.fileSecurity.scanContent(
            content,
            filePath
          );
          audit.contentSecurity = contentCheck;
        }
      }

      // Determine overall security status
      const hasPathIssues = !audit.pathSecurity.safe;
      const hasFileIssues = audit.fileSecurity && !audit.fileSecurity.valid;
      const hasContentIssues =
        audit.contentSecurity && !audit.contentSecurity.safe;

      if (hasPathIssues || hasFileIssues || hasContentIssues) {
        audit.overall = "unsafe";
      } else {
        audit.overall = "safe";
      }
    } catch (error) {
      audit.error = error.message;
      audit.overall = "error";
    }

    this.auditLog.push(audit);
    return audit;
  }

  /**
   * Get audit summary
   */
  getAuditSummary() {
    const total = this.auditLog.length;
    const safe = this.auditLog.filter((a) => a.overall === "safe").length;
    const unsafe = this.auditLog.filter((a) => a.overall === "unsafe").length;
    const errors = this.auditLog.filter((a) => a.overall === "error").length;

    const issues = this.auditLog
      .filter((a) => a.overall === "unsafe")
      .reduce((acc, audit) => {
        if (audit.pathSecurity && !audit.pathSecurity.safe) {
          acc.push(
            ...audit.pathSecurity.issues.map((issue) => ({
              file: audit.filePath,
              type: "path",
              issue,
            }))
          );
        }
        if (audit.fileSecurity && !audit.fileSecurity.valid) {
          acc.push(
            ...audit.fileSecurity.issues.map((issue) => ({
              file: audit.filePath,
              type: "file",
              issue,
            }))
          );
        }
        if (audit.contentSecurity && !audit.contentSecurity.safe) {
          acc.push(
            ...audit.contentSecurity.issues.map((issue) => ({
              file: audit.filePath,
              type: "content",
              issue,
            }))
          );
        }
        return acc;
      }, []);

    return {
      total,
      safe,
      unsafe,
      errors,
      securityScore: total > 0 ? Math.round((safe / total) * 100) : 100,
      issues,
    };
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog = [];
  }
}
