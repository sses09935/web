import React, { useMemo } from "react";
import { ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import { SCENARIOS, CATEGORY_GROUPS } from "@/constants";
import { Resource } from "@/types";

interface FilterPanelProps {
  /**
   * Whether the user has toggled the Beihu only filter.
   */
  filterBeihuOnly: boolean;
  /**
   * The currently selected scenario ID, or null.
   */
  selectedScenario: string | null;
  /**
   * The set of selected sub-category names.
   */
  selectedSubCats: Set<string>;
  /**
   * All unique sub-category names available in the data.
   */
  allSubCategories: string[];
  /**
   * The fully processed resource list (used to count items per subcategory).
   */
  processedResources: Resource[];
  /**
   * Whether the advanced filter panel is expanded.
   */
  filtersExpanded: boolean;
  /**
   * Toggles the Beihu only filter.
   */
  onBeihuOnlyToggle: () => void;
  /**
   * Toggles a scenario selection.
   */
  onScenarioToggle: (scenarioId: string, subCategories: string[]) => void;
  /**
   * Toggles a single sub-category checkbox.
   */
  onSubCatToggle: (subName: string) => void;
  /**
   * Selects all sub-categories.
   */
  onSelectAllFilters: () => void;
  /**
   * Clears all sub-category filters.
   */
  onClearAllFilters: () => void;
  /**
   * Toggles the expanded state of the advanced filters.
   */
  setFiltersExpanded: (expanded: boolean) => void;
  selectedDistrict: string;
  selectedCategory: string;
  allDistricts: string[];
  allCategories: string[];
  onDistrictChange: (district: string) => void;
  onCategoryChange: (category: string) => void;
}

/**
 * Filter panel component (Smart Care Filters)
 */
function FilterPanelComponent({
  filterBeihuOnly,
  selectedScenario,
  selectedSubCats,
  allSubCategories,
  processedResources,
  filtersExpanded,
  onBeihuOnlyToggle,
  onScenarioToggle,
  onSubCatToggle,
  onSelectAllFilters,
  onClearAllFilters,
  setFiltersExpanded,
  selectedDistrict,
  selectedCategory,
  allDistricts,
  allCategories,
  onDistrictChange,
  onCategoryChange
}: FilterPanelProps) {

  // Memoize counts for subcategories so they don't re-calculate on every render
  const subCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    processedResources.forEach(r => {
      counts[r.subCategory] = (counts[r.subCategory] || 0) + 1;
    });
    return counts;
  }, [processedResources]);

  return (
    <section className="bg-slate-100 dark:bg-slate-950 py-6 border-b border-slate-300 dark:border-white shadow-inner overflow-hidden flex-shrink-0" aria-label="長照需求快捷情境工作區">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-lg md:text-xl font-extrabold flex items-center gap-2 text-slate-900 dark:text-yellow-300">
              <span aria-hidden="true">💡</span>
              請選擇您的個案照顧情境（快捷智慧篩選）：
            </h2>
            
            {/* Golden Highlight Button for Beihu Network */}
            <button
              onClick={onBeihuOnlyToggle}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none min-h-[48px] md:min-h-0 ${
                filterBeihuOnly
                  ? "bg-amber-500 border-amber-600 text-black shadow-lg scale-105"
                  : "bg-amber-100/80 border-amber-400 text-amber-950 hover:bg-amber-200"
              }`}
              aria-pressed={filterBeihuOnly}
              aria-label="一鍵過濾顯示台大北護分院本院直屬長照及共照單位"
            >
              <span>🏥 億起台大北護 自有網絡</span>
              {filterBeihuOnly && <span className="text-xs bg-black text-amber-400 px-1.5 py-0.5 rounded font-black">已啟動</span>}
            </button>
          </div>
          
          {/* Dropdown Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1 mb-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="district-select" className="text-sm font-extrabold text-slate-700 dark:text-yellow-400">📍 行政區篩選</label>
              <select 
                id="district-select" 
                value={selectedDistrict} 
                onChange={(e) => onDistrictChange(e.target.value)}
                // ✨ 修復點 A2 (focus-visible)：滑鼠點擊不顯示焦點環
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl px-4 text-slate-800 dark:text-white font-bold text-base focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer min-h-[48px]"
              >
                <option value="全部">全部行政區</option>
                {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="category-select" className="text-sm font-extrabold text-slate-700 dark:text-yellow-400">🏥 服務類別篩選</label>
              <select 
                id="category-select" 
                value={selectedCategory} 
                onChange={(e) => onCategoryChange(e.target.value)}
                // ✨ 修復點 A2 (focus-visible)：滑鼠點擊不顯示焦點環
                className="w-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl px-4 text-slate-800 dark:text-white font-bold text-base focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 dark:focus-visible:ring-yellow-400 cursor-pointer min-h-[48px]"
              >
                <option value="全部">全部服務類別</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Scenario Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCENARIOS.map(sc => {
              const isSelected = selectedScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => onScenarioToggle(sc.id, sc.subCategories)}
                  className={`flex flex-col text-left p-4 rounded-xl transition-all border-2 text-wrap cursor-pointer focus:outline-none min-h-[80px] lg:min-h-0 ${
                    isSelected
                      ? "bg-blue-600 dark:bg-yellow-400 border-blue-700 dark:border-white text-white dark:text-black scale-[1.02] shadow-lg"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white hover:border-blue-400 dark:hover:border-yellow-400"
                  }`}
                  aria-pressed={isSelected}
                  aria-describedby={`desc-${sc.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl" role="img" aria-hidden="true">
                      {sc.icon}
                    </span>
                    <span className="font-extrabold text-base leading-snug">
                      {sc.title}
                    </span>
                  </div>
                  <p 
                    id={`desc-${sc.id}`} 
                    className={`text-xs font-semibold leading-relaxed ${
                      isSelected ? "text-blue-100 dark:text-black/80" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {sc.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Collapsible Filter Panel */}
          <div className="mt-3 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white shadow-sm">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full flex items-center justify-between font-extrabold text-base py-1 text-slate-800 dark:text-white focus:outline-none cursor-pointer min-h-[48px] lg:min-h-0"
              aria-expanded={filtersExpanded}
              aria-controls="advanced-filter-panel"
            >
              {/* ✨ 修復點 A4 (overflow 防禦)：truncate 防止窄螢幕文字溢出 */}
              <span className="flex items-center gap-2 truncate">
                🛠️ 進階篩選與派案細項多選框 ({selectedSubCats.size}/{allSubCategories.length})
              </span>
              {filtersExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {filtersExpanded && (
              <div 
                id="advanced-filter-panel"
                className="mt-4 pt-4 border-t border-slate-100 dark:border-white space-y-4"
                lang="zh-TW"
              >
                <div className="flex flex-wrap gap-2 pb-2">
                  <button
                    onClick={onSelectAllFilters}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white hover:bg-slate-200 text-slate-800 dark:text-white px-3 py-2 lg:py-1.5 rounded-lg text-xs font-extrabold focus:outline-none flex items-center gap-1.5 cursor-pointer min-h-[44px] min-w-[44px]"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> 勾選全部
                  </button>
                  <button
                    onClick={onClearAllFilters}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white hover:bg-slate-200 text-slate-800 dark:text-white px-3 py-2 lg:py-1.5 rounded-lg text-xs font-extrabold focus:outline-none flex items-center gap-1.5 cursor-pointer min-h-[44px] min-w-[44px]"
                  >
                    <Square className="w-3.5 h-3.5" /> 清空所有
                  </button>
                </div>

                {/* Checklist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(CATEGORY_GROUPS).map(([mainCat, subs]) => {
                    const hasAnyVisible = subs.some(subName => (subCategoryCounts[subName] || 0) > 0);
                    if (!hasAnyVisible) return null;

                    return (
                      <fieldset key={mainCat} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <legend className="px-2 font-extrabold text-sm text-blue-700 dark:text-yellow-400 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                          {mainCat}
                        </legend>
                        <div className="mt-2 space-y-2 lg:space-y-1.5">
                          {subs.map(subName => {
                            const isChecked = selectedSubCats.has(subName);
                            const count = subCategoryCounts[subName] || 0;
                            // Do not return null when count is 0. Allow multi-select freely.

                            return (
                              <label 
                                key={subName} 
                                className={`flex items-center gap-2 text-sm lg:text-xs font-bold leading-normal cursor-pointer ${count === 0 && !isChecked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => onSubCatToggle(subName)}
                                  className={`w-5 h-5 lg:w-4 lg:h-4 rounded border-slate-300 focus:ring-blue-500 cursor-pointer ${count === 0 && !isChecked ? 'text-slate-400' : 'text-blue-600'}`}
                                />
                                <span>
                                  {subName}{" "}
                                  <span className={count === 0 ? "text-slate-400 dark:text-slate-500 font-medium" : "text-slate-400 dark:text-yellow-500 font-extrabold"}>({count})</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(FilterPanelComponent);
