import { describe, test, expect } from 'bun:test';
import {
  EXIT_CODES,
  CatalogError,
  InvalidInputError,
  FileAccessError,
  ValidationError,
  DependencyError,
  FatalError,
  categorizeError,
  ErrorHandler
} from '../src/errors.js';

describe('Error Classes', () => {
  test('CatalogError creates base error with correct properties', () => {
    const error = new CatalogError('Test error', EXIT_CODES.GENERAL_ERROR, 'details');
    expect(error.message).toBe('Test error');
    expect(error.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(error.details).toBe('details');
    expect(error.recoverable).toBe(true);
    expect(error.name).toBe('CatalogError');
  });

  test('InvalidInputError has correct exit code and is not recoverable', () => {
    const error = new InvalidInputError('Invalid path');
    expect(error.exitCode).toBe(EXIT_CODES.INVALID_INPUT);
    expect(error.recoverable).toBe(false);
    expect(error.name).toBe('InvalidInputError');
  });

  test('FileAccessError has correct exit code and is recoverable', () => {
    const error = new FileAccessError('Permission denied');
    expect(error.exitCode).toBe(EXIT_CODES.FILE_ACCESS_ERROR);
    expect(error.recoverable).toBe(true);
    expect(error.name).toBe('FileAccessError');
  });

  test('ValidationError has correct exit code and is not recoverable', () => {
    const error = new ValidationError('Validation failed');
    expect(error.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
    expect(error.recoverable).toBe(false);
    expect(error.name).toBe('ValidationError');
  });

  test('DependencyError has correct exit code and is not recoverable', () => {
    const error = new DependencyError('Module not found');
    expect(error.exitCode).toBe(EXIT_CODES.DEPENDENCY_ERROR);
    expect(error.recoverable).toBe(false);
    expect(error.name).toBe('DependencyError');
  });

  test('FatalError has correct exit code and is not recoverable', () => {
    const error = new FatalError('Fatal error');
    expect(error.exitCode).toBe(EXIT_CODES.FATAL_ERROR);
    expect(error.recoverable).toBe(false);
    expect(error.name).toBe('FatalError');
  });
});

describe('Error Message Formatting', () => {
  test('getActionableMessage formats string details', () => {
    const error = new CatalogError('Test error', EXIT_CODES.GENERAL_ERROR, 'Additional info');
    const message = error.getActionableMessage();
    expect(message).toContain('Test error');
    expect(message).toContain('Details:');
    expect(message).toContain('Additional info');
  });

  test('getActionableMessage formats array details', () => {
    const error = new CatalogError('Test error', EXIT_CODES.GENERAL_ERROR, ['Item 1', 'Item 2']);
    const message = error.getActionableMessage();
    expect(message).toContain('• Item 1');
    expect(message).toContain('• Item 2');
  });

  test('getActionableMessage formats object details', () => {
    const error = new CatalogError('Test error', EXIT_CODES.GENERAL_ERROR, { file: 'test.md', line: 10 });
    const message = error.getActionableMessage();
    expect(message).toContain('file: test.md');
    expect(message).toContain('line: 10');
  });

  test('getRecoverySuggestions provides suggestions for invalid input', () => {
    const error = new InvalidInputError('Invalid path');
    const suggestions = error.getRecoverySuggestions();
    expect(suggestions).toContain('Check that the input path exists and is accessible');
    expect(suggestions).toContain('Verify the path is a directory, not a file');
    expect(suggestions).toContain('Use --help to see correct usage');
  });

  test('getRecoverySuggestions provides suggestions for file access errors', () => {
    const error = new FileAccessError('Permission denied');
    const suggestions = error.getRecoverySuggestions();
    expect(suggestions).toContain('Check file permissions');
    expect(suggestions).toContain('Ensure the directory is not locked by another process');
  });

  test('getRecoverySuggestions provides suggestions for validation errors', () => {
    const error = new ValidationError('Validation failed');
    const suggestions = error.getRecoverySuggestions();
    expect(suggestions).toContain('Review the validation errors above');
    expect(suggestions).toContain('Fix the issues in your documentation');
  });

  test('getRecoverySuggestions provides suggestions for dependency errors', () => {
    const error = new DependencyError('Module not found');
    const suggestions = error.getRecoverySuggestions();
    expect(suggestions).toContain('Run "bun install" to install dependencies');
    expect(suggestions).toContain('Check that all required packages are in package.json');
  });
});

describe('Error Categorization', () => {
  test('categorizeError returns CatalogError unchanged', () => {
    const catalogError = new ValidationError('Test');
    const result = categorizeError(catalogError);
    expect(result).toBe(catalogError);
  });

  test('categorizeError identifies ENOENT as FileAccessError', () => {
    const error = new Error('ENOENT: no such file or directory');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(FileAccessError);
    expect(result.message).toContain('File or directory not found');
  });

  test('categorizeError identifies EACCES as FileAccessError', () => {
    const error = new Error('EACCES: permission denied');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(FileAccessError);
    expect(result.message).toContain('Permission denied');
  });

  test('categorizeError identifies invalid input errors', () => {
    const error = new Error('Path is not a directory');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(InvalidInputError);
  });

  test('categorizeError identifies validation errors', () => {
    const error = new Error('Output validation failed');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(ValidationError);
  });

  test('categorizeError identifies dependency errors', () => {
    const error = new Error('Cannot find module "turndown"');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(DependencyError);
  });

  test('categorizeError defaults to general CatalogError', () => {
    const error = new Error('Unknown error');
    const result = categorizeError(error);
    expect(result).toBeInstanceOf(CatalogError);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});

describe('ErrorHandler', () => {
  test('ErrorHandler initializes with default options', () => {
    const handler = new ErrorHandler();
    expect(handler.silent).toBe(false);
    expect(handler.continueOnError).toBe(false);
    expect(handler.errors).toEqual([]);
    expect(handler.warnings).toEqual([]);
  });

  test('ErrorHandler respects silent option', () => {
    const handler = new ErrorHandler({ silent: true });
    expect(handler.silent).toBe(true);
  });

  test('handleError categorizes and stores errors', () => {
    const handler = new ErrorHandler({ silent: true });
    const error = new Error('Test error');
    
    const result = handler.handleError(error, 'test context');
    expect(result).toBeInstanceOf(CatalogError);
    expect(handler.errors.length).toBe(1);
    expect(handler.errors[0].context).toBe('test context');
  });

  test('handleError throws on non-recoverable errors when continueOnError is false', () => {
    const handler = new ErrorHandler({ silent: true, continueOnError: false });
    const error = new ValidationError('Validation failed');
    
    expect(() => handler.handleError(error)).toThrow(ValidationError);
  });

  test('handleError continues on non-recoverable errors when continueOnError is true', () => {
    const handler = new ErrorHandler({ silent: true, continueOnError: true });
    const error = new ValidationError('Validation failed');
    
    const result = handler.handleError(error);
    expect(result).toBeInstanceOf(ValidationError);
    expect(handler.errors.length).toBe(1);
  });

  test('addWarning stores warnings', () => {
    const handler = new ErrorHandler({ silent: true });
    handler.addWarning('Test warning', 'context');
    
    expect(handler.warnings.length).toBe(1);
    expect(handler.warnings[0].message).toBe('Test warning');
    expect(handler.warnings[0].context).toBe('context');
    expect(handler.warnings[0].timestamp).toBeInstanceOf(Date);
  });

  test('getSummary returns correct counts and details', () => {
    const handler = new ErrorHandler({ silent: true, continueOnError: true });
    handler.handleError(new FileAccessError('Recoverable error'));
    handler.handleError(new ValidationError('Non-recoverable error'));
    handler.addWarning('Test warning');
    
    const summary = handler.getSummary();
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.fatalErrors).toBe(1);
    expect(summary.recoverableErrors).toBe(1);
    expect(summary.details.errors.length).toBe(2);
    expect(summary.details.warnings.length).toBe(1);
  });

  test('hasFatalErrors detects fatal errors', () => {
    const handler = new ErrorHandler({ silent: true, continueOnError: true });
    expect(handler.hasFatalErrors()).toBe(false);
    
    handler.handleError(new FileAccessError('Recoverable'));
    expect(handler.hasFatalErrors()).toBe(false);
    
    handler.handleError(new FatalError('Fatal'));
    expect(handler.hasFatalErrors()).toBe(true);
  });

  test('clear removes all errors and warnings', () => {
    const handler = new ErrorHandler({ silent: true, continueOnError: true });
    handler.handleError(new Error('Test'));
    handler.addWarning('Warning');
    
    expect(handler.errors.length).toBe(1);
    expect(handler.warnings.length).toBe(1);
    
    handler.clear();
    expect(handler.errors.length).toBe(0);
    expect(handler.warnings.length).toBe(0);
  });
});

describe('EXIT_CODES', () => {
  test('EXIT_CODES has expected values', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
    expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
    expect(EXIT_CODES.FATAL_ERROR).toBe(2);
    expect(EXIT_CODES.INVALID_INPUT).toBe(3);
    expect(EXIT_CODES.FILE_ACCESS_ERROR).toBe(4);
    expect(EXIT_CODES.VALIDATION_ERROR).toBe(5);
    expect(EXIT_CODES.DEPENDENCY_ERROR).toBe(6);
  });
});