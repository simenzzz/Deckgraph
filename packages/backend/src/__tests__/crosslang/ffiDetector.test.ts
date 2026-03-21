/**
 * Tests for the FFI cross-language edge detector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Module } from '@deckgraph/shared';
import { createFfiDetector } from '../../crosslang/ffiDetector.js';

vi.mock('../../crosslang/fileScanner.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../crosslang/fileScanner.js')>();
  return { ...actual, findFiles: vi.fn() };
});

vi.mock('../../adapters/utils.js', () => ({
  readFileSafe: vi.fn(),
}));

import { findFiles } from '../../crosslang/fileScanner.js';
import { readFileSafe } from '../../adapters/utils.js';

const mockFindFiles = vi.mocked(findFiles);
const mockReadFileSafe = vi.mocked(readFileSafe);

afterEach(() => {
  vi.restoreAllMocks();
});

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    path: 'packages/app',
    name: 'app',
    ecosystem: 'npm',
    manifests: ['package.json'],
    dependencies: [],
    analysisState: 'manifest-only',
    ...overrides,
  };
}

describe('ffiDetector', () => {
  const detector = createFfiDetector();

  it('returns empty array when no source files match', async () => {
    mockFindFiles.mockResolvedValue([]);

    const modules: Module[] = [
      makeModule({ ecosystem: 'cargo' }),
      makeModule({ path: 'services/py', ecosystem: 'pypi' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });

  it('detects PyO3 bindings (Rust→Python)', async () => {
    // findFiles is called for each FFI pattern, respond differently
    mockFindFiles.mockImplementation(async (_root, patterns) => {
      const pat = patterns[0];
      if (pat === '**/*.rs') return ['crates/mylib/src/lib.rs'];
      return [];
    });

    mockReadFileSafe.mockResolvedValue(`
      use pyo3::prelude::*;

      #[pyfunction]
      fn hello() -> String {
        "hello".to_string()
      }

      #[pymodule]
      fn mylib(_py: Python, m: &PyModule) -> PyResult<()> {
        m.add_function(wrap_pyfunction!(hello, m)?)?;
        Ok(())
      }
    `);

    const modules: Module[] = [
      makeModule({ path: 'crates/mylib', ecosystem: 'cargo' }),
      makeModule({ path: 'services/api', ecosystem: 'pypi' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.type).toBe('ffi');
    expect(result[0]!.from.ecosystem).toBe('cargo');
    expect(result[0]!.to.ecosystem).toBe('pypi');
  });

  it('detects cgo bindings (Go→C)', async () => {
    mockFindFiles.mockImplementation(async (_root, patterns) => {
      const pat = patterns[0];
      if (pat === '**/*.go') return ['cmd/worker/main.go'];
      return [];
    });

    mockReadFileSafe.mockResolvedValue(`
      package main

      // #cgo LDFLAGS: -lmylib
      import "C"

      func main() {
        C.hello()
      }
    `);

    const modules: Module[] = [
      makeModule({ path: 'cmd/worker', ecosystem: 'go' }),
      makeModule({ path: 'libs/native', ecosystem: 'cargo' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.type).toBe('ffi');
    expect(result[0]!.from.ecosystem).toBe('go');
  });

  it('returns empty when no matching ecosystem pairs exist', async () => {
    const modules: Module[] = [
      makeModule({ ecosystem: 'npm' }),
      makeModule({ path: 'other', ecosystem: 'npm' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });

  it('skips files without FFI markers', async () => {
    mockFindFiles.mockImplementation(async (_root, patterns) => {
      const pat = patterns[0];
      if (pat === '**/*.rs') return ['crates/mylib/src/lib.rs'];
      return [];
    });

    mockReadFileSafe.mockResolvedValue(`
      fn main() {
        println!("no ffi here");
      }
    `);

    const modules: Module[] = [
      makeModule({ path: 'crates/mylib', ecosystem: 'cargo' }),
      makeModule({ path: 'services/api', ecosystem: 'pypi' }),
    ];

    const result = await detector.detect('/project', modules);
    expect(result).toEqual([]);
  });
});
