import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { Company, FiscalYear } from '../../types';
import {
  Building2,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Save,
  AlertTriangle,
  X,
  Lock,
  Unlock,
  CheckCircle2,
  FolderTree,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DateInput } from '../common/DateInput';
import { formatDateDisplay } from '../../utils/dateUtils';

export const CompanyDataView: React.FC = () => {
  const {
    currentCompany,
    currentFiscalYear,
    companies,
    fiscalYears,
    switchCompany,
    switchFiscalYear,
    updateCompany,
    deleteCompany,
    refreshActiveData,
    showNotification,
  } = useApp();

  // Company Modal State (Supports Create & Edit)
  const [companyModalOpen, setCompanyModalOpen] = useState<boolean>(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    bankName: '',
    bankAccountNo: '',
    bankIfsc: '',
    bankBranch: '',
  });

  // Delete Company Confirmation State
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  // New FY Modal
  const [fyModalOpen, setFyModalOpen] = useState<boolean>(false);
  const [newFyName, setNewFyName] = useState<string>('FY 2027-28');
  const [newFyStart, setNewFyStart] = useState<string>('2027-04-01');
  const [newFyEnd, setNewFyEnd] = useState<string>('2028-03-31');

  const handleOpenNewCompany = () => {
    setEditingCompany(null);
    setCompanyForm({
      name: '',
      legalName: '',
      gstin: '',
      pan: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      bankName: '',
      bankAccountNo: '',
      bankIfsc: '',
      bankBranch: '',
    });
    setCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (c: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCompany(c);
    setCompanyForm({
      name: c.name || '',
      legalName: c.legalName || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      bankName: c.bankName || '',
      bankAccountNo: c.bankAccountNo || '',
      bankIfsc: c.bankIfsc || '',
      bankBranch: c.bankBranch || '',
    });
    setCompanyModalOpen(true);
  };

  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) {
      showNotification('Company name is required.', 'error');
      return;
    }

    try {
      const now = new Date().toISOString();

      if (editingCompany) {
        const updatedComp: Company = {
          ...editingCompany,
          name: companyForm.name.trim(),
          legalName: companyForm.legalName.trim() || undefined,
          gstin: companyForm.gstin.trim().toUpperCase() || undefined,
          pan: companyForm.pan.trim().toUpperCase() || undefined,
          phone: companyForm.phone.trim() || undefined,
          email: companyForm.email.trim() || undefined,
          address: companyForm.address.trim() || undefined,
          city: companyForm.city.trim() || undefined,
          state: companyForm.state.trim() || undefined,
          pincode: companyForm.pincode.trim() || undefined,
          bankName: companyForm.bankName.trim() || undefined,
          bankAccountNo: companyForm.bankAccountNo.trim() || undefined,
          bankIfsc: companyForm.bankIfsc.trim().toUpperCase() || undefined,
          bankBranch: companyForm.bankBranch.trim() || undefined,
          updatedAt: now,
        };

        await updateCompany(updatedComp);
        setCompanyModalOpen(false);
        setEditingCompany(null);
      } else {
        const compId = `comp-${Date.now()}`;
        const comp: Company = {
          id: compId,
          uuid: uuidv4(),
          name: companyForm.name.trim(),
          legalName: companyForm.legalName.trim() || undefined,
          gstin: companyForm.gstin.trim().toUpperCase() || undefined,
          pan: companyForm.pan.trim().toUpperCase() || undefined,
          phone: companyForm.phone.trim() || undefined,
          email: companyForm.email.trim() || undefined,
          address: companyForm.address.trim() || undefined,
          city: companyForm.city.trim() || undefined,
          state: companyForm.state.trim() || undefined,
          pincode: companyForm.pincode.trim() || undefined,
          bankName: companyForm.bankName.trim() || undefined,
          bankAccountNo: companyForm.bankAccountNo.trim() || undefined,
          bankIfsc: companyForm.bankIfsc.trim().toUpperCase() || undefined,
          bankBranch: companyForm.bankBranch.trim() || undefined,
          currencySymbol: '₹',
          currencyCode: 'INR',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        await dbStorage.createCompany(comp);

        const fy: FiscalYear = {
          id: `fy-${Date.now()}`,
          uuid: uuidv4(),
          companyId: comp.id,
          name: 'FY 2026-27',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          isLocked: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        await dbStorage.createFiscalYear(fy);

        showNotification(`Company "${comp.name}" created with standard Chart of Accounts!`, 'success');
        setCompanyModalOpen(false);
        await switchCompany(comp.id);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to save company.', 'error');
    }
  };

  const handleDeleteCompanyPrompt = (c: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (companies.length <= 1) {
      showNotification('Cannot delete the only remaining company dataset.', 'error');
      return;
    }
    setCompanyToDelete(c);
  };

  const handleConfirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await deleteCompany(companyToDelete.id);
      if (editingCompany?.id === companyToDelete.id) {
        setCompanyModalOpen(false);
        setEditingCompany(null);
      }
      setCompanyToDelete(null);
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete company.', 'error');
    }
  };

  const handleCreateFiscalYear = async () => {
    if (!currentCompany || !newFyName.trim()) return;
    try {
      const now = new Date().toISOString();
      const fy: FiscalYear = {
        id: `fy-${Date.now()}`,
        uuid: uuidv4(),
        companyId: currentCompany.id,
        name: newFyName.trim(),
        startDate: newFyStart,
        endDate: newFyEnd,
        isLocked: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await dbStorage.createFiscalYear(fy);
      showNotification(`Fiscal Year "${fy.name}" created with carried forward balances!`, 'success');
      setFyModalOpen(false);
      await switchFiscalYear(fy.id);
    } catch (err: any) {
      showNotification(err.message || 'Failed to create fiscal year.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Company Data &amp; Financial Years
          </h1>
          <p className="text-xs text-slate-400">
            Manage multi-company datasets, financial years, and localized account isolation.
          </p>
        </div>
      </div>

      {/* Active Scope Summary Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{currentCompany?.name}</span>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active Dataset
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Current Financial Year: <span className="text-sky-300 font-semibold">{currentFiscalYear?.name}</span> ({currentFiscalYear?.startDate} to {currentFiscalYear?.endDate})
            </p>
          </div>
        </div>
      </div>

      {/* Dataset Isolation: Multi-Company & Multi-FY Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Companies Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              Company Datasets ({companies.length})
            </h2>
            <button
              onClick={handleOpenNewCompany}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Company
            </button>
          </div>

          <div className="space-y-2.5">
            {companies.map((c) => {
              const isCurrent = c.id === currentCompany?.id;
              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    isCurrent
                      ? 'border-amber-500/80 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div
                    onClick={() => switchCompany(c.id)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm hover:underline">{c.name}</span>
                      {c.legalName && c.legalName !== c.name && (
                        <span className="text-[11px] text-slate-400 font-normal">({c.legalName})</span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{c.city || 'Kishangarh'}, {c.state || 'Rajasthan'}</span>
                      <span>&bull;</span>
                      <span>{c.gstin ? `GST: ${c.gstin}` : 'Composition / Unregistered'}</span>
                      {c.pan && <span>&bull; PAN: {c.pan}</span>}
                      {c.phone && <span>&bull; Tel: {c.phone}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditCompany(c, e)}
                      title={`Edit ${c.name}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-amber-500/20 hover:border-amber-500/60 text-slate-300 hover:text-amber-300 font-semibold text-xs transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteCompanyPrompt(c, e)}
                      title={companies.length <= 1 ? "Cannot delete the only remaining company" : `Delete ${c.name}`}
                      disabled={companies.length <= 1}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        companies.length <= 1
                          ? 'border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed opacity-50'
                          : 'border-slate-700 bg-slate-800/90 hover:bg-rose-500/20 hover:border-rose-500/60 text-slate-300 hover:text-rose-400'
                      }`}
                    >
                      <Trash2 className={`w-3.5 h-3.5 ${companies.length <= 1 ? 'text-slate-600' : 'text-rose-400'}`} />
                      <span>Delete</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchCompany(c.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                        isCurrent
                          ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 cursor-default'
                          : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 cursor-pointer'
                      }`}
                    >
                      {isCurrent ? 'Current' : 'Switch →'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fiscal Years Manager */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Financial Years ({fiscalYears.length})
            </h2>
            <button
              onClick={() => setFyModalOpen(true)}
              className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New FY
            </button>
          </div>

          <div className="space-y-2">
            {fiscalYears.map((fy) => {
              const isCurrent = fy.id === currentFiscalYear?.id;
              return (
                <div
                  key={fy.id}
                  onClick={() => switchFiscalYear(fy.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                    isCurrent
                      ? 'border-sky-500/80 bg-sky-500/10'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{fy.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500 text-slate-950 uppercase">
                          Active
                        </span>
                      )}
                      {fy.isLocked && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Period: {formatDateDisplay(fy.startDate)} to {formatDateDisplay(fy.endDate)}
                    </div>
                  </div>
                  <button
                    className={`px-2.5 py-1 rounded font-semibold text-xs ${
                      isCurrent ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                  >
                    {isCurrent ? 'Current' : 'Switch →'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Company Modal (Create / Edit) */}
      {companyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xl space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3.5">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  {editingCompany ? 'Edit Enterprise Company' : 'Register New Enterprise Company'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingCompany
                    ? `Update company details and fiscal profile for ${editingCompany.name}`
                    : 'Create an isolated company database with standard Indian accounting Chart of Accounts'}
                </p>
              </div>
              <button
                onClick={() => {
                  setCompanyModalOpen(false);
                  setEditingCompany(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
              {/* Row 1: Name & Legal Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Company / Trade Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Royal Marbles & Granites"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Legal / Registered Name
                  </label>
                  <input
                    type="text"
                    value={companyForm.legalName}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, legalName: e.target.value }))}
                    placeholder="e.g. Royal Marbles & Granites Pvt Ltd"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Row 2: GSTIN & PAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={companyForm.gstin}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                    placeholder="08AAAAA0000A1Z5"
                    maxLength={15}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white uppercase font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={companyForm.pan}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
                    placeholder="AAAAA0000A"
                    maxLength={10}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white uppercase font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Row 3: Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Phone / Mobile Number
                  </label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="e.g. info@royalmarbles.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Row 4: Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Street / Factory Address
                </label>
                <input
                  type="text"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="e.g. RIICO Industrial Area, Phase II"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Row 5: City, State, Pincode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Kishangarh"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="Rajasthan"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={companyForm.pincode}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, pincode: e.target.value }))}
                    placeholder="305801"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Bank Details section */}
              <div className="border-t border-slate-800 pt-3">
                <span className="block text-[11px] font-bold text-slate-400 uppercase mb-2">
                  Bank Details (Optional - for Invoice Prints)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={companyForm.bankName}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, bankName: e.target.value }))}
                    placeholder="Bank Name (e.g. HDFC Bank)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs placeholder-slate-600"
                  />
                  <input
                    type="text"
                    value={companyForm.bankAccountNo}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, bankAccountNo: e.target.value }))}
                    placeholder="A/C Number"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono placeholder-slate-600"
                  />
                  <input
                    type="text"
                    value={companyForm.bankIfsc}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))}
                    placeholder="IFSC Code"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs uppercase font-mono placeholder-slate-600"
                  />
                  <input
                    type="text"
                    value={companyForm.bankBranch}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, bankBranch: e.target.value }))}
                    placeholder="Branch"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-xs placeholder-slate-600"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3.5 border-t border-slate-800">
              {editingCompany && (
                <button
                  type="button"
                  onClick={() => handleDeleteCompanyPrompt(editingCompany)}
                  disabled={companies.length <= 1}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    companies.length <= 1
                      ? 'text-slate-600 border border-slate-800 bg-slate-900/60 cursor-not-allowed'
                      : 'text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Company</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyModalOpen(false);
                    setEditingCompany(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompany}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingCompany ? 'Save Changes' : 'Initialize Company Database'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Company Confirmation Dialog */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 w-full max-w-md space-y-4 text-xs shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">Delete Company Dataset?</h3>
                <p className="text-slate-300 mt-1.5 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-white">"{companyToDelete.name}"</strong>?
                </p>
                <div className="mt-2.5 p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-[11px] leading-relaxed">
                  ⚠️ This action will remove all ledgers, inventory records, vouchers, and fiscal years isolated for this company. This operation cannot be undone.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCompanyToDelete(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCompany}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm &amp; Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New FY Modal */}
      {fyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                Create New Fiscal Year Database
              </h3>
              <button onClick={() => setFyModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">FY Display Name *</label>
                <input
                  type="text"
                  value={newFyName}
                  onChange={(e) => setNewFyName(e.target.value)}
                  placeholder="e.g. FY 2027-28"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                  <DateInput
                    value={newFyStart}
                    onChange={setNewFyStart}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                  <DateInput
                    value={newFyEnd}
                    onChange={setNewFyEnd}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                <span className="font-bold text-sky-300 block mb-0.5">Automated Balance Carry Forward:</span>
                Closing ledger &amp; stock balances from current FY will automatically become Opening Balances in this new FY dataset.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setFyModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFiscalYear}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Initialize New Fiscal Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
