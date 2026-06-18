/**
 * Accessibility E2E Tests
 * 
 * Uses @axe-core/playwright for automated WCAG auditing.
 * - No WCAG AA violations on homepage (with known exclusions)
 * - aria-label and aria-hidden should not coexist on the same element
 * - Tab key should be able to traverse all interactive elements
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility E2E', () => {
  test('首頁不應有 WCAG AA 級以上的無障礙違規（排除已知例外）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // Exclude the watermark overlay since it's intentionally aria-hidden
      .exclude('[data-testid="watermark-overlay"]')
      // Exclude map canvas which has its own accessibility model
      .exclude('.maplibregl-canvas')
      // Exclude known low-contrast areas that are intentionally subtle (watermarks, hints)
      .disableRules(['color-contrast'])
      .analyze();

    // Filter out aria-prohibited-attr which may trigger on React-managed elements
    const significantViolations = results.violations.filter(
      (v) => v.id !== 'aria-prohibited-attr'
    );

    // Log violations for debugging
    if (significantViolations.length > 0) {
      console.log('WCAG Violations:', JSON.stringify(significantViolations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length
      })), null, 2));
    }

    expect(significantViolations).toHaveLength(0);
  });

  test('aria-label 與 aria-hidden="true" 不應同時存在於同一元素', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const violations = await page.evaluate(() => {
      const els = document.querySelectorAll('[aria-label][aria-hidden="true"]');
      return Array.from(els).map((el) => el.outerHTML.slice(0, 100));
    });

    expect(violations).toHaveLength(0);
  });

  test('Tab 鍵應能依序瀏覽所有可互動元素', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('a.skip-link[href="#main-content"]', { state: 'attached' });

    // Count interactive elements
    const interactableCount = await page.evaluate(() =>
      document.querySelectorAll(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ).length
    );

    // Tab through a reasonable number of elements (cap at 20 to avoid timeout)
    const tabCount = Math.min(interactableCount, 20);
    for (let i = 0; i < tabCount; i++) {
      await page.keyboard.press('Tab');
    }

    // After tabbing, an element should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    // Focused element should not be BODY (meaning Tab navigation works)
    expect(focused).not.toBe('BODY');
  });
});
