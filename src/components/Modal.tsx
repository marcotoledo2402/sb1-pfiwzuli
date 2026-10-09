import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxW} bg-white rounded-t-3xl sm:rounded-2xl shadow-pop max-h-[90vh] flex flex-col animate-slide-up sm:animate-scale-in`}
      >
        {title && (
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-ink-100">
            <div>
              <h2 className="text-lg font-display font-bold text-ink-900">{title}</h2>
              {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="icon-btn -mt-2 -mr-2 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-ink-100 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3 sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
