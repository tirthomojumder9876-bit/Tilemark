import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end checks against the production build served by Express.
 * Each test creates uniquely named data so projects can share one server.
 */

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

async function addBookmark(page: Page, title: string, url: string) {
  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill(url);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tile__title', { hasText: title })).toBeVisible();
}

/** Widest row of tiles in the first section, grouped with a small tolerance. */
async function maxTilesPerRow(page: Page): Promise<number> {
  const boxes = await page.locator('.grid').first().locator('> .tile').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    }),
  );

  const rows: number[][] = [];
  for (const box of boxes.sort((a, b) => a.y - b.y)) {
    const row = rows.find((candidate) => Math.abs(candidate[0]! - box.y) < 8);
    if (row) row.push(box.y);
    else rows.push([box.y]);
  }
  return Math.max(...rows.map((row) => row.length));
}

test('renders a grid with square tiles and the add tile last', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.tile').first()).toBeVisible();

  const squares = await page.locator('.tile').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.width - rect.height) <= 1;
    }),
  );
  expect(squares.every(Boolean)).toBe(true);

  await expect(page.locator('.grid').first().locator('> .tile').last()).toHaveClass(/tile--add/);
});

test('uses two columns on small screens and more on desktop', async ({ page }) => {
  await page.goto('/');
  await addBookmark(page, unique('Grid'), 'example.com');
  await addBookmark(page, unique('Grid'), 'example.org');

  const columns = await maxTilesPerRow(page);
  const wide = (page.viewportSize()?.width ?? 0) >= 900;

  if (wide) expect(columns).toBeGreaterThanOrEqual(4);
  else expect(columns).toBe(2);
});

test('creates, edits, and deletes a bookmark and a section', async ({ page }) => {
  const name = unique('Section');
  const title = unique('Bookmark');

  await page.goto('/');
  await addSection(page, name);

  const target = section(page, name);
  await target.locator('.tile--add').click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('github.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(target.locator('.tile__title', { hasText: title })).toBeVisible();

  await target.getByRole('button', { name: `Edit ${title}`, exact: true }).click();
  await page.getByPlaceholder('My favorite site').fill(`${title}-edited`);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(target.locator('.tile__title', { hasText: `${title}-edited` })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await target.getByRole('button', { name: `Delete ${title}-edited`, exact: true }).click();
  await expect(target.locator('.tile__title', { hasText: `${title}-edited` })).toHaveCount(0);

  page.once('dialog', (dialog) => void dialog.accept());
  await target.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(section(page, name)).toHaveCount(0);
});

test('rejects an invalid url in the modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(unique('Bad'));
  await page.getByPlaceholder('example.com').fill('!!!');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a valid web address')).toBeVisible();
});

test('toggles dark mode and repaints the page', async ({ page }) => {
  await page.goto('/');
  const background = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const before = await background();
  await page.getByRole('button', { name: 'Toggle dark mode' }).click();
  await expect.poll(background).not.toBe(before);
});

test('shows the open-all notice instead of failing silently', async ({ page }) => {
  const name = unique('Empty');
  await page.goto('/');
  await addSection(page, name);

  await section(page, name).getByRole('button', { name: 'Open all' }).click();
  await expect(page.locator('.banner--info')).toContainText('no bookmarks');
});

test('keeps every control at least 40px', async ({ page }) => {
  await page.goto('/');
  await addBookmark(page, unique('Tap'), 'example.com');

  const sizes = await page
    .locator('button, a.tile__link')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
      }),
    );

  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.w).toBeGreaterThanOrEqual(40);
    expect(size.h).toBeGreaterThanOrEqual(40);
  }
});

