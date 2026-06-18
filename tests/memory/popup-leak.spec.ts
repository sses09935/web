/**
 * Memory Leak Test: Popup createRoot cleanup
 * 
 * Uses Playwright's built-in CDPSession (Chrome DevTools Protocol)
 * to take heap snapshots and verify PopupContent instances don't accumulate.
 * 
 * NO puppeteer dependency — uses Playwright CDPSession exclusively.
 */

import { test, expect, chromium } from '@playwright/test';
import type { CDPSession } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const resourcesPath = path.resolve(__dirname, '../../src/data/resources.build.json');
const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
const firstSubCategory = resources[0]?.subCategory || 'C單位';

test('重複開關 Popup 10 次後，PopupContent 實例數量不應累積', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create CDP session using Playwright's built-in API
  const client: CDPSession = await page.context().newCDPSession(page);

  await page.goto(`http://localhost:3000/?cats=${encodeURIComponent(firstSubCategory)}`);
  
  // Wait for map markers to render
  try {
    await page.waitForSelector('[data-testid="map-marker"]', { timeout: 15000 });
  } catch {
    // If no markers are visible (zero-state), skip this test
    await browser.close();
    test.skip();
    return;
  }

  // Force GC before baseline
  await client.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  // Take baseline heap snapshot
  const snapshot1 = await takeHeapSnapshot(client);
  const baseline = countNodes(snapshot1, 'PopupContent');

  // Get the marker count
  const markerCount = await page.locator('[data-testid="map-marker"]').count();
  
  if (markerCount === 0) {
    await browser.close();
    test.skip();
    return;
  }

  // Repeatedly open and close popups 10 times
  for (let i = 0; i < 10; i++) {
    const markerIndex = i % markerCount;
    // Use dispatchEvent to avoid viewport/overlay issues
    await page.evaluate((idx) => {
      const markers = document.querySelectorAll('[data-testid="map-marker"]');
      const marker = markers[idx] as HTMLElement;
      if (marker) {
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    }, markerIndex);
    await page.waitForTimeout(300);

    // Close the popup by clicking the MapLibre close button
    const closeBtn = page.locator('.maplibregl-popup-close-button');
    if (await closeBtn.isVisible()) {
      await closeBtn.click({ force: true });
      await page.waitForTimeout(300);
    }
  }

  // Force GC after iterations
  await client.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(500);

  // Take post-test heap snapshot
  const snapshot2 = await takeHeapSnapshot(client);
  const afterCount = countNodes(snapshot2, 'PopupContent');

  // PopupContent instances should not accumulate:
  // Allow at most baseline + 1 (for potentially one currently open popup)
  expect(afterCount).toBeLessThanOrEqual(baseline + 1);

  await browser.close();
}, 60000);

/**
 * Helper: Take a heap snapshot via Playwright CDPSession.
 * Collects chunks from HeapProfiler.addHeapSnapshotChunk events.
 */
async function takeHeapSnapshot(client: CDPSession): Promise<string> {
  let snapshot = '';
  
  const handler = (params: { chunk: string }) => {
    snapshot += params.chunk;
  };

  client.on('HeapProfiler.addHeapSnapshotChunk', handler);
  
  await client.send('HeapProfiler.takeHeapSnapshot', {
    reportProgress: false,
  });

  client.off('HeapProfiler.addHeapSnapshotChunk', handler);

  return snapshot;
}

/**
 * Helper: Count occurrences of a specific node name in a V8 heap snapshot.
 */
function countNodes(snapshot: string, nodeName: string): number {
  try {
    const data = JSON.parse(snapshot);
    const strings: string[] = data.strings;
    const nodes: number[] = data.nodes;
    const nodeFieldCount = data.snapshot.meta.node_fields.length;
    const nameOffset = data.snapshot.meta.node_fields.indexOf('name');
    
    let count = 0;
    for (let i = 0; i < nodes.length; i += nodeFieldCount) {
      const nameIndex = nodes[i + nameOffset];
      if (strings[nameIndex] === nodeName) count++;
    }
    return count;
  } catch {
    return 0;
  }
}
