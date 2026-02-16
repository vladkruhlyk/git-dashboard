import { useMemo, useState } from 'react';
import { Key, Loader2, ExternalLink, LogOut, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import type { AdAccount, DateRange } from '../types';

interface ApiSetupProps {
  token: string;
  onSaveToken: (token: string) => void;
  onFetchAccounts: (token?: string) => Promise<void>;
  accounts: AdAccount[];
  selectedAccount: AdAccount | null;
  onSelectAccount: (account: AdAccount, dateRange: DateRange) => void;
  loading: boolean;
  error: string | null;
  onDisconnect: () => void;
  onClearError: () => void;
}

export function ApiSetup({
  token, onSaveToken, onFetchAccounts, accounts,
  selectedAccount, onSelectAccount, loading, error,
  onDisconnect, onClearError,
}: ApiSetupProps) {
  const [inputToken, setInputToken] = useState(token);
  const [showDropdown, setShowDropdown] = useState(false);
  const [openedGroups, setOpenedGroups] = useState<Record<string, boolean>>({});
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      since: weekAgo.toISOString().split('T')[0],
      until: today.toISOString().split('T')[0],
    };
  });

  const handleConnect = async () => {
    onClearError();
    onSaveToken(inputToken);
    await onFetchAccounts(inputToken);
  };

  const handleSelectAccount = (account: AdAccount) => {
    setShowDropdown(false);
    onSelectAccount(account, dateRange);
  };

  const handleDateChange = (field: 'since' | 'until', value: string) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRange(newRange);
    if (selectedAccount) {
      onSelectAccount(selectedAccount, newRange);
    }
  };

  const presetRange = (days: number) => {
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - days);
    const newRange = {
      since: past.toISOString().split('T')[0],
      until: today.toISOString().split('T')[0],
    };
    setDateRange(newRange);
    if (selectedAccount) {
      onSelectAccount(selectedAccount, newRange);
    }
  };

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, AdAccount[]> = {};
    for (const account of accounts) {
      const parts = account.name.split('|');
      const groupName = parts.length > 1 ? parts[0].trim() : 'Без папки';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(account);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ru'));
  }, [accounts]);

  if (!token || accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/30 mb-6">
              <Key className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">FB/IG Ads Dashboard</h1>
            <p className="text-gray-400 text-lg">Подключите ваш Facebook Ads аккаунт</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d1117]/80 backdrop-blur-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Facebook Access Token
              </label>
              <input
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Вставьте ваш Access Token..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={!inputToken || loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-white font-medium hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Подключение...
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
                  Подключить
                </>
              )}
            </button>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="pt-2 border-t border-white/5">
              <p className="text-xs text-gray-500 leading-relaxed">
                Для получения Access Token перейдите в{' '}
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  Graph API Explorer
                </a>
                {' '}и выберите необходимые разрешения: ads_read, ads_management, read_insights
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 backdrop-blur-2xl bg-[#060a10]/80 border-b border-white/5">
      <div className="max-w-[1600px] mx-auto px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-3 mr-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Key className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg hidden sm:block">ADS</span>
          </div>

          {/* Account selector */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-all"
            >
              <span className="max-w-[200px] truncate">
                {selectedAccount ? selectedAccount.name : 'Выберите кабинет'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 z-50">
                {groupedAccounts.map(([groupName, groupAccounts]) => {
                  const isOpen = openedGroups[groupName] ?? true;
                  return (
                    <div key={groupName} className="border-b border-white/5 last:border-b-0">
                      <button
                        onClick={() => setOpenedGroups(prev => ({ ...prev, [groupName]: !isOpen }))}
                        className="w-full px-3 py-2 text-left text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 hover:bg-white/[0.03]"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Folder className="w-4 h-4" />
                        <span className="truncate">{groupName}</span>
                        <span className="ml-auto text-[10px] text-gray-500">{groupAccounts.length}</span>
                      </button>
                      {isOpen && groupAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          onClick={() => handleSelectAccount(acc)}
                          className={`w-full text-left pl-9 pr-4 py-3 hover:bg-white/5 transition-colors border-t border-white/5 ${
                            selectedAccount?.id === acc.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300'
                          }`}
                        >
                          <div className="font-medium text-sm">{acc.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">ID: {acc.account_id} · {acc.currency}</div>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.since}
              onChange={(e) => handleDateChange('since', e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all [color-scheme:dark]"
            />
            <span className="text-gray-500">—</span>
            <input
              type="date"
              value={dateRange.until}
              onChange={(e) => handleDateChange('until', e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none transition-all [color-scheme:dark]"
            />
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1">
            {[
              { label: '7д', days: 7 },
              { label: '14д', days: 14 },
              { label: '30д', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={days}
                onClick={() => presetRange(days)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Loading indicator */}
          {loading && (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          )}

          {/* Disconnect */}
          <button
            onClick={onDisconnect}
            className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Выйти</span>
          </button>
        </div>

        {error && (
          <div className="mt-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
