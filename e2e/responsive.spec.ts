import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Responsive coverage for the gaps listed in vault/spec.md section 12:
 * very narrow screens, landscape, every breakpoint boundary, and 200% text
 * scaling.
 *
 * The app derives its column count from window.innerWidth in JavaScript, so
 * every check here measures the rendered grid rather than the CSS variable.
 */

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** Independent copy of the spec table, used only to label observations. */
function expectedColumns(width: number): number {
  if (width < 640) return 2;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  if (width < 1600) return 5;
  return 6;
}

function section(page: Page, title: string) {
  return page.locator('section').filter({ has: page.locator('h2', { hasText: title }) });
}

/** Create a dedicated section with enough bookmarks to fill a six-column row. */
async function seedSection(request: APIRequestContext, title: string, count = 6): Promise<void> {
  const created = await request.post('/api/sections', { data: { title } });
  expect(created.status(), `create section ${title}`).toBe(201);
  const { id } = (await created.json()) as { id: string };

  for (let index = 0; index < count; index += 1) {
    const bookmark = await request.post('/api/bookmarks', {
      data: {
        title: `${title} ${index + 1}`,
        url: 'example.com',
        description: '',
        iconUrl: null,
        sectionId: id,
      },
    });
    expect(bookmark.status(), `create bookmark ${index + 1} in ${title}`).toBe(201);
  }
}

/** Load the page and wait for the seeded section: six tiles plus the add tile. */
async function open(page: Page, title: string): Promise<void> {
  await page.goto('/');
  await expect(section(page, title).locator('.grid > .tile')).toHaveCount(7);
}

/** Widest row of tiles in the seeded section, grouped with a small y tolerance. */
async function maxTilesPerRow(page: Page, title: string): Promise<number> {
  const boxes = await section(page, title)
    .locator('.grid > .tile')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { y: rect.y };
      }),
    );

  const rows: number[][] = [];
  for (const box of boxes.sort((a, b) => a.y - b.y)) {
    const row = rows.find((candidate) => Math.abs(candidate[0]! - box.y) < 8);
    if (row) row.push(box.y);
    else rows.push([box.y]);
  }

  expect(rows.length).toBeGreaterThan(0);
  return Math.max(...rows.map((row) => row.length));
}

async function expectSquareTiles(page: Page, title: string): Promise<void> {
  const sizes = await section(page, title)
    .locator('.grid > .tile')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );

  expect(sizes.length).toBe(7);
  for (const size of sizes) {
    expect(
      Math.abs(size.width - size.height),
      `tile should be square: ${size.width}x${size.height}`,
    ).toBeLessThanOrEqual(1);
  }
}

interface OverflowMetrics {
  scrollWidth: number;
  clientWidth: number;
  innerWidth: number;
  bodyScrollWidth: number;
}

/**
 * Horizontal overflow is measured against the viewport's client width. Mobile
 * emulation reports an expanded window.innerWidth once the document is wider
 * than the visual viewport, so innerWidth alone cannot detect the overflow.
 */
async function overflowMetrics(page: Page): Promise<OverflowMetrics> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
}

function isOverflowing(metrics: OverflowMetrics): boolean {
  return metrics.scrollWidth > metrics.clientWidth || metrics.bodyScrollWidth > metrics.clientWidth;
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await overflowMetrics(page);
  expect(metrics.scrollWidth, `${label}: document.scrollWidth should equal client width`).toBe(
    metrics.clientWidth,
  );
  expect(
    metrics.bodyScrollWidth,
    `${label}: body.scrollWidth should not exceed the viewport`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.scrollWidth, `${label}: document.scrollWidth should equal innerWidth`).toBe(
    metrics.innerWidth,
  );
}

function logMetric(
  testInfo: { project: { name: string } },
  label: string,
  viewport: string,
  expected: number,
  observed: number,
  metrics: OverflowMetrics,
): void {
  console.log(
    `[responsive] project=${testInfo.project.name} case=${label} viewport=${viewport} ` +
      `expected=${expected} observed=${observed} overflow=${isOverflowing(metrics) ? 'yes' : 'no'} ` +
      `scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} innerWidth=${metrics.innerWidth}`,
  );
}

