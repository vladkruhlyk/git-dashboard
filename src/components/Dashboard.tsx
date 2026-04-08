import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign, Eye, Users, MousePointerClick,
  ShoppingCart, TrendingUp, Target, Layers,
  BarChart3, Zap, Filter, X, ChevronDown, FileDown, Loader2, SlidersHorizontal, GripVertical, MessagesSquare,
  ChevronRight, Image as ImageIcon, Sparkles, FolderTree, CheckSquare, Square,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { toPng } from 'html-to-image';
import { MetricCard } from './MetricCard';
import type { AccountInsights, CampaignInsight, DailyData, AdAccount, CampaignNode, AdHierarchyItem } from '../types';

type ChartMetricKey = 'purchases' | 'leads' | 'clicks' | 'impressions';
type MetricKey =
  | 'spend'
  | 'impressions'
  | 'reach'
  | 'frequency'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'purchases'
  | 'purchaseValue'
  | 'roas'
  | 'costPerPurchase'
  | 'leads'
  | 'messagingConversations'
  | 'costPerMessagingConversation';
type BreakdownColumnKey =
  | 'spend'
  | 'impressions'
  | 'reach'
  | 'frequency'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'cpm'
  | 'leads'
  | 'messagingConversations'
  | 'costPerMessagingConversation'
  | 'purchases'
  | 'costPerPurchase'
  | 'purchaseValue'
  | 'roas';
type FunnelGoal = 'leads' | 'purchases';

interface DashboardProps {
  account: AdAccount;
  insights: AccountInsights;
  campaigns: CampaignInsight[];
  dailyData: DailyData[];
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  onClearCampaign: () => void;
  campaignNodesById: Record<string, CampaignNode>;
  loadingCampaignTreeId: string | null;
  onLoadCampaignTree: (campaign: CampaignInsight) => Promise<void>;
  onLoadAdPreview: (adId: string) => Promise<void>;
}

function formatNum(n: number, decimals = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeStatus(status?: string): string | null {
  if (!status) return null;
  return status.replace(/_/g, ' ').toLowerCase();
}

function getStatusTone(status?: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'PAUSED':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    case 'ARCHIVED':
    case 'DELETED':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
    default:
      return 'border-white/10 bg-white/5 text-gray-300';
  }
}

const parseActions = (actions: Array<{ action_type: string; value: string }> | undefined, type: string): number => {
  if (!actions) return 0;
  const found = actions.find(a => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
};

const parseActionsByCandidates = (
  actions: Array<{ action_type: string; value: string }> | undefined,
  candidates: string[]
): number => {
  if (!actions) return 0;
  for (const candidate of candidates) {
    const found = actions.find(a => a.action_type === candidate);
    if (found) return parseFloat(found.value);
  }
  return 0;
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

const messagingActionTypes = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
  'onsite_conversion.messaging_first_reply',
];

const METRICS_STORAGE_KEY = 'dashboard_visible_metrics';
const METRIC_ORDER_STORAGE_KEY = 'dashboard_metric_order_by_account';
const BREAKDOWN_COLUMNS_STORAGE_KEY = 'dashboard_breakdown_visible_columns';

const defaultMetricKeys: MetricKey[] = [
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'messagingConversations',
  'costPerMessagingConversation',
  'purchases',
  'purchaseValue',
  'roas',
  'costPerPurchase',
  'leads',
];

const baseMetricKeys: MetricKey[] = ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'purchases'];
const defaultBreakdownColumnKeys: BreakdownColumnKey[] = [
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'leads',
  'messagingConversations',
  'costPerMessagingConversation',
  'purchases',
  'costPerPurchase',
  'purchaseValue',
  'roas',
];
const compactBreakdownColumnKeys: BreakdownColumnKey[] = ['spend', 'impressions', 'clicks', 'ctr', 'leads', 'purchases', 'roas'];

const moveMetric = (arr: MetricKey[], source: MetricKey, target: MetricKey): MetricKey[] => {
  const sourceIdx = arr.indexOf(source);
  const targetIdx = arr.indexOf(target);
  if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return arr;

  const next = [...arr];
  next.splice(sourceIdx, 1);
  next.splice(targetIdx, 0, source);
  return next;
};

