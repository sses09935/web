/**
 * ResourceCard UI resilience unit tests (issue #5)
 *
 * Coverage goals:
 * - Full data renders the expected name / phone / address / action surface.
 * - Optional fields go through null-checks: no empty rows, no empty buttons,
 *   no placeholder text is emitted when a field is missing.
 * - Long presentation text is truncated at the presentation layer only
 *   (CSS line-clamp + full text preserved in the `title` tooltip).
 * - Resources with invalid coordinates still render as an outreach card,
 *   but are excluded from the map-marker set the <Map> component consumes.
 *
 * These are deliberately Jest/jsdom unit tests. Keyboard journeys, axe scans
 * and aria-live announcements live in the Playwright e2e suite (issue #1) to
 * avoid overlap.
 */

import React from "react";
import { render, screen, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ResourceCard from "@/components/ResourceCard";
import { BudgetProvider } from "@/contexts/BudgetContext";
import { hasMapLocation } from "@/lib/resourceUtils";
import { Resource } from "@/types";

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: "test-1",
    category: "照顧與專業服務",
    subCategory: "居家服務",
    name: "測試居家照顧單位",
    phone: "02-1234-5678",
    address: "臺北市萬華區測試路1號",
    navAddress: "臺北市萬華區測試路1號",
    district: "臺北市萬華區",
    latitude: 25.03,
    longitude: 121.5,
    targetAudience: "行動不便長者",
    providedResources: "居家照顧、餐食照顧",
    referralMethod: "由個案管理師電話轉介",
    notes: "需先確認服務時段",
    stableLabel: "A1",
    ...overrides,
  };
}

function renderCard(res: Resource, opts: { isExpanded?: boolean } = {}) {
  const utils = render(
    <BudgetProvider>
      <ResourceCard
        res={res}
        isActive={false}
        isExpanded={opts.isExpanded ?? false}
        onClick={() => {}}
        onToggleExpand={() => {}}
      />
    </BudgetProvider>
  );
  // Flush ScrambledText's post-hydration useEffect so the name spans render.
  act(() => {});
  return utils;
}

describe("ResourceCard — 完整資料渲染", () => {
  test("完整資料時應渲染名稱、電話、地址與主要操作按鈕", () => {
    const res = makeResource();
    renderCard(res);

    // The card itself is a labelled region.
    const card = screen.getByRole("region", { name: /測試居家照顧單位/ });
    expect(card).toBeInTheDocument();

    // Name (ScrambledText exposes the real text via aria-label).
    expect(within(card).getByLabelText(res.name)).toBeInTheDocument();

    // Phone link + address row present.
    expect(screen.getByTestId("resource-phone")).toHaveAttribute("href", `tel:${res.phone}`);
    expect(screen.getByTestId("resource-address")).toHaveTextContent(res.address);

    // Core actions for a fully-located, callable resource.
    expect(screen.getByRole("link", { name: `直接撥打電話給 ${res.name}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `在地圖上定位 ${res.name}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `將 ${res.name} 加入長照預算試算` })).toBeInTheDocument();
  });

  test("展開時應渲染所有存在的詳細欄位", () => {
    const res = makeResource();
    renderCard(res, { isExpanded: true });

    expect(screen.getByText("👥 協助對象：")).toBeInTheDocument();
    expect(screen.getByText(res.targetAudience)).toBeInTheDocument();
    expect(screen.getByText("🌟 可提供之資源服務：")).toBeInTheDocument();
    expect(screen.getByText("📝 轉介或預約方式：")).toBeInTheDocument();
  });
});

