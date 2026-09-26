import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { CityMasterItem, StateMasterItem } from '../../types';
import { ExportEngine } from '../../services/exportEngine';
import { ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  MapPin,
  Plus,
  Search,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  Building2,
  FileSpreadsheet,
  Globe,
  Hash,
  Layers,
  ArrowUpDown,
  Check,
  Info,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface CityStateMasterViewProps {
  initialTab?: 'cities' | 'states';
}

export const CityStateMasterView: React.FC<CityStateMasterViewProps> = ({ initialTab = 'cities' }) => {
  const { currentCompany, cities, states, saveCity, deleteCity, showNotification } = useApp();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'cities' | 'states'>(initialTab);

  // Synchronize when navigating from sidebar
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Search and filters for cities
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState('ALL');

  // Search for states directory
  const [stateSearchTerm, setStateSearchTerm] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<'cityName' | 'stateName'>('cityName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<CityMasterItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const cityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) {
      const t1 = setTimeout(() => cityInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => cityInputRef.current?.focus(), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [modalOpen]);

  // Form states - ONLY City and State
  const [formData, setFormData] = useState({
    cityName: '',
    stateName: '',
    stateCode: '',
  });

  // Unique states represented in configured cities
  const statesInCities = useMemo(() => {
    return Array.from(new Set(cities.map((c) => c.stateName).filter(Boolean))).sort();
  }, [cities]);

  // Filtered and sorted cities
  const filteredCities = useMemo(() => {
    return cities
      .filter((city) => {
        // Search term check
        const matchesSearch =
          searchTerm === '' ||
          city.cityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          city.stateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (city.stateCode && city.stateCode.includes(searchTerm));

        // State filter check
        const matchesState = selectedStateFilter === 'ALL' || city.stateName === selectedStateFilter;

        return matchesSearch && matchesState;
      })
      .sort((a, b) => {
        let valA = (a[sortField] || '').toLowerCase();
        let valB = (b[sortField] || '').toLowerCase();
        if (sortOrder === 'asc') {
          return valA.localeCompare(valB);
        }
        return valB.localeCompare(valA);
      });
  }, [cities, searchTerm, selectedStateFilter, sortField, sortOrder]);

  // Filtered states list for directory tab
  const filteredStates = useMemo(() => {
    return states.filter((st) => {
      if (!stateSearchTerm) return true;
      const term = stateSearchTerm.toLowerCase();
      return (
        st.name.toLowerCase().includes(term) ||
        st.code.includes(term) ||
        (st.shortCode && st.shortCode.toLowerCase().includes(term)) ||
        (st.capital && st.capital.toLowerCase().includes(term))
      );
    });
  }, [states, stateSearchTerm]);

  // City counts per state for the state directory
  const cityCountPerState = useMemo(() => {
    const counts: Record<string, number> = {};
    cities.forEach((c) => {
      counts[c.stateName] = (counts[c.stateName] || 0) + 1;
    });
    return counts;
  }, [cities]);

  // Keyboard navigation for City/State Master table
  const currentTotal = activeTab === 'cities' ? filteredCities.length : filteredStates.length;
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: currentTotal,
    tableId: activeTab === 'cities' ? 'city-master-table' : 'state-master-table',
    enabled: !modalOpen && !deleteConfirmId,
  });

  // Open modal to add city - ONLY City and State
  const handleOpenAddModal = () => {
    setEditingCity(null);
    setFormData({
      cityName: '',
      stateName: '',
      stateCode: '',
    });
    setModalOpen(true);
  };

  // Open modal to edit city - ONLY City and State
  const handleOpenEditModal = (city: CityMasterItem) => {
    setEditingCity(city);
    setFormData({
      cityName: city.cityName,
      stateName: city.stateName,
      stateCode: city.stateCode || '08',
    });
    setModalOpen(true);
  };

  // State selection handler inside form - auto synchronizes state code
  const handleStateChange = (selectedStateName: string) => {
    const foundState = states.find((s) => s.name === selectedStateName);
    setFormData((prev) => ({
      ...prev,
      stateName: selectedStateName,
      stateCode: foundState ? foundState.code : prev.stateCode,
    }));
  };

  // Submit form - saves only City and State
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cityName.trim()) {
      showNotification('City name is required.', 'error');
      return;
    }

    try {
      const cityToSave: CityMasterItem = {
        id: editingCity ? editingCity.id : `city-${uuidv4().substring(0, 8)}`,
        cityName: formData.cityName.trim(),
        stateName: formData.stateName,
        stateCode: formData.stateCode,
        isActive: true,
        createdAt: editingCity ? editingCity.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCity(cityToSave);
      setFormData({
        cityName: '',
        stateName: '',
        stateCode: '',
      });
      setModalOpen(false);
      showNotification(
        editingCity ? `City "${formData.cityName}" updated.` : `City "${formData.cityName}" added.`,
        'success'
      );
    } catch (err: any) {
      // Error notification handled in context
    }
  };

  // Delete city handler
  const handleDelete = async (id: string) => {
    try {
      await deleteCity(id);
      setDeleteConfirmId(null);
    } catch (err: any) {
      // Handled in context
    }
  };

  // Toggle sorting
  const handleSort = (field: 'cityName' | 'stateName') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export to Excel / CSV
  const handleExport = (format: 'EXCEL' | 'CSV') => {
    if (activeTab === 'states') {
      const exportData = filteredStates.map((st) => ({
        'GST State Code': st.code,
        'State / UT Name': st.name,
        'Short Code': st.shortCode || '-',
        'Category': st.isUnionTerritory ? 'Union Territory' : 'State',
        'Capital / Center': st.capital || '-',
        'Configured Cities': cityCountPerState[st.name] || 0,
      }));

      const filename = `Indian_States_GST_Codes_${new Date().toISOString().split('T')[0]}`;
      if (format === 'EXCEL') {
        ExportEngine.exportToExcel(exportData, filename);
      } else {
        ExportEngine.exportToCsv(exportData, filename);
      }
      showNotification(`Exported Indian States & GST Codes to ${format} successfully.`, 'success');
      return;
    }

    const exportData = filteredCities.map((c, idx) => ({
      'S.No': idx + 1,
      'City Name': c.cityName,
      'State Name': c.stateName,
      'GST State Code': c.stateCode || '-',
    }));

    const filename = `City_State_Master_${currentCompany?.name || 'ERP'}_${new Date().toISOString().split('T')[0]}`;
    if (format === 'EXCEL') {
      ExportEngine.exportToExcel(exportData, filename);
    } else {
      ExportEngine.exportToCsv(exportData, filename);
    }
    showNotification(`Exported cities to ${format} successfully.`, 'success');
  };

  return (
    <div className="space-y-3.5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-lg backdrop-blur-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">City &amp; State Master</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-amber-400 border border-amber-500/30">
                {cities.length} Cities Configured
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Standardized geographic master for Locations, Parties, Transporters, and Tax Invoices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center">
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5">
            <button
              onClick={() => handleExport('EXCEL')}
              id="export_cities_excel_btn"
              title="Export to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ExcelFileIcon className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('CSV')}
              id="export_cities_csv_btn"
              title="Export to CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer border-l border-slate-800"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>CSV</span>
            </button>
          </div>

          <button
            onClick={handleOpenAddModal}
            id="add_new_city_btn"
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-amber-500/10 transition transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add City</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Cities</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{cities.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">{cities.filter((c) => c.isActive).length} active</span> in operations
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Covered States</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{statesInCities.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Out of {states.length} Indian States &amp; UTs
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Indian States &amp; UTs</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {states.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            Official Indian States &amp; GST Codes
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">GST Code Integration</span>
            <Hash className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">Active</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Auto GST state code matching enabled
          </div>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-800 px-6 pt-4 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('cities')}
              id="cities_tab_btn"
              className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'cities'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Cities Directory ({filteredCities.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('states')}
              id="states_tab_btn"
              className={`flex items-center gap-2 pb-3.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                activeTab === 'states'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Indian States &amp; GST Codes ({states.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Cities Directory */}
        {activeTab === 'cities' && (
          <div>
            {/* Filter Bar */}
            {/* Search & Filter Bar */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search city or state..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto">
                {/* State Filter */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] text-slate-400">State:</span>
                  <select
                    value={selectedStateFilter}
                    onChange={(e) => setSelectedStateFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">
                      All States
                    </option>
                    {statesInCities.map((st) => (
                      <option key={st} value={st} className="bg-slate-900 text-white">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Cities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold text-[10.5px] leading-tight">
                    <th className="py-0.5 px-3 w-14 text-center">#</th>
                    <th
                      onClick={() => handleSort('cityName')}
                      className="py-0.5 px-3 cursor-pointer hover:text-white transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>City / Town</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('stateName')}
                      className="py-0.5 px-3 cursor-pointer hover:text-white transition select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>State</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                    </th>
                    <th className="py-0.5 px-3 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredCities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <div className="text-sm font-medium text-slate-400">No cities found matching criteria</div>
                        <div className="text-xs text-slate-600 mt-1">Try resetting search or filters, or add a new city.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCities.map((c, index) => {
                      const isSelected = activeTab === 'cities' && index === selectedIndex;
                      return (
                        <tr
                          key={c.id}
                          data-table-id="city-master-table"
                          data-row-idx={index}
                          onClick={() => setSelectedIndex(index)}
                          className={`transition group cursor-pointer ${
                            isSelected
                              ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                        <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-semibold text-sm">{c.cityName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-400 font-bold">
                              {c.stateCode || '08'}
                            </span>
                            <span className="text-slate-300 font-medium">{c.stateName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              title="Edit City"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(c.id)}
                              title="Delete City"
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
              <div>
                Showing <span className="text-white font-semibold">{filteredCities.length}</span> of{' '}
                <span className="text-white font-semibold">{cities.length}</span> configured cities
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <Info className="w-3.5 h-3.5 text-amber-500/80" />
                <span>Cities are automatically available in Location Master, Ledgers, and Company Setup.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Indian States & GST Codes Directory */}
        {activeTab === 'states' && (
          <div>
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/20 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={stateSearchTerm}
                  onChange={(e) => setStateSearchTerm(e.target.value)}
                  placeholder="Search state name, GST code, capital..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition"
                />
                {stateSearchTerm && (
                  <button
                    onClick={() => setStateSearchTerm('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                Official GST State Codes (CBIC &amp; GSTIN format)
              </div>
            </div>

            {/* States Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold leading-tight text-[10.5px]">
                    <th className="py-0.5 px-3 w-20 text-center">GST Code</th>
                    <th className="py-0.5 px-3">State / Union Territory Name</th>
                    <th className="py-0.5 px-3 text-center">Short Code</th>
                    <th className="py-0.5 px-3">Category</th>
                    <th className="py-0.5 px-3">Capital / Administrative Center</th>
                    <th className="py-0.5 px-3 text-center">Configured Cities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStates.map((st, index) => {
                    const isSelected = activeTab === 'states' && index === selectedIndex;
                    const cityCount = cityCountPerState[st.name] || 0;
                    return (
                      <tr
                        key={st.code}
                        data-table-id="state-master-table"
                        data-row-idx={index}
                        onClick={() => setSelectedIndex(index)}
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-xs font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-amber-400 shadow-inner">
                            {st.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-semibold">{st.name}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-[11px] text-slate-400 font-medium">
                            {st.shortCode || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {st.isUnionTerritory ? (
                            <span className="bg-purple-950/60 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              Union Territory
                            </span>
                          ) : (
                            <span className="bg-blue-950/60 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                              State
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {st.capital || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cityCount > 0 ? (
                            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full text-[11px] font-bold">
                              {cityCount} {cityCount === 1 ? 'City' : 'Cities'}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit City Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white">
                  {editingCity ? 'Edit City' : 'Add New City'}
                </h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - ONLY City and State */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* City Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  City / Town Name <span className="text-rose-400">*</span>
                </label>
                <input
                  ref={cityInputRef}
                  type="text"
                  required
                  autoFocus
                  value={formData.cityName}
                  onChange={(e) => setFormData({ ...formData, cityName: e.target.value })}
                  placeholder="e.g. Ramganj Mandi, Kota, Jaipur"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  State / Union Territory <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.stateName}
                  onChange={(e) => handleStateChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-amber-500 transition cursor-pointer"
                >
                  <option value="">Select</option>
                  {states.map((st) => (
                    <option key={st.code} value={st.name} className="bg-slate-900 text-white">
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save_city_submit_btn"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{editingCity ? 'Update City' : 'Save City'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete City?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to remove this city from the master?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                id="confirm_delete_city_btn"
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