export function Dashboard({
  account, insights, campaigns, dailyData,
  selectedCampaignId, onSelectCampaign, onClearCampaign,
  campaignNodesById, loadingCampaignTreeId, onLoadCampaignTree, onLoadAdPreview,
}: DashboardProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('purchases');
  const [showChartDropdown, setShowChartDropdown] = useState(false);
  const [showFunnelGoalDropdown, setShowFunnelGoalDropdown] = useState(false);
  const [funnelGoal, setFunnelGoal] = useState<FunnelGoal>(() => {
    const raw = localStorage.getItem('dashboard_funnel_goal');
    return raw === 'purchases' ? 'purchases' : 'leads';
  });
  const [showMetricsDropdown, setShowMetricsDropdown] = useState(false);
  const [showBreakdownColumnsDropdown, setShowBreakdownColumnsDropdown] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [draggingMetricKey, setDraggingMetricKey] = useState<MetricKey | null>(null);
  const [showCampaignHierarchy, setShowCampaignHierarchy] = useState(true);
  const [showOnlyCampaignsWithImpressions, setShowOnlyCampaignsWithImpressions] = useState(true);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [expandedAdsetIds, setExpandedAdsetIds] = useState<string[]>([]);
  const [creativePreview, setCreativePreview] = useState<AdHierarchyItem | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [visibleMetricKeys, setVisibleMetricKeys] = useState<MetricKey[]>(() => {
    try {
      const raw = localStorage.getItem(METRICS_STORAGE_KEY);
      if (!raw) return defaultMetricKeys;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return defaultMetricKeys;
      const normalized = defaultMetricKeys.filter(k => parsed.includes(k));
      return normalized.length > 0 ? normalized : defaultMetricKeys;
    } catch {
      return defaultMetricKeys;
    }
  });
  const [visibleBreakdownColumns, setVisibleBreakdownColumns] = useState<BreakdownColumnKey[]>(() => {
    try {
      const raw = localStorage.getItem(BREAKDOWN_COLUMNS_STORAGE_KEY);
      if (!raw) return defaultBreakdownColumnKeys;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return defaultBreakdownColumnKeys;
      const normalized = defaultBreakdownColumnKeys.filter((key) => parsed.includes(key));
      return normalized.length > 0 ? normalized : defaultBreakdownColumnKeys;
    } catch {
      return defaultBreakdownColumnKeys;
    }
  });
  const [metricOrderByAccount, setMetricOrderByAccount] = useState<Record<string, MetricKey[]>>(() => {
    try {
      const raw = localStorage.getItem(METRIC_ORDER_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? parsed as Record<string, MetricKey[]> : {};
    } catch {
      return {};
    }
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const activeChartOption = chartOptions.find(o => o.value === chartMetric) || chartOptions[0];

  const selectedCampaignName = selectedCampaignId
    ? campaigns.find(c => c.campaign_id === selectedCampaignId)?.campaign_name
    : null;

  useEffect(() => {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(visibleMetricKeys));
  }, [visibleMetricKeys]);

  useEffect(() => {
    localStorage.setItem(METRIC_ORDER_STORAGE_KEY, JSON.stringify(metricOrderByAccount));
  }, [metricOrderByAccount]);

  useEffect(() => {
    localStorage.setItem(BREAKDOWN_COLUMNS_STORAGE_KEY, JSON.stringify(visibleBreakdownColumns));
  }, [visibleBreakdownColumns]);

  useEffect(() => {
    localStorage.setItem('dashboard_funnel_goal', funnelGoal);
  }, [funnelGoal]);

  useEffect(() => {
    if (!creativePreview) return;

    for (const node of Object.values(campaignNodesById)) {
      for (const group of node.adsets) {
        const match = group.ads.find((ad) => ad.id === creativePreview.id);
        if (match && match !== creativePreview) {
          setCreativePreview(match);
          return;
        }
      }
    }
  }, [campaignNodesById, creativePreview]);

  const metrics = [
    {
      key: 'spend' as MetricKey,
      title: 'Расход',
      value: formatMoney(insights.spend),
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/20',
      glowColor: '#10b981',
    },
    {
      key: 'impressions' as MetricKey,
      title: 'Показы',
      value: formatNum(insights.impressions),
      icon: <Eye className="w-5 h-5 text-blue-400" />,
      color: 'bg-blue-500/20',
      glowColor: '#3b82f6',
    },
    {
      key: 'reach' as MetricKey,
      title: 'Охват',
      value: formatNum(insights.reach),
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      color: 'bg-cyan-500/20',
      glowColor: '#06b6d4',
    },
    {
      key: 'frequency' as MetricKey,
      title: 'Частота',
      value: insights.frequency.toFixed(2),
      icon: <BarChart3 className="w-5 h-5 text-purple-400" />,
      color: 'bg-purple-500/20',
      glowColor: '#a855f7',
    },
    {
      key: 'clicks' as MetricKey,
      title: 'Клики',
      value: formatNum(insights.clicks),
      icon: <MousePointerClick className="w-5 h-5 text-amber-400" />,
      color: 'bg-amber-500/20',
      glowColor: '#f59e0b',
    },
    {
      key: 'ctr' as MetricKey,
      title: 'CTR',
      value: insights.ctr.toFixed(2) + '%',
      icon: <Target className="w-5 h-5 text-orange-400" />,
      color: 'bg-orange-500/20',
      glowColor: '#f97316',
    },
    {
      key: 'cpc' as MetricKey,
      title: 'CPC',
      value: formatMoney(insights.cpc),
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
      color: 'bg-yellow-500/20',
      glowColor: '#eab308',
    },
    {
      key: 'cpm' as MetricKey,
      title: 'CPM',
      value: formatMoney(insights.cpm),
      icon: <Layers className="w-5 h-5 text-pink-400" />,
      color: 'bg-pink-500/20',
      glowColor: '#ec4899',
    },
    {
      key: 'messagingConversations' as MetricKey,
      title: 'Начало переписки',
      value: formatNum(insights.messagingConversations),
      icon: <MessagesSquare className="w-5 h-5 text-sky-400" />,
      color: 'bg-sky-500/20',
      glowColor: '#0ea5e9',
    },
    {
      key: 'costPerMessagingConversation' as MetricKey,
      title: 'Цена начала переписки',
      value: formatMoney(insights.costPerMessagingConversation),
      icon: <DollarSign className="w-5 h-5 text-rose-400" />,
      color: 'bg-rose-500/20',
      glowColor: '#f43f5e',
    },
    {
      key: 'purchases' as MetricKey,
      title: 'Покупки',
      value: formatNum(insights.purchases),
      icon: <ShoppingCart className="w-5 h-5 text-violet-400" />,
      color: 'bg-violet-500/20',
      glowColor: '#8b5cf6',
    },
    {
      key: 'purchaseValue' as MetricKey,
      title: 'Ценность покупок',
      value: formatMoney(insights.purchaseValue),
      icon: <BarChart3 className="w-5 h-5 text-fuchsia-400" />,
      color: 'bg-fuchsia-500/20',
      glowColor: '#d946ef',
    },
    {
      key: 'roas' as MetricKey,
      title: 'ROAS',
      value: insights.roas.toFixed(2) + 'x',
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      color: 'bg-emerald-500/20',
      glowColor: '#10b981',
      subtitle: insights.roas >= 2 ? '✅ Отлично' : insights.roas >= 1 ? '⚠️ Средний' : '❌ Низкий',
    },
    {
      key: 'costPerPurchase' as MetricKey,
      title: 'Цена за покупку',
      value: formatMoney(insights.costPerPurchase),
      icon: <DollarSign className="w-5 h-5 text-red-400" />,
      color: 'bg-red-500/20',
      glowColor: '#ef4444',
    },
    {
      key: 'leads' as MetricKey,
      title: 'Лиды',
      value: formatNum(insights.leads),
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      color: 'bg-indigo-500/20',
      glowColor: '#6366f1',
    },
  ];

  const metricMap = useMemo(() => {
    return Object.fromEntries(metrics.map(m => [m.key, m])) as Record<MetricKey, typeof metrics[number]>;
  }, [metrics]);

  const orderedMetricKeys = useMemo(() => {
    const saved = metricOrderByAccount[account.id];
    if (!saved || saved.length === 0) return defaultMetricKeys;
    const filtered = saved.filter(k => defaultMetricKeys.includes(k));
    const missing = defaultMetricKeys.filter(k => !filtered.includes(k));
    return [...filtered, ...missing];
  }, [account.id, metricOrderByAccount]);

  const visibleMetrics = orderedMetricKeys
    .filter(k => visibleMetricKeys.includes(k))
    .map(k => metricMap[k])
    .filter(Boolean);

  const visibleCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => (
      showOnlyCampaignsWithImpressions
        ? parseInt(campaign.impressions || '0') > 0
        : true
    ));
  }, [campaigns, showOnlyCampaignsWithImpressions]);

  const breakdownColumns = useMemo(() => ([
    { key: 'spend' as BreakdownColumnKey, label: 'Расход' },
    { key: 'impressions' as BreakdownColumnKey, label: 'Показы' },
    { key: 'reach' as BreakdownColumnKey, label: 'Охват' },
    { key: 'frequency' as BreakdownColumnKey, label: 'Частота' },
    { key: 'clicks' as BreakdownColumnKey, label: 'Клики' },
    { key: 'ctr' as BreakdownColumnKey, label: 'CTR' },
    { key: 'cpc' as BreakdownColumnKey, label: 'CPC' },
    { key: 'cpm' as BreakdownColumnKey, label: 'CPM' },
    { key: 'leads' as BreakdownColumnKey, label: 'Лиды' },
    { key: 'messagingConversations' as BreakdownColumnKey, label: 'Переписки' },
    { key: 'costPerMessagingConversation' as BreakdownColumnKey, label: 'Цена переписки' },
    { key: 'purchases' as BreakdownColumnKey, label: 'Покупки' },
    { key: 'costPerPurchase' as BreakdownColumnKey, label: 'Цена покупки' },
    { key: 'purchaseValue' as BreakdownColumnKey, label: 'Ценность' },
    { key: 'roas' as BreakdownColumnKey, label: 'ROAS' },
  ]), []);

  const tooltipStyle = {
    backgroundColor: '#0d1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
  };

  const toggleMetric = (metricKey: MetricKey) => {
    const isVisible = visibleMetricKeys.includes(metricKey);
    if (isVisible && visibleMetricKeys.length === 1) return;
    setVisibleMetricKeys(prev =>
      prev.includes(metricKey)
        ? prev.filter(k => k !== metricKey)
        : [...prev, metricKey]
    );
  };

  const reorderMetrics = (source: MetricKey, target: MetricKey) => {
    const nextOrder = moveMetric(orderedMetricKeys, source, target);
    setMetricOrderByAccount(prev => ({ ...prev, [account.id]: nextOrder }));
  };

  const resetMetricOrder = () => {
    setMetricOrderByAccount(prev => ({ ...prev, [account.id]: defaultMetricKeys }));
  };

  const toggleBreakdownColumn = (columnKey: BreakdownColumnKey) => {
    const isVisible = visibleBreakdownColumns.includes(columnKey);
    if (isVisible && visibleBreakdownColumns.length === 1) return;
    setVisibleBreakdownColumns((prev) => (
      prev.includes(columnKey)
        ? prev.filter((key) => key !== columnKey)
        : [...prev, columnKey]
    ));
  };

  const toggleCampaignExpansion = async (campaign: CampaignInsight) => {
    const isOpen = expandedCampaignIds.includes(campaign.campaign_id);
    if (isOpen) {
      setExpandedCampaignIds((prev) => prev.filter((id) => id !== campaign.campaign_id));
      return;
    }

    setExpandedCampaignIds((prev) => [...prev, campaign.campaign_id]);
    if (!campaignNodesById[campaign.campaign_id]) {
      await onLoadCampaignTree(campaign);
    }
  };

  const toggleAdsetExpansion = (adsetId: string) => {
    setExpandedAdsetIds((prev) => (
      prev.includes(adsetId)
        ? prev.filter((id) => id !== adsetId)
        : [...prev, adsetId]
    ));
  };

  const handleOpenCreative = async (ad: AdHierarchyItem) => {
    setCreativePreview(ad);
    if (!ad.id || ad.creative?.preview_html) return;

    setIsPreviewLoading(true);
    await onLoadAdPreview(ad.id);
    setIsPreviewLoading(false);
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

  const funnelGoalValue = funnelGoal === 'leads' ? insights.leads : insights.purchases;
  const funnelGoalLabel = funnelGoal === 'leads' ? 'Лиды' : 'Покупки';
  const ctrFromImpressions = insights.impressions > 0 ? (insights.clicks / insights.impressions) * 100 : 0;
  const finalFromClicks = insights.clicks > 0 ? (funnelGoalValue / insights.clicks) * 100 : 0;

  const renderStatCell = (value: string, muted = false) => (
    <span className={muted ? 'text-gray-500' : 'text-gray-300'}>{value}</span>
  );

  const renderStatusBadges = (item: Pick<AdHierarchyItem, 'effective_status' | 'configured_status'> | Pick<CampaignInsight, 'effective_status' | 'configured_status'>) => {
    const effective = item.effective_status;
    const configured = item.configured_status;
    const showConfigured = configured && configured !== effective;

    if (!effective && !showConfigured) return null;

    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {effective && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${getStatusTone(effective)}`}>
            {normalizeStatus(effective)}
          </span>
        )}
        {showConfigured && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${getStatusTone(configured)}`}>
            set: {normalizeStatus(configured)}
          </span>
        )}
      </div>
    );
  };

  const renderBreakdownCell = (
    item: Pick<AdHierarchyItem, 'spend' | 'impressions' | 'reach' | 'frequency' | 'clicks' | 'ctr' | 'cpc' | 'cpm' | 'leads' | 'messagingConversations' | 'costPerMessagingConversation' | 'purchases' | 'costPerPurchase' | 'purchaseValue' | 'roas'>,
    columnKey: BreakdownColumnKey,
    muted = false
  ) => {
    switch (columnKey) {
      case 'spend':
        return renderStatCell(formatMoney(item.spend), muted);
      case 'impressions':
        return renderStatCell(formatNum(item.impressions), muted);
      case 'reach':
        return renderStatCell(formatNum(item.reach), muted);
      case 'frequency':
        return renderStatCell(item.frequency.toFixed(2), muted);
      case 'clicks':
        return renderStatCell(formatNum(item.clicks), muted);
      case 'ctr':
        return renderStatCell(`${item.ctr.toFixed(2)}%`, muted);
      case 'cpc':
        return renderStatCell(formatMoney(item.cpc), muted);
      case 'cpm':
        return renderStatCell(formatMoney(item.cpm), muted);
      case 'leads':
        return renderStatCell(formatNum(item.leads), muted);
      case 'messagingConversations':
        return renderStatCell(formatNum(item.messagingConversations), muted);
      case 'costPerMessagingConversation':
        return renderStatCell(formatMoney(item.costPerMessagingConversation), muted);
      case 'purchases':
        return renderStatCell(formatNum(item.purchases), muted);
      case 'costPerPurchase':
        return renderStatCell(formatMoney(item.costPerPurchase), muted);
      case 'purchaseValue':
        return renderStatCell(formatMoney(item.purchaseValue), muted);
      case 'roas':
        return renderStatCell(`${item.roas.toFixed(2)}x`, muted);
    }
  };

  return (
    <div ref={dashboardRef} className="max-w-[1600px] mx-auto px-6 py-8 space-y-8 animate-dashboard-enter">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{account.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            ID: {account.account_id} · Валюта: {account.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" data-export-ignore="true">
            <button
              onClick={() => setShowMetricsDropdown(v => !v)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Метрики
            </button>
            {showMetricsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMetricsDropdown(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#0d1117] p-2 shadow-2xl shadow-black/60">
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={() => setVisibleMetricKeys(defaultMetricKeys)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                    >
                      Все
                    </button>
                    <button
                      onClick={() => setVisibleMetricKeys(baseMetricKeys)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                    >
                      База
                    </button>
                    <button
                      onClick={resetMetricOrder}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                    >
                      Сброс порядка
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {orderedMetricKeys.map((metricKey) => {
                      const metric = metricMap[metricKey];
                      if (!metric) return null;
                      const checked = visibleMetricKeys.includes(metric.key);
                      return (
                        <button
                          key={metric.key}
                          onClick={() => toggleMetric(metric.key)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-white/5"
                        >
                          <span className={`h-4 w-4 rounded border ${checked ? 'border-indigo-500 bg-indigo-500/30' : 'border-white/20'}`} />
                          <span>{metric.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {visibleMetrics.map((m) => (
          <div
            key={m.key}
            draggable
            onDragStart={() => setDraggingMetricKey(m.key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingMetricKey && draggingMetricKey !== m.key) reorderMetrics(draggingMetricKey, m.key);
              setDraggingMetricKey(null);
            }}
            onDragEnd={() => setDraggingMetricKey(null)}
            className="group/metric relative"
          >
            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover/metric:opacity-100 transition-opacity text-gray-500">
              <GripVertical className="w-4 h-4" />
            </div>
            <MetricCard {...m} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Воронка конверсий</h3>
          <div className="relative" data-export-ignore="true">
            <button
              onClick={() => setShowFunnelGoalDropdown(v => !v)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
            >
              Цель: {funnelGoalLabel}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFunnelGoalDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showFunnelGoalDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFunnelGoalDropdown(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-lg border border-white/10 bg-[#0d1117] shadow-xl">
                  <button
                    onClick={() => {
                      setFunnelGoal('leads');
                      setShowFunnelGoalDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs ${funnelGoal === 'leads' ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    Лиды
                  </button>
                  <button
                    onClick={() => {
                      setFunnelGoal('purchases');
                      setShowFunnelGoalDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs ${funnelGoal === 'purchases' ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    Покупки
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Показы → Клики</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">{formatNum(insights.impressions)} → {formatNum(insights.clicks)}</span>
                <span className="text-indigo-300">CTR: {ctrFromImpressions.toFixed(2)}%</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(4, Math.min(100, ctrFromImpressions))}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Клики → {funnelGoalLabel}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">{formatNum(insights.clicks)} → {formatNum(funnelGoalValue)}</span>
                <span className="text-indigo-300">CR: {finalFromClicks.toFixed(2)}%</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.max(4, Math.min(100, finalFromClicks))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {dailyData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {activeChartOption.chartLabel} по дням
              </h3>
              <div className="relative" data-export-ignore="true">
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
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
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
                <Bar dataKey={chartMetric} fill="url(#dynamicBarGrad)" radius={[4, 4, 0, 0]} name={activeChartOption.chartLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>

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

      {campaigns.length > 0 && (
        <div className="overflow-visible rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Кампании и структура</h3>
              <p className="text-xs text-gray-500 mt-1">Можно фильтровать дашборд по кампании, раскрывать ad set/ad и смотреть креатив.</p>
            </div>
            <div className="flex items-center gap-2" data-export-ignore="true">
              <div className="relative">
                <button
                  onClick={() => setShowBreakdownColumnsDropdown((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Колонки
                </button>
                {showBreakdownColumnsDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBreakdownColumnsDropdown(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#0d1117] p-2 shadow-2xl shadow-black/60">
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          onClick={() => setVisibleBreakdownColumns(defaultBreakdownColumnKeys)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                        >
                          Все
                        </button>
                        <button
                          onClick={() => setVisibleBreakdownColumns(compactBreakdownColumnKeys)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                        >
                          Компактно
                        </button>
                      </div>
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {breakdownColumns.map((column) => {
                          const checked = visibleBreakdownColumns.includes(column.key);
                          return (
                            <button
                              key={column.key}
                              onClick={() => toggleBreakdownColumn(column.key)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-white/5"
                            >
                              <span className={`h-4 w-4 rounded border ${checked ? 'border-indigo-500 bg-indigo-500/30' : 'border-white/20'}`} />
                              <span>{column.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowCampaignHierarchy((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
              >
                <FolderTree className="h-4 w-4" />
                {showCampaignHierarchy ? 'Скрыть блок' : 'Показать блок'}
              </button>
              <button
                onClick={() => setShowOnlyCampaignsWithImpressions((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
              >
                {showOnlyCampaignsWithImpressions ? <CheckSquare className="h-4 w-4 text-indigo-300" /> : <Square className="h-4 w-4 text-gray-500" />}
                Только с показами
              </button>
            </div>
          </div>
          {showCampaignHierarchy && (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Кампания</th>
                  {breakdownColumns
                    .filter((column) => visibleBreakdownColumns.includes(column.key))
                    .map((column) => (
                      <th key={column.key} className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                        {column.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={visibleBreakdownColumns.length + 1} className="px-6 py-10 text-center text-sm text-gray-500">
                      По текущему фильтру кампаний не найдено. Отключи режим "Только с показами", чтобы увидеть всё.
                    </td>
                  </tr>
                )}
                {visibleCampaigns.map((c, i) => {
                  const spend = parseFloat(c.spend || '0');
                  const purchases = parseActions(c.actions, 'purchase');
                  const messaging = parseActionsByCandidates(c.actions, messagingActionTypes);
                  const purchaseValue = parseActionValues(c.action_values, 'purchase');
                  const roas = spend > 0 ? purchaseValue / spend : 0;
                  const isSelected = selectedCampaignId === c.campaign_id;
                  const isExpanded = expandedCampaignIds.includes(c.campaign_id);
                  const node = campaignNodesById[c.campaign_id];
                  const isLoadingTree = loadingCampaignTreeId === c.campaign_id;

                  return (
                    <Fragment key={c.campaign_id || String(i)}>
                      <tr
                        className={`border-b border-white/5 transition-all duration-200 ${
                          isSelected
                            ? 'bg-indigo-500/10 border-l-[3px] border-l-indigo-500'
                            : 'hover:bg-white/[0.03] border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <td className="px-6 py-3 max-w-[250px]">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => void toggleCampaignExpansion(c)}
                              className="rounded-md border border-white/10 bg-white/5 p-1 text-gray-300 hover:bg-white/10"
                            >
                              {isLoadingTree ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              )}
                            </button>
                            <button
                              onClick={() => onSelectCampaign(c.campaign_id)}
                              className="min-w-0 text-left"
                            >
                              <div className="flex items-center gap-3">
                                {isSelected && (
                                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <span className={`block truncate font-medium ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                                    {c.campaign_name}
                                  </span>
                                  {renderStatusBadges(c)}
                                </div>
                              </div>
                            </button>
                          </div>
                        </td>
                        {breakdownColumns
                          .filter((column) => visibleBreakdownColumns.includes(column.key))
                          .map((column) => (
                            <td key={column.key} className="px-4 py-3 text-right">
                              {column.key === 'roas' ? (
                                <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${
                                  roas >= 2 ? 'bg-emerald-500/10 text-emerald-400' :
                                  roas >= 1 ? 'bg-amber-500/10 text-amber-400' :
                                  'bg-red-500/10 text-red-400'
                                }`}>
                                  {roas.toFixed(2)}x
                                </span>
                              ) : (
                                renderBreakdownCell({
                                  spend,
                                  impressions: parseInt(c.impressions || '0'),
                                  reach: parseInt(c.reach || '0'),
                                  frequency: parseFloat(c.frequency || '0'),
                                  clicks: parseInt(c.clicks || '0'),
                                  ctr: parseFloat(c.ctr || '0'),
                                  cpc: parseFloat(c.cpc || '0'),
                                  cpm: parseFloat(c.cpm || '0'),
                                  leads: parseActions(c.actions, 'lead'),
                                  messagingConversations: messaging,
                                  costPerMessagingConversation: messaging > 0 ? spend / messaging : 0,
                                  purchases,
                                  costPerPurchase: purchases > 0 ? spend / purchases : 0,
                                  purchaseValue,
                                  roas,
                                }, column.key)
                              )}
                            </td>
                          ))}
                      </tr>

                      {isExpanded && node?.adsets.map(({ adset, ads }) => {
                        const isAdsetExpanded = expandedAdsetIds.includes(adset.id);
                        return (
                          <Fragment key={adset.id}>
                            <tr key={adset.id} className="border-b border-white/[0.04] bg-white/[0.015]">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-3 pl-7">
                                  <button
                                    onClick={() => toggleAdsetExpansion(adset.id)}
                                    className="rounded-md border border-white/10 bg-white/5 p-1 text-gray-300 hover:bg-white/10"
                                  >
                                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isAdsetExpanded ? 'rotate-90' : ''}`} />
                                  </button>
                                  <div className="min-w-0">
                                    <span className="block truncate text-sm text-gray-200">{adset.name}</span>
                                    {renderStatusBadges(adset)}
                                  </div>
                                </div>
                              </td>
                              {breakdownColumns
                                .filter((column) => visibleBreakdownColumns.includes(column.key))
                                .map((column) => (
                                  <td key={column.key} className="px-4 py-3 text-right">
                                    {renderBreakdownCell(adset, column.key)}
                                  </td>
                                ))}
                            </tr>
                            {isAdsetExpanded && ads.map((ad) => (
                              <tr key={ad.id} className="border-b border-white/[0.04] bg-[#0a0f16]">
                                <td className="px-6 py-3">
                                  <div className="flex items-center justify-between gap-3 pl-16">
                                    <div className="min-w-0">
                                      <span className="block truncate text-sm text-gray-300">{ad.name}</span>
                                      {renderStatusBadges(ad)}
                                    </div>
                                    <button
                                      onClick={() => void handleOpenCreative(ad)}
                                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                                    >
                                      <ImageIcon className="h-3.5 w-3.5" />
                                      Креатив
                                    </button>
                                  </div>
                                </td>
                                {breakdownColumns
                                  .filter((column) => visibleBreakdownColumns.includes(column.key))
                                  .map((column) => (
                                    <td key={column.key} className="px-4 py-3 text-right">
                                      {renderBreakdownCell(ad, column.key, ad.impressions === 0)}
                                    </td>
                                  ))}
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {creativePreview && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={() => setCreativePreview(null)} />
          <div className="fixed inset-x-4 top-1/2 z-[80] mx-auto w-full max-w-6xl -translate-y-1/2 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1117] p-6 shadow-2xl shadow-black/70">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-indigo-300">
                  <Sparkles className="h-4 w-4" />
                  Просмотр креатива
                </div>
                <h4 className="mt-2 text-xl font-semibold text-white">{creativePreview.name}</h4>
              </div>
              <button
                onClick={() => setCreativePreview(null)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="flex min-h-[320px] max-h-[72vh] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#080d14] p-4">
                {creativePreview.creative?.media_type === 'video' && creativePreview.creative?.video_source ? (
                  <video
                    src={creativePreview.creative.video_source}
                    controls
                    playsInline
                    preload="metadata"
                    poster={creativePreview.creative.thumbnail_url || creativePreview.creative.image_url}
                    className="block max-h-[calc(72vh-2rem)] w-auto max-w-full overflow-hidden rounded-xl bg-[#080d14] object-contain"
                  />
                ) : creativePreview.creative?.image_hash && (creativePreview.creative?.image_url || creativePreview.creative?.thumbnail_url) ? (
                  <img
                    src={creativePreview.creative?.image_url || creativePreview.creative?.thumbnail_url}
                    alt={creativePreview.name}
                    className="block max-h-[calc(72vh-2rem)] w-auto max-w-full rounded-xl object-contain"
                  />
                ) : creativePreview.creative?.preview_html ? (
                  <div className="h-[72vh] w-full overflow-hidden rounded-xl bg-white">
                    <iframe
                      title={`preview-${creativePreview.id}`}
                      srcDoc={`<!doctype html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;max-width:100%;background:#fff}*{box-sizing:border-box;max-width:100%}::-webkit-scrollbar{display:none}</style></head><body>${creativePreview.creative.preview_html}</body></html>`}
                      sandbox="allow-same-origin allow-scripts allow-popups"
                      className="block h-full w-full overflow-hidden border-0"
                      scrolling="no"
                    />
                  </div>
                ) : creativePreview.creative?.image_url || creativePreview.creative?.thumbnail_url ? (
                  <img
                    src={creativePreview.creative?.image_url || creativePreview.creative?.thumbnail_url}
                    alt={creativePreview.name}
                    className="block max-h-[calc(72vh-2rem)] w-auto max-w-full rounded-xl object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                    {isPreviewLoading
                      ? 'Загружаю медиа креатива...'
                      : 'Медиа недоступно. Можно открыть оригинал по ссылке справа.'}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Текст</div>
                  <div className="mt-2 text-sm leading-6 text-gray-200">
                    {creativePreview.creative?.body || 'Текст креатива не найден в ответе Meta API.'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Заголовок</div>
                  <div className="mt-2 text-sm text-white">
                    {creativePreview.creative?.title || 'Без заголовка'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Ссылка</div>
                  {creativePreview.creative?.link_url ? (
                    <a
                      href={creativePreview.creative.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all text-sm text-indigo-300 hover:text-indigo-200"
                    >
                      {creativePreview.creative.link_url}
                    </a>
                  ) : (
                    <div className="mt-2 text-sm text-gray-500">Ссылка не пришла от API.</div>
                  )}
                </div>
                {(creativePreview.creative?.video_source || creativePreview.creative?.image_url || creativePreview.creative?.thumbnail_url) && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">
                      {creativePreview.creative?.media_type === 'video' ? 'Исходный файл' : 'Исходное изображение'}
                    </div>
                    <a
                      href={
                        creativePreview.creative?.video_source
                        || creativePreview.creative?.image_url
                        || creativePreview.creative?.thumbnail_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block break-all text-sm text-indigo-300 hover:text-indigo-200"
                    >
                      Открыть оригинал
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