describe("ResourceCard — 缺漏選填欄位的 null-check", () => {
  test("無電話時不渲染電話列或撥號按鈕（不出空 row、不出空 button）", () => {
    renderCard(makeResource({ phone: "" }));

    expect(screen.queryByTestId("resource-phone")).not.toBeInTheDocument();
    // 「一鍵撥號」與卡片內電話連結都依賴 res.phone，缺電話時不可出現。
    expect(screen.queryByRole("link", { name: /撥打電話給/ })).not.toBeInTheDocument();
    expect(screen.queryByText("📞 一鍵撥號")).not.toBeInTheDocument();
  });

  test("無地址時不渲染地址列，也不渲染地圖導航按鈕", () => {
    renderCard(makeResource({ address: "", navAddress: "" }));

    expect(screen.queryByTestId("resource-address")).not.toBeInTheDocument();
    expect(screen.queryByText("🧭 地圖導航")).not.toBeInTheDocument();
  });

  test("展開但詳細欄位全空時，不渲染任何空標題或空 placeholder", () => {
    renderCard(
      makeResource({
        targetAudience: "",
        providedResources: "",
        referralMethod: "",
        notes: "",
      }),
      { isExpanded: true }
    );

    expect(screen.queryByText("👥 協助對象：")).not.toBeInTheDocument();
    expect(screen.queryByText("🌟 可提供之資源服務：")).not.toBeInTheDocument();
    expect(screen.queryByText("⚠️ 注意事項 / 計費標準：")).not.toBeInTheDocument();
    expect(screen.queryByText("📝 轉介或預約方式：")).not.toBeInTheDocument();
  });

  test("缺漏選填欄位時渲染不應拋錯", () => {
    expect(() =>
      renderCard(
        makeResource({ phone: "", address: "", navAddress: "", notes: "" })
      )
    ).not.toThrow();
  });
});

describe("ResourceCard — 長文字於 presentation layer 截斷", () => {
  test("超長機構名稱以 line-clamp 截斷，完整文字保留在 title 與 aria-label", () => {
    const longName = "財團法人測試長期照顧服務社團法人附設居家式服務類長期照顧服務機構萬華區第一服務處超長名稱壓力測試單位";
    renderCard(makeResource({ name: longName }));

    const heading = screen.getByTestId("resource-name");
    // Truncation must be purely presentational — full text remains accessible.
    expect(heading).toHaveClass("line-clamp-2");
    expect(heading).toHaveAttribute("title", longName);
    expect(within(heading).getByLabelText(longName)).toBeInTheDocument();
  });

  test("超長地址以單行 line-clamp 截斷，完整文字保留在 title", () => {
    const longAddress = "臺北市萬華區測試路一段123巷45弄67號8樓之9壓力測試超長地址用於驗證單行截斷不破壞版面";
    renderCard(makeResource({ address: longAddress, navAddress: longAddress }));

    const addressEl = screen.getByTestId("resource-address");
    expect(addressEl).toHaveClass("line-clamp-1");
    expect(addressEl).toHaveAttribute("title", longAddress);
    // The visible text node still carries the full string; clamping is CSS-only.
    expect(addressEl).toHaveTextContent(longAddress);
  });
});

describe("ResourceCard — 無效座標的外展卡片", () => {
  test("座標為 null 時仍渲染卡片，但標記為外展諮詢且禁用地圖定位", () => {
    const res = makeResource({ latitude: null, longitude: null });
    renderCard(res);

    // Card still renders.
    expect(screen.getByRole("region", { name: /測試居家照顧單位/ })).toBeInTheDocument();
    // Outreach badge + disabled "no coordinates" affordance instead of map locate.
    expect(screen.getByText("📞 外展諮詢服務")).toBeInTheDocument();
    const noCoordBtn = screen.getByRole("button", {
      name: `${res.name} 無地圖座標資料，無法在地圖上定位`,
    });
    // Marked visually as not-actionable for map locate (cursor-not-allowed),
    // and the real "在地圖定位" action is not offered for an un-locatable unit.
    expect(noCoordBtn).toHaveClass("cursor-not-allowed");
    expect(screen.queryByRole("button", { name: `在地圖上定位 ${res.name}` })).not.toBeInTheDocument();
  });

  test("無效座標的資源被排除於地圖 marker 集合之外（與 <Map> 過濾邏輯一致）", () => {
    const valid = makeResource({ id: "valid", latitude: 25.03, longitude: 121.5 });
    const nullCoord = makeResource({ id: "null", latitude: null, longitude: null });
    const zeroCoord = makeResource({ id: "zero", latitude: 0, longitude: 0 });
    const outOfRange = makeResource({ id: "oob", latitude: 999, longitude: 999 });

    // <Map> derives its markers via `resources.filter(hasMapLocation)`.
    const markerSet = [valid, nullCoord, zeroCoord, outOfRange].filter(hasMapLocation);

    expect(markerSet.map((r) => r.id)).toEqual(["valid"]);
  });
});
