import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckSquare, Copy, EyeOff, KeyRound, Link2, Loader2, PanelLeft, PencilLine, Settings2, Square, Wallet } from 'lucide-react';
import { CursorGlow } from './components/CursorGlow';
import { ApiSetup } from './components/ApiSetup';
import { Dashboard } from './components/Dashboard';
import { useFacebookApi } from './hooks/useFacebookApi';

const VISIBLE_ACCOUNTS_STORAGE_KEY = 'dashboard_visible_accounts';
const ACCOUNT_ALIASES_STORAGE_KEY = 'dashboard_account_aliases';
const ACCOUNT_ORDER_STORAGE_KEY = 'dashboard_account_order';
const MONTHLY_BUDGETS_STORAGE_KEY = 'dashboard_monthly_budgets';
const ADMIN_AUTH_STORAGE_KEY = 'dashboard_admin_authenticated';
const ENV_ADMIN_LOGIN = (import.meta.env.VITE_DASHBOARD_LOGIN as string | undefined)?.trim() || '';
const ENV_ADMIN_PASSWORD = (import.meta.env.VITE_DASHBOARD_PASSWORD as string | undefined)?.trim() || '';

function getCurrencyFractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function parseMoneyLike(value: string | undefined, currency: string): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  if (normalized.includes('.') || normalized.includes(',')) {
    return parsed;
  }

  const fractionDigits = getCurrencyFractionDigits(currency);
  const divisor = 10 ** fractionDigits;
  return divisor > 1 ? parsed / divisor : parsed;
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

function normalizeAccountId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(?:act_)?(\d+)$/);
  return match ? match[1] : null;
}

