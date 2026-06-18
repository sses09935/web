import React, { KeyboardEvent, MouseEvent } from "react";
import { Phone, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Resource } from "@/types";
import { useBudgetDispatch, MOCK_SERVICES, EXCLUDED_SUB_CATEGORIES } from "@/contexts/BudgetContext";
import ScrambledText from '@/components/ScrambledText';
import { hasValidCoordinates } from "@/lib/resourceUtils";

interface ResourceCardProps {
  /**
   * The resource data to display.
   */
  res: Resource;
  /**
   * Whether the card is currently selected/active.
   */
  isActive: boolean;
  /**
   * Whether the card details are expanded.
   */
  isExpanded: boolean;
  /**
   * Callback for when the card is clicked or activated.
   */
  onClick: (res: Resource) => void;
  /**
   * Callback for expanding/collapsing details.
   */
  onToggleExpand: (id: string, e: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Enterprise-grade memoized resource card component.
 */
function ResourceCardComponent({
  res,
  isActive,
  isExpanded,
  onClick,
  onToggleExpand,
}: ResourceCardProps) {
  const { addService } = useBudgetDispatch();

  // 依修正條文第 2 條第 2 項，全日住宿式/團體家屋不適用本辦法
  const isExcludedFromBudget = EXCLUDED_SUB_CATEGORIES.includes(res.subCategory);

  let tagClass = "cat-care";
  if (res.category === "照顧與專業服務") tagClass = "cat-care";
  else if (res.category === "失智專責資源") tagClass = "cat-dementia";
  else if (res.category === "喘息與住宿機構") tagClass = "cat-respite";
  else if (res.category === "輔具與交通環境") tagClass = "cat-assist";

  const isOutreach = !hasValidCoordinates(res);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(res);
    }
  };

