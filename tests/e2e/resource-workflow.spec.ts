import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
type E2EResource = {
  subCategory: string;
  phone: string;
  providedResources?: string;
};

const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8')) as E2EResource[];
const firstSubCategory = resources[0]?.subCategory || 'C單位';
const resourceWithProvidedResources = resources.find(
  (res) => res.providedResources && String(res.providedResources).trim() !== '' && res.phone
) || resources[0];

test.describe('Resource workflow regression', () => {
  test('首頁初始狀態不應渲染資源卡片或資源 marker', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('歡迎使用北護長照資源協作平台')).toBeVisible();
    await expect(page.locator('article[id^="resource-card-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="map-marker"]')).toHaveCount(0);
  });

  test('URL q 參數應可搜尋 providedResources 欄位且不發生前端錯誤', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const query = String(resourceWithProvidedResources.providedResources).replace(/\s+/g, ' ').trim();
    await page.goto(`/?cats=${encodeURIComponent(resourceWithProvidedResources.subCategory)}&q=${encodeURIComponent(query)}`);
    await page.waitForSelector('[data-testid="resource-phone"]', { timeout: 15000 });

    await expect(page.getByText(resourceWithProvidedResources.phone).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('資源清單 aria 說明應指向載入更多按鈕，而非自動滑動載入', async ({ page }) => {
    await page.goto(`/?cats=${encodeURIComponent(firstSubCategory)}`);
    await page.waitForSelector('article[id^="resource-card-"]', { timeout: 15000 });

    const list = page.getByLabel(/長照資源卡片清單/);
    await expect(list).toHaveAttribute('aria-label', /載入更多按鈕/);
    await expect(list).not.toHaveAttribute('aria-label', /自動載入更多/);
  });
});
