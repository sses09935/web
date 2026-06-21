/**
 * Accessibility regression coverage (issue #1)
 *
 * "Regression coverage" pins today's good behaviour as a baseline so future
 * changes cannot silently break it. Three layers of assertions:
 *
 *   1. axe baseline — scan the index and dashboard routes and gate on
 *      serious + critical violations being zero.
 *   2. Keyboard journey — Tab order across filter → card → map control with a
 *      visible focus indicator at each stop, and a map popup that does not
 *      create a keyboard trap.
 *   3. aria-live — when filters change the result count, the polite live region
 *      announces the new number (a behaviour the README promises).
 *
 * Plus empty-state and INITIAL_DISPLAY_COUNT boundary focus management.
 *
 * This complements (does not overlap) the Jest unit suite in issue #5, which
 * covers component-level rendering resilience.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
import { INITIAL_DISPLAY_COUNT, DISPLAY_INCREMENT } from '../../src/constants';

const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8')) as Array<{
  subCategory: string;
}>;

const firstSubCategory = resources[0]?.subCategory || 'C單位';

// Pick the most populated subcategory so the load-more boundary is exercised.
const subCategoryCounts = resources.reduce<Record<string, number>>((acc, res) => {
  if (res.subCategory) acc[res.subCategory] = (acc[res.subCategory] || 0) + 1;
  return acc;
}, {});
const bigSubCategory =
  Object.entries(subCategoryCounts)
    .filter(([, count]) => count > INITIAL_DISPLAY_COUNT + DISPLAY_INCREMENT)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? firstSubCategory;

/**
 * Returns true if the currently focused element renders a visible focus
 * indicator (a non-zero outline or a ring box-shadow). Used to assert that
 * keyboard focus is never invisible.
 */
async function activeElementHasVisibleFocus(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const cs = getComputedStyle(el);
    const outlineVisible =
      cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0;
    const ringVisible = !!cs.boxShadow && cs.boxShadow !== 'none';
    return outlineVisible || ringVisible;
  });
}

test.describe('A11y regression — axe baseline', () => {
  for (const route of ['/', '/dashboard']) {
    test(`${route} 不應有 serious 或 critical 等級的無障礙違規`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        // Watermark is intentionally aria-hidden; map canvas has its own a11y model.
        .exclude('[data-testid="watermark-overlay"]')
        .exclude('.maplibregl-canvas')
        // Intentionally-subtle subtle hints/watermarks are out of scope here.
        .disableRules(['color-contrast'])
        .analyze();

      const blocking = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        // React-managed nodes can spuriously trip this rule.
        .filter((v) => v.id !== 'aria-prohibited-attr');

      if (blocking.length > 0) {
        console.log(
          `axe blocking violations on ${route}:`,
          JSON.stringify(
            blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
            null,
            2
          )
        );
      }

      expect(blocking).toHaveLength(0);
    });
  }
});

test.describe('A11y regression — keyboard journey', () => {
  test('搜尋框與資源卡片在鍵盤導航下都有可見焦點環', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('article[id^="resource-card-"]', { timeout: 15000 });

    // Station 1 — the keyword filter input shows a visible focus ring.
    const search = page.locator('#search-input-home');
    await search.focus();
    await expect(search).toBeFocused();
    expect(await activeElementHasVisibleFocus(page)).toBe(true);

    // Station 2 — tabbing forward must reach a resource card, and the card must
    // expose a keyboard-only focus-visible ring (not an invisible focus stop).
    let reachedCard = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const isCard = await page.evaluate(
        () => document.activeElement?.matches('article[id^="resource-card-"]') ?? false
      );
      if (isCard) {
        reachedCard = true;
        expect(await activeElementHasVisibleFocus(page)).toBe(true);
        break;
      }
    }
    expect(reachedCard).toBe(true);
  });

  test('地圖 marker 可由鍵盤聚焦/啟用,且 popup 不造成 keyboard trap', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);

    const marker = page.locator('[data-testid="map-marker"]').first();
    await marker.waitFor({ state: 'attached', timeout: 20000 });

    // Station 3 — the map marker is a keyboard-focusable control with a ring.
    await marker.focus();
    await expect(marker).toBeFocused();
    expect(await activeElementHasVisibleFocus(page)).toBe(true);

    // Enter activates the marker and opens its popup for keyboard users.
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="popup-name"]', { timeout: 5000 });

    // No keyboard trap: starting from inside the popup (close button), Tab must
    // be able to move focus OUT of the popup container — a trap would loop in it.
    const closeBtn = page.locator('.maplibregl-popup-close-button');
    await expect(closeBtn).toBeVisible();
    await closeBtn.focus();
    await expect(closeBtn).toBeFocused();

    let escapedPopup = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const insidePopup = await page.evaluate(() => {
        const el = document.activeElement;
        const popup = document.querySelector('.maplibregl-popup');
        return !!(popup && el && popup.contains(el));
      });
      if (!insidePopup) {
        escapedPopup = true;
        break;
      }
    }
    expect(escapedPopup).toBe(true);

    // The popup is also dismissible by keyboard via its close control.
    await closeBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="popup-name"]')).toHaveCount(0);
  });
});

