/**
 * ClipboardGuard E2E Tests
 * 
 * Verifies clipboard interception and watermark injection in a real browser.
 * Uses a focused browser target after ClipboardGuard initializes.
 * 
 * IMPORTANT: The app has `body { user-select: none !important }` as a friction
 * layer for casual text selection. ClipboardGuard intercepts copy/cut events
 * and injects traceability clues when window.getSelection() returns non-empty.
 * 
 * To test in headless mode, we:
 * 1. Temporarily enable selection on the target element
 * 2. Select text programmatically
 * 3. Dispatch a synthetic ClipboardEvent with a DataTransfer
 * 4. Verify ClipboardGuard's handler modifies the clipboardData
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type ResourceFixture = {
  phone?: string;
};

type ClipboardGuardDecoder = {
  decode(text: string): {
    timestamp: number | null;
    sessionHash: string | null;
  };
};

const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8')) as ResourceFixture[];
const firstResourceWithPhone = resources.find((r) => typeof r.phone === 'string' && r.phone.trim() !== '');
const clipboardSampleText = firstResourceWithPhone?.phone?.trim() || '0913-303-616';
const clipboardTargetSelector = '[data-testid="clipboard-guard-target"]';

async function prepareClipboardTarget(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => {
    return Boolean((window as Window & { __CG?: ClipboardGuardDecoder }).__CG);
  });

  await page.evaluate((sampleText) => {
    document.querySelector('[data-testid="clipboard-guard-target"]')?.remove();

    const target = document.createElement('div');
    target.dataset.testid = 'clipboard-guard-target';
    target.textContent = sampleText;
    target.style.setProperty('user-select', 'text', 'important');
    target.style.setProperty('-webkit-user-select', 'text', 'important');
    document.body.appendChild(target);
  }, clipboardSampleText);

  await expect(page.locator(clipboardTargetSelector)).toBeVisible();
}

/**
 * Helper: selects text in a data-testid element by temporarily enabling user-select,
 * dispatches a synthetic ClipboardEvent, and captures ClipboardGuard's output.
 */
async function triggerCopyAndCapture(
  page: import('@playwright/test').Page,
  selector: string,
  eventType: 'copy' | 'cut' = 'copy'
): Promise<string> {
  return page.evaluate(
    ({ sel, evtType }) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (!el) return '';

      // Temporarily enable user-select so getSelection() returns text
      el.style.setProperty('user-select', 'text', 'important');
      el.style.setProperty('-webkit-user-select', 'text', 'important');

      // Ancestors also need user-select override for selection to work
      let ancestor: HTMLElement | null = el.parentElement;
      const origStyles: Array<{ el: HTMLElement; val: string }> = [];
      while (ancestor) {
        origStyles.push({ el: ancestor, val: ancestor.style.userSelect });
        ancestor.style.setProperty('user-select', 'text', 'important');
        ancestor = ancestor.parentElement;
      }

      // Select text
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Dispatch synthetic ClipboardEvent
      const dt = new DataTransfer();
      const event = new ClipboardEvent(evtType, {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      document.dispatchEvent(event);

      // Capture what ClipboardGuard wrote
      const result = dt.getData('text/plain');

      // Restore original styles
      el.style.removeProperty('user-select');
      el.style.removeProperty('-webkit-user-select');
      for (const item of origStyles) {
        if (item.val) {
          item.el.style.userSelect = item.val;
        } else {
          item.el.style.removeProperty('user-select');
        }
      }

      // Clear selection
      selection?.removeAllRanges();

      return result;
    },
    { sel: selector, evtType: eventType }
  );
}

test.describe('ClipboardGuard E2E', () => {
  test('copy/cut 應注入版權聲明與可解碼零寬字元指紋', async ({ page }) => {
    await prepareClipboardTarget(page);

    const clipText = await triggerCopyAndCapture(page, clipboardTargetSelector);

    expect(clipText).toContain('© 版權所有，資料來源：NTUH-BEIHU');
    expect(clipText).toMatch(/[\u200B\u200C]/);

    // Decode through the exposed window.__CG
    const decoded = await page.evaluate((text) => {
      return (window as Window & { __CG?: ClipboardGuardDecoder }).__CG?.decode(text);
    }, clipText);

    expect(decoded).toBeTruthy();
    expect(decoded.timestamp).toBeGreaterThan(0);
    expect(decoded.sessionHash).toBeTruthy();

    const originalText = await page.locator(clipboardTargetSelector).innerText();
    const cutText = await triggerCopyAndCapture(page, clipboardTargetSelector, 'cut');

    expect(cutText).toContain(originalText.trim());
    expect(cutText).toContain('© 版權所有');
  });
});
