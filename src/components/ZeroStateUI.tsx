import React from "react";

interface ZeroStateUIProps {
  /**
   * True if no filters and no search query are active (initial load state).
   */
  isInitialState: boolean;
  /**
   * Callback to clear all active filters.
   */
  onClearFilters?: () => void;
}

/**
 * Enterprise-grade empty state component for rendering initial load state
 * or no results found message.
 */
function ZeroStateUIComponent({ isInitialState, onClearFilters }: ZeroStateUIProps) {
  if (isInitialState) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-8 px-4 sm:px-6 lg:px-8 text-center border-2 border-dashed border-slate-300 dark:border-yellow-400 rounded-xl my-4 bg-slate-50 dark:bg-slate-900 text-pretty" 
        role="status" 
        aria-live="polite"
      >
        <div className="text-4xl mb-3" aria-hidden="true">💡</div>
        <p className="text-xl sm:text-2xl lg:text-3xl leading-snug font-bold text-blue-900 dark:text-yellow-300">歡迎使用北護長照資源協作平台</p>
        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed mt-2 max-w-lg font-semibold">
          為了提升系統流暢度，系統已啟動減重載入。請<strong>點擊上方「情境快選」</strong>按鈕，或<strong>展開下方摺疊面板勾選服務類別</strong>，即可即時在地圖與清單中呈現篩選網絡。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800" role="status" aria-live="polite">
      <p className="text-xl sm:text-2xl lg:text-3xl leading-snug font-bold text-slate-500 dark:text-yellow-400">查無符合條件的資源</p>
      <p className="text-sm sm:text-base lg:text-lg leading-relaxed text-slate-400 dark:text-slate-400 mt-2 mb-4">請嘗試重設篩選條件或輸入不同的搜尋關鍵字。</p>
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors focus:outline-none min-h-[44px]"
        >
          清除所有篩選條件
        </button>
      )}
    </div>
  );
}

export default React.memo(ZeroStateUIComponent);
