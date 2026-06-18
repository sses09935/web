'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  resourceDataset as resourcesData,
  resourceDatasetLabel,
  resourceDatasetStats,
} from '@/data/resourceDataset';
import { hasValidCoordinates } from '@/lib/resourceUtils';

export default function ResourceDashboard() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Required mount gate preserves static export markup before client-only dashboard rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const stats = useMemo(() => {
    const districtCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let validCoordinatesCount = 0;

    resourcesData.forEach(res => {
       const district = res.district && res.district.trim() !== '' ? res.district : '其他/未分類';
       const category = res.category && res.category.trim() !== '' ? res.category : '未分類';

       districtCounts[district] = (districtCounts[district] || 0) + 1;
       categoryCounts[category] = (categoryCounts[category] || 0) + 1;

       if (hasValidCoordinates(res)) {
         validCoordinatesCount++;
       }
    });

    return {
      total: resourceDatasetStats.totalResources,
      mapped: validCoordinatesCount,
      missingCoordinates: resourceDatasetStats.totalResources - validCoordinatesCount,
      districtCounts: Object.entries(districtCounts).sort((a, b) => b[1] - a[1]),
      categoryCounts: Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]),
    };
  }, []);

  if (!isMounted) {
     return (
       <div className="flex flex-col justify-center items-center h-64 bg-white dark:bg-black rounded-xl border dark:border-yellow-400" aria-busy="true">
         <p className="text-xl font-bold text-gray-600 dark:text-yellow-400 animate-pulse">
           📊 數據載入與運算中，請稍候...
         </p>
       </div>
     );
  }

  return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="col-span-1 md:col-span-2 bg-white dark:bg-black border border-gray-200 dark:border-yellow-400 p-6 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500 dark:focus:ring-yellow-400" tabIndex={0}>
           <h2 className="text-2xl font-bold mb-4 dark:text-yellow-400">資料庫健康度總覽</h2>
           <p className="text-sm font-semibold text-gray-600 dark:text-yellow-500 mb-4">
             目前載入：{resourceDatasetLabel}
           </p>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="p-6 bg-blue-50 dark:bg-gray-900 border dark:border-yellow-600 rounded-lg">
                <p className="text-sm font-medium text-gray-600 dark:text-yellow-500 mb-1">正式收錄資源總數</p>
                <p className="text-5xl font-extrabold text-blue-700 dark:text-yellow-400">{stats.total}</p>
             </div>
             <div className="p-6 bg-green-50 dark:bg-gray-900 border dark:border-yellow-600 rounded-lg">
                <p className="text-sm font-medium text-gray-600 dark:text-yellow-500 mb-1">有效座標</p>
                <p className="text-5xl font-extrabold text-green-700 dark:text-yellow-400">{stats.mapped}</p>
             </div>
             <div className="p-6 bg-amber-50 dark:bg-gray-900 border dark:border-yellow-600 rounded-lg">
                <p className="text-sm font-medium text-gray-600 dark:text-yellow-500 mb-1">缺漏或無效座標</p>
                <p className="text-5xl font-extrabold text-amber-700 dark:text-yellow-400">{stats.missingCoordinates}</p>
             </div>
             <div className="p-6 bg-slate-50 dark:bg-gray-900 border dark:border-yellow-600 rounded-lg">
                <p className="text-sm font-medium text-gray-600 dark:text-yellow-500 mb-1">生活圈雷達半徑</p>
                <p className="text-5xl font-extrabold text-slate-700 dark:text-yellow-400">{resourceDatasetStats.radarRadiusKm}km</p>
             </div>
           </div>
        </section>

        <section className="bg-white dark:bg-black border border-gray-200 dark:border-yellow-400 p-6 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500 dark:focus:ring-yellow-400" tabIndex={0}>
           <h2 className="text-xl font-bold mb-4 dark:text-yellow-400">行政區服務量能</h2>
           <ul className="space-y-3">
              {stats.districtCounts.map(([district, count]) => (
                 <li key={district} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                   <span className="text-gray-800 dark:text-yellow-100 text-lg">{district}</span>
                   <span className="font-bold bg-gray-100 dark:bg-gray-800 dark:text-yellow-400 px-4 py-1.5 rounded-full min-w-[3rem] text-center">{count}</span>
                 </li>
              ))}
           </ul>
        </section>

        <section className="bg-white dark:bg-black border border-gray-200 dark:border-yellow-400 p-6 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500 dark:focus:ring-yellow-400" tabIndex={0}>
           <h2 className="text-xl font-bold mb-4 dark:text-yellow-400">資源類型分佈</h2>
           <ul className="space-y-3">
              {stats.categoryCounts.map(([category, count]) => (
                 <li key={category} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                   <span className="text-gray-800 dark:text-yellow-100 truncate pr-4 text-lg" title={category}>{category}</span>
                   <span className="font-bold bg-gray-100 dark:bg-gray-800 dark:text-yellow-400 px-4 py-1.5 rounded-full min-w-[3rem] text-center">{count}</span>
                 </li>
              ))}
           </ul>
        </section>
     </div>
  );
}
