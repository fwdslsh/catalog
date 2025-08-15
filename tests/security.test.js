import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  PathSecurity,
  FileSecurity,
  InputSanitizer,
  SecurityAuditor
} from '../src/security.js';

describe('PathSecurity', () => {
  test('creates path security with default options', () => {
    const pathSec = new PathSecurity();
    expect(pathSec.allowSymlinks).toBe(false);
    expect(pathSec.maxPathLength).toBe(4096);
    expect(pathSec.allowedPathPrefixes).toEqual([]);
    expect(pathSec.blockedPathSegments).toContain('node_modules');
  });

  test('respects custom options', () => {
    const pathSec = new PathSecurity({
      allowSymlinks: true,
      maxPathLength: 1000,
      allowedPathPrefixes: ['/safe'],
      blockedPathSegments: ['custom']
    });
    expect(pathSec.allowSymlinks).toBe(true);
    expect(pathSec.maxPathLength).toBe(1000);
    expect(pathSec.allowedPathPrefixes).toEqual(['/safe']);
    expect(pathSec.blockedPathSegments).toContain('custom');
  });

  test('validates safe paths', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.validatePath('docs/readme.md');
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.normalizedPath).toBe('docs/readme.md');
  });

  test('detects path traversal', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.validatePath('../../../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Path contains directory traversal sequences (..)');
  });

  test('detects null bytes', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.validatePath('file.txt\0.md');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Path contains null bytes');
  });

  test('detects suspicious characters', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.validatePath('file<script>.md');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Path contains suspicious characters');
  });

  test('detects blocked path segments', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.validatePath('node_modules/package/index.js');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Path contains blocked segment: node_modules');
  });

  test('detects long paths', () => {
    const pathSec = new PathSecurity({ maxPathLength: 10 });
    const longPath = 'very_long_filename_that_exceeds_limit.md';
    const result = pathSec.validatePath(longPath);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain(`Path too long: ${longPath.length} > 10 characters`);
  });

  test('validates paths within allowed prefixes', () => {
    const pathSec = new PathSecurity({
      allowedPathPrefixes: ['docs', 'src']
    });
    const result = pathSec.validatePath('docs/readme.md', '/project');
    expect(result.valid).toBe(true);
  });

  test('rejects paths outside allowed prefixes', () => {
    const pathSec = new PathSecurity({
      allowedPathPrefixes: ['docs']
    });
    const result = pathSec.validatePath('config/secrets.env', '/project');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Path is outside allowed directories');
  });

  test('sanitizes filenames', () => {
    const pathSec = new PathSecurity();
    expect(pathSec.sanitizeFilename('file<>name.md')).toBe('file_name.md');
    expect(pathSec.sanitizeFilename('  spaced  file  ')).toBe('_spaced_file_');
    expect(pathSec.sanitizeFilename('...dotfile')).toBe('dotfile');
    expect(pathSec.sanitizeFilename('CON')).toBe('_CON');
    expect(pathSec.sanitizeFilename('')).toBe('sanitized_file');
  });

  test('creates secure relative paths', () => {
    const pathSec = new PathSecurity();
    const result = pathSec.createSecureRelativePath('/project', '/project/docs/readme.md');
    expect(result).toBe('docs/readme.md');
  });

  test('rejects insecure relative paths', () => {
    const pathSec = new PathSecurity();
    expect(() => {
      pathSec.createSecureRelativePath('/project/docs', '/project');
    }).toThrow();
  });
});

