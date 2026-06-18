/**
 * ScrambledText E2E Tests
 * 
 * Verifies DOM scrambling behavior in a real browser.
 * - innerText should be scrambled (not matching aria-label)
 * - All internal spans should have aria-hidden="true"
 * 
 * NOTE: The app uses zero-state design (no cards until filters selected).
 * We use URL params to pre-load data: ?cats=C單位 loads a subcategory.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Read first subcategory from data to use as filter
const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
const firstSubCategory = resources[0]?.subCategory || 'C單位';

test.describe('ScrambledText E2E', () => {
  test('機構名稱的 DOM innerText 應為亂碼（非正確中文順序）', async ({ page }) => {
    // Load with a subcategory filter pre-selected via URL params
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('[data-testid="resource-name"]', { timeout: 15000 });
    
    const nameContainer = page.locator('[data-testid="resource-name"]').first();
    
    // Get the aria-label (the correct, unscrambled text) from the ScrambledText div
    const scrambledDiv = nameContainer.locator('[aria-label]').first();
    const ariaLabel = await scrambledDiv.getAttribute('aria-label');
    
    // Get the innerText (DOM order, which should be scrambled)
    const innerText = await scrambledDiv.evaluate(
      (el) => el.innerText.replace(/\s/g, '')
    );
    
    expect(ariaLabel).toBeTruthy();
    // The innerText extracted from DOM should NOT match the original order
    expect(innerText).not.toBe(ariaLabel);
  });

  test('機構名稱的 span 應全部帶有 aria-hidden="true"', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('[data-testid="resource-name"]', { timeout: 15000 });
    
    const spans = page.locator('[data-testid="resource-name"] span');
    const count = await spans.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const ariaHidden = await spans.nth(i).getAttribute('aria-hidden');
      expect(ariaHidden).toBe('true');
    }
  });
});
