import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { FullUnitMasterModal } from './FullUnitMasterModal';
import { SparePartItem } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { ExportEngine } from '../../services/exportEngine';
import { ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  Wrench,
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
  Cpu,
  Cog,
  ShieldAlert,
  Gauge,
  MapPin,
  Building,
  ArrowDownRight,
  TrendingDown,
  Layers,
  Activity,
  Tag,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const SPARE_PARTS_STORAGE_KEY_PREFIX = 'bahi_khata_spare_parts_';
const SPARE_CATEGORIES_STORAGE_KEY = 'bahi_khata_spare_item_categories';

const PRESET_ITEM_CATEGORIES = [
  'Diamond Tools & Blades',
  'Bearings & Bushings',
  'Hydraulics & Lubricants',
  'Motors & Electrical',
  'Abrasives & Polishing',
  'Cables, Belts & Ropes',
  'Valves, Nozzles & Fittings',
  'Pneumatics & Cylinders',
  'Fasteners & Hardware',
  'Consumables & General',
];

const DEFAULT_SPARE_PARTS: Omit<SparePartItem, 'companyId'>[] = [
  {
    id: 'sp-001',
    uuid: 'uuid-sp-001',
    partNumber: 'SP-GS-001',
    name: 'Diamond Gangsaw Blade Segments (4x10x20mm)',
    itemCategory: 'Diamond Tools & Blades',
    machineCategory: 'Gangsaw Machine',
    machineModel: 'Gasperi 80-Blade Diamond Gangsaw',
    unit: 'NOS',
    currentStock: 480,
    minStockLevel: 200,
    reorderLevel: 300,
    unitCost: 145,
    locationBin: 'Rack A - Bin 04',
    supplierBrand: 'Diamant Boart / Husqvarna',
    status: 'IN_STOCK',
    specifications: 'Cobalt-bronze matrix diamond segments for granite/hard marble slicing',
    notes: 'Standard 4mm thickness blade fitment',
    lastReplacedDate: '2026-04-10',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-002',
    uuid: 'uuid-sp-002',
    partNumber: 'SP-BRG-22220',
    name: 'SKF Heavy Duty Spherical Roller Bearing 22220',
    itemCategory: 'Bearings & Bushings',
    machineCategory: 'Gangsaw Machine',
    machineModel: 'Main Flywheel / Connecting Rod Mechanism',
    unit: 'PCS',
    currentStock: 4,
    minStockLevel: 2,
    reorderLevel: 4,
    unitCost: 12500,
    locationBin: 'Workshop Cabinet 2',
    supplierBrand: 'SKF Bearings Sweden',
    status: 'IN_STOCK',
    specifications: 'Tapered bore with adapter sleeve, C3 clearance high-vibration rated',
    notes: 'Critical spare for main crank arm',
    lastReplacedDate: '2026-03-15',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-003',
    uuid: 'uuid-sp-003',
    partNumber: 'SP-OIL-VG68',
    name: 'Castrol Hyspin VG 68 Anti-Wear Hydraulic Oil',
    itemCategory: 'Hydraulics & Lubricants',
    machineCategory: 'Hydraulics & Lubricants',
    machineModel: 'Gangsaw Hydraulic Tensioner & Block Cutter Powerpack',
    unit: 'LTR',
    currentStock: 65,
    minStockLevel: 100,
    reorderLevel: 120,
    unitCost: 220,
    locationBin: 'Oil Storage Yard - Drum 03',
    supplierBrand: 'Castrol Industrial India',
    status: 'LOW_STOCK',
    specifications: 'ISO VG 68 DIN 51524 Part 2 high thermal stability hydraulic fluid',
    notes: 'Immediate purchase order required',
    lastReplacedDate: '2026-04-18',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-004',
    uuid: 'uuid-sp-004',
    partNumber: 'SP-BLD-400',
    name: '400mm Diamond Circular Saw Blade (Bridge Cutter)',
    itemCategory: 'Diamond Tools & Blades',
    machineCategory: 'Bridge Saw Cutter',
    machineModel: 'Pedrini 5-Axis CNC Bridge Cutting Machine',
    unit: 'PCS',
    currentStock: 8,
    minStockLevel: 3,
    reorderLevel: 5,
    unitCost: 8900,
    locationBin: 'Rack B - Shelf 1',
    supplierBrand: 'Norton Clipper / Saint-Gobain',
    status: 'IN_STOCK',
    specifications: 'Silent core steel body, 50mm bore, 28 laser welded segments',
    notes: 'Used for slab edge trimming and squaring',
    lastReplacedDate: '2026-04-05',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-005',
    uuid: 'uuid-sp-005',
    partNumber: 'SP-CRN-WR16',
    name: '6x36 Heavy Duty Steel Wire Rope (16mm IWRC)',
    itemCategory: 'Cables, Belts & Ropes',
    machineCategory: 'Cranes & Gantry',
    machineModel: '20-Ton Overhead Gantry Crane Hoist',
    unit: 'MTR',
    currentStock: 120,
    minStockLevel: 50,
    reorderLevel: 80,
    unitCost: 450,
    locationBin: 'Cable Drum Rack #1',
    supplierBrand: 'Usha Martin Wire Ropes',
    status: 'IN_STOCK',
    specifications: '1960 N/mm2 tensile grade, galvanized, steel core hoist rope',
    notes: 'Quarterly inspection mandatory for safety compliance',
    lastReplacedDate: '2026-02-20',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-006',
    uuid: 'uuid-sp-006',
    partNumber: 'SP-POL-RES400',
    name: 'Diamond Resin Polishing Bricks (Frankfurt / Grit #400)',
    itemCategory: 'Abrasives & Polishing',
    machineCategory: 'Polishing Line',
    machineModel: '16-Head Automatic Slab Polishing Line',
    unit: 'SET',
    currentStock: 18,
    minStockLevel: 20,
    reorderLevel: 35,
    unitCost: 3200,
    locationBin: 'Rack C - Bin 12',
    supplierBrand: 'Tyrolit Abrasives',
    status: 'LOW_STOCK',
    specifications: 'Frankfurt base resin matrix stone polish pads (16-pack set)',
    notes: 'Consumable line abrasive for high gloss finish',
    lastReplacedDate: '2026-04-12',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-007',
    uuid: 'uuid-sp-007',
    partNumber: 'SP-MTR-15HP',
    name: '15 HP 3-Phase Squirrel Cage Induction Motor (1440 RPM)',
    itemCategory: 'Motors & Electrical',
    machineCategory: 'Slurry Pumps & Motors',
    machineModel: 'Water Recycling Slurry Centrifugal Pump',
    unit: 'NOS',
    currentStock: 1,
    minStockLevel: 1,
    reorderLevel: 2,
    unitCost: 38000,
    locationBin: 'Motor Yard Bay 3',
    supplierBrand: 'Siemens / Bharat Bijlee',
    status: 'IN_STOCK',
    specifications: '415V, 50Hz, Foot Mounted IP55 Cast Iron Frame 160M',
    notes: 'Standby pump motor for uninterrupted water supply',
    lastReplacedDate: '2026-01-10',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sp-008',
    uuid: 'uuid-sp-008',
    partNumber: 'SP-NZL-BRS',
    name: 'Heavy Duty High Pressure Water Coolant Spray Brass Nozzle',
    itemCategory: 'Valves, Nozzles & Fittings',
    machineCategory: 'Gangsaw Machine',
    machineModel: 'Blade Coolant Spray Manifold',
    unit: 'NOS',
    currentStock: 45,
    minStockLevel: 15,
    reorderLevel: 25,
    unitCost: 380,
    locationBin: 'Small Spares Bin 08',
    supplierBrand: 'Spraying Systems Co.',
    status: 'IN_STOCK',
    specifications: '1/4" NPT Male Threaded Flat Fan Spray Brass Nozzle',
    notes: 'Regular clean required to prevent lime scale blockage',
    lastReplacedDate: '2026-04-01',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const SparePartsMasterView: React.FC = () => {
  const { currentCompany, currentFiscalYear, showNotification } = useApp();

  const [spareParts, setSpareParts] = useState<SparePartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [itemCategoryFilter, setItemCategoryFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');

  // Category Management State
  const [customSpareCategories, setCustomSpareCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SPARE_CATEGORIES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedSpareCategories, setDeletedSpareCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bahi_khata_deleted_spare_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePartItem | null>(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<string[]>([
    'NOS', 'PCS', 'SET', 'LTR', 'KG', 'MTR', 'BOX', 'SQFT', 'SQMT', 'TON', 'PKT'
  ]);

  // Load available units from DB
  useEffect(() => {
    dbStorage.getItemUnits().then((units) => {
      if (units && units.length > 0) {
        setAvailableUnits((prev) =>
          Array.from(new Set([...prev, ...units.map((u) => u.symbol.toUpperCase())]))
        );
      }
    }).catch(console.error);
  }, []);

  // Form Fields
  const [partNumber, setPartNumber] = useState('');
  const [name, setName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('');
  const [machineCategory, setMachineCategory] = useState('');
  const [customMachineCategory, setCustomMachineCategory] = useState('');
  const [machineModel, setMachineModel] = useState('');
  const [unit, setUnit] = useState('');
  const [currentStock, setCurrentStock] = useState<number | string>('');
  const [minStockLevel, setMinStockLevel] = useState<number | string>('');
  const [reorderLevel, setReorderLevel] = useState<number | string>('');
  const [unitCost, setUnitCost] = useState<number | string>('');
  const [locationBin, setLocationBin] = useState('');
  const [supplierBrand, setSupplierBrand] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  const partNumberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modalOpen) {
      const t1 = setTimeout(() => partNumberInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => partNumberInputRef.current?.focus(), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [modalOpen]);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    itemDetails?: { label: string; value: string | number }[];
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'INFO',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const getStorageKey = () => {
    return `${SPARE_PARTS_STORAGE_KEY_PREFIX}${currentCompany?.id || 'comp-default-01'}`;
  };

  const loadParts = () => {
    try {
      const key = getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed: SparePartItem[] = JSON.parse(raw);
        // Ensure itemCategory is present on all records
        const sanitized = parsed.map((p) => ({
          ...p,
          itemCategory: p.itemCategory || 'Diamond Tools & Blades',
        }));
        setSpareParts(sanitized);
      } else {
        const seeded: SparePartItem[] = DEFAULT_SPARE_PARTS.map((p) => ({
          ...p,
          companyId: currentCompany?.id || 'comp-default-01',
        }));
        localStorage.setItem(key, JSON.stringify(seeded));
        setSpareParts(seeded);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadParts();
  }, [currentCompany?.id]);

  const saveToStorage = (updated: SparePartItem[]) => {
    setSpareParts(updated);
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const machineCategories: string[] = Array.from(
    new Set(spareParts.map((p) => p.machineCategory).filter((c): c is string => Boolean(c)))
  );
  if (!machineCategories.includes('Gangsaw Machine')) machineCategories.push('Gangsaw Machine');
  if (!machineCategories.includes('Bridge Saw Cutter')) machineCategories.push('Bridge Saw Cutter');
  if (!machineCategories.includes('Polishing Line')) machineCategories.push('Polishing Line');
  if (!machineCategories.includes('Cranes & Gantry')) machineCategories.push('Cranes & Gantry');
  if (!machineCategories.includes('Hydraulics & Lubricants')) machineCategories.push('Hydraulics & Lubricants');
  if (!machineCategories.includes('Slurry Pumps & Motors')) machineCategories.push('Slurry Pumps & Motors');
  machineCategories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const allItemCategories: string[] = Array.from(
    new Set([
      ...PRESET_ITEM_CATEGORIES,
      ...spareParts.map((p) => p.itemCategory).filter((c): c is string => Boolean(c)),
      ...customSpareCategories,
    ])
  )
    .filter((c) => !deletedSpareCategories.some((d) => d.toLowerCase() === c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const handleAddSpareCategory = () => {
    if (!newCategoryName.trim()) {
      showNotification('Please enter Category Name.', 'error');
      return;
    }
    const trimmed = newCategoryName.trim();
    if (allItemCategories.some((c) => c.trim().toLowerCase() === trimmed.toLowerCase())) {
      showNotification(`Warning: Item Category "${trimmed}" already exists. Duplicate category names are not allowed.`, 'error');
      return;
    }

    if (deletedSpareCategories.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      const updatedDeleted = deletedSpareCategories.filter((d) => d.toLowerCase() !== trimmed.toLowerCase());
      setDeletedSpareCategories(updatedDeleted);
      try {
        localStorage.setItem('bahi_khata_deleted_spare_categories', JSON.stringify(updatedDeleted));
      } catch (e) {
        console.error(e);
      }
    }

    const updated = [...customSpareCategories.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()), trimmed];
    setCustomSpareCategories(updated);
    try {
      localStorage.setItem(SPARE_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    showNotification(`Category "${trimmed}" added successfully.`, 'success');
    setNewCategoryName('');
  };

  const handleStartEditSpareCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditingCategoryValue(cat);
  };

  const handleSaveEditSpareCategory = (oldCat: string) => {
    const trimmed = editingCategoryValue.trim();
    if (!trimmed) {
      showNotification('Category Name cannot be empty.', 'error');
      return;
    }

    if (trimmed.toLowerCase() === oldCat.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    if (allItemCategories.some((c) => c.trim().toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== oldCat.toLowerCase())) {
      showNotification(`Warning: Item Category "${trimmed}" already exists. Duplicate category names are not allowed.`, 'error');
      return;
    }

    try {
      const updatedDeleted = Array.from(new Set([...deletedSpareCategories, oldCat])).filter(
        (c) => c.toLowerCase() !== trimmed.toLowerCase()
      );
      setDeletedSpareCategories(updatedDeleted);
      localStorage.setItem('bahi_khata_deleted_spare_categories', JSON.stringify(updatedDeleted));

      const updatedCustom = Array.from(
        new Set([...customSpareCategories.filter((c) => c.toLowerCase() !== oldCat.toLowerCase()), trimmed])
      );
      setCustomSpareCategories(updatedCustom);
      localStorage.setItem(SPARE_CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCustom));

      // Update parts assigned to oldCat
      const affected = spareParts.filter((p) => (p.itemCategory || '').toLowerCase() === oldCat.toLowerCase());
      if (affected.length > 0) {
        const updatedParts = spareParts.map((p) =>
          (p.itemCategory || '').toLowerCase() === oldCat.toLowerCase() ? { ...p, itemCategory: trimmed } : p
        );
        saveToStorage(updatedParts);
      }

      if (itemCategory.toLowerCase() === oldCat.toLowerCase()) {
        setItemCategory(trimmed);
      }
      if (itemCategoryFilter.toLowerCase() === oldCat.toLowerCase()) {
        setItemCategoryFilter(trimmed);
      }

      setEditingCategory(null);
      showNotification(`Category renamed to "${trimmed}" successfully.`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update category.', 'error');
    }
  };

  const handleDeleteSpareCategory = (cat: string) => {
    const count = spareParts.filter((p) => (p.itemCategory || '').toLowerCase() === cat.toLowerCase()).length;
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Delete Spare Part Category',
      message:
        count > 0
          ? `Are you sure you want to delete category "${cat}"? It is currently assigned to ${count} part(s). Deleting it will clear the category from these parts.`
          : `Are you sure you want to delete category "${cat}"?`,
      itemDetails: [
        { label: 'Category Name', value: cat },
        { label: 'Assigned Parts', value: `${count} part(s)` },
      ],
      onConfirm: () => {
        try {
          const updatedDeleted = Array.from(new Set([...deletedSpareCategories, cat]));
          setDeletedSpareCategories(updatedDeleted);
          localStorage.setItem('bahi_khata_deleted_spare_categories', JSON.stringify(updatedDeleted));

          const updatedCustom = customSpareCategories.filter((c) => c.toLowerCase() !== cat.toLowerCase());
          setCustomSpareCategories(updatedCustom);
          localStorage.setItem(SPARE_CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCustom));

          if (count > 0) {
            const updatedParts = spareParts.map((p) =>
              (p.itemCategory || '').toLowerCase() === cat.toLowerCase() ? { ...p, itemCategory: '' } : p
            );
            saveToStorage(updatedParts);
          }

          if (itemCategory.toLowerCase() === cat.toLowerCase()) {
            setItemCategory('');
          }
          if (itemCategoryFilter.toLowerCase() === cat.toLowerCase()) {
            setItemCategoryFilter('ALL');
          }

          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          showNotification(`Category "${cat}" deleted successfully.`, 'info');
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete category.', 'error');
        }
      },
    });
  };

  const filteredParts = spareParts.filter((part) => {
    const matchSearch =
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.itemCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.machineCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.machineModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.supplierBrand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (part.locationBin || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchMachine = categoryFilter === 'ALL' || part.machineCategory === categoryFilter;
    const matchItemCategory = itemCategoryFilter === 'ALL' || part.itemCategory === itemCategoryFilter;

    let matchStock = true;
    if (stockStatusFilter === 'LOW_STOCK') {
      matchStock = part.currentStock <= part.reorderLevel && part.currentStock > 0;
    } else if (stockStatusFilter === 'OUT_OF_STOCK') {
      matchStock = part.currentStock <= 0;
    } else if (stockStatusFilter === 'IN_STOCK') {
      matchStock = part.currentStock > part.reorderLevel;
    }

    return matchSearch && matchMachine && matchItemCategory && matchStock;
  });

  // Keyboard navigation for Spare Parts table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredParts.length,
    tableId: 'spare-parts-table',
    enabled: !modalOpen && !confirmModal.isOpen && !categoryModalOpen,
  });

  const totalStockValuation = spareParts.reduce((sum, p) => sum + (p.currentStock * p.unitCost), 0);
  const uniqueCategoriesCount = Array.from(new Set(spareParts.map((p) => p.itemCategory || 'General'))).length;
  const lowStockCount = spareParts.filter((p) => p.currentStock <= p.reorderLevel).length;

  const openNewPartModal = () => {
    setEditingPart(null);
    setPartNumber(`SP-${Math.floor(1000 + Math.random() * 9000)}`);
    setName('');
    setItemCategory('');
    setCustomItemCategory('');
    setMachineCategory('');
    setCustomMachineCategory('');
    setMachineModel('');
    setUnit('');
    setCurrentStock('');
    setMinStockLevel('');
    setReorderLevel('');
    setUnitCost('');
    setLocationBin('');
    setSupplierBrand('');
    setSpecifications('');
    setNotes('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditPartModal = (part: SparePartItem) => {
    setEditingPart(part);
    setPartNumber(part.partNumber);
    setName(part.name);
    setItemCategory(part.itemCategory || '');
    setCustomItemCategory('');
    setMachineCategory(part.machineCategory || '');
    setCustomMachineCategory('');
    setMachineModel(part.machineModel || '');
    setUnit(part.unit || '');
    setCurrentStock(part.currentStock);
    setMinStockLevel(part.minStockLevel);
    setReorderLevel(part.reorderLevel);
    setUnitCost(part.unitCost);
    setLocationBin(part.locationBin || '');
    setSupplierBrand(part.supplierBrand || '');
    setSpecifications(part.specifications || '');
    setNotes(part.notes || '');
    setIsActive(part.isActive !== false);
    setModalOpen(true);
  };

  const handleSavePart = () => {
    if (!name.trim()) {
      showNotification('Please enter Spare Part Name.', 'error');
      return;
    }
    if (!partNumber.trim()) {
      showNotification('Please enter Part Number / Code.', 'error');
      return;
    }

    const trimmedName = name.trim().toLowerCase();
    const duplicateName = spareParts.find(
      (p) => p.id !== editingPart?.id && p.name.trim().toLowerCase() === trimmedName
    );
    if (duplicateName) {
      showNotification(`Warning: A spare part named "${name.trim()}" already exists. Duplicate part names are not allowed.`, 'error');
      return;
    }

    const trimmedPartNo = partNumber.trim().toUpperCase();
    const duplicatePartNo = spareParts.find(
      (p) => p.id !== editingPart?.id && p.partNumber.trim().toUpperCase() === trimmedPartNo
    );
    if (duplicatePartNo) {
      showNotification(`Warning: Part Number "${partNumber.trim().toUpperCase()}" already exists. Duplicate part numbers are not allowed.`, 'error');
      return;
    }

    if (itemCategory === 'CUSTOM') {
      if (!customItemCategory.trim()) {
        showNotification('Please enter custom item category.', 'error');
        return;
      }
      const dupCat = allItemCategories.find(
        (c) => c.trim().toLowerCase() === customItemCategory.trim().toLowerCase()
      );
      if (dupCat) {
        showNotification(`Warning: Item Category "${customItemCategory.trim()}" already exists. Duplicate category names are not allowed.`, 'error');
        return;
      }
    }

    if (machineCategory === 'CUSTOM') {
      if (!customMachineCategory.trim()) {
        showNotification('Please enter custom machinery category.', 'error');
        return;
      }
      const dupMachine = machineCategories.find(
        (c) => c.trim().toLowerCase() === customMachineCategory.trim().toLowerCase()
      );
      if (dupMachine) {
        showNotification(`Warning: Machinery Category "${customMachineCategory.trim()}" already exists. Duplicate category names are not allowed.`, 'error');
        return;
      }
    }

    const finalItemCategory =
      itemCategory === 'CUSTOM'
        ? (customItemCategory.trim() || 'General Spare Parts')
        : (itemCategory.trim() || 'General Spare Parts');

    if (itemCategory === 'CUSTOM' && customItemCategory.trim()) {
      if (!customSpareCategories.includes(customItemCategory.trim())) {
        const updated = [...customSpareCategories, customItemCategory.trim()];
        setCustomSpareCategories(updated);
        try {
          localStorage.setItem(SPARE_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const finalMachineCategory =
      machineCategory === 'CUSTOM'
        ? (customMachineCategory.trim() || 'General Machinery')
        : machineCategory;

    const now = new Date().toISOString();
    const stockVal = Number(currentStock) || 0;
    const reorderVal = Number(reorderLevel) || 0;

    let computedStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
    if (stockVal <= 0) computedStatus = 'OUT_OF_STOCK';
    else if (stockVal <= reorderVal) computedStatus = 'LOW_STOCK';

    const partData: SparePartItem = {
      id: editingPart ? editingPart.id : `sp-${Date.now()}`,
      uuid: editingPart?.uuid || uuidv4(),
      companyId: currentCompany?.id || 'comp-default-01',
      partNumber: partNumber.trim().toUpperCase(),
      name: name.trim(),
      itemCategory: finalItemCategory,
      machineCategory: finalMachineCategory,
      machineModel: machineModel.trim(),
      unit: unit.toUpperCase(),
      currentStock: stockVal,
      minStockLevel: Number(minStockLevel) || 0,
      reorderLevel: reorderVal,
      unitCost: Number(unitCost) || 0,
      locationBin: locationBin.trim(),
      supplierBrand: supplierBrand.trim(),
      status: computedStatus,
      specifications: specifications.trim(),
      notes: notes.trim(),
      isActive,
      createdAt: editingPart?.createdAt || now,
      updatedAt: now,
    };

    let updated: SparePartItem[];
    if (editingPart) {
      updated = spareParts.map((p) => (p.id === editingPart.id ? partData : p));
    } else {
      updated = [partData, ...spareParts];
    }

    saveToStorage(updated);
    // Refresh form state
    setEditingPart(null);
    setPartNumber('');
    setName('');
    setItemCategory('');
    setCustomItemCategory('');
    setMachineCategory('');
    setCustomMachineCategory('');
    setMachineModel('');
    setUnit('');
    setCurrentStock('');
    setMinStockLevel('');
    setReorderLevel('');
    setUnitCost('');
    setLocationBin('');
    setSupplierBrand('');
    setSpecifications('');
    setNotes('');
    setIsActive(true);
    setModalOpen(false);
    showNotification(`Spare Part "${partData.name}" ${editingPart ? 'updated' : 'added'} successfully.`, 'success');
  };

  const handleDeletePart = (part: SparePartItem) => {
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Delete Spare Part Master',
      message: `Are you sure you want to remove spare part "${part.name}" (${part.partNumber})?`,
      itemDetails: [
        { label: 'Part Number', value: part.partNumber },
        { label: 'Part Name', value: part.name },
        { label: 'Item Category', value: part.itemCategory || 'General Spares' },
        { label: 'Machine Category', value: part.machineCategory },
        { label: 'Current Stock', value: `${part.currentStock} ${part.unit}` },
      ],
      onConfirm: () => {
        const updated = spareParts.filter((p) => p.id !== part.id);
        saveToStorage(updated);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showNotification(`Spare Part "${part.name}" deleted.`, 'info');
      },
    });
  };

  const handleExportCSV = () => {
    const exportData = filteredParts.map((p) => ({
      'Part Number': p.partNumber,
      'Spare Part Name': p.name,
      'Item Category': p.itemCategory || 'General Spares',
      'Machine Category': p.machineCategory,
      'Machine / Application': p.machineModel || '-',
      'Unit': p.unit,
      'Current Stock': p.currentStock,
      'Reorder Level': p.reorderLevel,
      'Unit Cost (₹)': p.unitCost,
      'Total Value (₹)': p.currentStock * p.unitCost,
      'Location / Bin': p.locationBin || '-',
      'Supplier / Brand': p.supplierBrand || '-',
      'Stock Status': p.status,
    }));

    ExportEngine.exportToCsv(exportData, `Spare_Parts_Master_${currentCompany?.name || 'ERP'}`);
    showNotification('Spare Parts Master exported to CSV.', 'success');
  };

  return (
    <div className="space-y-3.5" id="spare_parts_master_view">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                Spare Parts Master
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  Plant & Machinery
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Track gangsaw blades, bearings, hydraulic lubricants, crane ropes, polishing abrasives & machine spares
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <ExcelFileIcon className="w-3.5 h-3.5" />
              <span>Export CSV/Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Print</span>
            </button>
            <button
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>
            <button
              onClick={openNewPartModal}
              id="add_spare_part_btn"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-slate-950 font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Spare Part</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Total Spare Parts</span>
            <p className="text-base font-bold text-white mt-0.5 font-mono">{spareParts.length}</p>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-cyan-400 tracking-wider">Item Categories</span>
            <p className="text-base font-bold text-cyan-400 mt-0.5 font-mono">{uniqueCategoriesCount}</p>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-amber-400 tracking-wider">Low Stock Alerts</span>
            <p className="text-base font-bold text-amber-400 mt-0.5 font-mono">{lowStockCount}</p>
          </div>
          <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider">Total Spares Value</span>
            <p className="text-base font-bold text-emerald-400 mt-0.5 font-mono">
              ₹{totalStockValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 flex flex-col lg:flex-row items-center justify-between gap-2.5 shadow-sm">
        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search part #, name, category, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Item Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Category:</span>
            <select
              value={itemCategoryFilter}
              onChange={(e) => setItemCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {allItemCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Machine Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Machine:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Machinery</option>
              {machineCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Stock Status:</span>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Stock</option>
              <option value="IN_STOCK">Adequate Stock</option>
              <option value="LOW_STOCK">Low Stock (Reorder Alert)</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Spare Parts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider leading-tight">
                <th className="py-0.5 px-3">Part #</th>
                <th className="py-0.5 px-3">Part Name & Machine Application</th>
                <th className="py-0.5 px-3">Item Category</th>
                <th className="py-0.5 px-3">Location / Brand</th>
                <th className="py-0.5 px-3 text-right">Available Stock</th>
                <th className="py-0.5 px-3 text-right">Unit Cost</th>
                <th className="py-0.5 px-3 text-right">Total Value</th>
                <th className="py-0.5 px-3 text-center">Status</th>
                <th className="py-0.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Wrench className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-slate-400">No spare parts found</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Click "Add Spare Part" to record machine spares and maintenance components.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredParts.map((part, idx) => {
                  const isSelected = idx === selectedIndex;
                  const totalVal = part.currentStock * part.unitCost;
                  const isLow = part.currentStock <= part.reorderLevel;

                  return (
                    <tr
                      key={part.id}
                      data-table-id="spare-parts-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-1 px-3 font-mono font-bold text-cyan-400 text-xs">
                        {part.partNumber}
                      </td>
                      <td className="py-1 px-3">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors text-xs">
                          {part.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span className="px-1 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            {part.machineCategory}
                          </span>
                          {part.machineModel && (
                            <>
                              <span className="text-slate-600">&bull;</span>
                              <span className="text-slate-400 truncate max-w-xs">{part.machineModel}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-1 px-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {part.itemCategory || 'General Spares'}
                        </span>
                      </td>
                      <td className="py-1 px-3">
                        <div className="flex items-center gap-1 text-slate-300 text-[11px]">
                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{part.locationBin || 'Unassigned'}</span>
                        </div>
                        {part.supplierBrand && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {part.supplierBrand}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-medium text-xs">
                        <span
                          className={`font-bold ${
                            part.currentStock <= 0
                              ? 'text-rose-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-white'
                          }`}
                        >
                          {part.currentStock}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">{part.unit}</span>
                        {isLow && (
                          <div className="text-[9px] text-amber-400 font-mono">
                            Reorder: {part.reorderLevel}
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right font-mono text-slate-300 text-xs">
                        ₹{part.unitCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-3 text-right font-mono font-bold text-emerald-400 text-xs">
                        ₹{totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            part.currentStock <= 0
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : isLow
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {part.currentStock <= 0 ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="py-1 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditPartModal(part)}
                            title="Edit Spare Part"
                            className="p-1 rounded bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePart(part)}
                            title="Delete Spare Part"
                            className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
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

      {/* Add / Edit Spare Part Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-[99999] flex items-center justify-center p-2 sm:p-4 pt-14 sm:pt-16 pb-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[78vh] sm:max-h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingPart ? 'Edit Spare Part Master' : 'Add New Spare Part'}
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Define spare part name, item category, machine model, stock levels & location bin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-5 py-3 space-y-3 max-h-[68vh] overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    Part Number / Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    ref={partNumberInputRef}
                    type="text"
                    placeholder="e.g. SP-GS-001"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {Boolean(partNumber.trim() && spareParts.some((p) => p.id !== editingPart?.id && p.partNumber.trim().toUpperCase() === partNumber.trim().toUpperCase())) && (
                    <div className="mt-1 p-1.5 bg-rose-950/60 border border-rose-500/60 rounded-md text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Warning: Part Number &quot;{partNumber.trim().toUpperCase()}&quot; already in use.</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    Spare Part Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Diamond Gangsaw Blade Segments"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {Boolean(name.trim() && spareParts.some((p) => p.id !== editingPart?.id && p.name.trim().toLowerCase() === name.trim().toLowerCase())) && (
                    <div className="mt-1 p-1.5 bg-rose-950/60 border border-rose-500/60 rounded-md text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Warning: Spare Part &quot;{name.trim()}&quot; already exists. Duplicate part names not allowed.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Item Category & Machinery Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    Item Category <span className="text-cyan-400">*</span>
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select</option>
                    <option value="CUSTOM" className="text-cyan-400 font-bold bg-[#0f172a]">+ Add Custom Item Category</option>
                    {allItemCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {itemCategory === 'CUSTOM' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Enter custom item category"
                        value={customItemCategory}
                        onChange={(e) => setCustomItemCategory(e.target.value)}
                        className="mt-1.5 w-full bg-slate-950 border border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      {Boolean(customItemCategory.trim() && allItemCategories.some((c) => c.trim().toLowerCase() === customItemCategory.trim().toLowerCase())) && (
                        <div className="mt-1 p-1.5 bg-rose-950/60 border border-rose-500/60 rounded-md text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Warning: Item Category &quot;{customItemCategory.trim()}&quot; already exists.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-300 mb-0.5">
                    Machinery Category
                  </label>
                  <select
                    value={machineCategory}
                    onChange={(e) => setMachineCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select</option>
                    <option value="CUSTOM" className="text-cyan-400 font-bold bg-[#0f172a]">+ Add Custom Machinery Category</option>
                    {machineCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {machineCategory === 'CUSTOM' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Enter custom machinery category"
                        value={customMachineCategory}
                        onChange={(e) => setCustomMachineCategory(e.target.value)}
                        className="mt-1.5 w-full bg-slate-950 border border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      {Boolean(customMachineCategory.trim() && machineCategories.some((c) => c.trim().toLowerCase() === customMachineCategory.trim().toLowerCase())) && (
                        <div className="mt-1 p-1.5 bg-rose-950/60 border border-rose-500/60 rounded-md text-rose-300 text-[10px] flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Warning: Machinery Category &quot;{customMachineCategory.trim()}&quot; already exists.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Machine Model & Location / Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Machine Model / Application
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gasperi 80-Blade Diamond Gangsaw"
                    value={machineModel}
                    onChange={(e) => setMachineModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Storage Location / Bin
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A - Shelf 2"
                    value={locationBin}
                    onChange={(e) => setLocationBin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Supplier / Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SKF Bearings, Castrol"
                    value={supplierBrand}
                    onChange={(e) => setSupplierBrand(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Unit, Stock & Costs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Unit</label>
                    <button
                      type="button"
                      onClick={() => setUnitModalOpen(true)}
                      className="text-[9px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      +Add
                    </button>
                  </div>
                  <select
                    value={unit}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_UNIT__') {
                        setUnitModalOpen(true);
                      } else {
                        setUnit(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Select</option>
                    <option value="__ADD_UNIT__" className="text-cyan-400 font-bold bg-[#0f172a]">
                      + Add Measurement Unit...
                    </option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Available Stock
                  </label>
                  <input
                    type="number"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Total Stock Value
                  </label>
                  <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-400">
                    ₹{((Number(currentStock) || 0) * (Number(unitCost) || 0)).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Stock Levels & Technical Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Minimum Safety Stock
                  </label>
                  <input
                    type="number"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Reorder Alert Level
                  </label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Technical Specifications
                  </label>
                  <input
                    type="text"
                    placeholder="Dimensions, grade, thread, voltage, etc."
                    value={specifications}
                    onChange={(e) => setSpecifications(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSavePart}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingPart ? 'Update Spare Part' : 'Save Spare Part'}</span>
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Spare Part Category Management Modal */}
      {categoryModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 pt-14 sm:pt-16 pb-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-800/90 px-5 py-3 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Spare Part Categories Master</h3>
                  <p className="text-[11px] text-slate-400">View and create unique spare part categories</p>
                </div>
              </div>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Add New Category */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <label className="block text-[11px] font-bold uppercase text-slate-300">
                  Add New Category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Sensors & Transducers"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSpareCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSpareCategory}
                    className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {Boolean(newCategoryName.trim() && allItemCategories.some((c) => c.trim().toLowerCase() === newCategoryName.trim().toLowerCase())) && (
                  <div className="p-2.5 bg-rose-950/60 border border-rose-500/60 rounded-md text-rose-300 text-[11px] flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Warning: Item Category &quot;{newCategoryName.trim()}&quot; already exists. Duplicate category names are not allowed.</span>
                  </div>
                )}
              </div>

              {/* Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-medium text-[11px] px-1">
                  <span>Existing Categories ({allItemCategories.length})</span>
                  <div className="flex items-center gap-6">
                    <span>Parts Count</span>
                    <span className="w-16 text-center">Action</span>
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {allItemCategories.map((cat) => {
                    const count = spareParts.filter((p) => (p.itemCategory || '').toLowerCase() === cat.toLowerCase()).length;
                    const isEditing = editingCategory === cat;
                    return (
                      <div
                        key={cat}
                        className={`flex items-center justify-between p-2.5 bg-slate-950/40 hover:bg-slate-800/40 rounded-lg border transition gap-2 ${
                          isEditing ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-slate-800/80'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                            <input
                              type="text"
                              value={editingCategoryValue}
                              onChange={(e) => setEditingCategoryValue(e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditSpareCategory(cat);
                                } else if (e.key === 'Escape') {
                                  setEditingCategory(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditSpareCategory(cat)}
                              title="Save Changes"
                              className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition cursor-pointer shrink-0 font-bold"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              title="Cancel"
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                              <span className="text-white font-medium truncate">{cat}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                                {count} {count === 1 ? 'part' : 'parts'}
                              </span>
                              <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSpareCategory(cat)}
                                  title="Edit Category"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSpareCategory(cat)}
                                  title="Delete Category"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        itemDetails={confirmModal.itemDetails}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Full Measurement Unit Master Modal */}
      <FullUnitMasterModal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onCreated={(newUnit) => {
          const sym = newUnit.symbol.toUpperCase();
          setAvailableUnits((prev) => Array.from(new Set([...prev, sym])));
          setUnit(sym);
        }}
      />
    </div>
  );
};
export default SparePartsMasterView;
