import { describe, expect, it } from 'vitest';
import config from '../playwright.config';

const projects = config.projects ?? [];
const firefox = projects.find((project) => project.name === 'firefox');

describe('playwright browser matrix', () => {
  it('always lists the firefox project', () => {
    expect(firefox).toBeDefined();
  });

  it('runs firefox on CI but ignores its specs on local macOS', () => {
    const isMacOSLocal = process.platform === 'darwin' && !process.env.CI;

    if (isMacOSLocal) {
      // Playwright's Firefox build cannot launch on macOS 27, so the project stays
      // in the matrix with every spec ignored rather than failing the run.
      expect(firefox?.testIgnore).toBeInstanceOf(RegExp);
      expect((firefox?.testIgnore as RegExp).test('e2e/app.spec.ts')).toBe(true);
    } else {
      expect(firefox?.testIgnore).toBeUndefined();
    }
  });

  it('keeps the three working browser projects', () => {
    const names = projects.map((project) => project.name);
    expect(names).toEqual(expect.arrayContaining(['mobile-chrome', 'mobile-safari', 'desktop']));
  });
});