  const handleAddSimulation = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isExcludedFromBudget) return; // 排除項目不可加入

    // Create unique ID for each added service to prevent React Key collisions
    const generateId = (base: string) => `${base}_${res.id}_${crypto.randomUUID()}`;

    if (res.category === "照顧與專業服務") {
      // 預設加入一組 BA01 + BA05 (基本身體清潔 + 餐食照顧)
      addService({ ...MOCK_SERVICES['BA01'], id: generateId('BA01') });
      addService({ ...MOCK_SERVICES['BA05'], id: generateId('BA05') });
    } else if (res.subCategory === "交通接送") {
      addService({ id: generateId('transport'), name: '交通接送 D碼 (單趟)', price: 200, category: 'transport' });
    } else if (res.category === "喘息與住宿機構") {
      // 預設加入 GA05 機構住宿式喘息 (真實法規價格)
      addService({ ...MOCK_SERVICES['GA05'], id: generateId('GA05') });
    } else if (res.subCategory === "輔具特約" || res.subCategory === "輔具租賃") {
      addService({ id: generateId('assistive'), name: '輪椅 E碼 (輕量化)', price: 6000, category: 'assistive' });
    } else if (res.category === "輔具與交通環境") {
      addService({ id: generateId('general_assist'), name: '無障礙環境改善', price: 3000, category: 'assistive' });
    } else {
      addService({ id: generateId('general'), name: '專業指導諮詢', price: 1500, category: 'care' });
    }
  };

  return (
    <article
      id={`resource-card-${res.id}`}
      onClick={() => onClick(res)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      // ✨ 修復點 A2 (focus-visible)：滑鼠點擊不顯示焦點環，僅鍵盤導航時顯示
      className={`flexible-card cursor-pointer p-3.5 sm:p-4 md:p-5 rounded-xl border-2 transition-colors transform-gpu duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 [content-visibility:auto] [contain-intrinsic-size:auto_200px] ${
        isActive
          ? "bg-blue-50/80 dark:bg-slate-900/80 border-blue-600 dark:border-yellow-400 ring-2 ring-blue-100 dark:ring-yellow-400"
          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-yellow-500"
      }`}
      aria-current={isActive ? "true" : undefined}
      aria-label={`代碼 ${res.stableLabel}：${res.name}。分類：${res.subCategory}。${
        isOutreach ? "本單位提供外展諮詢服務。" : ""
      }地址：${res.address || "無實體地址"}。`}
    >
      {/* Heading details */}
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* ✨ 修復點 A1 (流體邊界)：min-w-0 切斷 Flexbox min-width:auto 內部尺寸陷阱 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`cat-tag ${tagClass}`} aria-hidden="true">
              {res.stableLabel}
            </span>
            <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {res.subCategory}
            </span>
            {isOutreach && (
              <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-amber-100 dark:bg-yellow-950 text-amber-800 dark:text-yellow-400 border border-amber-200 dark:border-yellow-800">
                📞 外展諮詢服務
              </span>
            )}
          </div>
          {/* ✨ 修復點 A1b (名稱截斷)：超長機構名稱窄螢幕下以兩行截斷 */}
          <h3 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2" data-testid="resource-name" title={res.name}>
            <ScrambledText text={res.name} />
          </h3>
        </div>
      </div>

      {/* Primary Info */}
      <div className="space-y-1.5 text-sm my-3 font-semibold text-slate-700 dark:text-slate-300">
        {res.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0 dark:text-yellow-400" aria-hidden="true" />
            <span className="sr-only">電話：</span>
            <a
              href={`tel:${res.phone}`}
              className="font-bold underline text-blue-600 dark:text-yellow-400 focus:outline-none min-h-[44px] min-w-[44px] flex items-center"
              aria-label={`撥打電話給 ${res.name}`}
              data-testid="resource-phone"
            >
              {res.phone}
            </a>
          </div>
        )}
        {res.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 dark:text-yellow-400" aria-hidden="true" />
            <span className="sr-only">地址：</span>
            {/* ✨ 修復點 A3 (地址 title)：截斷地址可透過 hover tooltip 顯示完整文字 */}
            <span className="line-clamp-1" data-testid="resource-address" title={res.address}>{res.address}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 my-3 flex-wrap">
        {isOutreach ? (
          <button
            onClick={(e) => { e.stopPropagation(); alert(`「${res.name}」目前無經緯度座標資料，無法在地圖上定位。\n\n如有地址，可使用「🧭 地圖導航」按鈕前往 Google Maps 查詢。`); }}
            className="bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs md:text-sm px-3 rounded-xl font-extrabold cursor-not-allowed focus:outline-none flex items-center justify-center gap-1.5 flex-1 text-center h-12 sm:h-11 min-h-[44px] min-w-[44px] shadow-sm border border-dashed border-slate-300 dark:border-slate-600"
            aria-label={`${res.name} 無地圖座標資料，無法在地圖上定位`}
            title="本單位無經緯度座標資料，無法於地圖定位"
          >
            📍 無座標資料
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onClick(res); }}
            className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 text-xs md:text-sm px-3 rounded-xl font-extrabold hover:bg-blue-200 dark:hover:bg-blue-800 focus:outline-none flex items-center justify-center gap-1.5 flex-1 text-center h-12 sm:h-11 min-h-[44px] min-w-[44px] shadow-sm transition-all"
            aria-label={`在地圖上定位 ${res.name}`}
          >
            📍 在地圖定位
          </button>
        )}
        {res.phone && (
          <a
            href={`tel:${res.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="bg-blue-600 dark:bg-yellow-400 text-white dark:text-black text-xs md:text-sm px-3 rounded-xl font-extrabold hover:bg-blue-700 focus:outline-none flex items-center justify-center gap-1.5 flex-1 text-center h-12 sm:h-11 min-h-[44px] min-w-[44px] shadow-sm transition-all"
            aria-label={`直接撥打電話給 ${res.name}`}
          >
            📞 一鍵撥號
          </a>
        )}
        {(() => {
          const navAddr = (res.navAddress && res.navAddress.trim()) ? res.navAddress.trim() : (res.address ? res.address.trim() : '');
          // Only show navigation for real addresses, not contact info strings
          const isRealAddress = navAddr && (navAddr.includes('市') || navAddr.includes('區') || navAddr.includes('路') || navAddr.includes('街') || navAddr.includes('號'));
          return isRealAddress ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navAddr)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="bg-green-600 dark:bg-yellow-500 text-white dark:text-black text-xs md:text-sm px-3 rounded-xl font-extrabold hover:bg-green-700 focus:outline-none flex items-center justify-center gap-1.5 flex-1 text-center h-12 sm:h-11 min-h-[44px] min-w-[44px] shadow-sm transition-all"
              aria-label={`開啟新分頁地圖導航至 ${res.name}`}
            >
              🧭 地圖導航
            </a>
          ) : null;
        })()}
        <button
          onClick={handleAddSimulation}
          disabled={isExcludedFromBudget}
          className={`text-xs md:text-sm px-3 rounded-xl font-extrabold focus:outline-none flex items-center justify-center gap-1.5 flex-1 text-center h-12 sm:h-11 min-h-[44px] min-w-[44px] shadow-sm transition-all ${
            isExcludedFromBudget
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-dashed border-slate-300 dark:border-slate-600'
              : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 hover:bg-purple-200 dark:hover:bg-purple-800'
          }`}
          aria-label={isExcludedFromBudget ? `${res.name} 依法不適用長照給付辦法` : `將 ${res.name} 加入長照預算試算`}
          title={isExcludedFromBudget ? '依第 2 條第 2 項，全日住宿式/團體家屋不適用本辦法' : undefined}
        >
          {isExcludedFromBudget ? '⛔ 依法不適用給付' : '💰 加入試算'}
        </button>
        <button
          onClick={(e) => onToggleExpand(res.id, e)}
          className="px-3 border border-slate-300 dark:border-white rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none flex items-center justify-center font-bold text-xs h-12 sm:h-11 min-h-[44px] min-w-[44px] transition-all"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `收起 ${res.name} 的詳細派案資訊` : `展開 ${res.name} 的詳細派案資訊`}
        >
          {isExpanded ? (
            <span className="flex items-center gap-1">收起 <ChevronUp className="w-3.5 h-3.5" /></span>
          ) : (
            <span className="flex items-center gap-1">展開 <ChevronDown className="w-3.5 h-3.5" /></span>
          )}
        </button>
      </div>

      {/* Collapsible details pane */}
      {isExpanded && (
        <div 
          className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-white text-sm space-y-3 font-semibold text-slate-800 dark:text-slate-200 text-pretty"
        >
          {res.targetAudience && (
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="text-xs font-extrabold text-blue-700 dark:text-yellow-400 mb-0.5">👥 協助對象：</h4>
              <p>{res.targetAudience}</p>
            </div>
          )}
          {res.providedResources && (
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="text-xs font-extrabold text-blue-700 dark:text-yellow-400 mb-0.5">🌟 可提供之資源服務：</h4>
              <p>{res.providedResources}</p>
            </div>
          )}
          {res.notes && (
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border-l-4 border-amber-500">
              <h4 className="text-xs font-extrabold text-amber-700 dark:text-yellow-400 mb-0.5">⚠️ 注意事項 / 計費標準：</h4>
              {res.subCategory === "交通接送" ? (
                <div className="space-y-1.5">
                  <p className="font-extrabold text-red-600 dark:text-yellow-300">
                    【爬梯機樓層計費細解】
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
                    <div className="bg-red-50 dark:bg-slate-950 p-1.5 rounded border border-red-200 dark:border-white">
                      2、3樓 <br /> <span className="text-red-700 dark:text-yellow-300">$800</span>
                    </div>
                    <div className="bg-red-50 dark:bg-slate-950 p-1.5 rounded border border-red-200 dark:border-white">
                      4樓 <br /> <span className="text-red-700 dark:text-yellow-300">$900</span>
                    </div>
                    <div className="bg-red-50 dark:bg-slate-950 p-1.5 rounded border border-red-200 dark:border-white">
                      5樓 <br /> <span className="text-red-700 dark:text-yellow-300">$1000</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-yellow-400 mt-1">{res.notes}</p>
                </div>
              ) : (
                <p className="whitespace-pre-line leading-relaxed">{res.notes}</p>
              )}
            </div>
          )}
          {res.referralMethod && (
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <h4 className="text-xs font-extrabold text-blue-700 dark:text-yellow-400 mb-0.5">📝 轉介或預約方式：</h4>
              <p className="whitespace-pre-line">{res.referralMethod}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default React.memo(ResourceCardComponent);
