export interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  account_status: number;
  balance?: string;
  billing_threshold?: string;
  amount_spent?: string;
  disable_reason?: number;
}

export interface CampaignInsight {
  campaign_name: string;
  campaign_id: string;
  effective_status?: string;
  configured_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  cpc: string;
  cpm: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface ActionStat {
  action_type: string;
  value: string;
}

export interface CreativePreview {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  image_hash?: string;
  media_type?: 'image' | 'video' | 'unknown';
  video_id?: string;
  video_source?: string;
  preview_html?: string;
  body?: string;
  title?: string;
  link_url?: string;
}

export interface AdHierarchyItem {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  effective_status?: string;
  configured_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  leads: number;
  costPerLead: number;
  messagingConversations: number;
  costPerMessagingConversation: number;
  costPerPurchase: number;
  creative?: CreativePreview | null;
}

export interface CampaignNode {
  campaign: AdHierarchyItem;
  adsets: Array<{
    adset: AdHierarchyItem;
    ads: AdHierarchyItem[];
  }>;
}

export interface AccountInsights {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  costPerPurchase: number;
  addToCart: number;
  leads: number;
  costPerLead: number;
  messagingConversations: number;
  costPerMessagingConversation: number;
}

export interface DailyData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  leads: number;
}

export interface DateRange {
  since: string;
  until: string;
}
