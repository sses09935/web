import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { QrCode, X, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PrescriptionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  summaryText: string;
}

export default function PrescriptionModal({
  isOpen,
  onOpenChange,
  summaryText
}: PrescriptionModalProps) {
  const currentUrl = isOpen && typeof window !== "undefined" ? window.location.href : "";

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 print:hidden" />
        <Dialog.Content 
          className="fixed left-[50%] top-[50%] z-[4001] w-[90vw] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] print:static print:transform-none print:w-full print:max-w-none print:shadow-none print:border-0 print:m-0 print:p-0 print:text-black"
          aria-describedby="prescription-desc"
        >
          <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
            <Dialog.Title className="text-xl font-black text-blue-900 dark:text-yellow-400 flex items-center gap-2">
              <QrCode className="w-6 h-6" />
              專屬長照服務需求
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="關閉處方箋視窗"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <div id="prescription-desc" className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
                目前的派案條件：
              </p>
              <p className="text-base font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg text-pretty">
                {summaryText}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-xl border-4 border-blue-100 shadow-sm flex flex-col items-center">
              {currentUrl && (
                <QRCodeSVG
                  value={currentUrl}
                  size={200}
                  level={"M"}
                  includeMargin={true}
                  className="rounded-lg"
                  aria-label="長照服務需求 QR Code，包含目前的搜尋與篩選狀態"
                />
              )}
              <span className="text-xs font-bold text-slate-400 mt-2 text-center">掃描即可還原此篩選結果</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 print:hidden">
            <span className="text-xs text-slate-400 font-bold">⚠️ 模擬功能，非正式用途</span>
            <div className="flex gap-3 w-full sm:w-auto justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 min-h-[44px] rounded-lg font-bold text-slate-600 hover:bg-slate-100 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-800">
                  取消
                </button>
              </Dialog.Close>
              <button
                onClick={() => window.print()}
                className="px-6 py-2 min-h-[44px] rounded-lg font-black bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 shadow-md dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-500"
              >
                <Printer className="w-5 h-5" />
                列印長照需求
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
