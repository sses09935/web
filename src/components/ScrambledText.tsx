'use client';

import React, { useEffect, useState, useMemo } from 'react';

/**
 * ScrambledText
 * 
 * 此元件的 SSR（Server-Side Rendering）階段會刻意回傳一個「空的 DOM 節點」，此為預期行為。
 * 
 * 這是為了符合純靜態展示架構下的必要妥協，具體原因如下：
 * 1. 避免 hydration mismatch：因為打亂字元的動作是在 Client 端由 JavaScript 的隨機演算法（Fisher-Yates）執行，
 *    如果 Server 端輸出正常字串，或是不同的隨機字串，將導致 React 在 Hydration 階段拋出 mismatch 錯誤。
 * 2. 避免 client scrambling 與 SSR HTML 不一致：維持純靜態輸出架構 (`output: 'export'`) 的限制下，我們無法在 
 *    Server 端即時產生每個 user 獨立的 Scrambling seed，因此統一由 Client 端接手渲染。
 * 3. 低階 scraping 摩擦與無障礙支援：此元件只增加簡單 DOM 文字擷取成本，不對抗瀏覽器自動化。
 *    即使 SSR 輸出為空節點，依賴 JS 的搜尋引擎（如 Googlebot）在執行 JavaScript 後依然能讀取，
 *    且元件外層容器綁定有 `aria-label={text}`，確保螢幕閱讀器及搜尋引擎能讀取到正確內容，不會因為內部字元順序被打亂而受到影響。
 */
interface ScrambledTextProps {
  text: string;
  rescrambleInterval?: number;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function ScrambledText({ text, rescrambleInterval = 30000 }: ScrambledTextProps) {
  // Use spread operator to correctly handle Unicode characters (including emojis/surrogate pairs)
  const characters = useMemo(() => [...text], [text]);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  useEffect(() => {
    // Generate initial order indices [0, 1, ..., N]
    const initialIndices = characters.map((_, i) => i);
    // Initial shuffle must run after hydration so SSR keeps the intentionally empty shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuffledIndices(shuffleArray(initialIndices));

    const intervalId = setInterval(() => {
      setShuffledIndices(shuffleArray(initialIndices));
    }, rescrambleInterval);

    return () => clearInterval(intervalId);
  }, [characters, rescrambleInterval]);

  // If SSR or before first shuffle
  if (shuffledIndices.length === 0) {
    return <div aria-label={text} className="flex flex-wrap select-none" />;
  }

  return (
    <div aria-label={text} className="flex flex-wrap select-none" style={{ userSelect: 'none' }}>
      {shuffledIndices.map((originalIndex, currentIndex) => (
        <span 
          key={currentIndex} 
          aria-hidden="true"
          style={{ order: originalIndex }}
        >
          {characters[originalIndex]}
        </span>
      ))}
    </div>
  );
}
