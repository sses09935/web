/**
 * SecurityProvider E2E Tests
 * 
 * Verifies keyboard and context menu interception.
 * - F12 should be blocked
 * - Right-click context menu should be blocked
 * - Tab key should NOT be blocked (accessibility protection)
 */

import { test, expect } from '@playwright/test';

test.describe('SecurityProvider E2E', () => {
  test('F12 應被攔截，keydown defaultPrevented 應為 true', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up a listener that captures the defaultPrevented state
    const defaultPrevented = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'F12') {
            // Use setTimeout to check after all handlers have run
            setTimeout(() => resolve(e.defaultPrevented), 0);
          }
        };
        document.addEventListener('keydown', handler, { capture: true, once: true });
        
        // Dispatch a synthetic F12 keydown event
        const event = new KeyboardEvent('keydown', {
          key: 'F12',
          code: 'F12',
          keyCode: 123,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });
    });

    expect(defaultPrevented).toBe(true);
  });

  test('右鍵選單應被阻擋', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const prevented = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: MouseEvent) => {
          setTimeout(() => resolve(e.defaultPrevented), 0);
        };
        document.addEventListener('contextmenu', handler, { capture: true, once: true });
        
        // Dispatch a synthetic contextmenu event
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(event);
      });
    });

    expect(prevented).toBe(true);
  });

  test('Tab 鍵不應被攔截（無障礙保護）', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const prevented = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const handler = (e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            setTimeout(() => resolve(e.defaultPrevented), 0);
          }
        };
        document.addEventListener('keydown', handler, { capture: true, once: true });
        
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          code: 'Tab',
          keyCode: 9,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(event);
      });
    });

    expect(prevented).toBe(false);
  });
});
