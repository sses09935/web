"use client";

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

// =====================================================================
// 1. Type Definitions
// =====================================================================

export type BudgetCategory = 'care' | 'transport' | 'respite' | 'assistive';

/** CMS 長照需要等級 (第 2-8 級，第 1 級不納入給付) */
export type CmsLevel = 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 長照身分別 (修正條文第 14 條) */
export type IdentityType = 'type1' | 'type2' | 'type3';

/** 交通接送服務分區 (附表三，原「類」修正為「區」) */
export type TransportZone = 1 | 2 | 3 | 4;

export interface BudgetItem {
  id: string;
  name: string;
  price: number;
  category: BudgetCategory;
}

// =====================================================================
// 2. 附表二：CMS 等級 × 給付項目額度上限
//    來源：《長期照顧服務申請及給付辦法》修正條文附表二
// =====================================================================

/** 照顧及專業服務 — 月額度 (依等級不同) */
const CARE_LIMITS: Record<CmsLevel, number> = {
  2: 10020,
  3: 15460,
  4: 18580,
  5: 24100,
  6: 28070,
  7: 32090,
  8: 36180,
};

/** 交通接送服務 — 月額度 (依分區不同，各等級相同) */
const TRANSPORT_LIMITS: Record<TransportZone, number> = {
  1: 1680,
  2: 1840,
  3: 2000,
  4: 2400,
};

/** 輔具及居家無障礙環境改善服務 — 三年額度 (第一組，各等級相同) */
const ASSISTIVE_LIMIT = 40000;

/** 喘息服務 — 年額度 (第 2-6 級: 32,340 / 第 7-8 級: 48,510) */
const RESPITE_LIMITS: Record<CmsLevel, number> = {
  2: 32340,
  3: 32340,
  4: 32340,
  5: 32340,
  6: 32340,
  7: 48510,
  8: 48510,
};

// =====================================================================
// 3. 附表五：部分負擔比率 (%)
//    來源：《長期照顧服務申請及給付辦法》修正條文附表五
//    備註：所有 CMS 等級 (2-8) 比率相同
// =====================================================================

/** 照顧及專業服務 (B/C 碼) 部分負擔 */
const CARE_COPAY: Record<IdentityType, number> = {
  type1: 0,     // 第一類 (低收)
  type2: 0.05,  // 第二類 (中低收)
  type3: 0.16,  // 第三類 (一般戶)
};

/** 交通接送服務 (D 碼) 部分負擔 — 依分區不同 */
const TRANSPORT_COPAY: Record<TransportZone, Record<IdentityType, number>> = {
  1: { type1: 0, type2: 0.10, type3: 0.30 },
  2: { type1: 0, type2: 0.09, type3: 0.27 },
  3: { type1: 0, type2: 0.08, type3: 0.25 },
  4: { type1: 0, type2: 0.07, type3: 0.21 },
};

/** 輔具及居家無障礙環境改善服務 (E/F 碼) 部分負擔 */
const ASSISTIVE_COPAY: Record<IdentityType, number> = {
  type1: 0,
  type2: 0.10,
  type3: 0.30,
};

/** 喘息服務 (G 碼) 部分負擔 */
const RESPITE_COPAY: Record<IdentityType, number> = {
  type1: 0,
  type2: 0.05,
  type3: 0.16,
};

// =====================================================================
// 4. 公開常數與工具函式
// =====================================================================

export const IDENTITY_LABELS: Record<IdentityType, string> = {
  type1: '第一類 (低收入戶)',
  type2: '第二類 (中低收入)',
  type3: '第三類 (一般戶)',
};

export const TRANSPORT_ZONE_LABELS: Record<TransportZone, string> = {
  1: '第一區 (臺北/新北等)',
  2: '第二區',
  3: '第三區',
  4: '第四區 (偏遠/離島)',
};

export const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  care: '照顧與專業服務',
  transport: '交通接送服務',
  respite: '喘息服務',
  assistive: '輔具與交通環境',
};

