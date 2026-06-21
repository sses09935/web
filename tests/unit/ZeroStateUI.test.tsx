/**
 * ZeroStateUI empty-state unit tests (issue #5)
 *
 * The resource list renders <ZeroStateUI> whenever the filtered result set is
 * empty. Two distinct empty states must stay distinguishable and announced:
 *   - Initial load (no filters / no query): a welcome / onboarding prompt.
 *   - No results (filters or query active but nothing matched): a recovery
 *     prompt, optionally with a "clear filters" action.
 *
 * Both states must expose a polite live region so the change is announced.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ZeroStateUI from "@/components/ZeroStateUI";

describe("ZeroStateUI — 初始空狀態", () => {
  test("isInitialState 時渲染歡迎引導，且為 polite live region", () => {
    render(<ZeroStateUI isInitialState={true} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("歡迎使用北護長照資源協作平台");
    // 初始狀態為引導，不應出現「查無符合條件」字樣或清除按鈕。
    expect(screen.queryByText("查無符合條件的資源")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("ZeroStateUI — 查無結果狀態", () => {
  test("非初始狀態時渲染查無結果訊息，且為 polite live region", () => {
    render(<ZeroStateUI isInitialState={false} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("查無符合條件的資源");
    expect(screen.queryByText("歡迎使用北護長照資源協作平台")).not.toBeInTheDocument();
  });

  test("提供 onClearFilters 時才渲染清除按鈕，點擊會觸發回呼", () => {
    const onClearFilters = jest.fn();
    const { rerender } = render(<ZeroStateUI isInitialState={false} />);

    // 未提供回呼 → 無清除按鈕。
    expect(screen.queryByRole("button", { name: "清除所有篩選條件" })).not.toBeInTheDocument();

    rerender(<ZeroStateUI isInitialState={false} onClearFilters={onClearFilters} />);
    const clearBtn = screen.getByRole("button", { name: "清除所有篩選條件" });
    clearBtn.click();
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  test("初始狀態即使提供 onClearFilters 也不渲染清除按鈕", () => {
    render(<ZeroStateUI isInitialState={true} onClearFilters={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
