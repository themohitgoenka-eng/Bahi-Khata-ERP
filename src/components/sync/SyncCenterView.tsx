import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { syncEngine, SyncStatusSummary } from '../../services/syncEngine';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Zap,
  Copy,
  Check,
  Settings,
  Save,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../../services/supabaseClient';
import { supabaseSyncService } from '../../services/supabaseSyncService';
import { SUPABASE_SETUP_SQL, EXPECTED_TABLES, getSqlEditorUrl } from '../../services/supabaseSchema';

export const SyncCenterView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    isOnline,
    pendingSyncCount,
    refreshActiveData,
    showNotification,
  } = useApp();

  const [syncStatus, setSyncStatus] = useState<SyncStatusSummary | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Cloud State
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(supabaseConfig.url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(supabaseConfig.anonKey);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseConnectionStatus, setSupabaseConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  }>({ tested: true, success: true, message: 'Connected to Cloud Database' });
  const [isBulkPushing, setIsBulkPushing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showConfigDetails, setShowConfigDetails] = useState(false);

  // One-click DB setup state
  const [tableStatus, setTableStatus] = useState<{ table: string; exists: boolean }[]>([]);
  const [checkingTables, setCheckingTables] = useState(false);
  const [initializingTables, setInitializingTables] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  const loadStatus = async () => {
    const s = await syncEngine.getSyncStatus();
    setSyncStatus(s);
  };

  useEffect(() => {
    testSupabaseConnection().then((res) => {
      setSupabaseConnectionStatus({
        tested: true,
        success: res.success,
        message: res.message,
        latencyMs: res.latencyMs,
      });
    });
  }, []);

  useEffect(() => {
    loadStatus();
  }, [currentCompany, currentFiscalYear, pendingSyncCount]);

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    setSupabaseConfig(getSupabaseConfig());
    const res = await testSupabaseConnection();
    setSupabaseConnectionStatus({
      tested: true,
      success: res.success,
      message: res.message,
      latencyMs: res.latencyMs,
    });
    setIsTestingSupabase(false);
    if (res.success) {
      showNotification(res.message, 'success');
    } else {
      showNotification(res.message, 'error');
    }
  };

  const handleSaveSupabaseConfig = () => {
    saveSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    setSupabaseConfig(getSupabaseConfig());
    showNotification('Configuration saved.', 'success');
    handleTestSupabase();
  };

  const handleBulkUploadToSupabase = async () => {
    setIsBulkPushing(true);
    try {
      const res = await supabaseSyncService.pushAllDataToCloud();
      if (res.success) {
        showNotification(res.message, 'success');
        await refreshActiveData();
        await loadStatus();
      } else {
        showNotification(res.message, 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Upload failed', 'error');
    } finally {
      setIsBulkPushing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    showNotification('SQL Schema copied to clipboard! Paste it into your SQL Editor.', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleCheckTables = async () => {
    setCheckingTables(true);
    try {
      const status = await supabaseSyncService.checkAllTables();
      setTableStatus(status);
      setSetupChecked(true);
      const missing = status.filter((s) => !s.exists).length;
      if (missing === 0) {
        showNotification('All database tables are present and ready!', 'success');
      } else {
        showNotification(`${missing} table(s) missing. Use One-Click Init or run the SQL schema.`, 'info');
      }
    } catch (err: any) {
      showNotification(err.message || 'Could not check tables.', 'error');
    } finally {
      setCheckingTables(false);
    }
  };

  const handleInitTables = async () => {
    setInitializingTables(true);
    try {
      const res = await supabaseSyncService.initializeAllTables();
      if (res.success) {
        showNotification(res.message, 'success');
      } else {
        showNotification(res.message, res.rpcAvailable ? 'info' : 'error');
      }
      // Re-check status after attempting init
      const status = await supabaseSyncService.checkAllTables();
      setTableStatus(status);
      setSetupChecked(true);
    } catch (err: any) {
      showNotification(err.message || 'Initialization failed.', 'error');
    } finally {
      setInitializingTables(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await syncEngine.syncNow();
      showNotification(
        `Cloud sync complete! Synchronized ${res.syncedCount} queued transactions.`,
        'success'
      );
      await loadStatus();
      await refreshActiveData();
    } catch (err: any) {
      showNotification(err.message || 'Sync failed.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-2.5 max-w-7xl mx-auto">
      {/* Header with balanced height */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl shadow">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center justify-center font-bold shadow-inner shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2 leading-tight">
              Cloud Sync Center
            </h1>
            <p className="text-xs text-slate-400 leading-tight mt-0.5">
              Real-time cloud database synchronization, offline transaction queue &amp; connection status.
            </p>
          </div>
        </div>
      </div>

      {/* One-Click Database Setup Card */}
      <div className="bg-slate-900 border border-indigo-800/40 rounded-xl p-3.5 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white tracking-wide">Database Setup</h2>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                Check &amp; initialize all Supabase tables in one click.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCheckTables}
              disabled={checkingTables || initializingTables}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Check which tables exist"
            >
              {checkingTables ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{checkingTables ? 'Checking...' : 'Check Tables'}</span>
            </button>

            <button
              type="button"
              onClick={handleInitTables}
              disabled={initializingTables || checkingTables || !isOnline}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Auto-create all tables via bootstrap RPC"
            >
              {initializingTables ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              <span>{initializingTables ? 'Initializing...' : 'One-Click Init'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="Copy the full bootstrap SQL schema"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
            </button>

            <a
              href={getSqlEditorUrl(supabaseConfig.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="Open Supabase SQL Editor"
            >
              <ExternalLink className="w-3 h-3" />
              <span>SQL Editor</span>
            </a>
          </div>
        </div>

        {/* One-time setup wizard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
              <span className="text-[11px] font-bold text-white">Copy the SQL</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug mb-2">One-time only. Anon key can't create tables, so run it once in Supabase.</p>
            <button
              type="button"
              onClick={handleCopySql}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Copied!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-[11px] font-bold text-white">Run in SQL Editor</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug mb-2">Open your project's SQL Editor, paste &amp; click <b className="text-slate-200">Run</b>.</p>
            <a
              href={getSqlEditorUrl(supabaseConfig.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold transition cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open SQL Editor</span>
            </a>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
              <span className="text-[11px] font-bold text-white">Verify Tables</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug mb-2">Come back &amp; confirm all tables are present and ready.</p>
            <button
              type="button"
              onClick={handleCheckTables}
              disabled={checkingTables}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {checkingTables ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              <span>{checkingTables ? 'Checking...' : 'Check Tables'}</span>
            </button>
          </div>
        </div>

        {/* Guidance / status summary */}
        {(() => {
          const missingCount = tableStatus.filter((s) => !s.exists).length;
          const allReady = setupChecked && missingCount === 0 && tableStatus.length > 0;
          return (
            <>
              {!setupChecked && (
                <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <b className="text-slate-200">Tables not created yet?</b> Supabase does not allow
                    table creation with the anon key, so follow steps{' '}
                    <b className="text-indigo-300">1 → 2 → 3</b> above once. After that, everything
                    (including any new tables) syncs automatically — use{' '}
                    <b className="text-indigo-300">One-Click Init</b> for future tables.
                  </span>
                </div>
              )}

              {allReady && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>All {tableStatus.length} tables are present and ready for cloud sync.</span>
                </div>
              )}

              {setupChecked && missingCount > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {missingCount} of {tableStatus.length} tables missing. Try{' '}
                    <b className="text-indigo-300">One-Click Init</b>, or run the SQL schema in the editor.
                  </span>
                </div>
              )}

              {tableStatus.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                  {tableStatus.map((s) => (
                    <div
                      key={s.table}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-mono ${
                        s.exists
                          ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                      }`}
                      title={s.exists ? 'Table exists' : 'Table missing'}
                    >
                      {s.exists ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{s.table}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Cloud Database Integration Card */}
      <div className="bg-slate-900 border border-emerald-800/40 rounded-xl p-3.5 space-y-2.5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center justify-center font-bold shadow-inner shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-white tracking-wide">
                  Cloud Database
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    supabaseConnectionStatus.success
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      supabaseConnectionStatus.success ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  ></span>
                  {supabaseConnectionStatus.success ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestSupabase}
              disabled={isTestingSupabase}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="Test connection"
            >
              <RefreshCw className={`w-3 h-3 ${isTestingSupabase ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isTestingSupabase ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              type="button"
              onClick={handleBulkUploadToSupabase}
              disabled={isBulkPushing || !isOnline}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Upload data"
            >
              <Cloud className="w-3 h-3" />
              <span>{isBulkPushing ? 'Uploading Data...' : 'Upload Data'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopySql}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="Copy Database Tables SQL Script"
            >
              {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfigDetails((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="View or Edit API Credentials"
            >
              <Settings className="w-3 h-3 text-slate-400" />
              <span>{showConfigDetails ? 'Hide Keys' : 'API Credentials'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Supabase Credentials Form */}
        {showConfigDetails && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Database Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  placeholder="https://xyzabcdefg.supabase.co"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Publishable Key / Anon Key
                </label>
                <input
                  type="text"
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  placeholder="sb_publishable_... or eyJhbGciOi..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400">
                Credentials are saved securely in your browser local storage.
              </span>
              <button
                type="button"
                onClick={handleSaveSupabaseConfig}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-3 h-3" />
                <span>Save Credentials</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Engine Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-2">
                System Status : {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
              </h2>
              <p className="text-[11px] text-slate-400">
                All accounting entries persist locally first.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={syncing || !isOnline}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronizing...' : 'Sync Cloud Now'}
          </button>
        </div>

        {/* Sync Metric Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Pending Sync Items</span>
            <div className="text-sm font-mono font-bold text-amber-300 mt-0.5">
              {syncStatus?.pendingCount || 0} Transactions
            </div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Synced Transactions</span>
            <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
              {syncStatus?.syncedCount || 0} Records
            </div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Local IndexedDB Scope</span>
            <div className="text-xs font-mono font-bold text-sky-400 mt-0.5 truncate">
              {currentCompany?.id}_{currentFiscalYear?.id}
            </div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Last Sync Check</span>
            <div className="text-xs font-mono text-slate-300 mt-0.5">
              {syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString() : 'Just now'}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Sync Queue Monitor Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h2 className="text-xs font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            Background Sync Queue Monitor
          </h2>
          <span className="text-[11px] text-slate-400">
            {pendingSyncCount > 0 ? `${pendingSyncCount} pending transactions waiting to sync` : 'All transactions synchronized'}
          </span>
        </div>

        {pendingSyncCount === 0 ? (
          <div className="py-5 sm:py-6 px-4 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center">
            {/* First line: Green tick symbol */}
            <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mb-2.5 shadow-inner">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>

            {/* Second line: Text with larger font size */}
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base tracking-wide">
                Sync Queue is Clear
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                Complete Data Are Saved In Local And Synced To Cloud Database.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
              <span>{pendingSyncCount} local transactions queued for background sync.</span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncing || !isOnline}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-xs font-bold transition cursor-pointer"
            >
              Sync Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
