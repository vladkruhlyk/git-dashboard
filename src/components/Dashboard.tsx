import { useRef, useState } from 'react';
import {
  DollarSign, Eye, Users, MousePointerClick,
  ShoppingCart, TrendingUp, Target, Layers,
  BarChart3, Zap, Filter, X, ChevronDown, FileDown, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { toPng } from 'html-to-image';
import { MetricCard } from './MetricCard';
import type { AccountInsights, CampaignInsight, DailyData, AdAccount } from '../types';

type ChartMetricKey = 'purchases' | 'leads' | 'clicks' | 'impressions';

interface DashboardProps {
  account: AdAccount;
  insights: AccountInsights;
  campaigns: CampaignInsight[];
  dailyData: DailyData[];
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  onClearCampaign: () => void;
}

function formatNum(n: number, decimals = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const parseActions = (actions: Array<{ action_type: string; value: string }> | undefined, type: string): number => {
  if (!actions) return 0;
  const found = actions.find(a => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
};

const parseActionValues = (actions: Array<{ action_type: string; value: string }> | undefined, type: string): number => {
  if (!actions) return 0;
  const found = actions.find(a => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
};

const chartOptions: Array<{ value: ChartMetricKey; label: string; chartLabel: string; color: string }> = [
  { value: 'purchases', label: 'Продажи по дням', chartLabel: 'Продажи', color: '#8b5cf6' },
  { value: 'leads', label: 'Лиды по дням', chartLabel: 'Лиды', color: '#6366f1' },
  { value: 'clicks', label: 'Клики по дням', chartLabel: 'Клики', color: '#06b6d4' },
  { value: 'impressions', label: 'Показы по дням', chartLabel: 'Показы', color: '#f59e0b' },
];

export function Dashboard({
  account, insights, campaigns, dailyData,
  selectedCampaignId, onSelectCampaign, onClearCampaign,
}: DashboardProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('purchases');
  const [showChartDropdown, setShowChartDropdown] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const activeChartOption = chartOptions.find(o => o.value === chartMetric) || chartOptions[0];

  const selectedCampaignName = selectedCampaignId
    ? campaigns.find(c => c.campaign_id === selectedCampaignId)?.campaign_name
    : null;

  const metrics = [
    {
      title: 'Расход',
      value: formatMoney(insights.spend),
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/20',
      glowColor: '#10b981',
    },
    {
      title: 'Показы',
      value: formatNum(insights.impressions),
      icon: <Eye className="w-5 h-5 text-blue-400" />,
      color: 'bg-blue-500/20',
      glowColor: '#3b82f6',
    },
    {
      title: 'Охват',
      value: formatNum(insights.reach),
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      color: 'bg-cyan-500/20',
      glowColor: '#06b6d4',
    },
    {
      title: 'Клики',
      value: formatNum(insights.clicks),
      icon: <MousePointerClick className="w-5 h-5 text-amber-400" />,
      color: 'bg-amber-500/20',
      glowColor: '#f59e0b',
    },
    {
      title: 'CTR',
      value: insights.ctr.toFixed(2) + '%',
      icon: <Target className="w-5 h-5 text-orange-400" />,
      color: 'bg-orange-500/20',
      glowColor: '#f97316',
    },
    {
      title: 'CPC',
      value: formatMoney(insights.cpc),
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      color: 'bg-yellow-500/20',
      glowColor: '#eab308',
    },
    {
      title: 'CPM',
      value: formatMoney(insights.cpm),
      icon: <Layers className="w-5 h-5 text-pink-400" />,
      color: 'bg-pink-500/20',
      glowColor: '#ec4899',
    },
    {
      title: 'Покупки',
      value: formatNum(insights.purchases),
      icon: <ShoppingCart className="w-5 h-5 text-violet-400" />,
      color: 'bg-violet-500/20',
      glowColor: '#8b5cf6',
    },
    {
      title: 'Ценность покупок',
      value: formatMoney(insights.purchaseValue),
      icon: <BarChart3 className="w-5 h-5 text-fuchsia-400" />,
      color: 'bg-fuchsia-500/20',
      glowColor: '#d946ef',
    },
    {
      title: 'ROAS',
      value: insights.roas.toFixed(2) + 'x',
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/20',
      glowColor: '#10b981',
      subtitle: insights.roas >= 2 ? '✅ Отлично' : insights.roas >= 1 ? '⚠️ Средний' : '❌ Низкий',
    },
    {
      title: 'Цена за покупку',
      value: formatMoney(insights.costPerPurchase),
      icon: <DollarSign className="w-5 h-5 text-red-400" />,
      color: 'bg-red-500/20',
      glowColor: '#ef4444',
    },
    {
      title: 'Лиды',
      value: formatNum(insights.leads),
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      color: 'bg-indigo-500/20',
      glowColor: '#6366f1',
    },
  ];

  const tooltipStyle = {
    backgroundColor: '#0d1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
  };

  const handleExportImage = async () => {
    const target = dashboardRef.current;
    if (!target || isExportingImage) return;

    setExportError(null);
    setIsExportingImage(true);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
      const exportWidth = Math.ceil(target.scrollWidth);
      const exportHeight = Math.ceil(target.scrollHeight);

      if ('fonts' in document) {
        await document.fonts.ready;
      }

      const imgData = await toPng(target, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: '#060a10',
        width: exportWidth,
        height: exportHeight,
        canvasWidth: Math.round(exportWidth * pixelRatio),
        canvasHeight: Math.round(exportHeight * pixelRatio),
        style: {
          margin: '0',
          overflow: 'visible',
          transform: 'none',
        },
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return node.dataset.exportIgnore !== 'true';
        },
      });

      const safeAccountName = account.name.replace(/[^\p{L}\p{N}\-_]+/gu, '_');
      const safeCampaignName = (selectedCampaignName || 'all_campaigns').replace(/[^\p{L}\p{N}\-_]+/gu, '_');
      const dateLabel = new Date().toISOString().slice(0, 10);
      const fileName = `stats_${safeAccountName}_${safeCampaignName}_${dateLabel}.png`;

      const link = document.createElement('a');
      link.href = imgData;
      link.download = fileName;
      link.click();
    } catch (error) {
      console.error(error);
      setExportError('Не удалось выгрузить изображение. Попробуйте снова.');
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div ref={dashboardRef} className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
      {/* Account header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{account.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            ID: {account.account_id} · Валюта: {account.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportImage}
            disabled={isExportingImage}
            data-export-ignore="true"
            className="flex min-w-[140px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isExportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Экспорт PNG
          </button>
          <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-400">Данные загружены</span>
          </div>
        </div>
      </div>

      {exportError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {exportError}
        </div>
      )}

      {/* Campaign filter banner */}
      {selectedCampaignName && (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/20 px-5 py-4 animate-in">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/20 shrink-0">
            <Filter className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium">Фильтр по кампании</p>
            <p className="text-white font-semibold truncate mt-0.5">{selectedCampaignName}</p>
          </div>
          <button
            onClick={onClearCampaign}
            className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
            Показать все
          </button>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </div>

      {/* Charts */}
      {dailyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spend chart */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Расход по дням</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" fill="url(#spendGrad)" strokeWidth={2} name="Расход" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Dynamic metric chart with dropdown */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {activeChartOption.chartLabel} по дням
              </h3>
              {/* Custom dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowChartDropdown(!showChartDropdown)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <span>{activeChartOption.chartLabel}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showChartDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showChartDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowChartDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60 z-50 overflow-hidden">
                      {chartOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setChartMetric(opt.value);
                            setShowChartDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                            chartMetric === opt.value
                              ? 'bg-indigo-500/10 text-indigo-400'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: opt.color }}
                          />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <defs>
                  <linearGradient id="dynamicBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={activeChartOption.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={activeChartOption.color} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey={chartMetric}
                  fill="url(#dynamicBarGrad)"
                  radius={[4, 4, 0, 0]}
                  name={activeChartOption.chartLabel}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue vs Spend */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">Расход vs Выручка</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#1e293b' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} name="Выручка" />
                <Area type="monotone" dataKey="spend" stroke="#ef4444" fill="url(#spendGrad2)" strokeWidth={2} name="Расход" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaigns table */}
      {campaigns.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Кампании</h3>
            <p className="text-xs text-gray-500">
              Нажмите на кампанию для фильтрации дашборда
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Кампания</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Расход</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Показы</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Охват</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Клики</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">CTR</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">CPC</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Покупки</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Ценность</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => {
                  const spend = parseFloat(c.spend || '0');
                  const purchases = parseActions(c.actions, 'purchase');
                  const purchaseValue = parseActionValues(c.action_values, 'purchase');
                  const roas = spend > 0 ? purchaseValue / spend : 0;
                  const isSelected = selectedCampaignId === c.campaign_id;

                  return (
                    <tr
                      key={c.campaign_id || i}
                      onClick={() => onSelectCampaign(c.campaign_id)}
                      className={`border-b border-white/5 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-indigo-500/10 border-l-[3px] border-l-indigo-500'
                          : 'hover:bg-white/[0.03] border-l-[3px] border-l-transparent'
                      }`}
                    >
                      <td className="px-6 py-3 max-w-[250px]">
                        <div className="flex items-center gap-3">
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                          )}
                          <span className={`font-medium truncate ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                            {c.campaign_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatMoney(spend)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatNum(parseInt(c.impressions || '0'))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatNum(parseInt(c.reach || '0'))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatNum(parseInt(c.clicks || '0'))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {parseFloat(c.ctr || '0').toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatMoney(parseFloat(c.cpc || '0'))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {purchases}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {formatMoney(purchaseValue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${
                          roas >= 2 ? 'bg-emerald-500/10 text-emerald-400' :
                          roas >= 1 ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {roas.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