test('closes the modal on Escape and traps focus', async ({ page }) => {
  await page.goto('/');
  await addBookmark(page, unique('Focus'), 'example.com');

  await page.locator('.tile__actions button[aria-label^="Edit"]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const insideDialog = await page.evaluate(() => {
    const element = document.querySelector('[role="dialog"]');
    return element !== null && element.contains(document.activeElement);
  });
  expect(insideDialog).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('recovers when a broken icon is replaced with a working one', async ({ page }) => {
  const title = unique('Icon');
  await page.goto('/');

  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('github.com');
  await page.getByPlaceholder('https://…').fill('https://invalid.invalid/missing.png');
  await page.getByRole('button', { name: 'Save' }).click();

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  await expect(tile.locator('img')).toHaveCount(0);

  await tile.getByRole('button', { name: `Edit ${title}` }).click();
  await page.getByPlaceholder('https://…').fill('https://www.google.com/s2/favicons?domain=github.com&sz=128');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(tile.locator('img')).toHaveCount(1, { timeout: 10_000 });
});

test('drags a bookmark between sections with a mouse', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 900, 'mouse drag needs a desktop-width viewport');

  const sourceName = unique('From');
  const targetName = unique('To');
  const title = unique('Dragged');

  await page.goto('/');
  await addSection(page, sourceName);
  await addSection(page, targetName);

  await section(page, sourceName).locator('.tile--add').click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  const drop = section(page, targetName).locator('.grid');

  const from = await tile.boundingBox();
  const to = await drop.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  // dnd-kit listens for pointer events, so drive the mouse explicitly.
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 20, { steps: 5 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();

  await expect(section(page, targetName).locator('.tile__title', { hasText: title })).toBeVisible();
});

test('drags a bookmark between sections with a real touch gesture', async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'CDP touch dispatch is Chromium-only');
  test.skip(!testInfo.project.name.startsWith('mobile'), 'touch drag is mobile-only');

  const sourceName = unique('TouchFrom');
  const targetName = unique('TouchTo');
  const title = unique('TouchDrag');

  await page.goto('/');
  await addSection(page, sourceName);
  await addSection(page, targetName);

  await section(page, sourceName).locator('.tile--add').click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  const target = section(page, targetName).locator('.grid');
  const from = await tile.boundingBox();
  const to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  const client = await context.newCDPSession(page);
  const start = { x: from!.x + from!.width / 2, y: from!.y + from!.height / 2 };
  const end = { x: to!.x + to!.width / 2, y: to!.y + to!.height / 2 };

  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y }],
  });

  // Hold still past the sensor's 200ms activation delay before moving.
  await page.waitForTimeout(350);

  for (let step = 1; step <= 12; step++) {
    const x = start.x + ((end.x - start.x) * step) / 12;
    const y = start.y + ((end.y - start.y) * step) / 12;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    });
    await page.waitForTimeout(40);
  }

  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(section(page, targetName).locator('.tile__title', { hasText: title })).toBeVisible();
});

test('renames a section', async ({ page }) => {
  const original = unique('Rename');
  const renamed = unique('Renamed');

  await page.goto('/');
  await addSection(page, original);
  await section(page, original).getByRole('button', { name: 'Rename' }).click();
  await page.getByPlaceholder('Reading').fill(renamed);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(section(page, renamed)).toBeVisible();
  await expect(section(page, original)).toHaveCount(0);
});

test('uses three columns at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/');

  await addBookmark(page, unique('Tablet'), 'example.com');
  await addBookmark(page, unique('Tablet'), 'example.org');
  await addBookmark(page, unique('Tablet'), 'example.net');

  expect(await maxTilesPerRow(page)).toBe(3);
});

test('shows a dismissible banner when loading fails', async ({ page }) => {
  await page.route('**/api/state', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Boom' }),
    }),
  );

  await page.goto('/');
  const banner = page.getByRole('alert');
  await expect(banner).toContainText('Boom');

  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner).toHaveCount(0);
});

test('requests one tab per bookmark when opening all', async ({ page }) => {
  const name = unique('OpenAll');
  await page.goto('/');
  await addSection(page, name);

  const target = section(page, name);
  for (const host of ['example.com', 'example.org', 'example.net']) {
    await target.locator('.tile--add').click();
    await page.getByPlaceholder('My favorite site').fill(host);
    await page.getByPlaceholder('example.com').fill(host);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(target.locator('.tile__title', { hasText: host })).toBeVisible();
  }

  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });

  await target.getByRole('button', { name: 'Open all' }).click();

  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
  expect(opened).toHaveLength(3);
  expect(opened[0]).toContain('example.com');
});
