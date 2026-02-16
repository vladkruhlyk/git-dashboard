import { type ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  color: string;
  glowColor: string;
}

export function MetricCard({ title, value, subtitle, icon, color, glowColor }: MetricCardProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/6 p-5 transition-all duration-300 hover:border-white/30 hover:shadow-lg hover:scale-[1.02] backdrop-blur-2xl [backdrop-filter:saturate(190%)_blur(22px)]"
      style={{ boxShadow: `0 0 40px -12px ${glowColor}` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${glowColor}15, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-gradient-to-b from-white/25 via-white/8 to-transparent opacity-90" />
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full blur-2xl opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `${glowColor}30` }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-20px_40px_rgba(0,0,0,0.2)]" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md ${color}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        {subtitle && (
          <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
