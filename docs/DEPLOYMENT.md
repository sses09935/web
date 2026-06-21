# 靜態託管部署指南

本文件補齊 README「部署」段落,讓任何 fork 者能從 clean clone 把本 PoC 部署到任一支援 static export 的主機,而不假設只有 Firebase Hosting 一種 vendor。

對應 issue:[#2 Expand static hosting deployment documentation](https://github.com/sses09935/web/issues/2)。

> 安全前提:本文件描述的 CSP 與快取 header 屬於部署層的 header hygiene / defense-in-depth,**不會**讓靜態前端變成可保護敏感資料的系統。靜態站台只要把資料送進瀏覽器,就無法保證阻止複製、截圖、攔截或自動化讀取。資產分類、對手模型與控制邊界以 [`THREAT_MODEL.md`](../THREAT_MODEL.md) 為準。

---

## 1. 通用 static-export 契約

部署產物完全由 Next.js static export 產生,與 host 無關:

```bash
npm install      # 會自動執行 prepare:data;無私有資料時使用合成範例
npm run build    # next build,output: 'export'
```

輸出目錄固定為 `out/`。任何主機的設定都應把這個目錄當成 web root(publish / public directory)。

### 1.1 必備產物

部署前請確認 `out/` 至少包含以下檔案。缺任何一個都代表 build 未完成或設定被改壞:

| 路徑 | 角色 | 缺漏症狀 |
| --- | --- | --- |
| `out/index.html` | 首頁(派案與查詢工作台) | 站台根目錄 404 / 空白 |
| `out/dashboard.html` | 儀表板路由 | `/dashboard` 404 |
| `out/404.html` | 找不到頁面時的 fallback | host 顯示預設 404 而非站台 404 |
| `out/maplibre-gl-csp-worker.js` | Maplibre CSP worker(實體檔) | 地圖空白、worker 被 CSP 擋下 |
| `out/_next/static/**` | hashed JS / CSS / media chunks | 樣式或互動完全失效 |

快速檢查:

```bash
npm run build
ls out/index.html out/dashboard.html out/404.html out/maplibre-gl-csp-worker.js
```

### 1.2 不可破壞的 export 前提

以下是 static export 能成立的硬條件(細節見 [`AGENTS.md`](../AGENTS.md) 與 README):

- 保留 `next.config.ts` 的 `output: 'export'` 與 `images.unoptimized: true`。
- 不加入 `getServerSideProps`、dynamic API routes 或任何 Node.js server runtime 依賴。
- 地圖元件維持 client-only:`next/dynamic(..., { ssr: false })`。
- 保留 `src/app/page.tsx` 的 `isMounted` gate,避免 hydration mismatch。
- 環境變數只有 build 時注入的 `NEXT_PUBLIC_*` 會進到 bundle;static export 沒有 server-side runtime env。

### 1.3 本機預覽

部署前先用內建靜態伺服器驗證產物(會模擬大多數 host 的 clean-URL / 404 行為):

```bash
npm run preview:static          # 預設 http://127.0.0.1:3000
npm run preview:static -- --port 4000
```

預覽伺服器對 `/dashboard` 會依序嘗試 `dashboard`、`dashboard/index.html`、`dashboard.html`,找不到時回 `out/404.html`,可用來在上線前重現路由問題。

---

## 2. CSP 指引(最容易踩雷的點)

Maplibre 在預設情況下用 `blob:` URL 建立 worker。**Safari 不正確支援 `worker-src blob:`,會退回 `script-src` 而把 worker 擋下。** 因此 `src/components/Map.tsx` 改用實體 worker 檔:

```ts
// src/components/Map.tsx
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl("/maplibre-gl-csp-worker.js");
```

這個檔案是 committed 的靜態資產 `public/maplibre-gl-csp-worker.js`,`next build` 會原樣複製到 `out/`。因為走實體檔而非 `blob:`,正確的 CSP 是 `worker-src 'self'`(不需要 `blob:`)。

### 2.1 完整 directive 與理由

下表是本專案實際使用的 CSP(權威來源為 [`firebase.json`](../firebase.json),其他 host 請對齊):

| Directive | 值 | 為什麼需要 |
| --- | --- | --- |
| `default-src` | `'self'` | 其餘未列出的資源預設同源 |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | Next.js inline bootstrap 與 Maplibre 需要 |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind / inline style |
| `img-src` | `'self' data: blob: https://*.cartocdn.com https://*.basemaps.cartocdn.com` | 地圖底圖磚與 data/blob 圖示 |
| `connect-src` | `'self' https://*.cartocdn.com https://*.basemaps.cartocdn.com` | 抓取底圖 tile 與 style JSON |
| **`worker-src`** | **`'self'`** | **載入 `/maplibre-gl-csp-worker.js`;最常被遺漏** |
| `child-src` | `'self'` | 舊瀏覽器對 worker 的 fallback directive |
| `font-src` | `'self' data:` | 內嵌字型 |
| `frame-ancestors` | `'none'` | 禁止被 iframe 嵌入(clickjacking) |

可直接複製的單行 CSP:

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cartocdn.com https://*.basemaps.cartocdn.com; connect-src 'self' https://*.cartocdn.com https://*.basemaps.cartocdn.com; worker-src 'self'; child-src 'self'; font-src 'self' data:; frame-ancestors 'none';
```

### 2.2 fork 者最常見的 CSP 失誤

- **漏掉 `worker-src 'self'`**:地圖容器渲染但無底圖,console 出現 worker 被 CSP refuse。一律把 `worker-src` 與 `child-src` 一起設 `'self'`。
- **換了底圖供應商卻沒改 `img-src` / `connect-src`**:若不再用 CARTO,需把 `*.cartocdn.com` 換成新供應商網域,否則 tile 會被 `connect-src` / `img-src` 擋下。
- **用 `<meta http-equiv>` 設 CSP**:`frame-ancestors` 在 meta 標籤無效,只能透過 HTTP header 設定。沒有 header 控制權的 host(見 §4.4 GitHub Pages)無法完整套用本 CSP。
- **把 worker 改回 `blob:`**:會在 Safari 失效。保留實體 worker 檔與 `setWorkerUrl`。

---

## 3. 路由、404 與快取

### 3.1 trailing slash / clean URL

- `next.config.ts` 未設定 `trailingSlash`,因此用 Next.js 預設(`false`)。
- static export 對 `/dashboard` 同時產生 `out/dashboard.html` 與 `out/dashboard/index.html`,讓不同 host 的解析策略都能命中。
- 各 host 對「無副檔名路徑」的解析不同,需要對應設定:
  - **Firebase**:`"cleanUrls": true` → `/dashboard` 直接映射 `dashboard.html`。
  - **Netlify / Cloudflare Pages**:預設會嘗試 `dashboard.html` 與 `dashboard/index.html`,通常免設定。
  - **GitHub Pages**:依賴 `dashboard/index.html`,所以保留目錄式輸出很重要。

### 3.2 404 行為

- 站台自訂 404 頁是 `out/404.html`(Next.js `_not-found` 路由的匯出)。
- 多數 host(Firebase / Netlify / Cloudflare / GitHub Pages)會自動把找不到的路徑回退到根目錄的 `404.html`,通常免設定。
- 驗證方式:`npm run preview:static` 後請求一個不存在的路徑,應回 `404.html` 內容與 HTTP 404。

### 3.3 asset cache 與 immutable hashing

- `out/_next/static/**` 內所有檔名都帶內容雜湊(例如 `chunks/0.qolj0tu202z.js`),內容一變檔名就變,可安全長期快取:

  ```
  Cache-Control: public, max-age=31536000, immutable
  ```

- **HTML(`index.html`、`dashboard.html`、`404.html`)不可長快取**,否則使用者會卡在舊版。建議短 TTL 或 `no-cache` / `must-revalidate`,讓新部署立即生效。
- `maplibre-gl-csp-worker.js` 檔名固定(不帶 hash),若要長快取,改版時需自行 cache-bust(或維持較短 TTL)。

---

## 4. 部署目標

至少提供 Firebase 之外的選項,消除單一 vendor 假設。所有 host 的 web root 都是 `out/`,build 指令都是 `npm run build`。

### 4.1 Firebase Hosting(現況)

設定已在 repo:[`firebase.json`](../firebase.json)(`hosting.public: "out"`、`cleanUrls`、CSP 與快取 header)、[`.firebaserc`](../.firebaserc)(default project `ntuh-beihu-poc`)。

```bash
npm run build
npx firebase-tools hosting:channel:deploy preview   # 預覽 channel,產生臨時 URL
npx firebase-tools deploy --only hosting            # 正式部署
```

Fork 者請改 `.firebaserc` 的 project id,並用自己的 Firebase 帳號登入。

### 4.2 Netlify

在 repo 根目錄新增 `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "out"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cartocdn.com https://*.basemaps.cartocdn.com; connect-src 'self' https://*.cartocdn.com https://*.basemaps.cartocdn.com; worker-src 'self'; child-src 'self'; font-src 'self' data:; frame-ancestors 'none';"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Netlify 會自動處理 clean URL 與 `404.html` fallback,通常不需要額外 redirects。

### 4.3 Cloudflare Pages

- Build command:`npm run build`
- Build output directory:`out`
- header / cache 與 CSP:在 `public/_headers`(會被複製到 `out/_headers`)寫:

  ```
  /_next/static/*
    Cache-Control: public, max-age=31536000, immutable

  /*
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: strict-origin-when-cross-origin
    Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.cartocdn.com https://*.basemaps.cartocdn.com; connect-src 'self' https://*.cartocdn.com https://*.basemaps.cartocdn.com; worker-src 'self'; child-src 'self'; font-src 'self' data:; frame-ancestors 'none';
  ```

Cloudflare Pages 會自動處理 `404.html` 與 clean URL。

### 4.4 GitHub Pages(注意事項較多)

GitHub Pages 可用,但有兩個會讓 fork 者踩雷的限制:

1. **無法設定 HTTP header**,因此無法完整套用本 CSP(`frame-ancestors` 無 meta 等價物)。只能接受較弱的 header hygiene。
2. **Project Pages 部署在子路徑** `https://<user>.github.io/<repo>/`。本專案用絕對路徑 `setWorkerUrl("/maplibre-gl-csp-worker.js")` 與 `output: 'export'` 的根路徑資產,子路徑下會 404,導致地圖空白。

   - **User / Org Pages**(`https://<user>.github.io/`,root)可直接用,免改設定。
   - **Project Pages** 需設定 `basePath` / `assetPrefix`,並把 worker URL 改成帶 base 的路徑,否則資產載入會失敗。這超出本 PoC 預設設定,請自行評估。

其他注意:加入空的 `.nojekyll`(避免 GitHub 忽略 `_next` 底線開頭目錄),並依賴目錄式輸出(`dashboard/index.html`)。

---

## 5. Troubleshooting

| 症狀 | 可能原因 | 處理 |
| --- | --- | --- |
| 地圖容器出現但底圖空白 | CSP 漏 `worker-src 'self'`,或 worker 檔 404 | 補 `worker-src 'self'`;確認 `out/maplibre-gl-csp-worker.js` 存在且非子路徑部署 |
| Safari 可、其他瀏覽器不可(或相反) | worker 被改回 `blob:` | 保留 `setWorkerUrl("/maplibre-gl-csp-worker.js")` 與實體 worker 檔 |
| 底圖磚載入失敗 | 換了底圖供應商但沒改 `img-src` / `connect-src` | 把新供應商網域加進兩個 directive |
| `/dashboard` 404 | host 未做 clean URL 或沒上傳目錄式輸出 | 確認 `out/dashboard.html` 與 `out/dashboard/index.html` 都已部署;設定 host clean URL |
| 找不到頁面顯示 host 預設 404 | 沒設定 404 fallback | 確認 `out/404.html` 已部署;必要時設定 host 的 404 對應 |
| 部署後仍是舊版 | HTML 被長快取 | 對 `*.html` 設短 TTL / `no-cache`;只對 `_next/static/**` 用 immutable |
| 樣式 / 互動完全失效 | `_next/static/**` 未上傳或路徑錯誤 | 確認整個 `out/_next` 目錄都已部署;子路徑部署需設 `basePath` |
| 預期的資料沒出現 | 該 host 用合成範例資料,或私有資料未注入 | 私有資料流程見 README 與 [`DATA_UPDATE_CHECKLIST.md`](DATA_UPDATE_CHECKLIST.md);env 只認 build 時的 `NEXT_PUBLIC_*` |

---

## 相關文件

- [`README.md`](../README.md) — 專案總覽、資料載入策略
- [`THREAT_MODEL.md`](../THREAT_MODEL.md) — 安全邊界與 PoC non-goals
- [`DATA_UPDATE_CHECKLIST.md`](DATA_UPDATE_CHECKLIST.md) — 正式資源檔的資料更新流程
- [`firebase.json`](../firebase.json) — Firebase header / CSP / 快取權威設定
