import { expect, test, type Page } from '@playwright/test';

/**
 * WebKit coverage for the gap in vault/spec.md §12: touch drag was verified in
 * Chromium only.
 *
 * Playwright's WebKit build has no CDP session, and `page.touchscreen` can only
 * tap, so this spec drives a genuine gesture with synthetic DOM TouchEvents.
 * WebKit's constructors are stricter than Chromium's:
 *
 *   - `new Touch(...)` throws "TypeError: Illegal constructor";
 *   - `new TouchEvent(...)` rejects a plain array for `touches`
 *     ("TypeError: Type error") and requires a real TouchList.
 *
 * Real `Touch` and `TouchList` objects are therefore built with the legacy
 * `document.createTouch` / `document.createTouchList` factories. The events are
 * dispatched on the element under the pointer, as a finger would target it.
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

async function addBookmark(page: Page, sectionTitle: string, title: string) {
  await section(page, sectionTitle).locator('.tile--add').click();
  await page.getByPlaceholder('My favorite site').fill(title);
  await page.getByPlaceholder('example.com').fill('example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.tile__title', { hasText: title })).toBeVisible();
}

interface Point {
  x: number;
  y: number;
}

interface TouchDragResult {
  error: string | null;
  activated: boolean;
  eventShape: string;
}

test('drags a bookmark between sections with WebKit touch events', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'webkit', 'WebKit-only touch verification');
  test.skip(!testInfo.project.name.startsWith('mobile'), 'touch drag is mobile-only');

  const sourceName = unique('TouchFrom');
  const targetName = unique('TouchTo');
  const title = unique('TouchDrag');

  await page.goto('/');
  await addSection(page, sourceName);
  await addSection(page, targetName);
  await addBookmark(page, sourceName, title);

  const tile = page.locator('.tile').filter({ hasText: title }).first();
  const target = section(page, targetName).locator('.grid');
  const fromBox = await tile.boundingBox();
  const toBox = await target.boundingBox();
  expect(fromBox).not.toBeNull();
  expect(toBox).not.toBeNull();

  const start: Point = { x: fromBox!.x + fromBox!.width / 2, y: fromBox!.y + fromBox!.height / 2 };
  const end: Point = { x: toBox!.x + toBox!.width / 2, y: toBox!.y + toBox!.height / 2 };

  const report: TouchDragResult = await page.evaluate(
    async ({ title, start, end, holdMs, steps }) => {
      const result: TouchDragResult = {
        error: null,
        activated: false,
        eventShape: '',
      };

      type LegacyDocument = Document & {
        createTouch?: (
          view: Window,
          target: EventTarget,
          identifier: number,
          ...coordinates: number[]
        ) => Touch;
        createTouchList?: (...touches: Touch[]) => TouchList;
      };
      const legacy = document as LegacyDocument;

      if (
        typeof TouchEvent !== 'function' ||
        typeof legacy.createTouch !== 'function' ||
        typeof legacy.createTouchList !== 'function'
      ) {
        result.error = 'This WebKit build exposes no TouchEvent/createTouch/createTouchList';
        return result;
      }

      const tile = Array.from(document.querySelectorAll<HTMLElement>('.tile')).find((element) =>
        element.querySelector('.tile__title')?.textContent?.includes(title),
      );
      if (!tile) {
        result.error = 'Bookmark tile not found';
        return result;
      }

      // A real touch targets the deepest element under the finger, and every
      // move/end of that touch is delivered to the same element.
      const hit = document.elementFromPoint(start.x, start.y);
      const dispatchTarget = hit && tile.contains(hit) ? hit : tile;
      const makeTouch = (x: number, y: number) =>
        // WebKit's argument order is not the documented one; the same x/y in
        // every coordinate slot keeps client/page/screen coordinates correct.
        legacy.createTouch!(window, dispatchTarget, 1, x, y, x, y, x, y);
      const touchList = (...touches: Touch[]) => legacy.createTouchList!(...touches);

      const fire = (type: string, x: number, y: number, touching: boolean) => {
        const list = touchList(makeTouch(x, y));
        const event = new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          // TypeScript models these as Touch[], but WebKit requires TouchList.
          touches: (touching ? list : touchList()) as unknown as Touch[],
          targetTouches: (touching ? list : touchList()) as unknown as Touch[],
          changedTouches: list as unknown as Touch[],
        });

        if (result.eventShape === '') {
          result.eventShape = [
            `type=${event.type}`,
            `isTouchEvent=${event instanceof TouchEvent}`,
            `touches=${event.touches.length}`,
            `targetTouches=${event.targetTouches.length}`,
            `changedTouches=${event.changedTouches.length}`,
            `touch0=${event.touches[0]?.clientX ?? 'none'},${event.touches[0]?.clientY ?? 'none'}`,
          ].join(' ');
        }

        dispatchTarget.dispatchEvent(event);
      };

      const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

      try {
        fire('touchstart', start.x, start.y, true);

        // The TouchSensor has a 200ms activation delay; hold past it.
        await sleep(holdMs);
        result.activated = document.querySelector('.tile[data-dragging]') !== null;

        for (let step = 1; step <= steps; step++) {
          const x = start.x + ((end.x - start.x) * step) / steps;
          const y = start.y + ((end.y - start.y) * step) / steps;
          fire('touchmove', x, y, true);
          await sleep(40);
        }

        // Settle exactly on the destination before releasing.
        fire('touchmove', end.x, end.y, true);
        await sleep(200);

        fire('touchend', end.x, end.y, false);
        await sleep(300);
      } catch (cause) {
        result.error = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      }

      return result;
    },
    { title, start, end, holdMs: 350, steps: 12 },
  );

  expect(report.error, report.error ?? 'Synthetic WebKit touch drag failed').toBeNull();
  expect(report.eventShape).toContain('isTouchEvent=true');
  expect(report.eventShape).toContain('touches=1');
  expect(report.activated, `touch sensor did not activate (${report.eventShape})`).toBe(true);

  // The tile must now render in the destination section.
  await expect(section(page, targetName).locator('.tile__title', { hasText: title })).toBeVisible();

  // The move must persist in the API, not just in the DOM.
  const stateResponse = await page.request.get('/api/state');
  expect(stateResponse.ok()).toBe(true);
  const state = (await stateResponse.json()) as {
    bookmarks: { title: string; sectionId: string }[];
    sections: { id: string; title: string }[];
  };
  const moved = state.bookmarks.find((bookmark) => bookmark.title === title);
  const destination = state.sections.find((candidate) => candidate.title === targetName);
  expect(moved).toBeDefined();
  expect(destination).toBeDefined();
  expect(moved!.sectionId).toBe(destination!.id);

  // And it must survive a reload.
  await page.reload();
  await expect(section(page, targetName).locator('.tile__title', { hasText: title })).toBeVisible();
});
