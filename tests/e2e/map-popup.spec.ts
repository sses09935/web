/**
 * Map Popup E2E Tests
 * 
 * Verifies:
 * - Popup name uses ScrambledText (scrambled spans with aria-hidden)
 * - Popup phone is plain text (no ScrambledText)
 * 
 * NOTE: Map markers are positioned by MapLibre GL and may be outside the
 * default viewport or overlapped by the card panel. We use JavaScript
 * dispatchEvent to trigger the click directly on the marker element.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
const firstSubCategory = resources[0]?.subCategory || 'C單位';

test.describe('Map Popup E2E', () => {
  test('點擊 Marker 後，popup 內的機構名稱應由亂序 span 組成', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    
    // Wait for map markers to render
    await page.waitForSelector('[data-testid="map-marker"]', { timeout: 20000 });
    
    // Programmatically click the marker via JS to avoid viewport/overlap issues
    await page.evaluate(() => {
      const marker = document.querySelector('[data-testid="map-marker"]') as HTMLElement;
      if (marker) {
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    
    // Wait for the popup to render via createRoot
    await page.waitForSelector('[data-testid="popup-name"]', { timeout: 5000 });
    
    // Verify the popup name contains ScrambledText spans
    const spans = page.locator('[data-testid="popup-name"] span');
    const count = await spans.count();
    expect(count).toBeGreaterThan(1);
    
    // All spans should have aria-hidden="true"
    const ariaHiddenValues = await spans.evaluateAll(
      (els) => els.map((el) => el.getAttribute('aria-hidden'))
    );
    expect(ariaHiddenValues.every((v) => v === 'true')).toBe(true);
  });

  test('popup 內的電話應為純文字且不包含 ScrambledText spans', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('[data-testid="map-marker"]', { timeout: 20000 });
    
    // Programmatically click the marker
    await page.evaluate(() => {
      const marker = document.querySelector('[data-testid="map-marker"]') as HTMLElement;
      if (marker) {
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });
    
    await page.waitForSelector('[data-testid="popup-phone"]', { timeout: 5000 });
    
    const phoneEl = page.locator('[data-testid="popup-phone"]');
    const phoneText = await phoneEl.innerText();
    
    // Phone should contain digits
    expect(phoneText).toMatch(/\d/);
    
    // Verify no inner span elements (not wrapped in ScrambledText)
    const innerSpanCount = await phoneEl.locator('span').count();
    expect(innerSpanCount).toBe(0);
  });
});
