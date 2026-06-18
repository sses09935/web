'use client';

import React from 'react';
import ScrambledText from '@/components/ScrambledText';
import { Resource } from '@/types';
import { compactText } from '@/lib/resourceUtils';

interface PopupContentProps {
  resource: Resource;
  isHighContrast: boolean;
}

export default function PopupContent({ resource: res, isHighContrast }: PopupContentProps) {
  const subCatText = res.subCategory || res.category || '未分類服務';
  const districtText = res.district && res.district !== '未分類' ? res.district : '區域未知';
  const navAddress = compactText(res.navAddress) || compactText(res.address);
  const hasNavigationAddress = navAddress !== '' && !navAddress.includes('無實體地址');

  return (
    <div className="flex flex-col gap-3 min-w-[240px]">
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${isHighContrast ? 'bg-black text-white border-white' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
            {subCatText}
          </span>
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold border ${isHighContrast ? 'bg-black text-yellow-400 border-yellow-400' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
            {districtText}
          </span>
        </div>
        
        <div className={`font-black text-lg ${isHighContrast ? 'text-yellow-400' : 'text-slate-800'} leading-snug`} data-testid="popup-name">
          <ScrambledText text={res.name} />
        </div>
      </div>
      
      <div className={`text-sm ${isHighContrast ? 'text-yellow-400' : 'text-slate-600'}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span aria-hidden="true" className="text-base">📞</span> 
          <span className="font-medium" data-testid="popup-phone">{res.phone || '無提供電話'}</span>
        </div>
        <div className="flex items-start gap-2 leading-tight">
          <span aria-hidden="true" className="text-base mt-0.5">📍</span> 
          <span className="font-medium">{res.address || '無實體地址'}</span>
        </div>
      </div>
      
      {(res.targetAudience || res.providedResources || res.referralMethod) && (
        <div className={isHighContrast ? 'mt-3 bg-black border-2 border-yellow-400 text-yellow-400 rounded-lg p-3 text-sm' : 'mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 shadow-inner'}>
          {res.targetAudience && (
            <div className="mb-1.5 leading-tight flex items-start gap-1">
              <span className={`font-bold shrink-0 ${isHighContrast ? 'text-yellow-400' : 'text-slate-900'}`}>🧑 對象：</span>
              <span>{res.targetAudience}</span>
            </div>
          )}
          {res.providedResources && (
            <div className="mb-1.5 leading-tight flex items-start gap-1">
              <span className={`font-bold shrink-0 ${isHighContrast ? 'text-yellow-400' : 'text-slate-900'}`}>💼 資源：</span>
              <span>{res.providedResources}</span>
            </div>
          )}
          {res.referralMethod && (
            <div className="leading-tight flex items-start gap-1">
              <span className={`font-bold shrink-0 ${isHighContrast ? 'text-yellow-400' : 'text-slate-900'}`}>📄 轉介：</span>
              <span>{res.referralMethod}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex gap-2 mt-1">
        {res.phone && (
          <a href={`tel:${res.phone}`} className={`flex-1 text-center py-2 rounded-lg font-bold transition-all transform-gpu hover:scale-105 active:scale-95 ${isHighContrast ? 'bg-black border-2 border-yellow-400 text-yellow-400 focus:outline-none focus:ring-2 focus:ring-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-600'}`}>
            撥打電話
          </a>
        )}
        {hasNavigationAddress && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(navAddress)}`} target="_blank" rel="noopener noreferrer" className={`flex-1 text-center py-2 rounded-lg font-bold transition-all transform-gpu hover:scale-105 active:scale-95 ${isHighContrast ? 'bg-yellow-400 text-black border-2 border-white focus:outline-none focus:ring-2 focus:ring-white' : 'bg-emerald-500 text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-700'}`}>
            導航前往
          </a>
        )}
      </div>
      
      <div className={isHighContrast ? 'mt-3 pt-3 border-t border-slate-600 text-xs text-yellow-500 text-center font-medium tracking-wide' : 'mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 text-center font-medium tracking-wide'}>
        💡 若有申請需求，請聯繫您的個案管理師，或直接洽詢該單位。
      </div>
    </div>
  );
}
