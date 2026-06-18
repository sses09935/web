/**
 * ScrambledText Unit Tests
 * 
 * Tests for: src/components/ScrambledText.tsx
 * - aria-hidden on internal spans
 * - aria-label on container
 * - CSS order values correctness
 * - Unicode handling (emoji / surrogate pairs)
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import ScrambledText from '@/components/ScrambledText';

describe('ScrambledText component', () => {
  test('所有內部 span 應有 aria-hidden="true"', () => {
    const { container } = render(<ScrambledText text="測試文字" />);
    
    // Wait for useEffect to fire (state update)
    // ScrambledText uses useEffect to set shuffledIndices, which triggers re-render
    act(() => {
      // Force useEffect to execute
    });

    const spans = container.querySelectorAll('span');
    expect(spans.length).toBeGreaterThan(0);
    
    spans.forEach((span) => {
      expect(span.getAttribute('aria-hidden')).toBe('true');
    });
  });

  test('容器應有正確的 aria-label', () => {
    const testText = '台大北護分院';
    const { container } = render(<ScrambledText text={testText} />);
    
    const labelledElement = container.querySelector(`[aria-label="${testText}"]`);
    expect(labelledElement).toBeTruthy();
  });

  test('span 的 CSS order 值應涵蓋 0 到 text.length-1 的所有整數', () => {
    const testText = 'ABCDE';
    const { container } = render(<ScrambledText text={testText} />);
    
    act(() => {});

    const spans = container.querySelectorAll('span');
    const orders = Array.from(spans)
      .map((span) => parseInt(span.style.order, 10))
      .sort((a, b) => a - b);

    // Should contain exactly [0, 1, 2, 3, 4]
    expect(orders).toEqual([0, 1, 2, 3, 4]);
  });

  test('應使用 [...text] 而非 split 來處理中文字元', () => {
    const testText = '你好👋';
    const { container } = render(<ScrambledText text={testText} />);
    
    act(() => {});

    const spans = container.querySelectorAll('span');
    // If using [...text], emoji counts as 1 character → 3 spans
    // If using split(''), emoji gets split into 2 surrogates → 4 spans
    expect(spans.length).toBe(3);
  });
});
