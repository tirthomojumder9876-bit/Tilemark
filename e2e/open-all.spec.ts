import { expect, test, type Page } from '@playwright/test';

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

function section(page: Page, title: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title }) });
}

async function addSection(page: Page, title: string) {
  await page.getByRole('button', { name: 'New section' }).click();
  await page.getByPlaceholder('Reading').fill(title);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(section(page, title)).toBeVisible();
}

async function addBookmarks(page: Page, title: string, hosts: string[]) {
  for (const host of hosts) {
    await section(page, title).locator('.tile--add').click();
    await page.getByPlaceholder('My favorite site').fill(host);
    await page.getByPlaceholder('example.com').fill(host);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(section(page, title).locator('.tile__title', { hasText: host })).toBeVisible();
  }
}

/** Replace window.open so a test can simulate the popup blocker. */
async function stubOpen(page: Page, behaviour: 'block' | 'allow') {
  await page.evaluate((mode) => {
    (window as unknown as { open: () => unknown }).open =
      mode === 'block' ? () => null : () => ({ closed: false });
  }, behaviour);
}

test('falls back to a link list when the popup blocker suppresses tabs', async ({ page }) => {
  const name = unique('Blocked');

  await page.goto('/');
  await addSection(page, name);
  await addBookmarks(page, name, ['example.com', 'example.org', 'example.net']);

  await stubOpen(page, 'block');
  await section(page, name).getByRole('button', { name: 'Open all' }).click();

  await expect(page.locator('.banner--info')).toContainText('blocked');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link')).toHaveCount(3);
  await expect(dialog.getByRole('link').first()).toHaveAttribute('target', '_blank');
  await expect(dialog.getByRole('link').first()).toHaveAttribute('rel', 'noopener noreferrer');

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});

test('reports success and shows no fallback when popups are allowed', async ({ page }) => {
  const name = unique('Allowed');

  await page.goto('/');
  await addSection(page, name);
  await addBookmarks(page, name, ['example.com', 'example.org']);

  await stubOpen(page, 'allow');
  await section(page, name).getByRole('button', { name: 'Open all' }).click();

  await expect(page.locator('.banner--info')).toContainText('Opened 2 sites');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
