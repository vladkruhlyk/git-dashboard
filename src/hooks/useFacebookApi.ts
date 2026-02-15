import { useState, useCallback } from 'react';
import type { AdAccount, AccountInsights, CampaignInsight, DailyData, DateRange } from '../types';

const FB_API_BASE = 'https://graph.facebook.com/v21.0';

const parseActions = (actions: Array<{ action_type: string; value: string }> | undefined, type: string): number => {
  if (!actions) return 0;
  const found = actions.find(a => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
};

function parseInsightsRow(d: Record<string, unknown>): AccountInsights {
  const actions = d.actions as Array<{ action_type: string; value: string }> | undefined;
  const actionValues = d.action_values as Array<{ action_type: string; value: string }> | undefined;
  const purchases = parseActions(actions, 'purchase');
  const purchaseValue = parseActions(actionValues, 'purchase');
  const spend = parseFloat(d.spend as string || '0');

  return {
    spend,
    impressions: parseInt(d.impressions as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    clicks: parseInt(d.clicks as string || '0'),
    cpc: parseFloat(d.cpc as string || '0'),
    cpm: parseFloat(d.cpm as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    purchases,
    purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    addToCart: parseActions(actions, 'add_to_cart'),
    leads: parseActions(actions, 'lead'),
  };
}

const emptyInsights: AccountInsights = {
  spend: 0, impressions: 0, reach: 0, clicks: 0,
  cpc: 0, cpm: 0, ctr: 0, purchases: 0,
  purchaseValue: 0, roas: 0, costPerPurchase: 0,
  addToCart: 0, leads: 0,
};

function parseDailyArray(data: Array<Record<string, unknown>>): DailyData[] {
  return data.map((d) => ({
    date: (d.date_start as string || '').slice(5),
    spend: parseFloat(d.spend as string || '0'),
    impressions: parseInt(d.impressions as string || '0'),
    clicks: parseInt(d.clicks as string || '0'),
    purchases: parseActions(d.actions as Array<{ action_type: string; value: string }>, 'purchase'),
    revenue: parseActions(d.action_values as Array<{ action_type: string; value: string }>, 'purchase'),
    leads: parseActions(d.actions as Array<{ action_type: string; value: string }>, 'lead'),
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
  const [lastDateRange, setLastDateRange] = useState<DateRange | null>(null);

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

    try {
      // Account-level insights
      const insightsRes = await fetch(
        `${FB_API_BASE}/${account.id}/insights?fields=spend,impressions,reach,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&access_token=${token}`
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
        `${FB_API_BASE}/${account.id}/insights?fields=campaign_name,campaign_id,spend,impressions,reach,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${dateRange.since}","until":"${dateRange.until}"}&level=campaign&limit=50&access_token=${token}`
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
        `${FB_API_BASE}/${campaignId}/insights?fields=spend,impressions,reach,clicks,cpc,cpm,ctr,actions,action_values,cost_per_action_type&time_range={"since":"${lastDateRange.since}","until":"${lastDateRange.until}"}&access_token=${token}`
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
    setLastDateRange(null);
    localStorage.removeItem('fb_token');
  }, []);

  return {
    token, saveToken, accounts, selectedAccount,
    insights, campaigns, dailyData,
    loading, error,
    fetchAccounts, fetchInsights, disconnect, setError,
    selectedCampaignId, selectCampaign, clearCampaignSelection,
  };
}
