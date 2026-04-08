import { useState, useCallback } from 'react';
import type {
  AdAccount,
  AccountInsights,
  CampaignInsight,
  DailyData,
  DateRange,
  CampaignNode,
  AdHierarchyItem,
  CreativePreview,
  ActionStat,
} from '../types';

const FB_API_BASE = 'https://graph.facebook.com/v21.0';

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

const parseCostPerAction = (
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

const messagingActionTypes = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_conversation_started',
  'onsite_conversion.messaging_first_reply',
];

const defaultDateRange = (): DateRange => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const toISO = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    since: toISO(weekAgo),
    until: toISO(today),
  };
};

const campaignFilter = (campaignId: string) =>
  encodeURIComponent(JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: campaignId }]));

const withTimeRange = (dateRange: DateRange) =>
  `time_range=${encodeURIComponent(JSON.stringify({ since: dateRange.since, until: dateRange.until }))}`;

const parseCreativePreview = (creative: Record<string, unknown> | undefined): CreativePreview | null => {
  if (!creative) return null;

  const objectStorySpec = creative.object_story_spec as Record<string, unknown> | undefined;
  const linkData = objectStorySpec?.link_data as Record<string, unknown> | undefined;
  const videoData = objectStorySpec?.video_data as Record<string, unknown> | undefined;
  const videoCallToAction = videoData?.call_to_action as Record<string, unknown> | undefined;
  const videoCallToActionValue = videoCallToAction?.value as Record<string, unknown> | undefined;

  const hasVideo = Boolean((creative.video_id as string | undefined) || (videoData?.video_id as string | undefined));
  const hasImage = Boolean(
    (creative.image_url as string | undefined)
    || (linkData?.picture as string | undefined)
    || (videoData?.image_url as string | undefined)
    || (creative.thumbnail_url as string | undefined)
    || (creative.image_hash as string | undefined)
    || (linkData?.image_hash as string | undefined)
  );

  return {
    id: creative.id as string | undefined,
    name: creative.name as string | undefined,
    thumbnail_url: creative.thumbnail_url as string | undefined,
    image_hash: (creative.image_hash as string | undefined) || (linkData?.image_hash as string | undefined),
    media_type: hasVideo ? 'video' : hasImage ? 'image' : 'unknown',
    image_url: (creative.image_url as string | undefined)
      || (linkData?.picture as string | undefined)
      || (videoData?.image_url as string | undefined)
      || (creative.thumbnail_url as string | undefined),
    video_id: (creative.video_id as string | undefined) || (videoData?.video_id as string | undefined),
    body: (creative.body as string | undefined)
      || (linkData?.message as string | undefined)
      || (videoData?.message as string | undefined),
    title: (creative.title as string | undefined)
      || (linkData?.name as string | undefined)
      || (videoData?.title as string | undefined),
    link_url: (creative.link_url as string | undefined)
      || (linkData?.link as string | undefined)
      || (videoCallToActionValue?.link as string | undefined),
  };
};

const toHierarchyItem = (
  row: Record<string, unknown>,
  level: AdHierarchyItem['level'],
  fallbackIdKey: 'campaign_id' | 'adset_id' | 'ad_id',
  fallbackNameKey: 'campaign_name' | 'adset_name' | 'ad_name',
  creative?: CreativePreview | null
): AdHierarchyItem => {
  const parsed = parseInsightsRow(row);

  return {
    id: (row[fallbackIdKey] as string | undefined) || '',
    name: (row[fallbackNameKey] as string | undefined) || 'Без названия',
    level,
    ...parsed,
    creative,
  };
};

