import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  Building2,
  Calendar,
  Wifi,
  WifiOff,
  RefreshCw,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Globe,
  Database,
  Keyboard,
  Pin,
  PinOff,
} from 'lucide-react';
import { CompanySetupModal } from '../system/CompanySetupModal';
import { FiscalYearManagerModal } from '../system/FiscalYearManagerModal';
import { KeyboardShortcutsModal } from '../system/KeyboardShortcutsModal';

export const Header: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    currentCompany,
    currentFiscalYear,
    companies,
    fiscalYears,
    refreshFiscalYears,
    switchCompany,
    switchFiscalYear,
    isOnline,
    setOnlineMode,
    syncSummary,
    triggerSync,
    setGlobalSearchOpen,
    isShortcutsModalOpen,
    setShortcutsModalOpen,
    notifications,
    removeNotification,
    isSidebarOpen,
    toggleSidebar,
  } = useApp();

  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [fyDropdownOpen, setFyDropdownOpen] = useState(false);
  const [newCompanyModalOpen, setNewCompanyModalOpen] = useState(false);
  const [fyManagerModalOpen, setFyManagerModalOpen] = useState(false);

  return (
    <header className="bg-[rgba(12,35,58,0.58)] border-b border-[rgba(112,185,245,0.22)] sticky top-0 z-30 shadow-[0_8px_30px_rgba(0,0,0,0.20)] backdrop-blur-[20px] shrink-0">
      {/* Top Notification Toasts */}
      <div className="fixed top-3 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.40)] border backdrop-blur-xl text-sm transition-all duration-180 animate-in slide-in-from-top-2 ${
              n.type === 'success'
                ? 'bg-[rgba(8,27,46,0.92)] border-[rgba(85,214,138,0.40)] text-[#55D68A]'
                : n.type === 'error'
                ? 'bg-[rgba(8,27,46,0.92)] border-[rgba(255,100,124,0.40)] text-[#FF647C]'
                : 'bg-[rgba(8,27,46,0.92)] border-[rgba(82,199,255,0.40)] text-[#52C7FF]'
            }`}
          >
            {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#55D68A] shrink-0 mt-0.5" />}
            {n.type === 'error' && <AlertCircle className="w-5 h-5 text-[#FF647C] shrink-0 mt-0.5" />}
            {n.type === 'info' && <Database className="w-5 h-5 text-[#52C7FF] shrink-0 mt-0.5" />}
            <span className="flex-1 font-medium">{n.message}</span>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-[#7F98AE] hover:text-[#F1F7FC] text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left Section: Sidebar Toggle + Brand Logo + Divider + Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* 1. Sidebar Fix / Moving (Pin / Unpin) Button */}
            <button
              onClick={toggleSidebar}
              id="header_sidebar_pin_btn"
              title={
                isSidebarOpen
                  ? 'Sidebar Pinned - Click to Auto-hide'
                  : 'Sidebar Auto-hide - Click to Pin'
              }
              className={`p-2 rounded-lg border text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                isSidebarOpen
                  ? 'bg-[#2588E8] border-[rgba(112,185,245,0.25)] text-[#FFFFFF] hover:bg-[#39A7FF]'
                  : 'bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-[rgba(112,185,245,0.25)] text-[#7F98AE] hover:text-[#2588E8] hover:bg-[#123356]'
              }`}
            >
              {isSidebarOpen ? (
                <Pin className="w-4 h-4 text-[#2588E8]" />
              ) : (
                <PinOff className="w-4 h-4 text-[#7F98AE]" />
              )}
            </button>

            {/* 2. Brand Logo */}
            <div
              onClick={() => setActiveTab('dashboard')}
              id="header_logo_branding"
              title="Dashboard (Home)"
              className="flex items-center gap-2 cursor-pointer group shrink-0 select-none py-1 px-1.5 rounded-lg hover:bg-[#123356] transition"
            >
              <div className="w-7 h-7 shrink-0 rounded-lg bg-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center text-[#FFFFFF] font-bold text-xs tracking-wider shadow-sm group-hover:scale-105 transition-transform font-mono">
                BK
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-semibold tracking-wider text-[#FFFFFF] uppercase font-sans">
                  BAHI KHATA
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-[rgba(13,38,62,0.48)] backdrop-blur-xl text-[#2588E8] font-mono font-bold border border-[rgba(112,185,245,0.25)]">
                  ERP
                </span>
              </div>
            </div>

            {/* Subtle Vertical Divider */}
            <div className="h-5 w-px bg-[rgba(37,99,155,0.32)] shrink-0 mx-0.5 sm:mx-1 hidden sm:block" />

            {/* 3. Quick Home / Dashboard Button */}
            <button
              onClick={() => setActiveTab('dashboard')}
              id="header_home_btn"
              title="Dashboard (Home)"
              className="flex items-center justify-center p-2 rounded-lg bg-[#2588E8] hover:bg-[#39A7FF] active:bg-[#2588E8] text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Home className="w-4 h-4 text-[#FFFFFF]" />
            </button>

            {/* 4. Company Dropdown (Firm Name) */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setCompanyDropdownOpen(!companyDropdownOpen);
                  setFyDropdownOpen(false);
                }}
                id="header_company_select_btn"
                className="flex items-center gap-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#FFFFFF] px-3 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#2588E8] shrink-0" />
                <span className="max-w-[120px] sm:max-w-[180px] md:max-w-[220px] truncate font-semibold">
                  {currentCompany?.name || 'Select Company'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#7F98AE] shrink-0" />
              </button>

              {companyDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-[rgba(8,27,46,0.96)] backdrop-blur-[24px] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.60)] border border-[rgba(112,185,245,0.30)] py-2 z-40">
                  <div className="px-3.5 py-1 text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">
                    Switch Company
                  </div>
                  {companies.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => {
                        switchCompany(comp.id);
                        setCompanyDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-[#123356] transition ${
                        currentCompany?.id === comp.id ? 'bg-[#2588E8] text-[#FFFFFF] font-bold' : 'text-[#FFFFFF]'
                      }`}
                    >
                      <span className="truncate">{comp.name}</span>
                      {currentCompany?.id === comp.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#2588E8]" />}
                    </button>
                  ))}
                  <div className="border-t border-[rgba(112,185,245,0.25)] mt-1.5 pt-1.5 px-1.5">
                    <button
                      onClick={() => {
                        setCompanyDropdownOpen(false);
                        setNewCompanyModalOpen(true);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#2588E8] hover:text-[#FFFFFF] hover:bg-[#123356] rounded-md flex items-center gap-1.5 font-medium transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Create New Company
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fiscal Year Switcher */}
            <div className="relative hidden md:block">
              <button
                onClick={() => {
                  const nextState = !fyDropdownOpen;
                  setFyDropdownOpen(nextState);
                  setCompanyDropdownOpen(false);
                  if (nextState) {
                    refreshFiscalYears();
                  }
                }}
                className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#B7C9D9] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-medium transition cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#2588E8] shrink-0" />
                <span className="font-semibold text-[#FFFFFF]">{currentFiscalYear?.name || 'No FY'}</span>
                <ChevronDown className="w-3 h-3 text-[#7F98AE]" />
              </button>

              {fyDropdownOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-[rgba(8,27,46,0.96)] backdrop-blur-[24px] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.60)] border border-[rgba(112,185,245,0.30)] py-2 z-40">
                  <div className="px-3.5 py-1 text-[11px] font-bold text-[#7F98AE] uppercase tracking-wider">
                    Fiscal Years
                  </div>
                  {fiscalYears.length === 0 ? (
                    <div className="px-3.5 py-2 text-xs text-[#7F98AE] italic">
                      No FY configured
                    </div>
                  ) : (
                    fiscalYears.map((fy) => (
                      <button
                        key={fy.id}
                        onClick={() => {
                          switchFiscalYear(fy.id);
                          setFyDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-[#123356] transition ${
                          currentFiscalYear?.id === fy.id ? 'bg-[#2588E8] text-[#FFFFFF] font-bold' : 'text-[#B7C9D9]'
                        }`}
                      >
                        <span>{fy.name}</span>
                        {currentFiscalYear?.id === fy.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#2588E8]" />}
                      </button>
                    ))
                  )}
                  <div className="border-t border-[rgba(112,185,245,0.25)] mt-1.5 pt-1.5 px-1.5">
                    <button
                      onClick={() => {
                        setFyDropdownOpen(false);
                        setFyManagerModalOpen(true);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#2588E8] hover:text-[#FFFFFF] hover:bg-[#123356] rounded-md flex items-center gap-1.5 font-medium transition"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Manage / Add Fiscal Years
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {/* Shortcut Keys Button */}
            <button
              onClick={() => setShortcutsModalOpen(true)}
              id="header_shortcut_keys_btn"
              className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#2588E8] hover:text-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-medium transition cursor-pointer shadow-sm"
              title="Shortcut Keys (Add, Edit, Delete, Customise)"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#2588E8]" />
              <span>Shortcut Keys</span>
            </button>

            {/* Global Search Button (Ctrl+F) */}
            <button
              onClick={() => setGlobalSearchOpen(true)}
              className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs transition cursor-pointer"
              title="Search Ledgers, Vouchers, Items (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5 text-[#7F98AE]" />
              <span className="hidden lg:inline font-medium">Search</span>
              <kbd className="hidden lg:inline px-1 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl rounded border border-[rgba(112,185,245,0.25)] text-[10px] text-[#7F98AE]">
                Ctrl+F
              </kbd>
            </button>

            {/* Online / Offline Status Toggle Badge */}
            <button
              onClick={() => setOnlineMode(!isOnline)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                isOnline
                  ? 'bg-[#2588E8]/15 border-[#2588E8]/30 text-[#2588E8] hover:bg-[#2588E8]/25'
                  : 'bg-[#FF647C]/15 border-[#FF647C]/30 text-[#FF647C] hover:bg-[#FF647C]/25'
              }`}
              title={isOnline ? 'Network Online: Click to simulate Offline Mode' : 'Network Offline: Local Dataset Active. Click to simulate Online'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-[#2588E8]" /> : <WifiOff className="w-3.5 h-3.5 text-[#FF647C] animate-pulse" />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {/* Cloud Sync Button */}
            <button
              onClick={triggerSync}
              className="flex items-center gap-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#123356] text-[#B7C9D9] hover:text-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] text-xs font-medium transition cursor-pointer"
              title="Synchronize queued transactions to Cloud"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2588E8]" />
              {syncSummary && syncSummary.pendingCount > 0 ? (
                <span className="bg-[#2588E8] text-[#FFFFFF] text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm border border-[rgba(112,185,245,0.25)]">
                  {syncSummary.pendingCount}
                </span>
              ) : (
                <span className="hidden md:inline text-[#7F98AE] text-xs">Synced</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {newCompanyModalOpen && <CompanySetupModal onClose={() => setNewCompanyModalOpen(false)} />}
      {fyManagerModalOpen && <FiscalYearManagerModal onClose={() => setFyManagerModalOpen(false)} />}
      {isShortcutsModalOpen && <KeyboardShortcutsModal onClose={() => setShortcutsModalOpen(false)} />}
    </header>
  );
};
