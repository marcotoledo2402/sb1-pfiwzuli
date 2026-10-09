import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;
const listeners: ((toast: ToastState) => void)[] = [];

export function showToast(type: ToastType, message: string) {
  const toast = { id: ++toastId, type, message };
  listeners.forEach((fn) => fn(toast));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  useEffect(() => {
    const listener = (toast: ToastState) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
        const color =
          t.type === 'success' ? 'text-primary-600' : t.type === 'error' ? 'text-error-600' : 'text-ink-600';
        const bg =
          t.type === 'success' ? 'border-primary-200' : t.type === 'error' ? 'border-error-200' : 'border-ink-200';
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 bg-white border ${bg} rounded-xl shadow-pop px-4 py-3 animate-slide-up pointer-events-auto max-w-sm`}
          >
            <Icon size={18} className={color} />
            <span className="text-sm text-ink-800 flex-1">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-ink-300 hover:text-ink-500"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
