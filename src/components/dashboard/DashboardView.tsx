import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { accountingEngine, ProfitLossResult, BalanceSheetResult } from '../../services/accountingEngine';
import { inventoryEngine, ItemStockSummary } from '../../services/inventoryEngine';
import { bankingEngine, BankReconciliationSummary } from '../../services/bankingEngine';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { Voucher } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import {
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  Scale,
  Package,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Search,
  ArrowRight,
  ShieldCheck,
  Activity,
  Clock,
  ChevronDown,
  Layers,
  Sparkles,
  RotateCw,
  Check,
  X,
  Warehouse,
  Coins,
  CheckSquare,
  Square,
  Flame,
  Sun,
  Bell,
  Eye,
  Sliders,
  DollarSign,
  ArrowUp,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface QuickTask {
  id: string;
  title: string;
  category: string;
  time: string;
  done: boolean;
}

export const DashboardView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    openVoucherModal,
    setActiveTab,
    openOrSwitchTab,
    setGlobalSearchOpen,
    locations,
  } = useApp();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [profitLoss, setProfitLoss] = useState<ProfitLossResult | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null);
  const [stockSummary, setStockSummary] = useState<ItemStockSummary[]>([]);
  const [recentVouchers, setRecentVouchers] = useState<Voucher[]>([]);
  const [bankRecSummary, setBankRecSummary] = useState<BankReconciliationSummary | null>(null);
  const [voucherFilter, setVoucherFilter] = useState<'ALL' | 'SALES' | 'RECEIPT' | 'PAYMENT' | 'PURCHASE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Interactive Checklist Tasks
  const [tasks, setTasks] = useState<QuickTask[]>([
    { id: '1', title: 'Audit Morning Cash In Hand drawer', category: 'Cash', time: '09:30 AM', done: false },
    { id: '2', title: 'Verify GST e-Invoices & E-Way bills', category: 'Tax', time: '01:00 PM', done: false },
    { id: '3', title: 'Stock reconciliation for Main Godown', category: 'Inventory', time: '04:30 PM', done: true },
    { id: '4', title: 'Review outstanding customer receivables', category: 'Debtors', time: '06:00 PM', done: false },
  ]);

  // System Control Toggles (Smart Hub strip)
  const [systemControls, setSystemControls] = useState({
    autoBackup: true,
    realTimeAudit: true,
    seriesAutoNumber: true,
    cloudSync: true,
  });

  const toggleControl = (key: keyof typeof systemControls) => {
    setSystemControls((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const loadDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [pl, bs, stocks, vouchers, banks] = await Promise.all([
        accountingEngine.getProfitAndLoss(),
        accountingEngine.getBalanceSheet(),
        inventoryEngine.getStockSummary(),
        dbStorage.getVouchers(),
        dbStorage.getBankAccounts(),
      ]);

      setProfitLoss(pl);
      setBalanceSheet(bs);
      setStockSummary(stocks);
      setRecentVouchers(
        [...vouchers]
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      );

      if (banks.length > 0) {
        const rec = await bankingEngine.getReconciliationSummary(banks[0].id);
        setBankRecSummary(rec);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentCompany, currentFiscalYear]);

  // 7-day Weekly Calendar Strip calculation
  const weeklyCalendar = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sun, 1 is Mon...
    // Start from Monday (or 3 days before today)
    const startOfWeek = new Date(today);
    const diff = (currentDay === 0 ? -6 : 1) - currentDay; // adjust when day is sunday
    startOfWeek.setDate(today.getDate() + diff);

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isoStr = d.toISOString().split('T')[0];
      const isToday = d.toDateString() === today.toDateString();

      // Check if any vouchers exist for this day
      const hasVouchers = recentVouchers.some((v) => v.date === isoStr);

      days.push({
        dayName: dayNames[i],
        dayNum: d.getDate(),
        dateStr: isoStr,
        isToday,
        hasVouchers,
      });
    }
    return days;
  }, [recentVouchers]);

  // Selected date filter on calendar (null = all)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Totals & Metrics
  const cashTotal = balanceSheet?.assets.currentAssets.cashInHand.reduce((s, c) => s + c.amount, 0) || 0;
  const bankTotal = balanceSheet?.assets.currentAssets.bankAccounts.reduce((s, b) => s + b.amount, 0) || 0;
  const debtorsTotal = balanceSheet?.assets.currentAssets.sundryDebtors.reduce((s, d) => s + d.amount, 0) || 0;
  const creditorsTotal = balanceSheet?.liabilities.currentLiabilities.sundryCreditors.reduce((s, c) => s + c.amount, 0) || 0;
  const stockValuation = profitLoss?.closingStockValue || 0;
  const netProfit = profitLoss?.netProfit || 0;
  const netSales = profitLoss?.netSales || 0;

  const lowStockItems = stockSummary.filter((s) => s.status === 'LOW_STOCK' || s.status === 'OUT_OF_STOCK');
  const outOfStockItems = stockSummary.filter((s) => s.status === 'OUT_OF_STOCK');
  const nominalStockCount = Math.max(0, stockSummary.length - lowStockItems.length);

  // Filtered vouchers based on tab, calendar date & search query
  const filteredVouchers = recentVouchers.filter((v) => {
    const matchesFilter = voucherFilter === 'ALL' || v.voucherType === voucherFilter;
    const matchesDate = !selectedCalendarDate || v.date === selectedCalendarDate;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesFilter && matchesDate;
    const matchesSearch =
      v.voucherNumber.toLowerCase().includes(q) ||
      (v.narration && v.narration.toLowerCase().includes(q)) ||
      v.lines.some((l) => l.ledgerName.toLowerCase().includes(q));
    return matchesFilter && matchesDate && matchesSearch;
  });

  // Calculate liquidity split percentages
  const totalLiquidity = Math.max(1, cashTotal + bankTotal);
  const cashPercent = Math.min(100, Math.max(0, Math.round((cashTotal / totalLiquidity) * 100)));
  const bankPercent = 100 - cashPercent;

  // Formatted Live Time
  const timeHours = currentTime.getHours().toString().padStart(2, '0');
  const timeMinutes = currentTime.getMinutes().toString().padStart(2, '0');
  const timeSeconds = currentTime.getSeconds().toString().padStart(2, '0');
  const dateFormatted = currentTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-[#2588E8]/20 animate-ping"></div>
            <div className="w-14 h-14 border-2 border-[#2588E8] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-sm text-[#2588E8] font-semibold tracking-wide font-mono">
            Loading Tablet Operations Hub &amp; Live Telemetry...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen -m-4 sm:-m-6 lg:-m-8 p-3 sm:p-5 lg:p-6 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#FFFFFF] overflow-hidden font-sans select-none">
      {/* Ambient Frosted Glow Lighting (Matching Modern Tablet Hub) */}
      <div className="absolute -top-24 left-1/5 w-[36rem] h-[36rem] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl/25 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/3 -right-20 w-[32rem] h-[32rem] bg-[rgba(18,48,76,0.22)] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-20 left-1/3 w-[36rem] h-[36rem] bg-[#0D2B4A]/20 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[1720px] mx-auto space-y-5">
        
        {/* ========================================================= */}
        {/* TOP STATUS & GREETING BAR (Tablet Header with Clock & Pill) */}
        {/* ========================================================= */}
        <header className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Greeting & Company Branding */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2588E8] to-[#1D68B2] p-0.5 shadow-lg shadow-[#2588E8]/20 flex items-center justify-center">
              <div className="w-full h-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-[14px] flex items-center justify-center text-[#2588E8] font-bold font-mono text-lg">
                {currentCompany?.name ? currentCompany.name.charAt(0).toUpperCase() : 'B'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Welcome, {currentCompany?.name || 'Bahi Khata Enterprise'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#2588E8]/15 text-[#2588E8] border border-[#2588E8]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2588E8] animate-pulse"></span>
                  Active Node
                </span>
              </div>
              <p className="text-xs text-[#7F98AE] mt-0.5">
                Central Operations Console &bull; {currentFiscalYear?.name || 'FY 2026-27'}
              </p>
            </div>
          </div>

          {/* Center/Right Telemetry: Status Pills + Live Clock + Fast Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* System Status Pill */}
            <div className="hidden lg:flex items-center gap-2 bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-3.5 py-2 rounded-2xl text-xs text-[#B7C9D9]">
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-white">Cloud Sync Ready</span>
              <span className="text-[#7F98AE]">&bull;</span>
              <span className="text-[#2588E8] font-mono">0 Pending</span>
            </div>

            {/* Live Clock Display (Matches Reference Image Time Header) */}
            <div className="flex items-center gap-3 bg-[rgba(18,48,76,0.60)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] px-4 py-2 rounded-2xl shadow-inner">
              <Clock className="w-4 h-4 text-[#2588E8]" />
              <div className="leading-tight">
                <div className="text-base sm:text-lg font-black font-mono text-white tracking-wider flex items-center">
                  <span>{timeHours}</span>
                  <span className="animate-pulse text-[#2588E8] mx-0.5">:</span>
                  <span>{timeMinutes}</span>
                  <span className="text-xs text-[#7F98AE] ml-1 font-normal">{timeSeconds}s</span>
                </div>
                <div className="text-[10px] text-[#7F98AE] uppercase tracking-wide font-medium">
                  {dateFormatted}
                </div>
              </div>
            </div>

            {/* Action Buttons: Refresh & Search */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadDashboardData(true)}
                disabled={refreshing}
                title="Refresh Live Telemetry"
                className="p-2.5 bg-[#0B233C] hover:bg-[#123356] active:scale-95 text-[#2588E8] border border-[rgba(112,185,245,0.25)] rounded-2xl transition cursor-pointer shadow-md"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setGlobalSearchOpen?.(true)}
                title="Global Search (Ctrl+K)"
                className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0B233C] hover:bg-[#123356] active:scale-95 text-white border border-[rgba(112,185,245,0.25)] rounded-2xl transition cursor-pointer text-xs font-semibold shadow-md"
              >
                <Sparkles className="w-4 h-4 text-[#2588E8]" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* TOP FLOATING GLASS KPI METRIC CARDS (Matches Reference UI) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Net Sales / Revenue */}
          <div
            onClick={() => setActiveTab('sales_register')}
            className="bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[20px] p-4 sm:p-5 transition-all duration-180 hover:-translate-y-1 hover:border-[rgba(100,190,255,0.45)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#39A7FF]/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#B7C9D9] uppercase tracking-wider">Revenue / Sales</span>
              <div className="w-8 h-8 rounded-xl bg-[#39A7FF]/15 border border-[#39A7FF]/30 flex items-center justify-center text-[#39A7FF]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-[#F1F7FC] tracking-tight">
              ₹{netSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#55D68A] font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" /> Active Turnover
              </span>
              <span className="text-[#7F98AE]">FY 2026-27</span>
            </div>
            {/* Sparkline curve */}
            <div className="mt-2.5 h-7 w-full overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                <path d="M0,20 Q25,8 50,15 T100,4" fill="none" stroke="#39A7FF" strokeWidth="2" strokeLinecap="round" />
                <path d="M0,20 Q25,8 50,15 T100,4 L100,24 L0,24 Z" fill="rgba(57,167,255,0.12)" />
              </svg>
            </div>
          </div>

          {/* 2. Net Operating Profit */}
          <div
            onClick={() => setActiveTab('profit_loss')}
            className="bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[20px] p-4 sm:p-5 transition-all duration-180 hover:-translate-y-1 hover:border-[rgba(85,214,138,0.45)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#55D68A]/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#B7C9D9] uppercase tracking-wider">Operating Profit</span>
              <div className="w-8 h-8 rounded-xl bg-[#55D68A]/15 border border-[#55D68A]/30 flex items-center justify-center text-[#55D68A]">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <div className={`mt-2 text-xl sm:text-2xl font-bold font-mono tracking-tight ${netProfit >= 0 ? 'text-[#55D68A]' : 'text-[#FF647C]'}`}>
              {netProfit >= 0 ? '+' : '-'}₹{Math.abs(netProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#55D68A] font-semibold">Net Operating Surplus</span>
              <span className="text-[#7F98AE]">P&amp;L Audited</span>
            </div>
            {/* Sparkline curve */}
            <div className="mt-2.5 h-7 w-full overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                <path d="M0,18 Q30,5 60,12 T100,2" fill="none" stroke="#55D68A" strokeWidth="2" strokeLinecap="round" />
                <path d="M0,18 Q30,5 60,12 T100,2 L100,24 L0,24 Z" fill="rgba(85,214,138,0.12)" />
              </svg>
            </div>
          </div>

          {/* 3. Closing Stock Valuation */}
          <div
            onClick={() => setActiveTab('stock_summary')}
            className="bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[20px] p-4 sm:p-5 transition-all duration-180 hover:-translate-y-1 hover:border-[rgba(155,124,255,0.45)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#9B7CFF]/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#B7C9D9] uppercase tracking-wider">Stock Valuation</span>
              <div className="w-8 h-8 rounded-xl bg-[#9B7CFF]/15 border border-[#9B7CFF]/30 flex items-center justify-center text-[#9B7CFF]">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-[#F1F7FC] tracking-tight">
              ₹{stockValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#9B7CFF] font-semibold">{stockSummary.length} Catalog Items</span>
              <span className="text-[#7F98AE]">Godowns</span>
            </div>
            {/* Sparkline curve */}
            <div className="mt-2.5 h-7 w-full overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                <path d="M0,15 Q35,22 70,8 T100,10" fill="none" stroke="#9B7CFF" strokeWidth="2" strokeLinecap="round" />
                <path d="M0,15 Q35,22 70,8 T100,10 L100,24 L0,24 Z" fill="rgba(155,124,255,0.12)" />
              </svg>
            </div>
          </div>

          {/* 4. Sundry Debtors (Receivables) */}
          <div
            onClick={() => setActiveTab('outstanding')}
            className="bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[20px] p-4 sm:p-5 transition-all duration-180 hover:-translate-y-1 hover:border-[rgba(82,199,255,0.45)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#52C7FF]/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#B7C9D9] uppercase tracking-wider">Receivables (Debtors)</span>
              <div className="w-8 h-8 rounded-xl bg-[#52C7FF]/15 border border-[#52C7FF]/30 flex items-center justify-center text-[#52C7FF]">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-[#F1F7FC] tracking-tight">
              ₹{debtorsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#52C7FF] font-semibold">Customer Dues</span>
              <span className="text-[#7F98AE]">Outstanding</span>
            </div>
            {/* Sparkline curve */}
            <div className="mt-2.5 h-7 w-full overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                <path d="M0,12 Q40,4 75,16 T100,6" fill="none" stroke="#52C7FF" strokeWidth="2" strokeLinecap="round" />
                <path d="M0,12 Q40,4 75,16 T100,6 L100,24 L0,24 Z" fill="rgba(82,199,255,0.12)" />
              </svg>
            </div>
          </div>

          {/* 5. Liquid Cash & Bank */}
          <div
            onClick={() => setActiveTab('cash_book')}
            className="bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[20px] p-4 sm:p-5 transition-all duration-180 hover:-translate-y-1 hover:border-[rgba(242,201,76,0.45)] cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#F2C94C]/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#B7C9D9] uppercase tracking-wider">Total Liquid Funds</span>
              <div className="w-8 h-8 rounded-xl bg-[#F2C94C]/15 border border-[#F2C94C]/30 flex items-center justify-center text-[#F2C94C]">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold font-mono text-[#F1F7FC] tracking-tight">
              ₹{(cashTotal + bankTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#F2C94C] font-semibold">Cash + Bank</span>
              <span className="text-[#7F98AE]">{cashPercent}% Cash</span>
            </div>
            {/* Sparkline curve */}
            <div className="mt-2.5 h-7 w-full overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                <path d="M0,18 Q20,10 50,14 T100,5" fill="none" stroke="#F2C94C" strokeWidth="2" strokeLinecap="round" />
                <path d="M0,18 Q20,10 50,14 T100,5 L100,24 L0,24 Z" fill="rgba(242,201,76,0.12)" />
              </svg>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MAIN 3-COLUMN SMART WIDGET GRID (Matches Reference Tablet) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ======================================================= */}
          {/* LEFT COLUMN: Today's Focus & Calendar (4 cols) */}
          {/* ======================================================= */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 shadow-2xl space-y-4">
              {/* Header Title with Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2588E8]/15 border border-[#2588E8]/30 flex items-center justify-center text-[#2588E8]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Today's Focus &amp; Priorities
                    </h2>
                    <p className="text-[11px] text-[#7F98AE]">Live operational schedule &amp; priorities</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8] border border-[#2588E8]/30">
                  {tasks.filter((t) => !t.done).length} Pending
                </span>
              </div>

              {/* Highlight Card: Primary Focus (Hero banner card) */}
              <div className="bg-gradient-to-br from-[#0A2036] to-[#07182A] border border-[#2588E8]/30 rounded-2xl p-4 shadow-lg space-y-2 relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#2588E8]/10 rounded-full blur-2xl group-hover:scale-125 transition"></div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#2588E8] bg-[#2588E8]/15 px-2 py-0.5 rounded-md border border-[#2588E8]/20">
                    Primary Operational Focus
                  </span>
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-white leading-snug">
                  Daily Physical Cash &amp; Stock Verification
                </div>
                <div className="flex items-center justify-between text-xs text-[#2588E8] pt-1">
                  <span>Liquid Cash In Hand:</span>
                  <span className="font-mono font-bold text-[#F2C94C]">
                    ₹{cashTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Scheduled Milestones Timeline */}
              <div className="space-y-2.5 pt-1">
                <div className="text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">
                  Today's Milestones
                </div>

                {/* Milestone 1 */}
                <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] p-3 rounded-2xl flex items-center justify-between transition">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-[#2588E8] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-1 rounded-lg">
                      09:30 AM
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">Opening Cash &amp; Counter Balance</div>
                      <div className="text-[10px] text-[#7F98AE]">Safe drawer count &amp; petty cash check</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#2588E8]" />
                </div>

                {/* Milestone 2 */}
                <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] p-3 rounded-2xl flex items-center justify-between transition">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-500/20">
                      01:30 PM
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">Receivables Follow-up (Debtors)</div>
                      <div className="text-[10px] text-[#7F98AE]">₹{debtorsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} outstanding</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('outstanding')}
                    className="text-[10px] font-semibold text-[#2588E8] hover:text-white bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-1 rounded-lg transition cursor-pointer"
                  >
                    View
                  </button>
                </div>

                {/* Milestone 3 */}
                <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] p-3 rounded-2xl flex items-center justify-between transition">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold text-[#7F98AE] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-1 rounded-lg">
                      06:00 PM
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">Day Book Closing &amp; Bank BRS</div>
                      <div className="text-[10px] text-[#7F98AE]">
                        {bankRecSummary?.isReconciled ? 'Reconciled' : 'Pending reconciliation'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('bank_reconciliation')}
                    className="text-[10px] font-semibold text-[#2588E8] hover:text-white bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-1 rounded-lg transition cursor-pointer"
                  >
                    BRS
                  </button>
                </div>
              </div>

              {/* Horizontal 7-Day Calendar Strip ("This Week") */}
              <div className="pt-2 border-t border-[rgba(112,185,245,0.25)] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">
                    This Week (Schedule &amp; Activity)
                  </span>
                  {selectedCalendarDate && (
                    <button
                      onClick={() => setSelectedCalendarDate(null)}
                      className="text-[10px] text-[#2588E8] hover:underline cursor-pointer"
                    >
                      Clear date filter
                    </button>
                  )}
                </div>

                {/* The 7 Day Pills */}
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {weeklyCalendar.map((d) => {
                    const isSelected = selectedCalendarDate === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        onClick={() =>
                          setSelectedCalendarDate(isSelected ? null : d.dateStr)
                        }
                        className={`py-2 px-1 rounded-2xl transition cursor-pointer flex flex-col items-center justify-center relative ${
                          d.isToday
                            ? 'bg-[#2588E8] text-[#06111F] font-bold shadow-lg shadow-[#2588E8]/20'
                            : isSelected
                            ? 'bg-[#123356] text-white border border-[#2588E8]/50 ring-1 ring-[#2588E8]'
                            : 'bg-[rgba(18,48,76,0.42)] hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#B7C9D9] border border-[rgba(112,185,245,0.25)]'
                        }`}
                      >
                        <span className={`text-[10px] uppercase ${d.isToday ? 'text-[#06111F] font-black' : 'text-[#7F98AE]'}`}>
                          {d.dayName}
                        </span>
                        <span className="text-sm font-mono font-bold mt-0.5">
                          {d.dayNum}
                        </span>

                        {/* Dot indicator if transactions exist for that day (matches reference screenshot) */}
                        <div className="mt-1 flex items-center justify-center h-1.5">
                          {d.hasVouchers ? (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                d.isToday ? 'bg-[rgba(8,24,40,0.50)] backdrop-blur-xl' : 'bg-[#2588E8]'
                              }`}
                            ></span>
                          ) : (
                            <span className="w-1.5 h-1.5 opacity-0"></span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* CENTER COLUMN: Action Tasks & Feed (4 cols) */}
          {/* ======================================================= */}
          <div className="lg:col-span-4 space-y-5">
            {/* Urgent Alerts / Notifications */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Action Items &amp; System Alerts
                    </h2>
                    <p className="text-[11px] text-[#7F98AE]">Live operational signals needing attention</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/30">
                  {lowStockItems.length > 0 ? `${lowStockItems.length} Alerts` : 'All Clear'}
                </span>
              </div>

              {/* Alert 1: Low Stock Reorder */}
              {lowStockItems.length > 0 ? (
                <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-amber-500/25 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          Reorder Alert ({lowStockItems.length} Items)
                        </div>
                        <div className="text-[10px] text-[#7F98AE]">
                          {lowStockItems.slice(0, 2).map((i) => i.name).join(', ')}
                          {lowStockItems.length > 2 ? ` +${lowStockItems.length - 2} more` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Quick Action Buttons (Tick / View) */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[rgba(112,185,245,0.25)]">
                    <button
                      onClick={() => openVoucherModal('PURCHASE')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(13,38,62,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#2588E8] text-[11px] font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Purchase Order (F9)</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('stock_summary')}
                      className="p-1.5 rounded-xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#7F98AE] hover:text-white transition cursor-pointer"
                      title="View Stock Summary"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[rgba(18,48,76,0.38)] border border-[rgba(112,185,245,0.25)] rounded-2xl p-3 text-xs text-[#7F98AE] flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#2588E8]" />
                  <span>All inventory items are currently above reorder levels.</span>
                </div>
              )}

              {/* Alert 2: Bank Statement Reconciliation */}
              <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#2588E8]/15 text-[#2588E8] flex items-center justify-center shrink-0">
                      <Landmark className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Bank BRS Status</div>
                      <div className="text-[10px] text-[#7F98AE]">
                        {bankRecSummary
                          ? `${bankRecSummary.matchedCount} matched • ${bankRecSummary.unmatchedStatementCount} pending`
                          : 'No bank reconciliation active'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      bankRecSummary?.isReconciled
                        ? 'bg-[#2588E8]/15 text-[#2588E8] border-[#2588E8]/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {bankRecSummary?.isReconciled ? 'Balanced' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[rgba(112,185,245,0.25)]">
                  <button
                    onClick={() => setActiveTab('bank_reconciliation')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[rgba(13,38,62,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#2588E8] text-[11px] font-bold transition cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Open BRS</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Checklist (Tasks) */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2588E8]/15 border border-[#2588E8]/30 flex items-center justify-center text-[#2588E8]">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Daily Checklist &amp; Operational Tasks
                    </h2>
                    <p className="text-[11px] text-[#7F98AE]">Tap task to mark completed</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#7F98AE]">
                  {tasks.filter((t) => t.done).length}/{tasks.length} Done
                </span>
              </div>

              {/* Task Items */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      task.done
                        ? 'bg-[rgba(18,48,76,0.28)] border-[rgba(112,185,245,0.12)] opacity-60'
                        : 'bg-[rgba(18,48,76,0.52)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-[#2588E8] shrink-0">
                        {task.done ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2588E8]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#7F98AE]" />
                        )}
                      </button>
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            task.done ? 'line-through text-[#7F98AE]' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="text-[10px] text-[#7F98AE] flex items-center gap-1.5 mt-0.5">
                          <span className="text-[#2588E8] font-medium">{task.category}</span>
                          <span>&bull;</span>
                          <span>{task.time}</span>
                        </div>
                      </div>
                    </div>
                    {task.done && (
                      <span className="text-[10px] text-[#2588E8] font-bold">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ======================================================= */}
          {/* RIGHT COLUMN: Quick Launcher & Key Metrics (4 cols) */}
          {/* ======================================================= */}
          <div className="lg:col-span-4 space-y-5">
            {/* Quick Launcher Tiles (Grid of 4 to 6 Fast Actions) */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2588E8]/15 border border-[#2588E8]/30 flex items-center justify-center text-[#2588E8]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Quick Transaction Launcher
                    </h2>
                    <p className="text-[11px] text-[#7F98AE]">Fast accounting entry shortcuts</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#7F98AE]">Keyboard Ready</span>
              </div>

              {/* 6 Quick Action Grid Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Sale Bill */}
                <button
                  onClick={() => openVoucherModal('SALES')}
                  className="group p-3.5 rounded-2xl bg-gradient-to-br from-[#0A2036] to-[#0A2036] hover:from-[#123356] hover:to-[#0D2B4A] border border-[#2588E8]/30 hover:border-[#2588E8]/60 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[#2588E8]/20 text-[#2588E8] flex items-center justify-center group-hover:scale-110 transition">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#2588E8] border border-[#2588E8]/30">
                      F8
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#2588E8] transition">
                    + Sale Bill
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Create tax invoice</div>
                </button>

                {/* 2. Receipt */}
                <button
                  onClick={() => openVoucherModal('RECEIPT')}
                  className="group p-3.5 rounded-2xl bg-gradient-to-br from-[#0A2036] to-[#0A2036] hover:from-[#123356] hover:to-[#0D2B4A] border border-[rgba(112,185,245,0.25)] hover:border-[#2588E8]/60 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(57,167,255,0.15)] text-[#2588E8] flex items-center justify-center group-hover:scale-110 transition">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#2588E8] border border-[rgba(37, 136, 232, 0.20)]">
                      F6
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#2588E8] transition">
                    + Receipt
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Customer payment</div>
                </button>

                {/* 3. Payment */}
                <button
                  onClick={() => openVoucherModal('PAYMENT')}
                  className="group p-3.5 rounded-2xl bg-[rgba(18,48,76,0.60)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-rose-500/20 hover:border-rose-500/50 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-[#FF647C] flex items-center justify-center group-hover:scale-110 transition">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#FF647C] border border-rose-500/30">
                      F5
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#FF647C] transition">
                    + Payment
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Vendor disbursement</div>
                </button>

                {/* 4. Purchase */}
                <button
                  onClick={() => openVoucherModal('PURCHASE')}
                  className="group p-3.5 rounded-2xl bg-[rgba(18,48,76,0.60)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/50 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#F2C94C] flex items-center justify-center group-hover:scale-110 transition">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#F2C94C] border border-amber-500/30">
                      F9
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#F2C94C] transition">
                    + Purchase
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Vendor inward bill</div>
                </button>

                {/* 5. Stock Journal */}
                <button
                  onClick={() => openOrSwitchTab('stock_journal')}
                  className="group p-3.5 rounded-2xl bg-[rgba(18,48,76,0.60)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[#2588E8]/40 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(112,185,245,0.12)] text-[#2588E8] flex items-center justify-center group-hover:scale-110 transition">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#7F98AE]">
                      Inv
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#2588E8] transition">
                    Stock Journal
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Transfer &amp; wastage</div>
                </button>

                {/* 6. Cash Book */}
                <button
                  onClick={() => openOrSwitchTab('cash_book')}
                  className="group p-3.5 rounded-2xl bg-[rgba(18,48,76,0.60)] backdrop-blur-xl hover:bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[#2588E8]/40 text-left transition transform active:scale-95 shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[rgba(37, 136, 232, 0.12)] text-[#2588E8] flex items-center justify-center group-hover:scale-110 transition">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[rgba(8,24,40,0.50)] backdrop-blur-xl text-[#7F98AE]">
                      Ledger
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-xs text-white group-hover:text-[#2588E8] transition">
                    Cash Book
                  </div>
                  <div className="text-[10px] text-[#7F98AE]">Daily cash summary</div>
                </button>
              </div>
            </div>

            {/* Financial Health Snapshot Card */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Financial Health &amp; Operating Margin
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    netProfit >= 0
                      ? 'bg-[#2588E8]/15 text-[#2588E8] border-[#2588E8]/30'
                      : 'bg-rose-500/15 text-[#FF647C] border-rose-500/30'
                  }`}
                >
                  {netProfit >= 0 ? '+ Net Surplus' : '- Deficit'}
                </span>
              </div>

              {/* Net Margin Figure */}
              <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl p-3.5 rounded-2xl border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#7F98AE] uppercase font-semibold">Net Operating Profit</div>
                  <div className="text-xl font-black font-mono text-white mt-0.5">
                    ₹{Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    netProfit >= 0 ? 'bg-[#2588E8]/15 text-[#2588E8]' : 'bg-rose-500/15 text-[#FF647C]'
                  }`}
                >
                  <Scale className="w-5 h-5" />
                </div>
              </div>

              {/* Debtors vs Creditors Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#7F98AE]">Debtors: ₹{debtorsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[#7F98AE]">Creditors: ₹{creditorsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[rgba(8,24,40,0.50)] backdrop-blur-xl overflow-hidden flex">
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((debtorsTotal / Math.max(1, debtorsTotal + creditorsTotal)) * 100))}%`,
                    }}
                    className="bg-[#2588E8] h-full"
                  ></div>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((creditorsTotal / Math.max(1, debtorsTotal + creditorsTotal)) * 100))}%`,
                    }}
                    className="bg-rose-400 h-full"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RECENT VOUCHER AUDIT FEED (Full-Width Expandable Section) */}
        {/* ========================================================= */}
        <section className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(112,185,245,0.25)] pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Recent Registered Vouchers</span>
                {selectedCalendarDate && (
                  <span className="text-xs font-mono font-normal text-[#2588E8] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2.5 py-0.5 rounded-full border border-[#2588E8]/30">
                    Filtered: {selectedCalendarDate}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#7F98AE]">
                Double-entry transaction audit log in active financial year
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-1.5 rounded-2xl border border-[rgba(112,185,245,0.25)] text-xs">
              {(['ALL', 'SALES', 'RECEIPT', 'PAYMENT', 'PURCHASE'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVoucherFilter(t)}
                  className={`px-3 py-1 rounded-xl font-medium transition text-xs cursor-pointer ${
                    voucherFilter === t
                      ? 'bg-[#2588E8] text-[#06111F] font-bold shadow-sm'
                      : 'text-[#B7C9D9] hover:text-white hover:bg-[rgba(37, 136, 232, 0.10)]'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Vouchers List */}
          {filteredVouchers.length === 0 ? (
            <div className="py-10 text-center text-[#7F98AE] font-mono text-xs">
              No vouchers found matching the filter{selectedCalendarDate ? ` for date ${selectedCalendarDate}` : ''}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredVouchers.slice(0, 8).map((v) => {
                const isReceipt = v.voucherType === 'RECEIPT';
                const isPayment = v.voucherType === 'PAYMENT';
                const isSales = v.voucherType === 'SALES';

                const badgeColor = isSales
                  ? 'bg-[#2588E8]/15 text-[#2588E8] border-[#2588E8]/30'
                  : isReceipt
                  ? 'bg-[rgba(85,214,138,0.15)] text-[#55D68A] border-[rgba(85,214,138,0.3)]'
                  : isPayment
                  ? 'bg-rose-500/15 text-[#FF647C] border-rose-500/30'
                  : 'bg-amber-500/15 text-[#F2C94C] border-amber-500/30';

                return (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-2xl bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[rgba(112,185,245,0.25)] transition flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] flex items-center justify-center shrink-0">
                        {isSales ? (
                          <TrendingUp className="w-4 h-4 text-[#2588E8]" />
                        ) : isReceipt ? (
                          <ArrowDownRight className="w-4 h-4 text-[#55D68A]" />
                        ) : isPayment ? (
                          <ArrowUpRight className="w-4 h-4 text-[#FF647C]" />
                        ) : (
                          <Package className="w-4 h-4 text-[#F2C94C]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs truncate">
                          {v.lines.find((l) => l.ledgerName)?.ledgerName || v.narration || 'General Voucher'}
                        </div>
                        <div className="text-[11px] text-[#7F98AE] font-mono flex items-center gap-2 mt-0.5">
                          <span className="text-[#2588E8]">#{v.voucherNumber}</span>
                          <span>&bull;</span>
                          <span>{formatDateDisplay(v.date)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-white">
                        ₹{v.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase mt-1 ${badgeColor}`}>
                        {v.voucherType}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <button
              onClick={() => setActiveTab('vouchers')}
              className="text-xs font-semibold text-[#2588E8] hover:underline flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>View full Voucher Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-[#7F98AE] font-mono">
              Total {filteredVouchers.length} records in active memory
            </span>
          </div>
        </section>

        {/* ========================================================= */}
        {/* BOTTOM WIDE CONTROL STRIP (Smart Hub Telemetry & Sliders) */}
        {/* ========================================================= */}
        <section className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl backdrop-blur-2xl border border-[rgba(112,185,245,0.25)] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[rgba(112,185,245,0.25)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#2588E8]/15 border border-[#2588E8]/30 flex items-center justify-center text-[#2588E8]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Business Pulse &amp; Godown Telemetry
                </h3>
                <p className="text-[11px] text-[#7F98AE]">Live multi-node storage capacity and system telemetry</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8] border border-[#2588E8]/30">
              4/4 Nodes Active
            </span>
          </div>

          {/* 4 Interactive Modular Cards / Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Godown Storage Capacity */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Warehouse className="w-4 h-4 text-[#2588E8]" />
                  <span>Main Central Godown</span>
                </div>
                <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-0.5 rounded-md font-bold">
                  {stockSummary.length} Items
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-[#7F98AE]">
                  <span>Utilization:</span>
                  <span className="text-white font-bold">
                    {Math.round((nominalStockCount / Math.max(1, stockSummary.length)) * 100)}% Normal
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[rgba(8,24,40,0.50)] backdrop-blur-xl overflow-hidden">
                  <div
                    style={{
                      width: `${Math.round((nominalStockCount / Math.max(1, stockSummary.length)) * 100)}%`,
                    }}
                    className="h-full bg-gradient-to-r from-[#1D68B2] to-[#2588E8] rounded-full transition-all duration-500"
                  ></div>
                </div>
              </div>
              <div className="text-[10px] text-[#7F98AE] flex justify-between">
                <span>Value: ₹{(stockValuation / 100000).toFixed(2)}L</span>
                <button
                  onClick={() => openOrSwitchTab('stock_summary')}
                  className="text-[#2588E8] hover:underline cursor-pointer"
                >
                  Manage &rarr;
                </button>
              </div>
            </div>

            {/* 2. Cash vs Bank Liquidity Split Meter */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Coins className="w-4 h-4 text-[#F2C94C]" />
                  <span>Liquidity Pool Split</span>
                </div>
                <span className="text-[10px] font-mono text-white bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-0.5 rounded-md font-bold">
                  ₹{((cashTotal + bankTotal) / 1000).toFixed(1)}k
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-[#7F98AE]">
                  <span>Cash ({cashPercent}%)</span>
                  <span>Bank ({bankPercent}%)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[rgba(8,24,40,0.50)] backdrop-blur-xl overflow-hidden flex">
                  <div
                    style={{ width: `${cashPercent}%` }}
                    className="h-full bg-[#F2C94C] rounded-l-full transition-all duration-500"
                  ></div>
                  <div
                    style={{ width: `${bankPercent}%` }}
                    className="h-full bg-[#2588E8] rounded-r-full transition-all duration-500"
                  ></div>
                </div>
              </div>
              <div className="text-[10px] text-[#7F98AE] flex justify-between">
                <span>Cash: ₹{(cashTotal / 1000).toFixed(1)}k</span>
                <span>Bank: ₹{(bankTotal / 1000).toFixed(1)}k</span>
              </div>
            </div>

            {/* 3. System Integrity & Auto-Backup */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-[#2588E8]" />
                  <span>Integrity Safeguards</span>
                </div>
                <span className="text-[10px] font-bold text-[#2588E8]">Active</span>
              </div>
              <div className="space-y-2 text-xs">
                {/* Toggle 1: Auto-Backup */}
                <div
                  onClick={() => toggleControl('autoBackup')}
                  className="flex items-center justify-between text-[11px] cursor-pointer hover:text-white transition"
                >
                  <span className="text-[#7F98AE]">Auto-Backup on Exit:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                      systemControls.autoBackup
                        ? 'bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8]'
                        : 'bg-rose-950/40 text-[#FF647C]'
                    }`}
                  >
                    {systemControls.autoBackup ? 'Active' : 'Disabled'}
                  </span>
                </div>

                {/* Toggle 2: Real-time Audit */}
                <div
                  onClick={() => toggleControl('realTimeAudit')}
                  className="flex items-center justify-between text-[11px] cursor-pointer hover:text-white transition"
                >
                  <span className="text-[#7F98AE]">Double-Entry Integrity:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                      systemControls.realTimeAudit
                        ? 'bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8]'
                        : 'bg-rose-950/40 text-[#FF647C]'
                    }`}
                  >
                    {systemControls.realTimeAudit ? 'Balanced' : 'Check'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Sales Velocity & Turnover Meter */}
            <div className="bg-[rgba(18,48,76,0.52)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Activity className="w-4 h-4 text-[#2588E8]" />
                  <span>Sales Turnover</span>
                </div>
                <span className="text-[10px] font-mono text-[#2588E8] bg-[rgba(13,38,62,0.48)] backdrop-blur-xl px-2 py-0.5 rounded-md font-bold">
                  Active Period
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black font-mono text-white">
                  ₹{netSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-[#7F98AE]">
                  Gross Trading Margin: ₹{(profitLoss?.grossProfit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px]">
                <button
                  onClick={() => openOrSwitchTab('profit_loss')}
                  className="text-[#2588E8] hover:underline font-semibold cursor-pointer"
                >
                  P&amp;L Statement &rarr;
                </button>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};
