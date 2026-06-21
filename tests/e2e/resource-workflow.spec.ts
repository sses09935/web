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

  // Regression: district/category dropdowns (home-only UI) used to silently
  // filter every tab and were never cleared by reset or tab navigation.
  test('行政區下拉選取應寫入 URL，切換頁籤後應自動清除（防跨頁籤洩漏）', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#district-select', { timeout: 15000 });

    const districtSelect = page.locator('#district-select');
    expect(await districtSelect.locator('option').count()).toBeGreaterThan(1);

    const firstRealDistrict = await districtSelect.locator('option').nth(1).getAttribute('value');
    expect(firstRealDistrict).toBeTruthy();
    await districtSelect.selectOption(firstRealDistrict!);

    // 選取後應持久化到 URL
    await expect
      .poll(() => new URL(page.url()).searchParams.get('district'))
      .toBe(firstRealDistrict);

    // 切換至「長照資源大總匯」頁籤後，行政區過濾應被清除，不再隱形套用於其他頁
    await page.getByRole('button', { name: '長照資源大總匯分類資料庫' }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.has('district'))
      .toBe(false);
  });

  test('全部重置應清除行政區下拉，避免殘留過濾', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#district-select', { timeout: 15000 });

    const districtSelect = page.locator('#district-select');
    const firstRealDistrict = await districtSelect.locator('option').nth(1).getAttribute('value');
    await districtSelect.selectOption(firstRealDistrict!);
    await expect(districtSelect).toHaveValue(firstRealDistrict!);

    // 修復前 handleGlobalReset 不清行政區；修復後應回到「全部」且 URL 不殘留 district
    await page.getByRole('button', { name: '將所有服務單位重置並取消選取' }).first().click();
    await expect(districtSelect).toHaveValue('全部');
    await expect
      .poll(() => new URL(page.url()).searchParams.has('district'))
      .toBe(false);
  });
});
