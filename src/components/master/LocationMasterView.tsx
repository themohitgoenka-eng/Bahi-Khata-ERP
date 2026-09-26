import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Location, LocationType } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { ExportEngine } from '../../services/exportEngine';
import { ExcelFileIcon } from '../common/DocumentIcons';
import { FullCityModal } from './FullCityModal';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  X,
  Save,
  Building2,
  Warehouse,
  Factory,
  Store,
  Compass,
  Star,
  ShieldCheck,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const LOCATION_TYPES: { type: LocationType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { type: 'GODOWN', label: 'Godown / Storage', icon: Warehouse },
  { type: 'WAREHOUSE', label: 'Central Warehouse', icon: Building2 },
  { type: 'YARD', label: 'Quarry / Open Yard', icon: Compass },
  { type: 'FACTORY_FLOOR', label: 'Factory / Production Floor', icon: Factory },
  { type: 'SHOWROOM', label: 'Showroom / Display Depot', icon: Store },
  { type: 'BRANCH', label: 'Branch Office & Store', icon: Building2 },
  { type: 'TRANSIT', label: 'In-Transit / Floating Yard', icon: Compass },
  { type: 'OTHER', label: 'Other Location', icon: MapPin },
];

export const LocationMasterView: React.FC = () => {
  const { currentCompany, locations, saveLocation, deleteLocation, showNotification, cities, states, setActiveTab } = useApp();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [cityModalOpen, setCityModalOpen] = useState(false);

  // Form Fields State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('GODOWN');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) {
      const t1 = setTimeout(() => firstInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => firstInputRef.current?.focus(), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [modalOpen]);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    details?: { label: string; value: string | number }[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filtered List
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchSearch =
        searchTerm === '' ||
        loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loc.city && loc.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (loc.state && loc.state.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = typeFilter === 'ALL' || loc.type === typeFilter;
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && loc.isActive) ||
        (statusFilter === 'INACTIVE' && !loc.isActive);

      return matchSearch && matchType && matchStatus;
    });
  }, [locations, searchTerm, typeFilter, statusFilter]);

  // Keyboard navigation for Location Master table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredLocations.length,
    tableId: 'location-master-table',
    enabled: !modalOpen && !confirmModal.isOpen && !cityModalOpen,
  });

  // Key Statistics
  const totalLocations = locations.length;
  const activeLocations = locations.filter((l) => l.isActive).length;
  const defaultLocation = locations.find((l) => l.isDefault) || locations[0];
  const uniqueCities = new Set(locations.map((l) => l.city).filter(Boolean)).size;

  // Helper to auto-generate the next sequential location code (e.g. LOC-01, LOC-02)
  const getNextLocationCode = (existingLocations: Location[]): string => {
    let maxNum = 0;
    const locPattern = /^LOC-(\d+)$/i;

    existingLocations.forEach((loc) => {
      const match = (loc.code || '').trim().match(locPattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    if (maxNum === 0 && existingLocations.length > 0) {
      existingLocations.forEach((loc) => {
        const match = (loc.code || '').match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
    }

    const nextNum = maxNum > 0 ? maxNum + 1 : existingLocations.length + 1;
    return `LOC-${String(nextNum).padStart(2, '0')}`;
  };

  // Open Modal for Add
  const handleOpenAddModal = () => {
    setEditingLocation(null);
    setCode(getNextLocationCode(locations));
    setName('');
    setType('' as any);
    setCity('');
    setState('');
    setPincode('');
    setIsDefault(locations.length === 0);
    setIsActive(true);
    setModalOpen(true);
  };

  const handleCityChange = (newCityName: string) => {
    setCity(newCityName);
    const matched = cities.find(
      (c) => c.cityName.trim().toLowerCase() === newCityName.trim().toLowerCase()
    );
    if (matched) {
      setState(matched.stateName);
      if (matched.pincode && (!pincode || editingLocation === null)) {
        setPincode(matched.pincode);
      }
    }
  };

  // Open Modal for Edit
  const handleOpenEditModal = (loc: Location) => {
    setEditingLocation(loc);
    setCode(loc.code);
    setName(loc.name);
    setType((loc.type as LocationType) || 'GODOWN');
    setCity(loc.city || '');
    setState(loc.state || '');
    setPincode(loc.pincode || '');
    setIsDefault(Boolean(loc.isDefault));
    setIsActive(loc.isActive);
    setModalOpen(true);
  };

  // Save Location Handler
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showNotification('Please enter Location / Godown Name.', 'error');
      return;
    }
    const trimmedCode = (code.trim() || getNextLocationCode(locations)).toUpperCase();

    // Check duplicate code
    const duplicate = locations.find(
      (l) => l.code.trim().toUpperCase() === trimmedCode && l.id !== editingLocation?.id
    );
    if (duplicate) {
      showNotification(`Location code "${trimmedCode}" already exists for "${duplicate.name}".`, 'error');
      return;
    }

    const now = new Date().toISOString();
    const locPayload: Location = {
      id: editingLocation?.id || `loc-${Date.now()}`,
      uuid: editingLocation?.uuid || uuidv4(),
      companyId: currentCompany?.id || 'comp-default-01',
      code: trimmedCode,
      name: name.trim(),
      type: type || 'GODOWN',
      address: '',
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault,
      isActive,
      createdAt: editingLocation?.createdAt || now,
      updatedAt: now,
    };

    try {
      await saveLocation(locPayload);
      setCode('');
      setName('');
      setType('' as any);
      setCity('');
      setState('');
      setPincode('');
      setIsDefault(false);
      setEditingLocation(null);
      setModalOpen(false);
    } catch (err: any) {
      // Handled in context
    }
  };

  // Delete Handler with Confirmation
  const handleDeleteLocation = (loc: Location) => {
    if (loc.isDefault && locations.length > 1) {
      showNotification('Cannot delete primary default Godown. Set another location as default first.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Confirm Delete Location / Godown',
      message: `Are you sure you want to permanently delete location "${loc.name}" (${loc.code})?`,
      details: [
        { label: 'Code', value: loc.code },
        { label: 'Name', value: loc.name },
        { label: 'Type', value: loc.type },
        { label: 'City', value: loc.city || 'N/A' },
      ],
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteLocation(loc.id);
        } catch (err) {
          // Handled in context
        }
      },
    });
  };

  // Quick Set as Default
  const handleSetDefault = async (loc: Location) => {
    if (loc.isDefault) return;
    try {
      await saveLocation({ ...loc, isDefault: true, isActive: true });
      showNotification(`"${loc.name}" is now set as the default godown.`, 'success');
    } catch (err) {
      // Handled in context
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (loc: Location) => {
    if (loc.isDefault && loc.isActive) {
      showNotification('Default godown cannot be marked inactive.', 'error');
      return;
    }
    try {
      await saveLocation({ ...loc, isActive: !loc.isActive });
    } catch (err) {
      // Handled in context
    }
  };

  // Export to Excel / CSV
  const handleExport = (format: 'EXCEL' | 'CSV') => {
    const exportData = filteredLocations.map((l, index) => ({
      'S.No': index + 1,
      'Location Code': l.code,
      'Location / Godown Name': l.name,
      'Type': l.type,
      'City': l.city || '-',
      'State': l.state || '-',
      'PIN Code': l.pincode || '-',
      'Is Default': l.isDefault ? 'YES' : 'NO',
      'Status': l.isActive ? 'ACTIVE' : 'INACTIVE',
    }));

    if (format === 'EXCEL') {
      ExportEngine.exportToExcel(
        exportData,
        `Locations_Godowns_${currentCompany?.name || 'ERP'}_${new Date().toISOString().split('T')[0]}`
      );
    } else {
      ExportEngine.exportToCsv(
        exportData,
        `Locations_Godowns_${currentCompany?.name || 'ERP'}_${new Date().toISOString().split('T')[0]}`
      );
    }
    showNotification(`Locations exported to ${format} successfully.`, 'success');
  };

  // Print View
  const handlePrint = () => {
    window.print();
  };

  const getTypeBadgeClass = (locType: string) => {
    switch (locType) {
      case 'GODOWN':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'WAREHOUSE':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/60';
      case 'YARD':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60';
      case 'FACTORY_FLOOR':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/60';
      case 'SHOWROOM':
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60';
      case 'BRANCH':
        return 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-3.5 text-slate-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-slate-900/90 border border-slate-800 p-3.5 sm:p-4 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Location &amp; Godown Master
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                {totalLocations} Locations
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage stock yards, factory shopfloors, warehouses, and branch dispatch godowns
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleExport('EXCEL')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            title="Export to Excel"
          >
            <ExcelFileIcon className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Print List"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs hover:shadow-emerald-600/20 transition ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Location</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Godowns / Yards</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white">{totalLocations}</span>
            <span className="text-[11px] text-slate-400">configured</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Storage Points</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400">{activeLocations}</span>
            <span className="text-[11px] text-slate-400">operational</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Default Primary Godown</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
          </div>
          <div className="mt-1">
            <div className="text-xs font-bold text-white truncate" title={defaultLocation?.name || 'None'}>
              {defaultLocation ? defaultLocation.name : 'Not set'}
            </div>
            <span className="text-[10px] text-amber-400/90 font-mono">
              {defaultLocation?.code || 'None'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cities / Regions</span>
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-cyan-400">{uniqueCities || 1}</span>
            <span className="text-[11px] text-slate-400">locations</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, godown name, city, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Location Types</option>
              {LOCATION_TYPES.map((lt) => (
                <option key={lt.type} value={lt.type}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 leading-tight">
              <tr>
                <th className="py-0.5 px-3 w-12 text-center">#</th>
                <th className="py-0.5 px-3">Code</th>
                <th className="py-0.5 px-3">Godown / Location Name</th>
                <th className="py-0.5 px-3">Type</th>
                <th className="py-0.5 px-3">City / State</th>
                <th className="py-0.5 px-3 text-center">Default</th>
                <th className="py-0.5 px-3 text-center">Status</th>
                <th className="py-0.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">No locations found matching the criteria.</p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="mt-2 text-[11px] text-emerald-400 hover:underline"
                      >
                        Clear search filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLocations.map((loc, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={loc.id}
                      data-table-id="location-master-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                        {loc.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        {loc.name}
                        {loc.isDefault && (
                          <span
                            title="Default Godown for transactions"
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          >
                            <Star className="w-2.5 h-2.5 fill-amber-300" />
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getTypeBadgeClass(
                          loc.type
                        )}`}
                      >
                        {loc.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-medium">{loc.city || '-'}</div>
                      {(loc.state || loc.pincode) && (
                        <div className="text-[11px] text-slate-500">
                          {[loc.state, loc.pincode].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {loc.isDefault ? (
                        <span className="text-amber-400 inline-flex items-center gap-1 font-semibold text-[11px]">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          Primary
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(loc)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-amber-300 px-2 py-0.5 rounded border border-slate-700 hover:border-amber-500/40 transition"
                        >
                          Make Default
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(loc)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                          loc.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700/60'
                        }`}
                      >
                        {loc.isActive ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(loc)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Location"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(loc)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                          title="Delete Location"
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
      </div>

      {/* Add / Edit Location Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#0f131d] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl text-xs text-slate-200 overflow-hidden my-4">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0a0d14]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Warehouse className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingLocation ? 'Edit Location / Godown' : 'Add New Location / Godown Master'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Configure godown, quarry yard, factory floor, or branch depot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Row 1: Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Location Code *
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. LOC-01, RM-YARD"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Location / Godown Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Raw Material Yard / Finished Goods Godown"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 2: Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Location Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as LocationType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select</option>
                  {LOCATION_TYPES.map((lt) => (
                    <option key={lt.type} value={lt.type}>
                      {lt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: City, State, PIN Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      City / Town
                    </label>
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
                    list="location_cities_list"
                    value={city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    placeholder="Type or select city..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="location_cities_list">
                    {cities.map((c) => (
                      <option key={c.id} value={c.cityName}>
                        {c.stateCode} - {c.stateName} {c.district ? `(${c.district})` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Select</option>
                    {states.map((st) => (
                      <option key={st.code} value={st.name}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="326519"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Row 4: Toggles (Default, Active) */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                  />
                  <div>
                    <span className="font-semibold text-white">Set as Primary Default Godown</span>
                    <p className="text-[10px] text-slate-400">
                      Transactions and Stock Journals will automatically select this location by default
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-800/80">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900"
                  />
                  <div>
                    <span className="font-semibold text-white">Active Location</span>
                    <p className="text-[10px] text-slate-400">
                      Inactive locations will be hidden from transaction dropdowns
                    </p>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs hover:shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingLocation ? 'Update Location' : 'Save Location'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

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
