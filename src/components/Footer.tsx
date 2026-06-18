export default function Footer() {
  return (
    <>
      {/* Hidden crawler-noise clue: visually hidden, retained in the DOM.
        This can support detection signals, but it is not bot protection.
      */}
      <div 
        aria-hidden="true" 
        className="absolute w-0 h-0 overflow-hidden opacity-0 pointer-events-none select-none -z-50"
      >
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={`obfuscation-${i}`}>
            © PoC（概念驗證網站）｜系統建置：連鈞成
          </div>
        ))}
      </div>

      {/* ✨ 視覺層 (正常 UI)：真實使用者與無障礙設備看到的正常 Footer
      */}
      <footer className="w-full border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 py-6 text-center text-sm text-gray-500 print:hidden flex flex-col gap-1.5">
        <p>
          © PoC（概念驗證網站）｜系統建置：連鈞成
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-600">最後更新時間：2026/06/18</p>
      </footer>
    </>
  );
}
