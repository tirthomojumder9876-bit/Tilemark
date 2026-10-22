import { describe, expect, it } from 'vitest';
import { faviconUrl, hostLabel, initialFor, normalizeUrl } from '../src/logic/url';

describe('normalizeUrl', () => {
  it('adds https to a bare host', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
  });

  it('keeps an explicit scheme', () => {
    expect(normalizeUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com/');
  });

  it('rejects empty input', () => {
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(normalizeUrl('ftp://example.com')).toBeNull();
    expect(normalizeUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects javascript: payloads', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('hostLabel', () => {
  it('drops the www prefix', () => {
    expect(hostLabel('https://www.example.com/a')).toBe('example.com');
  });

  it('returns empty for garbage', () => {
    expect(hostLabel('not a url')).toBe('');
  });
});

describe('faviconUrl', () => {
  it('builds a sized icon url', () => {
    expect(faviconUrl('https://example.com')).toContain('domain=example.com');
    expect(faviconUrl('https://example.com')).toContain('sz=128');
  });

  it('returns empty when there is no host', () => {
    expect(faviconUrl('nope')).toBe('');
  });
});

describe('initialFor', () => {
  it('prefers the title', () => {
    expect(initialFor('GitHub', 'https://github.com')).toBe('G');
  });

  it('falls back to the host', () => {
    expect(initialFor('   ', 'https://example.com')).toBe('E');
  });

  it('never returns an empty string', () => {
    expect(initialFor('', '')).toBe('?');
  });
});