function parseInsightsRow(d: Record<string, unknown>): AccountInsights {
  const actions = d.actions as ActionStat[] | undefined;
  const actionValues = d.action_values as ActionStat[] | undefined;
  const costPerActionType = d.cost_per_action_type as ActionStat[] | undefined;
  const purchases = parseActions(actions, 'purchase');
  const leads = parseActions(actions, 'lead');
  const messagingConversations = parseActionsByCandidates(actions, messagingActionTypes);
  const purchaseValue = parseActions(actionValues, 'purchase');
  const spend = parseFloat(d.spend as string || '0');
  const parsedCostPerMessaging = parseCostPerAction(costPerActionType, messagingActionTypes);
  const costPerMessagingConversation = parsedCostPerMessaging > 0
    ? parsedCostPerMessaging
    : messagingConversations > 0
      ? spend / messagingConversations
      : 0;

  return {
    spend,
    impressions: parseInt(d.impressions as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    frequency: parseFloat(d.frequency as string || '0'),
    clicks: parseInt(d.clicks as string || '0'),
    cpc: parseFloat(d.cpc as string || '0'),
    cpm: parseFloat(d.cpm as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    addToCart: parseActions(actions, 'add_to_cart'),
    leads,
    messagingConversations,
    costPerMessagingConversation,
  };
}

const emptyInsights: AccountInsights = {
  spend: 0, impressions: 0, reach: 0, clicks: 0,
  frequency: 0, cpc: 0, cpm: 0, ctr: 0, purchases: 0,
  purchaseValue: 0, roas: 0, costPerPurchase: 0,
  addToCart: 0, leads: 0, messagingConversations: 0, costPerMessagingConversation: 0,
};

function parseDailyArray(data: Array<Record<string, unknown>>): DailyData[] {
  return data.map((d) => ({
    date: (d.date_start as string || '').slice(5),
    spend: parseFloat(d.spend as string || '0'),
    impressions: parseInt(d.impressions as string || '0'),
    clicks: parseInt(d.clicks as string || '0'),
    purchases: parseActions(d.actions as ActionStat[], 'purchase'),
    revenue: parseActions(d.action_values as ActionStat[], 'purchase'),
    leads: parseActions(d.actions as ActionStat[], 'lead'),
  }));
}

export function useFacebookApi() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('fb_token') || '');
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
  const [insights, setInsights] = useState<AccountInsights | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignInsight[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campaign filtering
  const [accountInsights, setAccountInsights] = useState<AccountInsights | null>(null);
  const [accountDailyData, setAccountDailyData] = useState<DailyData[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [lastDateRange, setLastDateRange] = useState<DateRange>(defaultDateRange);
  const [campaignNodesById, setCampaignNodesById] = useState<Record<string, CampaignNode>>({});
  const [loadingCampaignTreeId, setLoadingCampaignTreeId] = useState<string | null>(null);

  const saveToken = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem('fb_token', t);
  }, []);

  const fetchAccounts = useCallback(async (accessToken?: string) => {
    const tk = accessToken || token;
    if (!tk) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${FB_API_BASE}/me/adaccounts?fields=account_id,name,currency,account_status&limit=100&access_token=${tk}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      setAccounts(data.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchInsights = useCallback(async (account: AdAccount, dateRange: DateRange) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setSelectedAccount(account);
    setSelectedCampaignId(null);
    setLastDateRange(dateRange);
    setCampaignNodesById({});

    try {
      // Account-level insights
      const insightsRes = await fetch(
        `${FB_API_BASE}/${account.id}/insights?fields=spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&access_token=${token}`
      );
      const insightsData = await insightsRes.json();
      if (insightsData.error) throw new Error(insightsData.error.message);

      let parsed: AccountInsights;
      if (insightsData.data && insightsData.data.length > 0) {
        parsed = parseInsightsRow(insightsData.data[0]);
      } else {
        parsed = { ...emptyInsights };
      }
      setInsights(parsed);
      setAccountInsights(parsed);

      // Campaign-level insights
      const campaignsRes = await fetch(
        `${FB_API_BASE}/${account.id}/insights?fields=campaign_name,campaign_id,spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&level=campaign&limit=50&access_token=${token}`
      );
      const campaignsData = await campaignsRes.json();
      if (!campaignsData.error) {
        setCampaigns(campaignsData.data || []);
      }

      // Daily data
      const dailyRes = await fetch(
        `${FB_API_BASE}/${account.id}/insights?fields=spend,impressions,clicks,actions,action_values&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&time_increment=1&access_token=${token}`
      );
      const dailyDataRes = await dailyRes.json();
      let daily: DailyData[] = [];
      if (!dailyDataRes.error && dailyDataRes.data) {
        daily = parseDailyArray(dailyDataRes.data);
      }
      setDailyData(daily);
      setAccountDailyData(daily);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const selectCampaign = useCallback(async (campaignId: string) => {
    if (!token || !lastDateRange) return;

    // Toggle: clicking same campaign deselects
    if (campaignId === selectedCampaignId) {
      setSelectedCampaignId(null);
      setInsights(accountInsights);
      setDailyData(accountDailyData);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedCampaignId(campaignId);

    try {
      // Campaign-specific insights
      const insightsRes = await fetch(
        `${FB_API_BASE}/${campaignId}/insights?fields=spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${lastDateRange.since}","until":"${lastDateRange.until}"}&access_token=${token}`
      );
      const insightsData = await insightsRes.json();
      if (insightsData.error) throw new Error(insightsData.error.message);

      if (insightsData.data && insightsData.data.length > 0) {
        setInsights(parseInsightsRow(insightsData.data[0]));
      } else {
        setInsights({ ...emptyInsights });
      }

      // Campaign-specific daily data
      const dailyRes = await fetch(
        `${FB_API_BASE}/${campaignId}/insights?fields=spend,impressions,clicks,actions,action_values&time_range={"since":"${lastDateRange.since}","until":"${lastDateRange.until}"}&time_increment=1&access_token=${token}`
      );
      const dailyDataRes = await dailyRes.json();
      if (!dailyDataRes.error && dailyDataRes.data) {
        setDailyData(parseDailyArray(dailyDataRes.data));
      } else {
        setDailyData([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch campaign data');
    } finally {
      setLoading(false);
    }
  }, [token, lastDateRange, selectedCampaignId, accountInsights, accountDailyData]);

  const clearCampaignSelection = useCallback(() => {
    setSelectedCampaignId(null);
    setInsights(accountInsights);
    setDailyData(accountDailyData);
  }, [accountInsights, accountDailyData]);

  const loadAdPreview = useCallback(async (adId: string) => {
    if (!token || !adId) return;

    try {
      const previewRes = await fetch(
        `${FB_API_BASE}/${adId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${token}`
      );
      const previewData = await previewRes.json();
      if (previewData.error) throw new Error(previewData.error.message);

      const html = (previewData.data?.[0]?.body as string | undefined) || '';
      if (!html) return;

      setCampaignNodesById((prev) => {
        const next = { ...prev };
        for (const [campaignId, node] of Object.entries(prev)) {
          const updatedAdsets = node.adsets.map((group) => ({
            ...group,
            ads: group.ads.map((ad) => (
              ad.id === adId
                ? {
                    ...ad,
                    creative: {
                      ...ad.creative,
                      preview_html: html,
                    },
                  }
                : ad
            )),
          }));

          next[campaignId] = {
            ...node,
            adsets: updatedAdsets,
          };
        }
        return next;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch ad preview');
    }
  }, [token]);

  const loadCampaignTree = useCallback(async (campaign: CampaignInsight) => {
    if (!token || !selectedAccount) return;
    if (campaignNodesById[campaign.campaign_id]) return;

    setLoadingCampaignTreeId(campaign.campaign_id);
    setError(null);

    try {
      const sharedFields = 'spend,impressions,reach,frequency,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type';
      const filtering = campaignFilter(campaign.campaign_id);
      const timeRange = withTimeRange(lastDateRange);

      const adsetsRes = await fetch(
        `${FB_API_BASE}/${selectedAccount.id}/insights?fields=adset_id,adset_name,${sharedFields}&level=adset&limit=200&filtering=${filtering}&${timeRange}&access_token=${token}`
      );
      const adsetsData = await adsetsRes.json();
      if (adsetsData.error) throw new Error(adsetsData.error.message);

      const adsRes = await fetch(
        `${FB_API_BASE}/${selectedAccount.id}/insights?fields=ad_id,ad_name,adset_id,${sharedFields}&level=ad&limit=500&filtering=${filtering}&${timeRange}&access_token=${token}`
      );
      const adsData = await adsRes.json();
      if (adsData.error) throw new Error(adsData.error.message);

      const creativesRes = await fetch(
        `${FB_API_BASE}/${campaign.campaign_id}/ads?fields=id,name,adset_id,creative{id,name,thumbnail_url,image_url,image_hash,video_id,body,title,link_url,object_story_spec{link_data{picture,image_hash,link,name,message},video_data{image_url,video_id,message,title,call_to_action}}}&limit=500&access_token=${token}`
      );
      const creativesData = await creativesRes.json();
      if (creativesData.error) throw new Error(creativesData.error.message);

      const creativeByAdId = new Map<string, CreativePreview | null>();
      for (const ad of (creativesData.data || []) as Array<Record<string, unknown>>) {
        creativeByAdId.set(ad.id as string, parseCreativePreview(ad.creative as Record<string, unknown> | undefined));
      }

      const imageHashes = Array.from(new Set(
        Array.from(creativeByAdId.values())
          .map((creative) => creative?.image_hash)
          .filter((value): value is string => Boolean(value))
      ));
      const videoIds = Array.from(new Set(
        Array.from(creativeByAdId.values())
          .map((creative) => creative?.video_id)
          .filter((value): value is string => Boolean(value))
      ));

      const imageUrlByHash = new Map<string, string>();
      if (imageHashes.length > 0) {
        const hashesParam = encodeURIComponent(JSON.stringify(imageHashes));
        const adImagesRes = await fetch(
          `${FB_API_BASE}/${selectedAccount.id}/adimages?fields=hash,url,original_width,original_height&hashes=${hashesParam}&access_token=${token}`
        );
        const adImagesData = await adImagesRes.json();
        if (!adImagesData.error && adImagesData.images) {
          for (const value of Object.values(adImagesData.images as Record<string, Record<string, unknown>>)) {
            const hash = value.hash as string | undefined;
            const url = value.url as string | undefined;
            if (hash && url) imageUrlByHash.set(hash, url);
          }
        }
      }

      for (const creative of creativeByAdId.values()) {
        if (!creative?.image_hash) continue;
        const originalUrl = imageUrlByHash.get(creative.image_hash);
        if (originalUrl) {
          creative.image_url = originalUrl;
        }
      }

      if (videoIds.length > 0) {
        const videoBatchRes = await fetch(
          `${FB_API_BASE}/?ids=${encodeURIComponent(videoIds.join(','))}&fields=source,picture,thumbnails&access_token=${token}`
        );
        const videoBatchData = await videoBatchRes.json();
        if (!videoBatchData.error) {
          for (const [videoId, payload] of Object.entries(videoBatchData as Record<string, Record<string, unknown>>)) {
            for (const creative of creativeByAdId.values()) {
              if (creative?.video_id !== videoId) continue;
              const thumbnails = payload.thumbnails as { data?: Array<Record<string, unknown>> } | undefined;
              const bestThumbnail = thumbnails?.data?.[0]?.uri as string | undefined;
              creative.video_source = payload.source as string | undefined;
              creative.thumbnail_url = (payload.picture as string | undefined) || bestThumbnail || creative.thumbnail_url;
              if (!creative.image_url) {
                creative.image_url = creative.thumbnail_url;
              }
              creative.media_type = creative.video_source ? 'video' : 'image';
            }
          }
        }
      }

      const adsByAdsetId = new Map<string, AdHierarchyItem[]>();
      for (const row of (adsData.data || []) as Array<Record<string, unknown>>) {
        const adsetId = row.adset_id as string | undefined;
        if (!adsetId) continue;
        const item = toHierarchyItem(row, 'ad', 'ad_id', 'ad_name', creativeByAdId.get((row.ad_id as string) || '') || null);
        if (!adsByAdsetId.has(adsetId)) adsByAdsetId.set(adsetId, []);
        adsByAdsetId.get(adsetId)?.push(item);
      }

      const node: CampaignNode = {
        campaign: toHierarchyItem(campaign as unknown as Record<string, unknown>, 'campaign', 'campaign_id', 'campaign_name'),
        adsets: ((adsetsData.data || []) as Array<Record<string, unknown>>).map((row) => {
          const adsetId = (row.adset_id as string | undefined) || '';
          return {
            adset: toHierarchyItem(row, 'adset', 'adset_id', 'adset_name'),
            ads: (adsByAdsetId.get(adsetId) || []).sort((a, b) => b.impressions - a.impressions),
          };
        }).sort((a, b) => b.adset.impressions - a.adset.impressions),
      };

      setCampaignNodesById((prev) => ({ ...prev, [campaign.campaign_id]: node }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch campaign tree');
    } finally {
      setLoadingCampaignTreeId(null);
    }
  }, [token, selectedAccount, campaignNodesById, lastDateRange]);

  const disconnect = useCallback(() => {
    setToken('');
    setAccounts([]);
    setSelectedAccount(null);
    setInsights(null);
    setCampaigns([]);
    setDailyData([]);
    setAccountInsights(null);
    setAccountDailyData([]);
    setSelectedCampaignId(null);
    setLastDateRange(defaultDateRange());
    setCampaignNodesById({});
    setLoadingCampaignTreeId(null);
    localStorage.removeItem('fb_token');
  }, []);

  return {
    token, saveToken, accounts, selectedAccount,
    insights, campaigns, dailyData,
    loading, error,
    fetchAccounts, fetchInsights, disconnect, setError,
    selectedCampaignId, selectCampaign, clearCampaignSelection,
    currentDateRange: lastDateRange,
    campaignNodesById,
    loadingCampaignTreeId,
    loadCampaignTree,
    loadAdPreview,
  };
}
