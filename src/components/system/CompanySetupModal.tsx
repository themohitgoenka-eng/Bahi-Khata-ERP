import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { Company, FiscalYear } from '../../types';
import { Building2, X, Check, Calendar, FileText, MapPin, Phone, Mail } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DateInput } from '../common/DateInput';
import { FullCityModal } from '../master/FullCityModal';

interface CompanySetupModalProps {
  onClose: () => void;
}

export const CompanySetupModal: React.FC<CompanySetupModalProps> = ({ onClose }) => {
  const { refreshActiveData, switchCompany, cities, states } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    phone: '',
    email: '',
    financialYearStartDate: '2026-04-01',
    booksBeginningDate: '2026-04-01',
    fyName: 'FY 2026-2027',
  });
  const [cityModalOpen, setCityModalOpen] = useState(false);

  const handleCityChange = (newCity: string) => {
    const matched = cities.find((c) => c.cityName.trim().toLowerCase() === newCity.trim().toLowerCase());
    setFormData((prev) => ({
      ...prev,
      city: newCity,
      state: matched ? matched.stateName : prev.state,
      pincode: matched?.pincode ? matched.pincode : prev.pincode,
    }));
  };

  const handleStartDateChange = (newDate: string) => {
    const startYear = parseInt(newDate.split('-')[0], 10) || 2026;
    const endYear = startYear + 1;
    setFormData((prev) => ({
      ...prev,
      financialYearStartDate: newDate,
      booksBeginningDate: newDate,
      fyName: `FY ${startYear}-${endYear}`,
    }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Company Name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const companyId = `comp-${Date.now()}`;
      const fyId = `fy-${Date.now()}`;
      const now = new Date().toISOString();

      const newCompany: Company = {
        id: companyId,
        uuid: uuidv4(),
        name: formData.name.trim(),
        legalName: formData.legalName.trim() || formData.name.trim(),
        gstin: formData.gstin.trim(),
        pan: formData.pan.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country.trim() || 'India',
        pincode: formData.pincode.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        booksBeginningDate: formData.booksBeginningDate,
        financialYearStartDate: formData.financialYearStartDate,
        baseCurrency: 'INR',
        currencySymbol: '₹',
        currencyCode: 'INR',
        decimalPlaces: 2,
        accountingEnabled: true,
        inventoryEnabled: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      const startYear = parseInt(formData.financialYearStartDate.split('-')[0], 10) || 2026;
      const endYear = startYear + 1;
      const endDate = `${endYear}-03-31`;

      const newFY: FiscalYear = {
        id: fyId,
        uuid: uuidv4(),
        companyId,
        name: formData.fyName.trim() || `FY ${startYear}-${endYear}`,
        startDate: formData.financialYearStartDate,
        endDate,
        isClosed: false,
        isLocked: false,
        isTransferred: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      await dbStorage.createCompany(newCompany);
      await dbStorage.createFiscalYear(newFY);
      await dbStorage.switchDataset(companyId, fyId);

      await refreshActiveData();
      await switchCompany(companyId);

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create company dataset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(2,10,18,0.62)] backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Create New Company & Isolated Dataset</h3>
              <p className="text-xs text-slate-400">Initialize double-entry books with default chart of accounts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700 text-rose-200 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">
                Company Trade Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Royal Marbles & Kota Stones Pvt. Ltd."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Legal Registered Name</label>
              <input
                type="text"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                placeholder="Official billing name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">GSTIN / Tax ID</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="08AAAAA0000A1Z5"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 font-mono transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Permanent Account Number (PAN)</label>
              <input
                type="text"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                placeholder="AAAAA0000A"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 font-mono transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="accounts@company.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-300">Business Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Industrial Area, Sukher"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">City / District</label>
                <button
                  type="button"
                  onClick={() => setCityModalOpen(true)}
                  className="text-[10px] text-amber-400 hover:underline cursor-pointer font-semibold"
                >
                  + Add City
                </button>
              </div>
              <input
                type="text"
                list="company_cities_list"
                value={formData.city}
                onChange={(e) => handleCityChange(e.target.value)}
                placeholder="Type or select city..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
              />
              <datalist id="company_cities_list">
                {cities.map((c) => (
                  <option key={c.id} value={c.cityName}>
                    {c.stateCode} - {c.stateName} {c.district ? `(${c.district})` : ''}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-amber-500 transition cursor-pointer"
              >
                {states.map((st) => (
                  <option key={st.code} value={st.name}>
                    {st.code} - {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/80 md:col-span-2 space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Initial Fiscal Year Setup
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Financial Year Begins</label>
                  <DateInput
                    value={formData.financialYearStartDate}
                    onChange={handleStartDateChange}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Fiscal Year Label (FY XXXX-YYYY)</label>
                  <input
                    type="text"
                    value={formData.fyName}
                    onChange={(e) => setFormData({ ...formData, fyName: e.target.value })}
                    placeholder="FY 2026-2027"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg shadow flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Dataset...' : 'Create & Switch Dataset'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Full City Modal */}
      <FullCityModal
        isOpen={cityModalOpen}
        initialName=""
        onClose={() => setCityModalOpen(false)}
        onCreated={(newCity) => {
          handleCityChange(newCity.cityName);
        }}
      />
    </div>
  );
};