/** The header must stay on screen, keep its controls tappable, and still work. */
async function expectUsableHeader(page: Page): Promise<void> {
  const header = page.locator('.app__header');
  await expect(header).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.x).toBeGreaterThanOrEqual(0);
  expect(headerBox!.y).toBeGreaterThanOrEqual(0);
  expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(viewport.height);

  for (const control of [
    page.getByRole('button', { name: 'New section' }),
    page.getByRole('button', { name: 'Toggle dark mode' }),
  ]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.height).toBeGreaterThanOrEqual(40);
  }

  // Usable also means actionable: the header still opens its dialog.
  await page.getByRole('button', { name: 'New section' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Scroll the add tile into view, confirm it is on screen, and activate it. */
async function expectAddTileReachable(page: Page, title: string): Promise<void> {
  const add = section(page, title).locator('.tile--add');
  await add.scrollIntoViewIfNeeded();
  await expect(add).toBeVisible();

  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const box = await add.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.y).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 0.5);

  await add.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByPlaceholder('My favorite site')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Render the app with html { font-size: 200% } already in place. */
async function injectLargeText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const apply = () => {
      const style = document.createElement('style');
      style.textContent = 'html { font-size: 200%; }';
      document.head.append(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
      apply();
    }
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 280, height: 653 },
]) {
  test(`narrow ${viewport.width}x${viewport.height}: two square columns, no overflow`, async (
    { page, request },
    testInfo,
  ) => {
    const title = unique(`Narrow-${viewport.width}`);
    await seedSection(request, title);

    await page.setViewportSize(viewport);
    await open(page, title);

    const observed = await maxTilesPerRow(page, title);
    const metrics = await overflowMetrics(page);
    logMetric(testInfo, 'narrow', `${viewport.width}x${viewport.height}`, 2, observed, metrics);

    expect(observed, `expected exactly 2 columns at ${viewport.width}px`).toBe(2);
    await expectNoHorizontalOverflow(page, `narrow ${viewport.width}x${viewport.height}`);
    await expectSquareTiles(page, title);
  });
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test(`landscape ${viewport.width}x${viewport.height}: usable header and reachable add tile`, async (
    { page, request },
    testInfo,
  ) => {
    const title = unique(`Landscape-${viewport.width}`);
    await seedSection(request, title);

    await page.setViewportSize(viewport);
    await open(page, title);

    const observed = await maxTilesPerRow(page, title);
    const metrics = await overflowMetrics(page);
    logMetric(testInfo, 'landscape', `${viewport.width}x${viewport.height}`, 3, observed, metrics);

    expect(observed, `landscape ${viewport.width}px falls in the 640-899px range`).toBe(3);
    await expectNoHorizontalOverflow(page, `landscape ${viewport.width}x${viewport.height}`);
    await expectUsableHeader(page);
    await expectAddTileReachable(page, title);
  });
}

const BOUNDARIES = [
  { lower: 639, upper: 640, lowerColumns: 2, upperColumns: 3 },
  { lower: 899, upper: 900, lowerColumns: 3, upperColumns: 4 },
  { lower: 1199, upper: 1200, lowerColumns: 4, upperColumns: 5 },
  { lower: 1599, upper: 1600, lowerColumns: 5, upperColumns: 6 },
] as const;

for (const boundary of BOUNDARIES) {
  test(`breakpoint ${boundary.lower}/${boundary.upper}px flips the column count`, async (
    { page, request },
    testInfo,
  ) => {
    const title = unique(`Boundary-${boundary.lower}`);
    await seedSection(request, title);
    await open(page, title);

    for (const [width, expected] of [
      [boundary.lower, boundary.lowerColumns],
      [boundary.upper, boundary.upperColumns],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => maxTilesPerRow(page, title), { message: `${width}px should render ${expected} columns` })
        .toBe(expected);

      const metrics = await overflowMetrics(page);
      logMetric(testInfo, 'boundary', `${width}x900`, expected, expected, metrics);

      expect(await maxTilesPerRow(page, title), `expected exactly ${expected} columns at ${width}px`).toBe(
        expected,
      );
      await expectNoHorizontalOverflow(page, `${width}px`);
    }
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`200% text scaling at ${viewport.width}x${viewport.height}: no overflow, 40px controls`, async (
    { page, request },
    testInfo,
  ) => {
    const title = unique(`Text-${viewport.width}`);
    await seedSection(request, title);

    await page.setViewportSize(viewport);
    await injectLargeText(page);
    await page.goto('/');
    await expect(section(page, title).locator('.grid > .tile')).toHaveCount(7);
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('32px');

    const observed = await maxTilesPerRow(page, title);
    const metrics = await overflowMetrics(page);
    logMetric(
      testInfo,
      'text-scale',
      `${viewport.width}x${viewport.height}`,
      expectedColumns(viewport.width),
      observed,
      metrics,
    );

    await expectNoHorizontalOverflow(page, `200% text at ${viewport.width}x${viewport.height}`);

    const undersized = await page.evaluate(() => {
      const selector = 'button, a[href], input, select, textarea';
      return Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            label: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40),
            className: typeof element.className === 'string' ? element.className : '',
            width: rect.width,
            height: rect.height,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden',
          };
        })
        .filter((control) => control.visible && (control.width < 40 || control.height < 40));
    });

    expect(
      undersized,
      `every interactive control should be at least 40x40 CSS pixels: ${JSON.stringify(undersized)}`,
    ).toEqual([]);
  });
}