export const CATEGORY_PERIOD: Record<BudgetCategory, string> = {
  care: '月',
  transport: '月',
  respite: '年',
  assistive: '3年',
};

/**
 * 根據當前配置取得各類別的額度上限
 */
export function getLimits(cmsLevel: CmsLevel, transportZone: TransportZone) {
  return {
    care: CARE_LIMITS[cmsLevel],
    transport: TRANSPORT_LIMITS[transportZone],
    respite: RESPITE_LIMITS[cmsLevel],
    assistive: ASSISTIVE_LIMIT,
  };
}

/**
 * 根據當前配置取得各類別的部分負擔比率
 */
export function getCopayRates(identityType: IdentityType, transportZone: TransportZone) {
  return {
    care: CARE_COPAY[identityType],
    transport: TRANSPORT_COPAY[transportZone][identityType],
    respite: RESPITE_COPAY[identityType],
    assistive: ASSISTIVE_COPAY[identityType],
  };
}

// =====================================================================
// 5. 附表四：BA/GA 碼照顧組合真實計價字典
//    來源：《長期照顧服務申請及給付辦法》修正條文附表四
// =====================================================================

export const MOCK_SERVICES: Record<string, BudgetItem> = {
  // 照顧及專業服務 (B 碼)
  'BA01': { id: 'BA01', name: 'BA01 基本身體清潔', price: 260, category: 'care' },
  'BA02': { id: 'BA02', name: 'BA02 基本日常照顧 (30min)', price: 195, category: 'care' },
  'BA03': { id: 'BA03', name: 'BA03 測量生命徵象', price: 35, category: 'care' },
  'BA04': { id: 'BA04', name: 'BA04 協助進食或管灌餵食', price: 130, category: 'care' },
  'BA05': { id: 'BA05', name: 'BA05 餐食照顧', price: 310, category: 'care' },
  'BA07': { id: 'BA07', name: 'BA07 協助沐浴及洗頭', price: 325, category: 'care' },
  'BA08': { id: 'BA08', name: 'BA08 足部照護 (糖尿病)', price: 500, category: 'care' },
  'BA09': { id: 'BA09', name: 'BA09 到宅沐浴車-第一型', price: 2200, category: 'care' },
  'BA09a': { id: 'BA09a', name: 'BA09a 到宅沐浴車-第二型', price: 2500, category: 'care' },
  // 喘息服務 (G 碼)
  'GA03': { id: 'GA03', name: 'GA03 日照中心喘息-全日', price: 1250, category: 'respite' },
  'GA04': { id: 'GA04', name: 'GA04 日照中心喘息-半日', price: 625, category: 'respite' },
  'GA05': { id: 'GA05', name: 'GA05 機構住宿式喘息', price: 2310, category: 'respite' },
  'GA09': { id: 'GA09', name: '短期照顧服務 (小規模多機能/機構)', price: 1500, category: 'respite' },
};

// =====================================================================
// 6. 全日住宿式 / 團體家屋排除清單
//    來源：修正條文第 2 條第 2 項
//    「全日住宿式服務及提供團體家屋服務之服務使用者，
//     由中央主管機關另依法令規定提供照顧，不適用本辦法。」
// =====================================================================

export const EXCLUDED_SUB_CATEGORIES: readonly string[] = Object.freeze([
  '團體家屋',
]);

// =====================================================================
// 7. Context Interfaces
// =====================================================================

export interface CategoryTotal {
  total: number;
  copay: number;
  overage: number;
  percentage: number;
  limit: number;
  copayRate: number;
}

export interface BudgetState {
  selectedServices: BudgetItem[];
  totals: Record<BudgetCategory, CategoryTotal>;
  grandTotalCopay: number;
  cmsLevel: CmsLevel;
  identityType: IdentityType;
  transportZone: TransportZone;
}

