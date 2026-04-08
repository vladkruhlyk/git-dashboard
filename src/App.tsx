import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, EyeOff, PanelLeft, Settings2, Square } from 'lucide-react';
import { CursorGlow } from './components/CursorGlow';
import { ApiSetup } from './components/ApiSetup';
import { Dashboard } from './components/Dashboard';
import { useFacebookApi } from './hooks/useFacebookApi';

const VISIBLE_ACCOUNTS_STORAGE_KEY = 'dashboard_visible_accounts';

export function App() {
  const {
    token, saveToken, accounts, selectedAccount,
    insights, campaigns, dailyData,
    loading, error,
    fetchAccounts, fetchInsights, disconnect, setError,
    selectedCampaignId, selectCampaign, clearCampaignSelection,
    currentDateRange, campaignNodesById, loadingCampaignTreeId, loadCampaignTree,
  } = useFacebookApi();
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountSettingsSearch, setAccountSettingsSearch] = useState('');
  const [visibleAccountIds, setVisibleAccountIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(VISIBLE_ACCOUNTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) as string[] : [];
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

  const visibleAccounts = useMemo(() => {
    if (visibleAccountIds.length === 0) return accounts;
    const visible = accounts.filter((account) => visibleAccountIds.includes(account.id));
    return visible.length > 0 ? visible : accounts;
  }, [accounts, visibleAccountIds]);

  const filteredAccountSettings = useMemo(() => {
    const normalized = accountSettingsSearch.trim().toLowerCase();
    if (!normalized) return accounts;
    return accounts.filter((account) => {
      const haystack = `${account.name} ${account.account_id} ${account.currency}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [accounts, accountSettingsSearch]);

  const toggleVisibleAccount = (accountId: string) => {
    setVisibleAccountIds((prev) => {
      const exists = prev.includes(accountId);
      if (exists && prev.length === 1) return prev;
      if (exists) return prev.filter((id) => id !== accountId);
      return [...prev, accountId];
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
                            <div className="truncate text-sm text-white">{account.name}</div>
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
                  return (
                    <button
                      key={account.id}
                      onClick={() => fetchInsights(account, currentDateRange)}
                      className={`mb-2 w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                        isActive
                          ? 'border-indigo-500/30 bg-indigo-500/12 shadow-lg shadow-indigo-500/10'
                          : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-medium ${isActive ? 'text-indigo-200' : 'text-white'}`}>
                            {account.name}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{account.account_id} · {account.currency}</div>
                        </div>
                        {isActive ? (
                          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" />
                        ) : (
                          <EyeOff className="h-4 w-4 shrink-0 text-gray-600" />
                        )}
                      </div>
                    </button>
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