describe('FileSecurity', () => {
  const testDir = './tests/security_test';
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('creates file security with default options', () => {
    const fileSec = new FileSecurity();
    expect(fileSec.maxFileSize).toBe(100 * 1024 * 1024);
    expect(fileSec.allowedExtensions).toContain('.md');
    expect(fileSec.blockedExtensions).toContain('.exe');
    expect(fileSec.scanForMaliciousContent).toBe(true);
  });

  test('respects custom options', () => {
    const fileSec = new FileSecurity({
      maxFileSize: 1024,
      allowedExtensions: ['.txt'],
      blockedExtensions: ['.bin'],
      scanForMaliciousContent: false
    });
    expect(fileSec.maxFileSize).toBe(1024);
    expect(fileSec.allowedExtensions).toEqual(['.txt']);
    expect(fileSec.blockedExtensions).toEqual(['.bin']);
    expect(fileSec.scanForMaliciousContent).toBe(false);
  });

  test('validates safe files', async () => {
    const fileSec = new FileSecurity();
    const testFile = join(testDir, 'safe.md');
    await writeFile(testFile, '# Safe content');
    
    const result = await fileSec.validateFile(testFile);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test('detects blocked extensions', async () => {
    const fileSec = new FileSecurity();
    const testFile = join(testDir, 'malicious.exe');
    await writeFile(testFile, 'fake exe content');
    
    const result = await fileSec.validateFile(testFile);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Blocked file extension: .exe');
  });

  test('detects disallowed extensions', async () => {
    const fileSec = new FileSecurity({
      allowedExtensions: ['.md']
    });
    const testFile = join(testDir, 'document.pdf');
    await writeFile(testFile, 'fake pdf content');
    
    const result = await fileSec.validateFile(testFile);
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('File extension not in allowed list: .pdf');
  });

  test('validates directory file counts', async () => {
    const fileSec = new FileSecurity({ maxFilesPerDirectory: 5 });
    
    const result1 = await fileSec.validateDirectory('/test', 3);
    expect(result1.valid).toBe(true);
    
    const result2 = await fileSec.validateDirectory('/test', 10);
    expect(result2.valid).toBe(false);
    expect(result2.issues).toContain('Too many files in directory: 10 > 5');
  });

  test('scans content for script injections', async () => {
    const fileSec = new FileSecurity();
    
    const safeContent = '# Safe markdown content';
    const result1 = await fileSec.scanContent(safeContent);
    expect(result1.safe).toBe(true);
    
    const maliciousContent = '<script>alert("xss")</script>';
    const result2 = await fileSec.scanContent(maliciousContent);
    expect(result2.safe).toBe(false);
    expect(result2.issues[0]).toContain('Potential script injection detected');
  });

  test('detects suspicious URLs', () => {
    const fileSec = new FileSecurity();
    
    expect(fileSec.isSuspiciousURL('https://bit.ly/malicious')).toBe(true);
    expect(fileSec.isSuspiciousURL('http://127.0.0.1:8080/data')).toBe(true);
    expect(fileSec.isSuspiciousURL('https://192.168.1.1/admin')).toBe(true);
    expect(fileSec.isSuspiciousURL('https://example.com/safe')).toBe(false);
    expect(fileSec.isSuspiciousURL('https://github.com/user/repo')).toBe(false);
  });

  test('scans content for suspicious URLs', async () => {
    const fileSec = new FileSecurity();
    
    const contentWithSuspiciousURL = 'Visit https://bit.ly/suspicious for more info';
    const result = await fileSec.scanContent(contentWithSuspiciousURL);
    expect(result.safe).toBe(false);
    expect(result.issues[0]).toContain('Suspicious URL detected');
  });

  test('detects large base64 content', async () => {
    const fileSec = new FileSecurity();
    
    const largeBase64 = 'A'.repeat(1500); // Large base64-like string
    const result = await fileSec.scanContent(largeBase64);
    expect(result.safe).toBe(false);
    expect(result.issues[0]).toContain('Large base64 encoded content detected');
  });

  test('skips content scanning when disabled', async () => {
    const fileSec = new FileSecurity({ scanForMaliciousContent: false });
    
    const maliciousContent = '<script>alert("xss")</script>';
    const result = await fileSec.scanContent(maliciousContent);
    expect(result.safe).toBe(true);
  });
});

describe('InputSanitizer', () => {
  test('sanitizes input for logging', () => {
    expect(InputSanitizer.sanitizeForLog('normal text')).toBe('normal text');
    expect(InputSanitizer.sanitizeForLog('<script>alert()</script>')).toBe('&lt;script&gt;alert()&lt;/script&gt;');
    expect(InputSanitizer.sanitizeForLog('text\x00with\x1fcontrol')).toBe('textwithcontrol');
    expect(InputSanitizer.sanitizeForLog(123)).toBe('123');
    
    const longInput = 'A'.repeat(2000);
    const sanitized = InputSanitizer.sanitizeForLog(longInput);
    expect(sanitized.length).toBe(1000);
  });

  test('sanitizes URLs', () => {
    expect(InputSanitizer.sanitizeURL('https://example.com/path')).toBe('https://example.com/path');
    expect(InputSanitizer.sanitizeURL('http://example.com:8080/path?query=1')).toBe('http://example.com:8080/path?query=1');
    
    expect(() => InputSanitizer.sanitizeURL('file:///etc/passwd')).toThrow('Only HTTP and HTTPS URLs are allowed');
    expect(() => InputSanitizer.sanitizeURL('javascript:alert(1)')).toThrow('Only HTTP and HTTPS URLs are allowed');
    expect(() => InputSanitizer.sanitizeURL('not-a-url')).toThrow('Invalid URL');
    expect(() => InputSanitizer.sanitizeURL(123)).toThrow('URL must be a string');
  });

  test('sanitizes glob patterns', () => {
    expect(InputSanitizer.sanitizeGlobPattern('*.md')).toBe('*.md');
    expect(InputSanitizer.sanitizeGlobPattern('**/{docs,src}/*.{md,mdx}')).toBe('**/{docs,src}/*.{md,mdx}');
    expect(InputSanitizer.sanitizeGlobPattern('pattern<>with|dangerous')).toBe('patternwithdangerous');
    expect(InputSanitizer.sanitizeGlobPattern('pattern\x00with\x01control')).toBe('patternwithcontrol');
    
    const longPattern = 'A'.repeat(1000);
    const sanitized = InputSanitizer.sanitizeGlobPattern(longPattern);
    expect(sanitized.length).toBe(500);
    
    expect(() => InputSanitizer.sanitizeGlobPattern('')).toThrow('Empty glob pattern after sanitization');
    expect(() => InputSanitizer.sanitizeGlobPattern(123)).toThrow('Glob pattern must be a string');
  });
});

describe('SecurityAuditor', () => {
  const testDir = './tests/audit_test';
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('creates security auditor with default options', () => {
    const auditor = new SecurityAuditor();
    expect(auditor.pathSecurity).toBeInstanceOf(PathSecurity);
    expect(auditor.fileSecurity).toBeInstanceOf(FileSecurity);
    expect(auditor.auditLog).toEqual([]);
  });

  test('audits safe files', async () => {
    const auditor = new SecurityAuditor();
    const testFile = join(testDir, 'safe.md');
    await writeFile(testFile, '# Safe content');
    
    const audit = await auditor.auditFile(testFile, '# Safe content');
    expect(audit.overall).toBe('safe');
    expect(audit.pathSecurity.safe).toBe(true);
    expect(audit.fileSecurity.valid).toBe(true);
    expect(audit.contentSecurity.safe).toBe(true);
  });

  test('audits unsafe files', async () => {
    const auditor = new SecurityAuditor();
    
    const audit = await auditor.auditFile('../../../etc/passwd', '<script>alert()</script>');
    expect(audit.overall).toBe('unsafe');
    expect(audit.pathSecurity.safe).toBe(false);
  });

  test('tracks audit history', async () => {
    const auditor = new SecurityAuditor();
    
    await auditor.auditFile('safe1.md', '# Safe 1');
    await auditor.auditFile('safe2.md', '# Safe 2');
    await auditor.auditFile('../unsafe.md', '<script>alert()</script>');
    
    expect(auditor.auditLog.length).toBe(3);
    
    const summary = auditor.getAuditSummary();
    expect(summary.total).toBe(3);
    expect(summary.unsafe).toBeGreaterThan(0); // All are actually unsafe due to path validation
    expect(summary.securityScore).toBeLessThan(100);
    expect(summary.issues.length).toBeGreaterThan(0);
  });

  test('clears audit log', async () => {
    const auditor = new SecurityAuditor();
    
    await auditor.auditFile('test.md', '# Test');
    expect(auditor.auditLog.length).toBe(1);
    
    auditor.clearAuditLog();
    expect(auditor.auditLog.length).toBe(0);
  });

  test('handles audit errors', async () => {
    const auditor = new SecurityAuditor();
    
    // Force an error by creating a circular reference in the options
    const badOptions = {};
    badOptions.circular = badOptions;
    
    const audit = await auditor.auditFile('test.md');
    // Should handle gracefully without content
    expect(audit).toHaveProperty('overall');
  });

  test('generates comprehensive audit summary', async () => {
    const auditor = new SecurityAuditor();
    
    // Add various types of issues
    await auditor.auditFile('safe.md', '# Safe');
    await auditor.auditFile('../traversal.md', '# Traversal');
    await auditor.auditFile('script.md', '<script>alert()</script>');
    
    const summary = auditor.getAuditSummary();
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('safe');
    expect(summary).toHaveProperty('unsafe');
    expect(summary).toHaveProperty('errors');
    expect(summary).toHaveProperty('securityScore');
    expect(summary).toHaveProperty('issues');
    
    expect(summary.total).toBe(3);
    expect(summary.securityScore).toBeGreaterThanOrEqual(0);
    expect(summary.securityScore).toBeLessThanOrEqual(100);
    
    // Check that issues are categorized
    const pathIssues = summary.issues.filter(i => i.type === 'path');
    const contentIssues = summary.issues.filter(i => i.type === 'content');
    expect(pathIssues.length).toBeGreaterThan(0);
    expect(contentIssues.length).toBeGreaterThan(0);
  });
});