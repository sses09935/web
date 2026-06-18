"use client";

import React, { useState } from "react";
import {
  useBudgetState,
  useBudgetDispatch,
  BudgetCategory,
  CmsLevel,
  IdentityType,
  TransportZone,
  CATEGORY_LABELS,
  CATEGORY_PERIOD,
  IDENTITY_LABELS,
  TRANSPORT_ZONE_LABELS,
} from "@/contexts/BudgetContext";
import { ChevronUp, ChevronDown, Trash2, Calculator, AlertTriangle, X, GripHorizontal } from "lucide-react";
import { useRef, useCallback, useEffect } from "react";
import { MOCK_SERVICES } from "@/contexts/BudgetContext";

const CMS_LEVELS: CmsLevel[] = [2, 3, 4, 5, 6, 7, 8];
const IDENTITY_TYPES: IdentityType[] = ['type1', 'type2', 'type3'];
const TRANSPORT_ZONES: TransportZone[] = [1, 2, 3, 4];
const CATEGORY_ORDER: BudgetCategory[] = ['care', 'transport', 'respite', 'assistive'];

export default function BudgetSandbox() {
  const { selectedServices, totals, grandTotalCopay, cmsLevel, identityType, transportZone } = useBudgetState();
  const { removeService, clearServices, setCmsLevel, setIdentityType, setTransportZone, addService } = useBudgetDispatch();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [sandboxHeight, setSandboxHeight] = useState(33); // max-h in dvh
  const [isResizingState, setIsResizingState] = useState(false);
  const isResizing = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Only allow left click
    if ('button' in e && e.button !== 0) return;
    
    // Disable document scrolling/selection during drag
    isResizing.current = true;
    setIsResizingState(true);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    let animationFrameId: number | null = null;
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing.current) return;
      // Prevent default scrolling on touch
      if (e.cancelable) e.preventDefault();
      
      if (animationFrameId) return;
      animationFrameId = requestAnimationFrame(() => {
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const windowHeight = window.innerHeight;
        
        let newHeight = ((windowHeight - clientY) / windowHeight) * 100;
        newHeight = Math.max(20, Math.min(newHeight, 85)); // clamp between 20vh and 85vh
        
        setSandboxHeight(newHeight);
        animationFrameId = null;
      });
    };

    const stopResizing = () => {
      if (isResizing.current) {
        isResizing.current = false;
        setIsResizingState(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', stopResizing);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', stopResizing);
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-[50] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 print:hidden hover:scale-105 transition-transform"
        aria-label="打開長照預算沙盤"
      >
        <Calculator className="w-6 h-6" />
        <span className="font-bold hidden sm:inline">預算沙盤</span>
      </button>
    );
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(amount);
  };

  const hasOverage = Object.values(totals).some(t => t.overage > 0);

  return (
    <div
      className={`fixed bottom-0 left-0 w-full z-[40] bg-white dark:bg-slate-900 border-t-2 border-blue-500 dark:border-yellow-400 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] pb-safe print:hidden ${
        isResizingState ? '' : 'transition-all duration-300'
      }`}
      aria-label="長照動態預算沙盤"
      role="region"
    >
      {/* Resizer Handle */}
      {isExpanded && (
        <div 
          className="w-full h-5 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center cursor-ns-resize transition-colors touch-none"
          onMouseDown={startResizing}
          onTouchStart={startResizing}
          aria-hidden="true"
        >
          <GripHorizontal className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>
      )}

      {/* Header / Toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-slate-800 select-none relative group">
        <button
          className="absolute inset-0 w-full h-full focus:outline-none focus:ring-inset focus:ring-4 focus:ring-blue-400"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "收起預算沙盤" : "展開預算沙盤"}
        />
        <div className="flex items-center gap-3 relative pointer-events-none">
          <div className={`p-1.5 rounded-lg shadow-sm ${hasOverage ? 'bg-red-500 animate-pulse' : 'bg-blue-600 dark:bg-yellow-500'}`}>
            {hasOverage
              ? <AlertTriangle className="w-5 h-5 text-white" aria-hidden="true" />
              : <Calculator className="w-5 h-5 text-white dark:text-black" aria-hidden="true" />
            }
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              長照動態預算沙盤
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 font-bold ml-2">
                CMS {cmsLevel}級 · {IDENTITY_LABELS[identityType].split(' ')[0]}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              預估自付額：
              <span className={`text-base ml-1 font-extrabold ${hasOverage ? 'text-red-500' : 'text-blue-600 dark:text-yellow-400'}`}>
                {formatMoney(grandTotalCopay)}
              </span>
              {hasOverage && <span className="text-red-500 ml-1 text-[11px]">⚠️ 含超額自費</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 p-1 rounded-full shadow-sm">
          <div className="p-1 rounded-full">
            {isExpanded
              ? <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              : <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
            }
          </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
            className="relative z-10 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="完全關閉預算沙盤"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className="p-4 overflow-y-auto shadow-inner"
          style={{ maxHeight: `${sandboxHeight}dvh` }}
        >
          <div className="max-w-7xl mx-auto space-y-5">

            {/* ===== Configuration Selectors ===== */}
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
                📋 長照身分與等級設定（依《長期照顧服務申請及給付辦法》修正條文）
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* CMS Level */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="sandbox-cms-level" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    CMS 長照需要等級
                  </label>
                  <select
                    id="sandbox-cms-level"
                    value={cmsLevel}
                    onChange={(e) => setCmsLevel(Number(e.target.value) as CmsLevel)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px] cursor-pointer"
                  >
                    {CMS_LEVELS.map(level => (
                      <option key={level} value={level}>第 {level} 級</option>
                    ))}
                  </select>
                </div>

                {/* Identity Type */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="sandbox-identity" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    長照身分別（第 14 條）
                  </label>
                  <select
                    id="sandbox-identity"
                    value={identityType}
                    onChange={(e) => setIdentityType(e.target.value as IdentityType)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px] cursor-pointer"
                  >
                    {IDENTITY_TYPES.map(type => (
                      <option key={type} value={type}>{IDENTITY_LABELS[type]}</option>
                    ))}
                  </select>
                </div>

                {/* Transport Zone */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="sandbox-transport-zone" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    交通接送分區（附表三）
                  </label>
                  <select
                    id="sandbox-transport-zone"
                    value={transportZone}
                    onChange={(e) => setTransportZone(Number(e.target.value) as TransportZone)}
                    className="px-3 py-2 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[44px] cursor-pointer"
                  >
                    {TRANSPORT_ZONES.map(zone => (
                      <option key={zone} value={zone}>{TRANSPORT_ZONE_LABELS[zone]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ===== Quick Add Mock Services ===== */}
            <div className="bg-blue-50 dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-slate-700">
              <h3 className="text-xs font-extrabold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                ⚡ 快速試算範例（點擊加入清單）
              </h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => addService(MOCK_SERVICES['GA05'])} 
                  className="text-xs bg-white dark:bg-slate-700 border border-blue-200 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-slate-600 font-bold transition-colors shadow-sm"
                >
                  + 喘息服務 (機構住宿)
                </button>
                <button 
                  onClick={() => addService(MOCK_SERVICES['GA09'])} 
                  className="text-xs bg-white dark:bg-slate-700 border border-blue-200 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-slate-600 font-bold transition-colors shadow-sm"
                >
                  + 短期照顧服務
                </button>
                <button 
                  onClick={() => addService(MOCK_SERVICES['BA01'])} 
                  className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 font-bold transition-colors shadow-sm text-slate-700 dark:text-slate-200"
                >
                  + 基本身體清潔 (BA01)
                </button>
              </div>
            </div>

            {/* ===== Main Content Grid ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Left Column: Progress Bars */}
              <div className="space-y-3">
                {CATEGORY_ORDER.map(cat => {
                  const { limit, copayRate, total, percentage, overage } = totals[cat];
                  const isOver = percentage > 100;
                  const ratePercent = Math.round(copayRate * 100);

                  return (
                    <div key={cat} className={`space-y-1.5 p-3 rounded-xl border transition-colors ${
                      isOver
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                    }`}>
                      <div className="flex justify-between text-xs font-extrabold">
                        <span className="text-slate-700 dark:text-slate-300">
                          {CATEGORY_LABELS[cat]}
                          <span className="text-slate-400 dark:text-slate-500 ml-1">
                            (自負額 {ratePercent}% · {CATEGORY_PERIOD[cat]})
                          </span>
                        </span>
                        <span className={isOver ? "text-red-500 font-black" : "text-blue-600 dark:text-yellow-400"}>
                          {formatMoney(total)} / {formatMoney(limit)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            isOver ? 'bg-red-500' : 'bg-blue-500 dark:bg-yellow-400'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(percentage)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${CATEGORY_LABELS[cat]} 已使用 ${Math.round(percentage)}%`}
                        ></div>
                      </div>
                      {isOver && (
                        <p className="text-[11px] text-red-500 font-extrabold text-right mt-1">
                          ⚠️ 超額 {formatMoney(overage)}（依第 15 條，超過核定額度需 100% 全額自費）
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Selected Items */}
              <div className="border-l-0 md:border-l border-slate-200 dark:border-slate-700 pl-0 md:pl-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    已選服務清單 ({selectedServices.length} 項)
                  </h3>
                  {selectedServices.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearServices(); }}
                      className="text-xs font-bold text-red-500 hover:text-red-700 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-300 rounded-md px-2 py-1 min-h-[32px] transition-colors"
                      aria-label="清除所有已選服務"
                    >
                      全部清除
                    </button>
                  )}
                </div>

                {selectedServices.length === 0 ? (
                  <p className="text-sm text-slate-400 italic font-semibold">
                    尚未加入任何服務，請從上方資源卡片點擊「💰 加入試算」。
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                    {selectedServices.map((service) => (
                      <li key={service.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:border-blue-300 dark:hover:border-yellow-500/50">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2 flex-1">
                          {service.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-blue-700 dark:text-yellow-400 font-extrabold">{formatMoney(service.price)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeService(service.id);
                            }}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-400 focus:outline-none p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                            aria-label={`移除 ${service.name}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Legal footnote */}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed font-medium">
                  📌 本試算依《長期照顧服務申請及給付辦法》修正條文附表二、附表五計算。實際給付以照管中心核定為準。全日住宿式服務及團體家屋不適用本辦法（第 2 條第 2 項）。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
