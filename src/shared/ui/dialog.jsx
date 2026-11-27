import React, { useLayoutEffect, useRef } from 'react';

export function Dialog({ id, title, pending, onDismiss, children, width = '28rem' }) {
  const dialog = useRef(null);
  const dismiss = useRef(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    dismiss.current.focus();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} id={id} aria-labelledby={id + '-title'}
    style={{ inlineSize: `min(${width}, calc(100vw - 2rem))` }}
    className="panel fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 text-ui-text shadow-2xl backdrop:bg-slate-950/45"
    onCancel={event => {
      event.preventDefault();
      if (!pending) onDismiss();
    }}>
    <header className="flex items-center justify-between gap-3 border-b border-ui-border px-5 py-4">
      <h2 id={id + '-title'} className="font-bold">{title}</h2>
      <button ref={dismiss} type="button" aria-label="창 닫기" disabled={pending}
        className="grid size-8 place-items-center rounded-md text-lg text-ui-secondary hover:bg-ui-muted" onClick={onDismiss}>×</button>
    </header>
    {children}
  </dialog>;
}
