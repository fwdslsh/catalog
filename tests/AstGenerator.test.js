import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { AstGenerator } from "../src/AstGenerator.js";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";

const testInputDir = './tests/ast_test_input';
const testOutputDir = './tests/ast_test_output';

describe('AstGenerator', () => {
  beforeAll(async () => {
    // Create test input directory structure
    await mkdir(testInputDir, { recursive: true });
    await mkdir(join(testInputDir, 'src'), { recursive: true });
    await mkdir(join(testInputDir, 'lib'), { recursive: true });

    // Create JavaScript test file
    await writeFile(join(testInputDir, 'src', 'index.js'), `import { foo } from './bar.js';
import React from 'react';

export class MyClass {
  constructor() {
    this.value = 0;
  }

  myMethod() {
    return this.value;
  }
}

export function myFunction(param) {
  return param * 2;
}

const MY_CONSTANT = 42;

export default MyClass;
`, 'utf8');

    // Create TypeScript test file
    await writeFile(join(testInputDir, 'src', 'types.ts'), `export interface User {
  id: number;
  name: string;
}

export type UserId = number | string;

export class UserManager {
  getUser(id: UserId): User {
    return { id: 1, name: 'Test' };
  }
}
`, 'utf8');

    // Create Python test file
    await writeFile(join(testInputDir, 'lib', 'utils.py'), `import os
from datetime import datetime

class DataProcessor:
    def __init__(self):
        self.data = []

    def process(self, item):
        return item.strip()

def helper_function(value):
    return value * 2

MAX_SIZE = 1000
`, 'utf8');

    // Create Go test file
    await writeFile(join(testInputDir, 'lib', 'server.go'), `package main

import "fmt"

type Server struct {
    port int
}

func NewServer(port int) *Server {
    return &Server{port: port}
}

func (s *Server) Start() {
    fmt.Println("Starting server")
}

const DEFAULT_PORT = 8080
`, 'utf8');

    // Create test output directory
    await mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testInputDir, { recursive: true, force: true });
    await rm(testOutputDir, { recursive: true, force: true });
  });

  test('constructs with required parameters', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js', 'ts']
    });
    expect(generator.inputDir).toBe(testInputDir);
    expect(generator.outputDir).toBe(testOutputDir);
    expect(generator.extensions).toEqual(['js', 'ts']);
  });

  test('constructs with silent option', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });
    expect(generator.silent).toBe(true);
  });

  test('throws error when no extensions specified', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: []
    });
    await expect(generator.generateAll()).rejects.toThrow('No file extensions specified');
  });

  test('collectFiles finds files with specified extensions', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js', 'ts']
    });
    const files = await generator.collectFiles(testInputDir);

    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.some(f => f.name === 'index.js')).toBe(true);
    expect(files.some(f => f.name === 'types.ts')).toBe(true);
  });

  test('collectFiles filters by extension correctly', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['py']
    });
    const files = await generator.collectFiles(testInputDir);

    expect(files.every(f => f.extension === 'py')).toBe(true);
    expect(files.some(f => f.name === 'utils.py')).toBe(true);
  });

  test('shouldSkipDirectory returns true for common directories', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    expect(generator.shouldSkipDirectory('node_modules')).toBe(true);
    expect(generator.shouldSkipDirectory('.git')).toBe(true);
    expect(generator.shouldSkipDirectory('dist')).toBe(true);
    expect(generator.shouldSkipDirectory('build')).toBe(true);
    expect(generator.shouldSkipDirectory('.hidden')).toBe(true);
  });

  test('shouldSkipDirectory returns false for normal directories', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    expect(generator.shouldSkipDirectory('src')).toBe(false);
    expect(generator.shouldSkipDirectory('lib')).toBe(false);
    expect(generator.shouldSkipDirectory('docs')).toBe(false);
  });

  test('parseJavaScriptTypeScript extracts imports', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    const file = {
      path: 'src/index.js',
      fullPath: join(testInputDir, 'src', 'index.js'),
      extension: 'js',
      name: 'index.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast.imports.length).toBeGreaterThanOrEqual(1);
    expect(ast.imports.some(imp => imp.module === './bar.js')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts exports', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    const file = {
      path: 'src/index.js',
      fullPath: join(testInputDir, 'src', 'index.js'),
      extension: 'js',
      name: 'index.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast.exports.length).toBeGreaterThanOrEqual(2);
    expect(ast.exports.some(exp => exp.name === 'MyClass')).toBe(true);
    expect(ast.exports.some(exp => exp.name === 'myFunction')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts functions', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    const file = {
      path: 'src/index.js',
      fullPath: join(testInputDir, 'src', 'index.js'),
      extension: 'js',
      name: 'index.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast.functions.length).toBeGreaterThanOrEqual(1);
    expect(ast.functions.some(func => func.name === 'myFunction')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts classes', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    const file = {
      path: 'src/index.js',
      fullPath: join(testInputDir, 'src', 'index.js'),
      extension: 'js',
      name: 'index.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast.classes.length).toBeGreaterThanOrEqual(1);
    expect(ast.classes.some(cls => cls.name === 'MyClass')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts constants', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js']
    });

    const file = {
      path: 'src/index.js',
      fullPath: join(testInputDir, 'src', 'index.js'),
      extension: 'js',
      name: 'index.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast.constants.length).toBeGreaterThanOrEqual(1);
    expect(ast.constants.some(c => c.name === 'MY_CONSTANT')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts TypeScript interfaces', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['ts']
    });

    const file = {
      path: 'src/types.ts',
      fullPath: join(testInputDir, 'src', 'types.ts'),
      extension: 'ts',
      name: 'types.ts'
    };

    const ast = await generator.parseFile(file);

    expect(ast.interfaces.length).toBeGreaterThanOrEqual(1);
    expect(ast.interfaces.some(iface => iface.name === 'User')).toBe(true);
  });

  test('parseJavaScriptTypeScript extracts TypeScript types', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['ts']
    });

    const file = {
      path: 'src/types.ts',
      fullPath: join(testInputDir, 'src', 'types.ts'),
      extension: 'ts',
      name: 'types.ts'
    };

    const ast = await generator.parseFile(file);

    expect(ast.types.length).toBeGreaterThanOrEqual(1);
    expect(ast.types.some(type => type.name === 'UserId')).toBe(true);
  });

  test('parsePython extracts imports', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['py']
    });

    const file = {
      path: 'lib/utils.py',
      fullPath: join(testInputDir, 'lib', 'utils.py'),
      extension: 'py',
      name: 'utils.py'
    };

    const ast = await generator.parseFile(file);

    expect(ast.imports.length).toBeGreaterThanOrEqual(2);
    expect(ast.imports.some(imp => imp.statement.includes('import os'))).toBe(true);
  });

  test('parsePython extracts functions', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['py']
    });

    const file = {
      path: 'lib/utils.py',
      fullPath: join(testInputDir, 'lib', 'utils.py'),
      extension: 'py',
      name: 'utils.py'
    };

    const ast = await generator.parseFile(file);

    expect(ast.functions.length).toBeGreaterThanOrEqual(1);
    expect(ast.functions.some(func => func.name === 'helper_function')).toBe(true);
  });

  test('parsePython extracts classes', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['py']
    });

    const file = {
      path: 'lib/utils.py',
      fullPath: join(testInputDir, 'lib', 'utils.py'),
      extension: 'py',
      name: 'utils.py'
    };

    const ast = await generator.parseFile(file);

    expect(ast.classes.length).toBeGreaterThanOrEqual(1);
    expect(ast.classes.some(cls => cls.name === 'DataProcessor')).toBe(true);
  });

  test('parsePython extracts constants', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['py']
    });

    const file = {
      path: 'lib/utils.py',
      fullPath: join(testInputDir, 'lib', 'utils.py'),
      extension: 'py',
      name: 'utils.py'
    };

    const ast = await generator.parseFile(file);

    expect(ast.constants.length).toBeGreaterThanOrEqual(1);
    expect(ast.constants.some(c => c.name === 'MAX_SIZE')).toBe(true);
  });

  test('parseGo extracts functions', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['go']
    });

    const file = {
      path: 'lib/server.go',
      fullPath: join(testInputDir, 'lib', 'server.go'),
      extension: 'go',
      name: 'server.go'
    };

    const ast = await generator.parseFile(file);

    expect(ast.functions.length).toBeGreaterThanOrEqual(1);
    expect(ast.functions.some(func => func.name === 'NewServer')).toBe(true);
  });

  test('parseGo extracts types', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['go']
    });

    const file = {
      path: 'lib/server.go',
      fullPath: join(testInputDir, 'lib', 'server.go'),
      extension: 'go',
      name: 'server.go'
    };

    const ast = await generator.parseFile(file);

    expect(ast.types.length).toBeGreaterThanOrEqual(1);
    expect(ast.types.some(type => type.name === 'Server')).toBe(true);
  });

  test('parseGo extracts constants', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['go']
    });

    const file = {
      path: 'lib/server.go',
      fullPath: join(testInputDir, 'lib', 'server.go'),
      extension: 'go',
      name: 'server.go'
    };

    const ast = await generator.parseFile(file);

    expect(ast.constants.length).toBeGreaterThanOrEqual(1);
    expect(ast.constants.some(c => c.name === 'DEFAULT_PORT')).toBe(true);
  });

  test('generateSummary calculates totals correctly', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js', 'ts']
    });

    const astData = [
      {
        file: 'file1.js',
        extension: 'js',
        lines: 100,
        size: 2000,
        imports: [{}, {}],
        exports: [{}],
        functions: [{}, {}, {}],
        classes: [{}],
        interfaces: [],
        types: [],
        constants: [{}]
      },
      {
        file: 'file2.ts',
        extension: 'ts',
        lines: 150,
        size: 3000,
        imports: [{}],
        exports: [{}, {}],
        functions: [{}, {}],
        classes: [{}, {}],
        interfaces: [{}],
        types: [{}, {}],
        constants: []
      }
    ];

    const summary = generator.generateSummary(astData);

    expect(summary.totalLines).toBe(250);
    expect(summary.totalSize).toBe(5000);
    expect(summary.totalImports).toBe(3);
    expect(summary.totalExports).toBe(3);
    expect(summary.totalFunctions).toBe(5);
    expect(summary.totalClasses).toBe(3);
    expect(summary.totalInterfaces).toBe(1);
    expect(summary.totalTypes).toBe(2);
    expect(summary.totalConstants).toBe(1);
  });

  test('generateSummary groups by extension', () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js', 'ts']
    });

    const astData = [
      {
        file: 'file1.js',
        extension: 'js',
        lines: 100,
        size: 2000,
        imports: [],
        exports: [],
        functions: [{}, {}, {}],
        classes: [{}],
        interfaces: [],
        types: [],
        constants: []
      },
      {
        file: 'file2.js',
        extension: 'js',
        lines: 50,
        size: 1000,
        imports: [],
        exports: [],
        functions: [{}],
        classes: [],
        interfaces: [],
        types: [],
        constants: []
      },
      {
        file: 'file3.ts',
        extension: 'ts',
        lines: 150,
        size: 3000,
        imports: [],
        exports: [],
        functions: [{}, {}],
        classes: [{}, {}],
        interfaces: [],
        types: [],
        constants: []
      }
    ];

    const summary = generator.generateSummary(astData);

    expect(summary.byExtension.js.files).toBe(2);
    expect(summary.byExtension.js.lines).toBe(150);
    expect(summary.byExtension.js.functions).toBe(4);
    expect(summary.byExtension.js.classes).toBe(1);

    expect(summary.byExtension.ts.files).toBe(1);
    expect(summary.byExtension.ts.lines).toBe(150);
    expect(summary.byExtension.ts.functions).toBe(2);
    expect(summary.byExtension.ts.classes).toBe(2);
  });

  test('generateAll creates ast-index.json', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });

    await generator.generateAll();

    const indexPath = join(testOutputDir, 'ast-index.json');
    const content = await readFile(indexPath, 'utf8');
    const index = JSON.parse(content);

    expect(index.extensions).toEqual(['js']);
    expect(index.totalFiles).toBeGreaterThanOrEqual(1);
    expect(index.files).toBeDefined();
    expect(index.summary).toBeDefined();
    expect(index.summary.totalLines).toBeGreaterThan(0);
  });

  test('generateAll creates ast-full.txt', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });

    await generator.generateAll();

    const fullPath = join(testOutputDir, 'ast-full.txt');
    const content = await readFile(fullPath, 'utf8');

    expect(content).toContain('# Project AST Index');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Files');
    expect(content).toContain('Total Files:');
    expect(content).toContain('Total Lines:');
  });

  test('generateAll handles multiple extensions', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js', 'ts', 'py'],
      silent: true
    });

    await generator.generateAll();

    const indexPath = join(testOutputDir, 'ast-index.json');
    const content = await readFile(indexPath, 'utf8');
    const index = JSON.parse(content);

    expect(index.extensions).toEqual(['js', 'ts', 'py']);
    expect(index.totalFiles).toBeGreaterThanOrEqual(3);

    const extensions = index.files.map(f => f.extension);
    expect(extensions).toContain('js');
    expect(extensions).toContain('ts');
    expect(extensions).toContain('py');
  });

  test('parseFile returns null for unreadable files', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });

    const file = {
      path: 'nonexistent.js',
      fullPath: join(testInputDir, 'nonexistent.js'),
      extension: 'js',
      name: 'nonexistent.js'
    };

    const ast = await generator.parseFile(file);

    expect(ast).toBeNull();
  });

  test('generateAll handles empty directory gracefully', async () => {
    const emptyDir = './tests/empty_ast_input';
    const emptyOutput = './tests/empty_ast_output';

    await mkdir(emptyDir, { recursive: true });
    await mkdir(emptyOutput, { recursive: true });

    const generator = new AstGenerator(emptyDir, emptyOutput, {
      extensions: ['js'],
      silent: true
    });

    // generateAll() should complete without throwing, even if no files found
    // It just logs a message and returns early
    await generator.generateAll();

    // No files should be created since there are no source files to parse
    // This is the expected behavior - it exits early

    await rm(emptyDir, { recursive: true, force: true });
    await rm(emptyOutput, { recursive: true, force: true });
  });

  test('ast-full.txt includes line numbers', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });

    await generator.generateAll();

    const fullPath = join(testOutputDir, 'ast-full.txt');
    const content = await readFile(fullPath, 'utf8');

    // Should contain line references
    expect(content).toMatch(/Line \d+:/);
  });

  test('ast-index.json contains all required fields', async () => {
    const generator = new AstGenerator(testInputDir, testOutputDir, {
      extensions: ['js'],
      silent: true
    });

    await generator.generateAll();

    const indexPath = join(testOutputDir, 'ast-index.json');
    const content = await readFile(indexPath, 'utf8');
    const index = JSON.parse(content);

    expect(index.generated).toBeDefined();
    expect(index.extensions).toBeDefined();
    expect(index.totalFiles).toBeDefined();
    expect(index.files).toBeDefined();
    expect(index.summary).toBeDefined();
    expect(index.summary.totalLines).toBeDefined();
    expect(index.summary.totalFunctions).toBeDefined();
    expect(index.summary.totalClasses).toBeDefined();
    expect(index.summary.byExtension).toBeDefined();
  });
});
