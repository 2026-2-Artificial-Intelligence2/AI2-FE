import React, { useEffect, useEffectEvent } from 'react';

export function useShortcuts(enabled, actions) {
  const onKeyDown = useEffectEvent(event => {
    if (event.defaultPrevented || event.isComposing || event.shiftKey || event.altKey ||
        event.ctrlKey || event.metaKey || document.querySelector('dialog:modal')) return;

    // Tab은 업무·주식 전환 키라 주문이나 업무 입력 중에도 사용할 수 있다.
    const editing = event.target instanceof HTMLElement &&
      (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="textbox"]'));
    if (editing && event.code !== 'Tab') return;

    const action = actions[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) action();
  });

  useEffect(() => {
    if (!enabled) return;
    const handleKey = event => onKeyDown(event);
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [enabled]);
}

export function KeyHint({ children }) {
  return <kbd aria-hidden="true" className="ml-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-normal text-slate-600">
    {children}
  </kbd>;
}
