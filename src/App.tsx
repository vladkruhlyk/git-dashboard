import { useEffect } from 'react';
import { CursorGlow } from './components/CursorGlow';
import { ApiSetup } from './components/ApiSetup';
import { Dashboard } from './components/Dashboard';
import { useFacebookApi } from './hooks/useFacebookApi';

export function App() {
  const {
    token, saveToken, accounts, selectedAccount,
    insights, campaigns, dailyData,
    loading, error,
    fetchAccounts, fetchInsights, disconnect, setError,
    selectedCampaignId, selectCampaign, clearCampaignSelection,
  } = useFacebookApi();

  // Auto-fetch accounts if token exists on load
  useEffect(() => {
    if (token && accounts.length === 0) {
      fetchAccounts();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        {selectedAccount && insights && (
          <Dashboard
            account={selectedAccount}
            insights={insights}
            campaigns={campaigns}
            dailyData={dailyData}
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={selectCampaign}
            onClearCampaign={clearCampaignSelection}
          />
        )}

        {/* Show account selection prompt after connecting */}
        {accounts.length > 0 && !selectedAccount && (
          <div className="flex items-center justify-center min-h-[60vh]">
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
                Выберите рекламный кабинет в меню сверху для просмотра статистики
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