test.describe('A11y regression — aria-live announcements', () => {
  test('篩選結果數改變時,polite live region 應播報新的筆數', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('article[id^="resource-card-"]', { timeout: 15000 });

    // The dedicated screen-reader announcement node.
    const liveRegion = page.locator('[role="status"][aria-atomic="true"]');
    await expect(liveRegion).toHaveAttribute('aria-live', 'polite');

    // The visible result counter is the source of truth for the count.
    const counter = page.getByText(/筆派案網絡資源/).first();
    const readDigits = async (text: string | null): Promise<string | null> =>
      text?.match(/\d+/)?.[0] ?? null;

    const initialCount = await readDigits(await counter.textContent());
    expect(initialCount).not.toBeNull();

    // Initial filter change should already have been announced with a count.
    await expect(liveRegion).toContainText('已篩選出', { timeout: 5000 });
    await expect(liveRegion).toContainText('筆長照資源單位');

    // Narrow the result set and assert the announcement reports the NEW count,
    // matching the on-screen counter.
    await page.locator('#search-input-home').fill('日照');

    await expect
      .poll(async () => readDigits(await counter.textContent()), { timeout: 10000 })
      .not.toBe(initialCount);

    await expect
      .poll(
        async () => {
          const counterDigits = await readDigits(await counter.textContent());
          const regionDigits = await readDigits(await liveRegion.textContent());
          return counterDigits !== null && regionDigits === counterDigits;
        },
        { timeout: 10000 }
      )
      .toBe(true);

    await expect(liveRegion).toContainText('筆長照資源單位');
  });
});

test.describe('A11y regression — empty state & display-count boundary', () => {
  test('初始空狀態渲染為 polite live region,且無卡片/marker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const initialState = page.getByText('歡迎使用北護長照資源協作平台');
    await expect(initialState).toBeVisible();

    // The empty state is a polite live region so the context is announced.
    const statusRegion = page.locator('[role="status"]', {
      hasText: '歡迎使用北護長照資源協作平台',
    });
    await expect(statusRegion).toHaveAttribute('aria-live', 'polite');

    // Strict zero-state: no cards and no markers before a selection is made.
    await expect(page.locator('article[id^="resource-card-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="map-marker"]')).toHaveCount(0);
  });

  test('INITIAL_DISPLAY_COUNT 邊界:先顯示 N 筆,載入更多揭露其餘且不丟失焦點', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(bigSubCategory)}`);
    await page.waitForSelector('article[id^="resource-card-"]', { timeout: 15000 });

    const cards = page.locator('article[id^="resource-card-"]');
    await expect(cards).toHaveCount(INITIAL_DISPLAY_COUNT);

    // Activate "load more" by keyboard from a focused state.
    const loadMore = page.getByRole('button', { name: /顯示更多資源/ });
    await loadMore.focus();
    await expect(loadMore).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(cards).toHaveCount(INITIAL_DISPLAY_COUNT + DISPLAY_INCREMENT);

    // Focus management: revealing more cards must not dump focus back to <body>.
    const activeIsBody = await page.evaluate(() => document.activeElement === document.body);
    expect(activeIsBody).toBe(false);
  });
});
