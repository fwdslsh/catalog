import { readdir, readFile, writeFile, stat } from "fs/promises";
import { join, relative, extname, basename } from "path";

/**
 * AstGenerator - Responsible for generating AST indexes for specified file types
 * Follows Single Responsibility Principle by focusing solely on AST generation
 */
export class AstGenerator {
  constructor(inputDir, outputDir, options = {}) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.extensions = options.extensions || [];
    this.silent = options.silent || false;
  }

  /**
   * Log messages unless in silent mode
   */
  log(...args) {
    if (!this.silent) {
      console.log(...args);
    }
  }

  /**
   * Generate AST index for all specified file types
   */
  async generateAll() {
    if (this.extensions.length === 0) {
      throw new Error('No file extensions specified for AST generation.');
    }

    // Collect all files with specified extensions
    const files = await this.collectFiles(this.inputDir);

    if (files.length === 0) {
      this.log(`No files found with extensions: ${this.extensions.join(', ')}`);
      return;
    }

    // Parse each file and extract AST information
    const astData = [];
    for (const file of files) {
      const fileAst = await this.parseFile(file);
      if (fileAst) {
        astData.push(fileAst);
      }
    }

    // Generate ast-index.json
    await this.generateAstIndex(astData);

    // Generate ast-full.txt with detailed information
    await this.generateAstFull(astData);

    this.log(`✔ Generated AST index for ${files.length} files`);
  }

  /**
   * Recursively collect all files with specified extensions
   */
  async collectFiles(dir, collected = []) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip common directories
        if (entry.isDirectory()) {
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }
          await this.collectFiles(fullPath, collected);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).slice(1); // Remove leading dot
          if (this.extensions.includes(ext)) {
            const relativePath = relative(this.inputDir, fullPath);
            collected.push({
              path: relativePath,
              fullPath: fullPath,
              extension: ext,
              name: entry.name
            });
          }
        }
      }
    } catch (error) {
      // Directory might not be accessible, skip
    }

    return collected;
  }

  /**
   * Check if directory should be skipped
   */
  shouldSkipDirectory(name) {
    const skipDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'out',
      'coverage',
      '.next',
      '.nuxt',
      '.output',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      'target'
    ];
    return skipDirs.includes(name) || name.startsWith('.');
  }

  /**
   * Parse a file and extract AST information
   */
  async parseFile(file) {
    try {
      const content = await readFile(file.fullPath, 'utf8');
      const lines = content.split('\n');

      const ast = {
        file: file.path,
        extension: file.extension,
        lines: lines.length,
        size: Buffer.byteLength(content, 'utf8'),
        imports: [],
        exports: [],
        functions: [],
        classes: [],
        interfaces: [],
        types: [],
        constants: [],
        variables: []
      };

      // Parse based on file extension
      switch (file.extension) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'mjs':
        case 'cjs':
          this.parseJavaScriptTypeScript(content, lines, ast);
          break;
        case 'py':
          this.parsePython(content, lines, ast);
          break;
        case 'java':
          this.parseJava(content, lines, ast);
          break;
        case 'go':
          this.parseGo(content, lines, ast);
          break;
        case 'rs':
          this.parseRust(content, lines, ast);
          break;
        case 'rb':
          this.parseRuby(content, lines, ast);
          break;
        case 'php':
          this.parsePhp(content, lines, ast);
          break;
        case 'c':
        case 'cpp':
        case 'cc':
        case 'h':
        case 'hpp':
          this.parseCCpp(content, lines, ast);
          break;
        default:
          // Generic parsing for unknown types
          this.parseGeneric(content, lines, ast);
      }

      return ast;
    } catch (error) {
      this.log(`Warning: Failed to parse ${file.path}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse JavaScript/TypeScript files
   */
  parseJavaScriptTypeScript(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('import ') || line.includes(' from ')) {
        const match = line.match(/import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)(?:\s+from\s+['"]([^'"]+)['"])?/);
        if (match) {
          ast.imports.push({ line: lineNum, statement: line, module: match[1] || null });
        }
      }

      // Exports
      if (line.startsWith('export ')) {
        const match = line.match(/export\s+(default\s+)?(class|function|const|let|var|interface|type)\s+(\w+)/);
        if (match) {
          ast.exports.push({
            line: lineNum,
            type: match[2],
            name: match[3],
            default: !!match[1]
          });
        }
      }

      // Functions
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
      if (funcMatch) {
        ast.functions.push({ line: lineNum, name: funcMatch[1], type: 'function' });
      }

      // Arrow functions and methods
      const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        ast.functions.push({ line: lineNum, name: arrowMatch[1], type: 'arrow' });
      }

      // Classes
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }

      // Interfaces (TypeScript)
      const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) {
        ast.interfaces.push({ line: lineNum, name: interfaceMatch[1] });
      }

      // Types (TypeScript)
      const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*=/);
      if (typeMatch) {
        ast.types.push({ line: lineNum, name: typeMatch[1] });
      }

      // Constants
      const constMatch = line.match(/const\s+([A-Z_][A-Z0-9_]*)\s*=/);
      if (constMatch) {
        ast.constants.push({ line: lineNum, name: constMatch[1] });
      }
    }
  }

  /**
   * Parse Python files
   */
  parsePython(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('import ') || line.startsWith('from ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions
      const funcMatch = line.match(/def\s+(\w+)\s*\(/);
      if (funcMatch) {
        const isPrivate = funcMatch[1].startsWith('_');
        ast.functions.push({
          line: lineNum,
          name: funcMatch[1],
          private: isPrivate
        });
      }

      // Classes
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }

      // Constants (uppercase variables)
      const constMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=/);
      if (constMatch) {
        ast.constants.push({ line: lineNum, name: constMatch[1] });
      }
    }
  }

  /**
   * Parse Java files
   */
  parseJava(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('import ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Classes
      const classMatch = line.match(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }

      // Methods
      const methodMatch = line.match(/(?:public|private|protected)\s+(?:static\s+)?(?:\w+)\s+(\w+)\s*\(/);
      if (methodMatch && !['if', 'while', 'for', 'switch'].includes(methodMatch[1])) {
        ast.functions.push({ line: lineNum, name: methodMatch[1] });
      }
    }
  }

  /**
   * Parse Go files
   */
  parseGo(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('import ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions
      const funcMatch = line.match(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/);
      if (funcMatch) {
        ast.functions.push({ line: lineNum, name: funcMatch[1] });
      }

      // Types/Structs
      const typeMatch = line.match(/type\s+(\w+)\s+(?:struct|interface)/);
      if (typeMatch) {
        ast.types.push({ line: lineNum, name: typeMatch[1] });
      }

      // Constants
      const constMatch = line.match(/const\s+(\w+)\s*=/);
      if (constMatch) {
        ast.constants.push({ line: lineNum, name: constMatch[1] });
      }
    }
  }

  /**
   * Parse Rust files
   */
  parseRust(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('use ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions
      const funcMatch = line.match(/(?:pub\s+)?fn\s+(\w+)\s*\(/);
      if (funcMatch) {
        ast.functions.push({ line: lineNum, name: funcMatch[1] });
      }

      // Structs/Traits/Enums
      const typeMatch = line.match(/(?:pub\s+)?(?:struct|trait|enum)\s+(\w+)/);
      if (typeMatch) {
        ast.types.push({ line: lineNum, name: typeMatch[1] });
      }

      // Constants
      const constMatch = line.match(/const\s+(\w+)\s*:/);
      if (constMatch) {
        ast.constants.push({ line: lineNum, name: constMatch[1] });
      }
    }
  }

  /**
   * Parse Ruby files
   */
  parseRuby(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Requires
      if (line.startsWith('require ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions/Methods
      const funcMatch = line.match(/def\s+(\w+)/);
      if (funcMatch) {
        ast.functions.push({ line: lineNum, name: funcMatch[1] });
      }

      // Classes/Modules
      const classMatch = line.match(/(?:class|module)\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }
    }
  }

  /**
   * Parse PHP files
   */
  parsePhp(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Imports
      if (line.startsWith('use ') || line.startsWith('require ') || line.startsWith('include ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions
      const funcMatch = line.match(/function\s+(\w+)\s*\(/);
      if (funcMatch) {
        ast.functions.push({ line: lineNum, name: funcMatch[1] });
      }

      // Classes
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }
    }
  }

  /**
   * Parse C/C++ files
   */
  parseCCpp(content, lines, ast) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;

      // Includes
      if (line.startsWith('#include ')) {
        ast.imports.push({ line: lineNum, statement: line });
      }

      // Functions
      const funcMatch = line.match(/(?:static\s+)?(?:inline\s+)?(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*{/);
      if (funcMatch && !['if', 'while', 'for', 'switch'].includes(funcMatch[1])) {
        ast.functions.push({ line: lineNum, name: funcMatch[1] });
      }

      // Classes/Structs
      const classMatch = line.match(/(?:class|struct)\s+(\w+)/);
      if (classMatch) {
        ast.classes.push({ line: lineNum, name: classMatch[1] });
      }
    }
  }

  /**
   * Generic parsing for unknown file types
   */
  parseGeneric(content, lines, ast) {
    // Just count lines and size, no detailed parsing
    ast.summary = `Generic file with ${lines.length} lines`;
  }

  /**
   * Generate ast-index.json with all AST data
   */
  async generateAstIndex(astData) {
    const index = {
      generated: new Date().toISOString(),
      extensions: this.extensions,
      totalFiles: astData.length,
      files: astData,
      summary: this.generateSummary(astData)
    };

    const indexPath = join(this.outputDir, 'ast-index.json');
    await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * Generate summary statistics
   */
  generateSummary(astData) {
    const summary = {
      totalLines: 0,
      totalSize: 0,
      totalImports: 0,
      totalExports: 0,
      totalFunctions: 0,
      totalClasses: 0,
      totalInterfaces: 0,
      totalTypes: 0,
      totalConstants: 0,
      byExtension: {}
    };

    for (const file of astData) {
      summary.totalLines += file.lines;
      summary.totalSize += file.size;
      summary.totalImports += file.imports.length;
      summary.totalExports += file.exports.length;
      summary.totalFunctions += file.functions.length;
      summary.totalClasses += file.classes.length;
      summary.totalInterfaces += file.interfaces.length;
      summary.totalTypes += file.types.length;
      summary.totalConstants += file.constants.length;

      if (!summary.byExtension[file.extension]) {
        summary.byExtension[file.extension] = {
          files: 0,
          lines: 0,
          functions: 0,
          classes: 0
        };
      }

      summary.byExtension[file.extension].files++;
      summary.byExtension[file.extension].lines += file.lines;
      summary.byExtension[file.extension].functions += file.functions.length;
      summary.byExtension[file.extension].classes += file.classes.length;
    }

    return summary;
  }

  /**
   * Generate ast-full.txt with detailed AST information
   */
  async generateAstFull(astData) {
    let content = '# Project AST Index\n\n';
    content += `> Generated for extensions: ${this.extensions.join(', ')}\n\n`;

    const summary = this.generateSummary(astData);
    content += '## Summary\n\n';
    content += `- Total Files: ${astData.length}\n`;
    content += `- Total Lines: ${summary.totalLines}\n`;
    content += `- Total Functions: ${summary.totalFunctions}\n`;
    content += `- Total Classes: ${summary.totalClasses}\n`;
    content += `- Total Imports: ${summary.totalImports}\n`;
    content += `- Total Exports: ${summary.totalExports}\n\n`;

    content += '## Files\n\n';

    for (const file of astData) {
      content += `### ${file.file}\n\n`;
      content += `- Lines: ${file.lines}\n`;
      content += `- Extension: ${file.extension}\n\n`;

      if (file.imports.length > 0) {
        content += '**Imports:**\n';
        for (const imp of file.imports) {
          content += `- Line ${imp.line}: ${imp.statement}\n`;
        }
        content += '\n';
      }

      if (file.exports.length > 0) {
        content += '**Exports:**\n';
        for (const exp of file.exports) {
          content += `- Line ${exp.line}: ${exp.type} ${exp.name}${exp.default ? ' (default)' : ''}\n`;
        }
        content += '\n';
      }

      if (file.functions.length > 0) {
        content += '**Functions:**\n';
        for (const func of file.functions) {
          content += `- Line ${func.line}: ${func.name}\n`;
        }
        content += '\n';
      }

      if (file.classes.length > 0) {
        content += '**Classes:**\n';
        for (const cls of file.classes) {
          content += `- Line ${cls.line}: ${cls.name}\n`;
        }
        content += '\n';
      }

      if (file.interfaces.length > 0) {
        content += '**Interfaces:**\n';
        for (const iface of file.interfaces) {
          content += `- Line ${iface.line}: ${iface.name}\n`;
        }
        content += '\n';
      }

      if (file.types.length > 0) {
        content += '**Types:**\n';
        for (const type of file.types) {
          content += `- Line ${type.line}: ${type.name}\n`;
        }
        content += '\n';
      }

      if (file.constants.length > 0) {
        content += '**Constants:**\n';
        for (const constant of file.constants) {
          content += `- Line ${constant.line}: ${constant.name}\n`;
        }
        content += '\n';
      }

      content += '---\n\n';
    }

    const fullPath = join(this.outputDir, 'ast-full.txt');
    await writeFile(fullPath, content, 'utf8');
  }
}
