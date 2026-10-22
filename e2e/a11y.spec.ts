import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility smoke tests. Every scan runs in both themes and fails on any
 * axe violation with impact "critical" or "serious".
 */

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

function describeViolation(violation: Violation): string {
  const nodes = violation.nodes
    .map((node) => {
      const target = node.target.join(' ');
      const summary = node.failureSummary?.replace(/\n/g, '\n      ') ?? '';
      return `    - ${target}\n      ${summary}`;
    })
    .join('\n');
  return `  [${violation.impact}] ${violation.id}: ${violation.help}\n    ${violation.helpUrl}\n${nodes}`;
}

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );

  const allIds = results.violations.map((violation) => violation.id);
  console.log(
    `axe ${label}: ${results.violations.length} violation(s)` +
      (allIds.length > 0 ? ` [${allIds.join(', ')}]` : ''),
  );

  expect(
    blocking,
    `Axe found ${blocking.length} critical/serious violation(s) on ${label}:\n` +
      blocking.map(describeViolation).join('\n\n'),
  ).toEqual([]);
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const current = await page.evaluate(() => document.documentElement.dataset.theme);
  if (current !== theme) {
    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function addBookmarkWithDescription(page: Page): Promise<string> {
  const title = unique('A11y bookmark');
  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.locator('.modal textarea').fill('A bookmark used for accessibility checks.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tile__title', { hasText: title })).toBeVisible();
  return title;
}

test('main page passes axe in light and dark themes', async ({ page }) => {
  await page.goto('/');
  await addBookmarkWithDescription(page);

  await setTheme(page, 'light');
  await scan(page, 'main page (light)');

  await setTheme(page, 'dark');
  await scan(page, 'main page (dark)');
});

test('bookmark modal passes axe in light and dark themes', async ({ page }) => {
  await page.goto('/');
  const title = await addBookmarkWithDescription(page);

  const open = async () => {
    await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  };

  await setTheme(page, 'light');
  await open();
  await scan(page, 'bookmark modal (light)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await setTheme(page, 'dark');
  await open();
  await scan(page, 'bookmark modal (dark)');
});

test('section modal passes axe in light and dark themes', async ({ page }) => {
  await page.goto('/');
  await addBookmarkWithDescription(page);

  const open = async () => {
    await page.getByRole('button', { name: 'New section' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  };

  await setTheme(page, 'light');
  await open();
  await scan(page, 'section modal (light)');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await setTheme(page, 'dark');
  await open();
  await scan(page, 'section modal (dark)');
});

test('error banner passes axe in light and dark themes', async ({ page }) => {
  await page.route('**/api/state', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Boom' }),
    }),
  );

  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Boom');

  await setTheme(page, 'light');
  await scan(page, 'error banner (light)');

  await setTheme(page, 'dark');
  await scan(page, 'error banner (dark)');
});
