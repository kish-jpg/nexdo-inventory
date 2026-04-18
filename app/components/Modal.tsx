'use client';

import { useEffect, useRef, ReactNode } from 'react';

type ModalProps = {
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  maxWidth?: number | string;
  role?: 'dialog' | 'alertdialog';
  initialFocusRef?: React.RefObject<HTMLElement>;
  textAlign?: 'left' | 'center';
};

export default function Modal({
  onClose,
  labelledBy,
  children,
  maxWidth = 540,
  role = 'dialog',
  initialFocusRef,
  textAlign = 'left',
}: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = initialFocusRef?.current
      ?? boxRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button:not([aria-label="Close"])',
      );
    el?.focus();
  }, [initialFocusRef]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={boxRef}
        className="modal-box"
        style={{ maxWidth, textAlign }}
        onClick={e => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}
