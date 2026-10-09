import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: { value: string; positive: boolean };
  icon?: ReactNode;
  accent?: 'primary' | 'blue' | 'accent' | 'ink';
}

export function StatCard({ label, value, subtext, trend, icon, accent = 'ink' }: StatCardProps) {
  const accentBg = {
    primary: 'bg-primary-50 text-primary-600',
    blue: 'bg-blue-50 text-blue-600',
    accent: 'bg-accent-50 text-accent-600',
    ink: 'bg-ink-100 text-ink-600',
  }[accent];

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-500 font-medium">{label}</span>
        {icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentBg}`}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-ink-900 tracking-tight">{value}</div>
        {subtext && <div className="text-xs text-ink-400 mt-0.5">{subtext}</div>}
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            trend.positive ? 'text-primary-600' : 'text-error-600'
          }`}
        >
          {trend.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend.value}
        </div>
      )}
    </div>
  );
}
