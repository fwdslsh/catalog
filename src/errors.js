/**
 * Error classes and exit codes for Catalog CLI
 * Provides standardized error handling and categorization
 */

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  FATAL_ERROR: 2,
  INVALID_INPUT: 3,
  FILE_ACCESS_ERROR: 4,
  VALIDATION_ERROR: 5,
  DEPENDENCY_ERROR: 6,
};

/**
 * Base error class for all Catalog errors
 */
export class CatalogError extends Error {
  constructor(message, exitCode = EXIT_CODES.GENERAL_ERROR, details = null) {
    super(message);
    this.name = 'CatalogError';
    this.exitCode = exitCode;
    this.details = details;
    this.recoverable = exitCode === EXIT_CODES.GENERAL_ERROR;
  }

  /**
   * Get actionable error message for user
   */
  getActionableMessage() {
    let message = this.message;
    
    if (this.details) {
      message += '\n\nDetails:';
      if (typeof this.details === 'string') {
        message += '\n  ' + this.details;
      } else if (Array.isArray(this.details)) {
        this.details.forEach(detail => {
          message += '\n  • ' + detail;
        });
      } else if (typeof this.details === 'object') {
        Object.entries(this.details).forEach(([key, value]) => {
          message += `\n  ${key}: ${value}`;
        });
      }
    }

    // Add recovery suggestions based on error type
    const suggestions = this.getRecoverySuggestions();
    if (suggestions.length > 0) {
      message += '\n\nSuggestions:';
      suggestions.forEach(suggestion => {
        message += '\n  → ' + suggestion;
      });
    }

    return message;
  }

  /**
   * Get recovery suggestions based on error type
   */
  getRecoverySuggestions() {
    const suggestions = [];

    switch (this.exitCode) {
      case EXIT_CODES.INVALID_INPUT:
        suggestions.push('Check that the input path exists and is accessible');
        suggestions.push('Verify the path is a directory, not a file');
        suggestions.push('Use --help to see correct usage');
        break;
      case EXIT_CODES.FILE_ACCESS_ERROR:
        suggestions.push('Check file permissions');
        suggestions.push('Ensure the directory is not locked by another process');
        suggestions.push('Try running with appropriate permissions');
        break;
      case EXIT_CODES.VALIDATION_ERROR:
        suggestions.push('Review the validation errors above');
        suggestions.push('Fix the issues in your documentation');
        suggestions.push('Run with --validate to check again');
        break;
      case EXIT_CODES.DEPENDENCY_ERROR:
        suggestions.push('Run "bun install" to install dependencies');
        suggestions.push('Check that all required packages are in package.json');
        break;
    }

    return suggestions;
  }
}

/**
 * Error for invalid input paths or arguments
 */
export class InvalidInputError extends CatalogError {
  constructor(message, details = null) {
    super(message, EXIT_CODES.INVALID_INPUT, details);
    this.name = 'InvalidInputError';
    this.recoverable = false;
  }
}

/**
 * Error for file access issues
 */
export class FileAccessError extends CatalogError {
  constructor(message, details = null) {
    super(message, EXIT_CODES.FILE_ACCESS_ERROR, details);
    this.name = 'FileAccessError';
    this.recoverable = true;
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends CatalogError {
  constructor(message, details = null) {
    super(message, EXIT_CODES.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
    this.recoverable = false;
  }
}

/**
 * Error for missing dependencies
 */
export class DependencyError extends CatalogError {
  constructor(message, details = null) {
    super(message, EXIT_CODES.DEPENDENCY_ERROR, details);
    this.name = 'DependencyError';
    this.recoverable = false;
  }
}

/**
 * Error for fatal unrecoverable errors
 */
export class FatalError extends CatalogError {
  constructor(message, details = null) {
    super(message, EXIT_CODES.FATAL_ERROR, details);
    this.name = 'FatalError';
    this.recoverable = false;
  }
}

/**
 * Categorize a generic error into a specific CatalogError
 */
export function categorizeError(error) {
  // Already a CatalogError
  if (error instanceof CatalogError) {
    return error;
  }

  const message = error.message || 'Unknown error occurred';
  const lowerMessage = message.toLowerCase();

  // Categorize based on error message patterns
  if (lowerMessage.includes('enoent') || lowerMessage.includes('no such file')) {
    return new FileAccessError(`File or directory not found: ${message}`, {
      originalError: error.code || 'ENOENT'
    });
  }

  if (lowerMessage.includes('eacces') || lowerMessage.includes('permission')) {
    return new FileAccessError(`Permission denied: ${message}`, {
      originalError: error.code || 'EACCES'
    });
  }

  if (lowerMessage.includes('invalid') || lowerMessage.includes('not a directory')) {
    return new InvalidInputError(message);
  }

  if (lowerMessage.includes('validation') || lowerMessage.includes('failed validation')) {
    return new ValidationError(message);
  }

  if (lowerMessage.includes('cannot find module') || lowerMessage.includes('module not found')) {
    return new DependencyError(message);
  }

  // Default to general error
  return new CatalogError(message, EXIT_CODES.GENERAL_ERROR);
}

/**
 * Error handler for graceful degradation
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.silent = options.silent || false;
    this.continueOnError = options.continueOnError || false;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Handle an error with graceful degradation
   */
  handleError(error, context = '') {
    const catalogError = categorizeError(error);
    
    if (context) {
      catalogError.context = context;
    }

    this.errors.push(catalogError);

    if (!this.silent) {
      console.error(`\n❌ Error${context ? ` in ${context}` : ''}: ${catalogError.message}`);
      
      if (catalogError.details && !this.silent) {
        console.error(catalogError.getActionableMessage());
      }
    }

    // Determine if we should continue
    if (!catalogError.recoverable && !this.continueOnError) {
      throw catalogError;
    }

    return catalogError;
  }

  /**
   * Add a warning
   */
  addWarning(message, context = '') {
    const warning = { message, context, timestamp: new Date() };
    this.warnings.push(warning);
    
    if (!this.silent) {
      console.warn(`\n⚠️  Warning${context ? ` in ${context}` : ''}: ${message}`);
    }
  }

  /**
   * Get summary of errors and warnings
   */
  getSummary() {
    return {
      errors: this.errors.length,
      warnings: this.warnings.length,
      fatalErrors: this.errors.filter(e => !e.recoverable).length,
      recoverableErrors: this.errors.filter(e => e.recoverable).length,
      details: {
        errors: this.errors.map(e => ({
          message: e.message,
          type: e.name,
          recoverable: e.recoverable,
          context: e.context
        })),
        warnings: this.warnings
      }
    };
  }

  /**
   * Check if there are any fatal errors
   */
  hasFatalErrors() {
    return this.errors.some(e => !e.recoverable);
  }

  /**
   * Clear all errors and warnings
   */
  clear() {
    this.errors = [];
    this.warnings = [];
  }
}