import { useRef, type MouseEvent } from 'react';

export function useRipple() {
  const targetRef = useRef<HTMLElement | null>(null);

  const addRipple = (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  };

  return { addRipple, targetRef };
}
