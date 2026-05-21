import { describe, it, expect } from 'vitest';
import { splitCommand } from '../../hooks/hookRunner.js';

describe('splitCommand', () => {
  it('splits simple space-separated args', () => {
    expect(splitCommand('echo hello world')).toEqual(['echo', 'hello', 'world']);
  });

  it('handles single-quoted strings', () => {
    expect(splitCommand("echo 'hello world'")).toEqual(['echo', 'hello world']);
  });

  it('handles double-quoted strings', () => {
    expect(splitCommand('echo "hello world"')).toEqual(['echo', 'hello world']);
  });

  it('handles escaped quotes inside double quotes', () => {
    expect(splitCommand('echo "say \\"hi\\""')).toEqual(['echo', 'say "hi"']);
  });

  it('handles multiple quoted args', () => {
    expect(splitCommand("cmd 'arg one' \"arg two\"")).toEqual(['cmd', 'arg one', 'arg two']);
  });

  it('handles empty input by returning original', () => {
    expect(splitCommand('')).toEqual(['']);
  });

  it('collapses multiple spaces', () => {
    expect(splitCommand('echo   hello')).toEqual(['echo', 'hello']);
  });

  it('throws on unterminated single quote', () => {
    expect(() => splitCommand("echo 'unterminated")).toThrow('unterminated quotes');
  });

  it('throws on unterminated double quote', () => {
    expect(() => splitCommand('echo "unterminated')).toThrow('unterminated quotes');
  });

  it('handles backslash-escaped closing quote', () => {
    expect(splitCommand('echo "hello\\"world"')).toEqual(['echo', 'hello"world']);
  });
});
