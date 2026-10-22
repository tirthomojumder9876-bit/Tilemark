import { describe, expect, it } from 'vitest';
import { MAX_TITLE, validateBookmark, validateSectionTitle } from '../src/logic/validation';

describe('validateBookmark', () => {
  it('accepts a minimal valid bookmark', () => {
    const result = validateBookmark({ title: 'GitHub', url: 'github.com' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('GitHub');
      expect(result.value.url).toBe('https://github.com/');
      expect(result.value.description).toBe('');
      expect(result.value.iconUrl).toBeNull();
    }
  });

  it('trims the title and description', () => {
    const result = validateBookmark({ title: '  GitHub  ', url: 'github.com', description: '  code  ' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('GitHub');
      expect(result.value.description).toBe('code');
    }
  });

  it('requires a title', () => {
    const result = validateBookmark({ title: '   ', url: 'github.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBeDefined();
  });

  it('rejects an invalid url', () => {
    const result = validateBookmark({ title: 'X', url: 'not a url' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.url).toBeDefined();
  });

  it('rejects an over-long title', () => {
    const result = validateBookmark({ title: 'a'.repeat(MAX_TITLE + 1), url: 'example.com' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toBeDefined();
  });

  it('reports multiple errors at once', () => {
    const result = validateBookmark({ title: '', url: '!!!' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.url).toBeDefined();
    }
  });

  it('keeps a provided icon url', () => {
    const result = validateBookmark({ title: 'X', url: 'example.com', iconUrl: 'https://cdn/x.png' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.iconUrl).toBe('https://cdn/x.png');
  });
});

describe('validateSectionTitle', () => {
  it('accepts a normal title', () => {
    expect(validateSectionTitle('Reading')).toBeNull();
  });

  it('rejects a blank title', () => {
    expect(validateSectionTitle('   ')).not.toBeNull();
  });

  it('rejects an over-long title', () => {
    expect(validateSectionTitle('a'.repeat(MAX_TITLE + 1))).not.toBeNull();
  });
});
