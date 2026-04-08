import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, EyeOff, PanelLeft, PencilLine, Settings2, Square } from 'lucide-react';
import { CursorGlow } from './components/CursorGlow';
import { ApiSetup } from './components/ApiSetup';
import { Dashboard } from './components/Dashboard';
import { useFacebookApi } from './hooks/useFacebookApi';

const VISIBLE_ACCOUNTS_STORAGE_KEY = 'dashboard_visible_accounts';
const ACCOUNT_ALIASES_STORAGE_KEY = 'dashboard_account_aliases';

function parseMoneyLike(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number.isInteger(parsed) && Math.abs(parsed) >= 1000 ? parsed / 100 : parsed;
}

function formatCurrencyValue(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function getBillingMeta(accountStatus: number, balance: number | null, disableReason?: number) {
  if (accountStatus === 1) {
    return {
      label: 'Активен',
      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    };
  }

  if (balance !== null && balance > 0) {
    return {
      label: 'Задолженность',
      tone: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
    };
  }

  if (disableReason !== undefined && disableReason !== 0) {
    return {
      label: 'Ограничен',
      tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    };
  }

  return {
    label: 'Проверить биллинг',
    tone: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  };
}

export function App() {
  const {
    token, saveToken, accounts, selectedAccount,
    insights, campaigns, dailyData,
    loading, error,
    fetchAccounts, fetchInsights, disconnect, setError,
    selectedCampaignId, selectCampaign, clearCampaignSelection,
    currentDateRange, campaignNodesById, loadingCampaignTreeId, loadCampaignTree, loadAdPreview,
  } = useFacebookApi();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsSearch, setAccountSettingsSearch] = useState('');
  const [accountAliases, setAccountAliases] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_ALIASES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === 'string')
      );
    } catch {
      return {};
    }
  });
  const [visibleAccountIds, setVisibleAccountIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(VISIBLE_ACCOUNTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });

  // Auto-fetch accounts if token exists on load
  useEffect(() => {
    if (token && accounts.length === 0) {
      fetchAccounts();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (accounts.length === 0) return;
    setVisibleAccountIds((prev) => {
      if (prev.length > 0) return prev;
      return accounts.map((account) => account.id);
    });
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(VISIBLE_ACCOUNTS_STORAGE_KEY, JSON.stringify(visibleAccountIds));
  }, [visibleAccountIds]);

  useEffect(() => {
    localStorage.setItem(ACCOUNT_ALIASES_STORAGE_KEY, JSON.stringify(accountAliases));
  }, [accountAliases]);

  const getAccountLabel = (accountId: string, fallbackName: string) => accountAliases[accountId]?.trim() || fallbackName;

  const visibleAccounts = useMemo(() => {
    if (visibleAccountIds.length === 0) return accounts;
    const visible = accounts.filter((account) => visibleAccountIds.includes(account.id));
    return visible.length > 0 ? visible : accounts;
  }, [accounts, visibleAccountIds]);

  const filteredAccountSettings = useMemo(() => {
    const normalized = accountSettingsSearch.trim().toLowerCase();
    if (!normalized) return accounts;
    return accounts.filter((account) => {
      const haystack = `${account.name} ${getAccountLabel(account.id, account.name)} ${account.account_id} ${account.currency}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [accounts, accountAliases, accountSettingsSearch]);

  const toggleVisibleAccount = (accountId: string) => {
    setVisibleAccountIds((prev) => {
      const exists = prev.includes(accountId);
      if (exists && prev.length === 1) return prev;
      if (exists) return prev.filter((id) => id !== accountId);
      return [...prev, accountId];
    });
  };

  const renameAccount = (accountId: string, currentName: string) => {
    const nextName = window.prompt('Новое имя для кабинета в этом дашборде:', getAccountLabel(accountId, currentName));
    if (nextName === null) return;

    const trimmed = nextName.trim();
    setAccountAliases((prev) => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[accountId];
        return next;
      }
      return { ...prev, [accountId]: trimmed };
    });
  };

  return (
    <div className="min-h-screen bg-[#060a10] text-white relative overflow-x-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Grid overlay */}
      <div
        className="fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Cursor glow */}
      <CursorGlow />

      {/* Content */}
      <div className="relative z-10">
        <ApiSetup
          token={token}
          onSaveToken={saveToken}
          onFetchAccounts={fetchAccounts}
          accounts={accounts}
          selectedAccount={selectedAccount}
          onSelectAccount={fetchInsights}
          loading={loading}
          error={error}
          onDisconnect={disconnect}
          onClearError={() => setError(null)}
        />

        {accounts.length > 0 && (
          <div className="mx-auto flex max-w-[1800px] gap-6 px-4 py-6 md:px-6">
            <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-80 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1018]/85 backdrop-blur-xl lg:block">
              <div className="border-b border-white/5 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-indigo-300">
                      <PanelLeft className="h-4 w-4" />
                      Проекты
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">Рекламные кабинеты</h3>
                    <p className="mt-1 text-sm text-gray-400">Слева только те кабинеты, которые ты отметил в настройках.</p>
                  </div>
                  <button
                    onClick={() => setShowAccountSettings((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300 transition-all hover:bg-white/10"
                  >
                    <Settings2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {showAccountSettings && (
                <div className="border-b border-white/5 bg-white/[0.02] px-5 py-4">
                  <div className="mb-3 flex items-center gap-2 text-sm text-gray-300">
                    <CheckSquare className="h-4 w-4 text-indigo-300" />
                    Настройки отображения кабинетов
                  </div>
                  <div className="mb-3">
                    <input
                      value={accountSettingsSearch}
                      onChange={(e) => setAccountSettingsSearch(e.target.value)}
                      placeholder="Поиск кабинета в настройках"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {filteredAccountSettings.map((account) => {
                      const checked = visibleAccountIds.includes(account.id);
                      return (
                        <button
                          key={account.id}
                          onClick={() => toggleVisibleAccount(account.id)}
                          className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.04]"
                        >
                          {checked ? (
                            <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                          ) : (
                            <Square className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white">{getAccountLabel(account.id, account.name)}</div>
                            <div className="text-xs text-gray-500">ID: {account.account_id}</div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredAccountSettings.length === 0 && (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-4 text-sm text-gray-500">
                        Поиск ничего не нашёл.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="h-[calc(100%-5.5rem)] overflow-y-auto px-3 py-3">
                {visibleAccounts.map((account) => {
                  const isActive = selectedAccount?.id === account.id;
                  const balance = parseMoneyLike(account.balance);
                  const billingMeta = getBillingMeta(account.account_status, balance, account.disable_reason);
                  return (
                    <div
                      key={account.id}
                      className={`mb-2 rounded-2xl border px-4 py-4 transition-all ${
                        isActive
                          ? 'border-indigo-500/30 bg-indigo-500/12 shadow-lg shadow-indigo-500/10'
                          : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => fetchInsights(account, currentDateRange)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className={`truncate text-sm font-medium ${isActive ? 'text-indigo-200' : 'text-white'}`}>
                            {getAccountLabel(account.id, account.name)}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{account.account_id} · {account.currency}</div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${billingMeta.tone}`}>
                              {billingMeta.label}
                            </span>
                            {billingMeta.label === 'Задолженность' && balance !== null && balance > 0 && (
                              <span className="text-xs text-rose-300">
                                {formatCurrencyValue(balance, account.currency)}
                              </span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => renameAccount(account.id, account.name)}
                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                            title="Переименовать для себя"
                          >
                            <PencilLine className="h-4 w-4" />
                          </button>
                          {isActive ? (
                            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" />
                          ) : (
                            <EyeOff className="h-4 w-4 shrink-0 text-gray-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {selectedAccount && insights ? (
                <Dashboard
                  key={`${selectedAccount.id}-${selectedCampaignId || 'all'}`}
                  account={selectedAccount}
                  insights={insights}
                  campaigns={campaigns}
                  dailyData={dailyData}
                  selectedCampaignId={selectedCampaignId}
                  onSelectCampaign={selectCampaign}
                  onClearCampaign={clearCampaignSelection}
                  campaignNodesById={campaignNodesById}
                  loadingCampaignTreeId={loadingCampaignTreeId}
                  onLoadCampaignTree={loadCampaignTree}
                  onLoadAdPreview={loadAdPreview}
                />
              ) : (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10">
                      <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      Найдено {accounts.length} рекламных кабинетов
                    </h3>
                    <p className="text-gray-400">
                      Выбери нужный кабинет слева, и дашборд загрузит статистику за текущий период.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
