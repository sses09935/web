import ResourceDashboard from '@/components/ResourceDashboard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { resourceDatasetLabel, resourceDatasetStats } from '@/data/resourceDataset';

export const metadata = {
  title: '長照資源數據儀表板 | 臺大醫院北護分院長照資源協作平台',
  description: '依建置環境載入公開範例或私有資料的長照資源數據儀表板。',
};

export default function DashboardPage() {
  return (
    <main className="min-h-[100dvh] p-6 bg-gray-50 dark:bg-black dark:text-yellow-400">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-6">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-yellow-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[48px] focus:outline-none focus:ring-4 focus:ring-blue-500 dark:focus:ring-yellow-400"
            aria-label="返回地圖主頁"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">返回主頁</span>
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-yellow-400" tabIndex={0}>
            長照資源數據儀表板
          </h1>
          <p className="text-lg mt-2 text-gray-700 dark:text-yellow-300" tabIndex={0}>
            目前載入 {resourceDatasetLabel}：{resourceDatasetStats.totalResources} 筆資源、{resourceDatasetStats.validCoordinates} 筆有效座標、{resourceDatasetStats.invalidCoordinates} 筆缺漏或無效座標，生活圈雷達半徑 {resourceDatasetStats.radarRadiusKm}km。
          </p>
        </header>
        
        <ResourceDashboard />
      </div>
    </main>
  );
}