export interface BudgetDispatch {
  addService: (service: BudgetItem) => void;
  removeService: (id: string) => void;
  clearServices: () => void;
  setCmsLevel: (level: CmsLevel) => void;
  setIdentityType: (type: IdentityType) => void;
  setTransportZone: (zone: TransportZone) => void;
}

const BudgetStateContext = createContext<BudgetState | undefined>(undefined);
const BudgetDispatchContext = createContext<BudgetDispatch | undefined>(undefined);

// =====================================================================
// 8. BudgetProvider
// =====================================================================

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [selectedServices, setSelectedServices] = useState<BudgetItem[]>([]);
  const [cmsLevel, setCmsLevel] = useState<CmsLevel>(4);
  const [identityType, setIdentityType] = useState<IdentityType>('type3');
  const [transportZone, setTransportZone] = useState<TransportZone>(1);

  const addService = useCallback((service: BudgetItem) => {
    setSelectedServices(prev => [...prev, service]);
  }, []);

  const removeService = useCallback((id: string) => {
    setSelectedServices(prev => prev.filter((service) => service.id !== id));
  }, []);

  const clearServices = useCallback(() => {
    setSelectedServices([]);
  }, []);

  /**
   * 計價演算法 — 嚴格遵循《長期照顧服務申請及給付辦法》
   *
   * 1. 在核定額度以內的服務費用：民眾自付額 = 費用 × 部分負擔比率
   * 2. 超過核定額度的部分：依第 15 條第 1 款 → 100% 全額自費
   * 3. 部分負擔費用以小數點後無條件捨去計算 (附表五備註)
   */
  const totals = useMemo(() => {
    const limits = getLimits(cmsLevel, transportZone);
    const rates = getCopayRates(identityType, transportZone);

    const categoryTotals: Record<BudgetCategory, number> = {
      care: 0,
      transport: 0,
      respite: 0,
      assistive: 0,
    };

    selectedServices.forEach(s => {
      categoryTotals[s.category] += s.price;
    });

    const result = {} as Record<BudgetCategory, CategoryTotal>;

    (Object.keys(categoryTotals) as BudgetCategory[]).forEach(cat => {
      const total = categoryTotals[cat];
      const limit = limits[cat];
      const copayRate = rates[cat];

      const withinLimit = Math.min(total, limit);
      const overage = Math.max(0, total - limit);

      // 附表五備註：部分負擔費用以小數點後無條件捨去計算
      const copay = Math.floor(withinLimit * copayRate) + overage;
      const percentage = limit > 0 ? (total / limit) * 100 : 0;

      result[cat] = { total, copay, overage, percentage, limit, copayRate };
    });

    return result;
  }, [selectedServices, cmsLevel, identityType, transportZone]);

  const grandTotalCopay = useMemo(() => {
    return Object.values(totals).reduce((sum, cat) => sum + cat.copay, 0);
  }, [totals]);

  const stateValue = useMemo(() => ({
    selectedServices, totals, grandTotalCopay, cmsLevel, identityType, transportZone
  }), [selectedServices, totals, grandTotalCopay, cmsLevel, identityType, transportZone]);

  const dispatchValue = useMemo(() => ({
    addService, removeService, clearServices, setCmsLevel, setIdentityType, setTransportZone
  }), [addService, removeService, clearServices, setCmsLevel, setIdentityType, setTransportZone]);

  return (
    <BudgetStateContext.Provider value={stateValue}>
      <BudgetDispatchContext.Provider value={dispatchValue}>
        {children}
      </BudgetDispatchContext.Provider>
    </BudgetStateContext.Provider>
  );
}

// =====================================================================
// 9. Hooks
// =====================================================================

export function useBudgetState() {
  const context = useContext(BudgetStateContext);
  if (!context) throw new Error("useBudgetState must be used within BudgetProvider");
  return context;
}

export function useBudgetDispatch() {
  const context = useContext(BudgetDispatchContext);
  if (!context) throw new Error("useBudgetDispatch must be used within BudgetProvider");
  return context;
}
