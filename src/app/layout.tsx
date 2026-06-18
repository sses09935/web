import type { Metadata } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import SecurityProvider from "@/components/SecurityProvider";
import WatermarkOverlay from "@/components/WatermarkOverlay";

export const metadata: Metadata = {
  title: "NTUH 北護長照資源協作 PoC",
  description: "靜態資源派案與查詢工作台 PoC，依建置環境載入公開範例或私有資料；以可近用性、穩定靜態輸出、資料防禦式渲染與 Maplibre 互動為核心。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`h-full antialiased text-size-standard`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col w-full max-w-[100vw] overflow-x-hidden" suppressHydrationWarning>
        <SecurityProvider>
          <WatermarkOverlay label="資源平台">
            {children}
          </WatermarkOverlay>
        </SecurityProvider>
      </body>
    </html>
  );
}
