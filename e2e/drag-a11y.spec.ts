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

test('tiles expose sortable semantics and a polite live region', async ({ page }) => {
  const title = unique('Announced');

  await page.goto('/');
  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tile__title', { hasText: title })).toBeVisible();

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  await expect(tile).toHaveAttribute('aria-roledescription', 'sortable');

  // dnd-kit renders an aria-live region for its announcements.
  const liveRegion = page.locator('[aria-live]').first();
  await expect(liveRegion).toHaveCount(1);
});

test('announces the destination position after a drag', async ({ page }) => {
  const source = unique('From');
  const target = unique('To');
  const title = unique('Moved');

  await page.goto('/');
  await addSection(page, source);
  await addSection(page, target);

  await section(page, source).locator('.tile--add').click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(section(page, source).locator('.tile__title', { hasText: title })).toBeVisible();

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  const dropZone = section(page, target).locator('.grid');
  const from = await tile.boundingBox();
  const to = await dropZone.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 20, { steps: 5 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(section(page, target).locator('.tile__title', { hasText: title })).toBeVisible();
  await expect(page.locator('[aria-live]')).toContainText(`Moved ${title} to position 1 of 1 in ${target}`);
});
