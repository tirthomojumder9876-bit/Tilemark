import { expect, test, type Page } from '@playwright/test';

/**
 * Text scaling: at 200% the tile must grow rather than clip its contents.
 * Measures real geometry instead of trusting CSS.
 */

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

async function addBookmark(page: Page, title: string, description: string) {
  await page.locator('.tile--add').first().click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('textbox').nth(2).fill(description);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tile__title', { hasText: title })).toBeVisible();
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('.tile:not(.tile--add), .tile--add'));
    const clipped = tiles
      .map((tile) => {
        const link = tile.querySelector('.tile__link');
        return {
          title: tile.querySelector('.tile__title')?.textContent?.slice(0, 20) ?? '',
          tileClip: tile.scrollHeight - tile.clientHeight,
          linkClip: link ? link.scrollHeight - link.clientHeight : 0,
          height: Math.round(tile.getBoundingClientRect().height),
          width: Math.round(tile.getBoundingClientRect().width),
        };
      })
      .filter((entry) => entry.tileClip > 1 || entry.linkClip > 1);
    return {
      clipped,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: (() => {
        const grid = document.querySelector('.grid');
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
      })(),
    };
  });
}

for (const viewport of [
  { width: 390, height: 844, name: 'mobile' },
  { width: 1440, height: 900, name: 'desktop' },
]) {
  test(`200% text scaling does not clip tile content (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const title = unique('A deliberately long bookmark title that needs room');
    await addBookmark(
      page,
      title,
      'A long description that also needs vertical room inside the tile at large text sizes.',
    );

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
    });
    await page.waitForTimeout(150);

    const result = await measure(page);
    console.log(viewport.name, JSON.stringify(result));

    expect(result.overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(result.clipped, `clipped tiles: ${JSON.stringify(result.clipped)}`).toHaveLength(0);

    const geometry = await page.locator('.tile').first().evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
    expect(geometry.height, 'tile never shorter than it is wide').toBeGreaterThanOrEqual(geometry.width - 1);
  });
}