function getAccountIdFromUrl(): string | null {
  const url = new URL(window.location.href);
  const queryAccount = url.searchParams.get('account') || url.searchParams.get('account_id');
  const pathMatch = window.location.pathname.match(/\/account\/(act_\d+|\d+)/);
  return normalizeAccountId(queryAccount || pathMatch?.[1]);
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
    currentMonthSpend,
    currentDateRange, campaignNodesById, loadingCampaignTreeId, loadCampaignTree, loadAdPreview,
    updateEntityStatus, updateEntityBudget,
    hasEnvToken,
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
  const [accountOrder, setAccountOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_ORDER_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
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
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(MONTHLY_BUDGETS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed || {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value > 0)
      ) as Record<string, number>;
    } catch {
      return {};
    }
  });
  const [monthlyBudgetEditor, setMonthlyBudgetEditor] = useState<{
    accountId: string;
    name: string;
    currency: string;
    value: string;
  } | null>(null);
  const [draggingAccountId, setDraggingAccountId] = useState<string | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [clientAccountId] = useState<string | null>(() => getAccountIdFromUrl());
  const isClientLinkMode = Boolean(clientAccountId);
  const shouldProtectMainDashboard = Boolean(ENV_ADMIN_LOGIN && ENV_ADMIN_PASSWORD && !isClientLinkMode);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => (
    !shouldProtectMainDashboard || localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true'
  ));
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  // Auto-fetch accounts if token exists on load
  useEffect(() => {
    if (token && accounts.length === 0 && (isAdminAuthenticated || isClientLinkMode)) {
      fetchAccounts();
    }
  }, [accounts.length, fetchAccounts, isAdminAuthenticated, isClientLinkMode, token]);

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

  useEffect(() => {
    localStorage.setItem(ACCOUNT_ORDER_STORAGE_KEY, JSON.stringify(accountOrder));
  }, [accountOrder]);

  useEffect(() => {
    localStorage.setItem(MONTHLY_BUDGETS_STORAGE_KEY, JSON.stringify(monthlyBudgets));
  }, [monthlyBudgets]);

  useEffect(() => {
    if (accounts.length === 0) return;
    setAccountOrder((prev) => {
      const knownIds = new Set(accounts.map((account) => account.id));
      const preserved = prev.filter((id) => knownIds.has(id));
      const missing = accounts.map((account) => account.id).filter((id) => !preserved.includes(id));
      return [...preserved, ...missing];
    });
  }, [accounts]);

  useEffect(() => {
    if (!clientAccountId || accounts.length === 0) return;
    const match = accounts.find((account) => (
      normalizeAccountId(account.account_id) === clientAccountId
      || normalizeAccountId(account.id) === clientAccountId
    ));

    if (!match) {
      setError('Кабинет из ссылки не найден среди доступных кабинетов.');
      return;
    }

    if (selectedAccount?.id === match.id) return;
    fetchInsights(match, currentDateRange);
  }, [accounts, clientAccountId, currentDateRange, fetchInsights, selectedAccount?.id, setError]);

  const getAccountLabel = (accountId: string, fallbackName: string) => accountAliases[accountId]?.trim() || fallbackName;

  const visibleAccounts = useMemo(() => {
    const orderedAccounts = (accountOrder.length > 0 ? [...accounts].sort((a, b) => {
      const aIndex = accountOrder.indexOf(a.id);
      const bIndex = accountOrder.indexOf(b.id);
      const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return safeA - safeB;
    }) : accounts);

    if (visibleAccountIds.length === 0) return orderedAccounts;
    const visible = orderedAccounts.filter((account) => visibleAccountIds.includes(account.id));
    return visible.length > 0 ? visible : accounts;
  }, [accounts, accountOrder, visibleAccountIds]);

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

  const openMonthlyBudgetEditor = (account: { id: string; name: string; currency: string }) => {
    const currentBudget = monthlyBudgets[account.id];
    setMonthlyBudgetEditor({
      accountId: account.id,
      name: getAccountLabel(account.id, account.name),
      currency: account.currency,
      value: currentBudget ? String(currentBudget) : '',
    });
  };

  const saveMonthlyBudget = () => {
    if (!monthlyBudgetEditor) return;
    const parsed = Number(monthlyBudgetEditor.value.replace(',', '.'));
    setMonthlyBudgets((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(parsed) || parsed <= 0) {
        delete next[monthlyBudgetEditor.accountId];
        return next;
      }
      next[monthlyBudgetEditor.accountId] = parsed;
      return next;
    });
    setMonthlyBudgetEditor(null);
  };

  const getClientLink = (accountId: string) => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    url.searchParams.set('account', accountId);
    return url.toString();
  };

  const copyClientLink = async (accountId: string) => {
    const link = getClientLink(accountId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedAccountId(accountId);
      window.setTimeout(() => setCopiedAccountId(null), 1600);
    } catch {
      window.prompt('Ссылка на кабинет:', link);
    }
  };

  const handleAdminLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginForm.login === ENV_ADMIN_LOGIN && loginForm.password === ENV_ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
      setIsAdminAuthenticated(true);
      setLoginError(null);
      return;
    }

    setLoginError('Неверный логин или пароль.');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    setIsAdminAuthenticated(false);
    disconnect();
  };

  const moveAccount = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setAccountOrder((prev) => {
      const next = prev.length > 0 ? [...prev] : accounts.map((account) => account.id);
      const sourceIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
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
        {shouldProtectMainDashboard && !isAdminAuthenticated ? (
          <div className="flex min-h-screen items-center justify-center px-4">
            <form
              onSubmit={handleAdminLogin}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117]/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Вход в дашборд</h1>
                  <p className="text-sm text-gray-500">Основной кабинет закрыт паролем.</p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  value={loginForm.login}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, login: event.target.value }))}
                  placeholder="Логин"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Пароль"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {loginError && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Войти
              </button>
            </form>
          </div>
        ) : (
          <ApiSetup
            token={token}
            onSaveToken={saveToken}
            onFetchAccounts={fetchAccounts}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={fetchInsights}
            loading={loading}
            error={error}
            onDisconnect={shouldProtectMainDashboard ? handleAdminLogout : disconnect}
            onClearError={() => setError(null)}
            hideTokenLogin={hasEnvToken}
            hideDisconnect={isClientLinkMode}
          />
        )}

        {(isAdminAuthenticated || isClientLinkMode) && accounts.length > 0 && (
          <div className={`mx-auto flex gap-6 px-4 py-6 md:px-6 ${isClientLinkMode ? 'max-w-[1600px]' : 'max-w-[1800px]'}`}>
            {!isClientLinkMode && (
            <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-80 shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1018]/85 backdrop-blur-xl lg:flex lg:flex-col animate-sidebar-enter">
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
                <div className="border-b border-white/5 bg-white/[0.02] px-5 py-4 animate-settings-expand">
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

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {visibleAccounts.map((account, idx) => {
                  const isActive = selectedAccount?.id === account.id;
                  const balance = parseMoneyLike(account.balance, account.currency);
                  const billingThreshold = parseMoneyLike(account.billing_threshold, account.currency);
                  const billingMeta = getBillingMeta(account.account_status, balance, account.disable_reason);
                  return (
                    <div
                      key={account.id}
                      draggable
                      onDragStart={() => setDraggingAccountId(account.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggingAccountId) moveAccount(draggingAccountId, account.id);
                        setDraggingAccountId(null);
                      }}
                      onDragEnd={() => setDraggingAccountId(null)}
                      className={`mb-2 rounded-2xl border px-4 py-4 transition-all duration-200 animate-fade-up ${
                        isActive
                          ? 'border-indigo-500/30 bg-indigo-500/12 shadow-lg shadow-indigo-500/10'
                          : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.05]'
                      } ${draggingAccountId === account.id ? 'scale-[0.985] opacity-60' : ''} ${draggingAccountId && draggingAccountId !== account.id ? 'hover:-translate-y-1' : ''}`}
                      style={{ animationDelay: `${idx * 60}ms` }}
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
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300">
                              <span className="uppercase tracking-[0.18em] text-gray-500">Задолженность</span>
                              <span className={balance !== null && balance > 0 ? 'font-medium text-rose-300' : 'font-medium text-gray-300'}>
                                {formatCurrencyValue(balance !== null && balance > 0 ? balance : 0, account.currency)}
                              </span>
                            </span>
                            {billingThreshold !== null && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300">
                                <span className="uppercase tracking-[0.18em] text-gray-500">Порог</span>
                                <span className="font-medium text-gray-200">
                                  {formatCurrencyValue(billingThreshold, account.currency)}
                                </span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-300">
                              <span className="uppercase tracking-[0.18em] text-gray-500">План месяца</span>
                              <span className="font-medium text-gray-200">
                                {monthlyBudgets[account.id] ? formatCurrencyValue(monthlyBudgets[account.id], account.currency) : 'Не задан'}
                              </span>
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyClientLink(account.account_id)}
                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                            title="Скопировать клиентскую ссылку"
                          >
                            {copiedAccountId === account.account_id ? (
                              <Copy className="h-4 w-4 text-emerald-300" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openMonthlyBudgetEditor(account)}
                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                            title="Задать месячный бюджет"
                          >
                            <Wallet className="h-4 w-4" />
                          </button>
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
            )}

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
                  onUpdateEntityStatus={updateEntityStatus}
                  onUpdateEntityBudget={updateEntityBudget}
                  monthlyBudget={monthlyBudgets[selectedAccount.id] || null}
                  currentMonthSpend={currentMonthSpend}
                  onEditMonthlyBudget={() => openMonthlyBudgetEditor(selectedAccount)}
                />
              ) : (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="text-center space-y-4 animate-empty-bounce">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10">
                      {loading ? <Loader2 className="h-8 w-8 animate-spin text-indigo-400" /> : (
                        <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {isClientLinkMode ? 'Загружаем кабинет из ссылки' : `Найдено ${accounts.length} рекламных кабинетов`}
                    </h3>
                    <p className="text-gray-400">
                      {isClientLinkMode
                        ? 'Дашборд откроет только кабинет, указанный в ссылке.'
                        : 'Выбери нужный кабинет слева, и дашборд загрузит статистику за текущий период.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {monthlyBudgetEditor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl shadow-black/60">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-white">Месячный бюджет</h3>
                <p className="truncate text-sm text-gray-500">{monthlyBudgetEditor.name}</p>
              </div>
            </div>

            <label className="mb-2 block text-sm text-gray-400">
              План на месяц, {monthlyBudgetEditor.currency}
            </label>
            <input
              autoFocus
              value={monthlyBudgetEditor.value}
              onChange={(event) => setMonthlyBudgetEditor((prev) => (
                prev ? { ...prev, value: event.target.value } : prev
              ))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveMonthlyBudget();
                if (event.key === 'Escape') setMonthlyBudgetEditor(null);
              }}
              placeholder="Например, 3000"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-gray-500">
              Оставь поле пустым или введи 0, чтобы убрать план.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMonthlyBudgetEditor(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveMonthlyBudget}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
