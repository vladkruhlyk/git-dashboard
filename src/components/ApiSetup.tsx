import { useMemo, useState } from 'react';
import { Key, Loader2, ExternalLink, LogOut, ChevronDown, ChevronRight, Folder, CalendarDays, Plus } from 'lucide-react';
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

type DateField = 'since' | 'until';

const GROUPS_STORAGE_KEY = 'account_custom_groups';
const GROUP_NAMES_STORAGE_KEY = 'account_custom_group_names';

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const weekNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU');
};

const parseDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const toISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthGrid = (monthDate: Date): Array<Date | null> => {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export function ApiSetup({
  token, onSaveToken, onFetchAccounts, accounts,
  selectedAccount, onSelectAccount, loading, error,
  onDisconnect, onClearError,
}: ApiSetupProps) {
  const [inputToken, setInputToken] = useState(token);
  const [showDropdown, setShowDropdown] = useState(false);
  const [openedGroups, setOpenedGroups] = useState<Record<string, boolean>>({});
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      since: toISO(weekAgo),
      until: toISO(today),
    };
  });
  const [openCalendarFor, setOpenCalendarFor] = useState<DateField | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => parseDate(dateRange.until));

  const [customGroups, setCustomGroups] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      return raw ? JSON.parse(raw) as Record<string, string> : {};
    } catch {
      return {};
    }
  });
  const [customGroupNames, setCustomGroupNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(GROUP_NAMES_STORAGE_KEY);
      return raw ? JSON.parse(raw) as string[] : [];
    } catch {
      return [];
    }
  });

  const persistGroups = (next: Record<string, string>) => {
    setCustomGroups(next);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
  };

  const handleConnect = async () => {
    onClearError();
    onSaveToken(inputToken);
    await onFetchAccounts(inputToken);
  };

  const handleSelectAccount = (account: AdAccount) => {
    setShowDropdown(false);
    onSelectAccount(account, dateRange);
  };

  const applyDateRange = (newRange: DateRange) => {
    setDateRange(newRange);
    if (selectedAccount) {
      onSelectAccount(selectedAccount, newRange);
    }
  };

  const setDateField = (field: DateField, value: string) => {
    const next = { ...dateRange, [field]: value };
    if (next.since > next.until) {
      if (field === 'since') next.until = value;
      else next.since = value;
    }
    applyDateRange(next);
  };

  const pickCalendarDate = (field: DateField, d: Date) => {
    setDateField(field, toISO(d));
    setOpenCalendarFor(null);
  };

  const presetRange = (days: number) => {
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - days);
    applyDateRange({ since: toISO(past), until: toISO(today) });
  };

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, AdAccount[]> = {};
    for (const account of accounts) {
      const custom = customGroups[account.id]?.trim();
      const parts = account.name.split('|');
      const fallbackGroup = parts.length > 1 ? parts[0].trim() : 'Без папки';
      const groupName = custom || fallbackGroup;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(account);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ru'));
  }, [accounts, customGroups]);

  const allGroupNames = useMemo(() => {
    const set = new Set<string>();
    groupedAccounts.forEach(([name]) => set.add(name));
    customGroupNames.forEach(name => set.add(name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [groupedAccounts, customGroupNames]);

  const createGroup = () => {
    const entered = window.prompt('Название новой папки');
    const groupName = entered?.trim();
    if (!groupName) return;
    setCustomGroupNames(prev => {
      const next = prev.includes(groupName) ? prev : [...prev, groupName];
      localStorage.setItem(GROUP_NAMES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setOpenedGroups(prev => ({ ...prev, [groupName]: true }));
  };

  const assignGroup = (account: AdAccount, nextGroup: string) => {
    const normalized = nextGroup.trim();
    const nextMap = { ...customGroups };
    if (!normalized) {
      delete nextMap[account.id];
    } else {
      nextMap[account.id] = normalized;
      setCustomGroupNames(prev => {
        const next = prev.includes(normalized) ? prev : [...prev, normalized];
        localStorage.setItem(GROUP_NAMES_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
    persistGroups(nextMap);
    setOpenedGroups(prev => ({ ...prev, [normalized]: true }));
  };

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

  const calendarDays = getMonthGrid(visibleMonth);
  const sinceDate = parseDate(dateRange.since);
  const untilDate = parseDate(dateRange.until);

  return (
    <div className="sticky top-0 z-50 backdrop-blur-2xl bg-[#060a10]/80 border-b border-white/5">
      <div className="max-w-[1600px] mx-auto px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 mr-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Key className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg hidden sm:block">ADS</span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition-all"
            >
              <span className="max-w-[220px] truncate">
                {selectedAccount ? selectedAccount.name : 'Выберите кабинет'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showDropdown && (
              <div className="absolute top-full left-0 mt-2 w-[420px] max-h-[520px] overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/50 z-50">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 sticky top-0 bg-[#0d1117] z-10">
                  <button
                    onClick={() => setShowGroupManager(v => !v)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                  >
                    {showGroupManager ? 'Закрыть управление' : 'Управлять папками'}
                  </button>
                  <button
                    onClick={createGroup}
                    className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Новая папка
                  </button>
                </div>

                {showGroupManager && (
                  <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] text-xs text-gray-400">
                    Для переноса кабинета выберите папку в выпадающем списке у нужной строки.
                  </div>
                )}

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
                        <div key={acc.id} className="border-t border-white/5">
                          <button
                            onClick={() => handleSelectAccount(acc)}
                            className={`w-full text-left pl-9 pr-4 py-3 hover:bg-white/5 transition-colors ${
                              selectedAccount?.id === acc.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300'
                            }`}
                          >
                            <div className="font-medium text-sm">{acc.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">ID: {acc.account_id} · {acc.currency}</div>
                          </button>
                          {showGroupManager && (
                            <div className="px-9 pb-3">
                              <select
                                value={customGroups[acc.id] || ''}
                                onChange={(e) => assignGroup(acc, e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-gray-300"
                              >
                                <option value="">Авто (по названию)</option>
                                {allGroupNames.map((name) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => {
                setVisibleMonth(parseDate(dateRange.since));
                setOpenCalendarFor(openCalendarFor === 'since' ? null : 'since');
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-all"
            >
              <CalendarDays className="w-4 h-4 text-indigo-300" />
              {formatDate(dateRange.since)}
            </button>
            <span className="text-gray-500">—</span>
            <button
              onClick={() => {
                setVisibleMonth(parseDate(dateRange.until));
                setOpenCalendarFor(openCalendarFor === 'until' ? null : 'until');
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-all"
            >
              <CalendarDays className="w-4 h-4 text-indigo-300" />
              {formatDate(dateRange.until)}
            </button>

            {openCalendarFor && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenCalendarFor(null)} />
                <div className="absolute top-full left-0 mt-2 z-50 w-[300px] rounded-2xl border border-white/10 bg-[#0d1117] p-3 shadow-2xl shadow-black/50">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      onClick={() => setVisibleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                    >
                      ←
                    </button>
                    <span className="text-sm text-white font-medium">
                      {monthNames[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                    </span>
                    <button
                      onClick={() => setVisibleMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                    >
                      →
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {weekNames.map((w) => (
                      <div key={w} className="text-center text-[11px] text-gray-500 py-1">{w}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      if (!day) return <div key={`empty-${idx}`} className="h-8" />;

                      const iso = toISO(day);
                      const isSelected = openCalendarFor === 'since' ? iso === dateRange.since : iso === dateRange.until;
                      const inRange = iso >= dateRange.since && iso <= dateRange.until;

                      return (
                        <button
                          key={iso}
                          onClick={() => pickCalendarDate(openCalendarFor, day)}
                          className={`h-8 rounded-lg text-xs transition-colors ${
                            isSelected
                              ? 'bg-indigo-500 text-white'
                              : inRange
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'text-gray-300 hover:bg-white/5'
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

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

          {loading && (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          )}

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
