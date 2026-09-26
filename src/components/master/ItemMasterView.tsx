import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { dbStorage } from '../../services/storage/indexedDbStorage';
import { InventoryItem, ItemUnit } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { QuickCreateLedgerModal } from '../banking/QuickCreateLedgerModal';
import { FullUnitMasterModal } from './FullUnitMasterModal';
import { ExportEngine } from '../../services/exportEngine';
import { inventoryEngine } from '../../services/inventoryEngine';
import { masterSyncService } from '../../services/masterSyncService';
import { ExcelFileIcon } from '../common/DocumentIcons';
import { useTableKeyboardNavigation } from '../../hooks/useTableKeyboardNavigation';
import {
  Boxes,
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
  Package,
  Layers,
  ArrowRightLeft,
  DollarSign,
  Tag,
  Hash,
  Eye,
  SlidersHorizontal,
  MapPin,
  FolderPlus,
  Calculator,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const ItemMasterView: React.FC = () => {
  const { currentCompany, currentFiscalYear, inventoryItems, locations, refreshActiveData, showNotification, setActiveTab, ledgers } = useApp();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<ItemUnit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Category Management State
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bahi_khata_item_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bahi_khata_deleted_item_categories');
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
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [taxPercent, setTaxPercent] = useState<number | string>('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [salesAc, setSalesAc] = useState('');
  const [purchaseAc, setPurchaseAc] = useState('');
  const [primaryUnit, setPrimaryUnit] = useState('');
  const [alternateUnit, setAlternateUnit] = useState('');
  const [conversionFactor, setConversionFactor] = useState<number | string>('');
  const [conversionDirection, setConversionDirection] = useState<'PRIMARY_TO_ALT' | 'ALT_TO_PRIMARY'>('PRIMARY_TO_ALT');
  const [decimalPlaces, setDecimalPlaces] = useState<number | string>('');
  const [locationRows, setLocationRows] = useState<
    { id: string; locationId: string; qty: number | string; rate: number | string; amount: number | string }[]
  >([{ id: '1', locationId: '', qty: '', rate: '', amount: '' }]);
  const [valuationMethod, setValuationMethod] = useState<'FIFO' | 'WEIGHTED_AVG' | 'MOVING_AVG' | ''>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [quickLedgerModalOpen, setQuickLedgerModalOpen] = useState(false);
  const [quickLedgerTarget, setQuickLedgerTarget] = useState<'sales' | 'purchase'>('sales');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitTarget, setUnitTarget] = useState<'primary' | 'alternate'>('primary');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (itemModalOpen) {
      const t1 = setTimeout(() => nameInputRef.current?.focus(), 60);
      const t2 = setTimeout(() => nameInputRef.current?.focus(), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [itemModalOpen]);

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

  const cleanItemName = (rawName: string | undefined): string => {
    if (!rawName) return '';
    return rawName
      .replace(/\s*-\s*Main Central Godown/gi, '')
      .replace(/Main Central Godown/gi, '')
      .replace(/\s*-\s*Central Godown/gi, '')
      .trim();
  };

  const loadData = async () => {
    try {
      const dbItems = await dbStorage.getInventoryItems();
      let hasModified = false;
      const sanitizedItems = dbItems.map((item) => {
        if (item.name && /Main Central Godown/i.test(item.name)) {
          hasModified = true;
          const cleaned = cleanItemName(item.name);
          const updated = { ...item, name: cleaned };
          dbStorage.saveInventoryItem(updated).catch(console.error);
          return updated;
        }
        return item;
      });
      setItems(sanitizedItems);
      if (hasModified) {
        await refreshActiveData();
      }
      const dbUnits = await dbStorage.getItemUnits();
      setUnits(dbUnits);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCompany, currentFiscalYear, inventoryItems]);

  const baseCategories = [
    'Kota Stone',
    'Granite Slabs',
    'Marble Slabs',
    'Sandstone',
    'Raw Material Blocks',
    'Finished Tiles',
  ];

  const categories = Array.from(
    new Set([
      ...baseCategories,
      ...items.map((i) => i.category || '').filter(Boolean),
      ...customCategories,
    ])
  )
    .filter((c) => !deletedCategories.some((d) => d.toLowerCase() === c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      showNotification('Please enter Category Name.', 'error');
      return;
    }
    const trimmed = newCategoryName.trim();
    if (categories.some((c) => c.trim().toLowerCase() === trimmed.toLowerCase())) {
      showNotification(`Warning: Item Category "${trimmed}" already exists. Duplicate category names are not allowed.`, 'error');
      return;
    }

    if (deletedCategories.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      const updatedDeleted = deletedCategories.filter((d) => d.toLowerCase() !== trimmed.toLowerCase());
      setDeletedCategories(updatedDeleted);
      try {
        localStorage.setItem('bahi_khata_deleted_item_categories', JSON.stringify(updatedDeleted));
      } catch (e) {
        console.error(e);
      }
    }

    const updated = [...customCategories.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()), trimmed];
    setCustomCategories(updated);
    try {
      localStorage.setItem('bahi_khata_item_categories', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    showNotification(`Category "${trimmed}" added successfully.`, 'success');
    setNewCategoryName('');
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCategory(cat);
    setEditingCategoryValue(cat);
  };

  const handleSaveEditCategory = async (oldCat: string) => {
    const trimmed = editingCategoryValue.trim();
    if (!trimmed) {
      showNotification('Category Name cannot be empty.', 'error');
      return;
    }

    if (trimmed.toLowerCase() === oldCat.toLowerCase()) {
      setEditingCategory(null);
      return;
    }

    if (categories.some((c) => c.trim().toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== oldCat.toLowerCase())) {
      showNotification(`Warning: Item Category "${trimmed}" already exists. Duplicate category names are not allowed.`, 'error');
      return;
    }

    try {
      // 1. Mark oldCat as deleted so hardcoded base category doesn't re-emerge
      const updatedDeleted = Array.from(new Set([...deletedCategories, oldCat])).filter(
        (c) => c.toLowerCase() !== trimmed.toLowerCase()
      );
      setDeletedCategories(updatedDeleted);
      localStorage.setItem('bahi_khata_deleted_item_categories', JSON.stringify(updatedDeleted));

      // 2. Update customCategories
      const updatedCustom = Array.from(
        new Set([...customCategories.filter((c) => c.toLowerCase() !== oldCat.toLowerCase()), trimmed])
      );
      setCustomCategories(updatedCustom);
      localStorage.setItem('bahi_khata_item_categories', JSON.stringify(updatedCustom));

      // 3. Update items assigned to oldCat
      const affectedItems = items.filter((i) => (i.category || '').toLowerCase() === oldCat.toLowerCase());
      if (affectedItems.length > 0) {
        for (const item of affectedItems) {
          await dbStorage.saveInventoryItem({ ...item, category: trimmed });
        }
        await loadData();
        await refreshActiveData();
      }

      // 4. Update current form state if matching
      if (category.toLowerCase() === oldCat.toLowerCase()) {
        setCategory(trimmed);
      }
      if (categoryFilter.toLowerCase() === oldCat.toLowerCase()) {
        setCategoryFilter(trimmed);
      }

      setEditingCategory(null);
      showNotification(`Category renamed to "${trimmed}" successfully.`, 'success');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update category.', 'error');
    }
  };

  const handleDeleteCategory = (cat: string) => {
    const count = items.filter((i) => (i.category || '').toLowerCase() === cat.toLowerCase()).length;
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Delete Item Category',
      message:
        count > 0
          ? `Are you sure you want to delete category "${cat}"? It is currently assigned to ${count} item(s). Deleting it will clear the category from these items.`
          : `Are you sure you want to delete category "${cat}"?`,
      itemDetails: [
        { label: 'Category Name', value: cat },
        { label: 'Assigned Items', value: `${count} item(s)` },
      ],
      onConfirm: async () => {
        try {
          // Add to deleted categories
          const updatedDeleted = Array.from(new Set([...deletedCategories, cat]));
          setDeletedCategories(updatedDeleted);
          localStorage.setItem('bahi_khata_deleted_item_categories', JSON.stringify(updatedDeleted));

          // Remove from custom categories
          const updatedCustom = customCategories.filter((c) => c.toLowerCase() !== cat.toLowerCase());
          setCustomCategories(updatedCustom);
          localStorage.setItem('bahi_khata_item_categories', JSON.stringify(updatedCustom));

          // If items use this category, clear their category
          if (count > 0) {
            for (const item of items) {
              if ((item.category || '').toLowerCase() === cat.toLowerCase()) {
                await dbStorage.saveInventoryItem({ ...item, category: '' });
              }
            }
            await loadData();
            await refreshActiveData();
          }

          if (category.toLowerCase() === cat.toLowerCase()) {
            setCategory('');
          }
          if (categoryFilter.toLowerCase() === cat.toLowerCase()) {
            setCategoryFilter('ALL');
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

  // Available Sales & Purchase Ledgers for Item Master
  const salesLedgerOptions = React.useMemo(() => {
    const list: string[] = [
      'GST Sales 18%',
      'GST Sales 12%',
      'GST Sales 5%',
      'GST Sales 28%',
      'Marble Sales A/c',
      'Granite & Slab Sales',
      'Kota Stone Sales A/c',
      'Interstate Sales (IGST 18%)',
      'Nil-Rated / Exempted Sales',
      'General Sales Account',
    ];
    if (Array.isArray(ledgers) && ledgers.length > 0) {
      ledgers.forEach((l) => {
        if (l?.name && !list.includes(l.name)) {
          list.push(l.name);
        }
      });
    }
    return list;
  }, [ledgers]);

  const purchaseLedgerOptions = React.useMemo(() => {
    const list: string[] = [
      'Purchase Account',
      'GST Purchase 18%',
      'GST Purchase 12%',
      'GST Purchase 5%',
      'Raw Blocks Purchase A/c',
      'Interstate Purchase A/c',
      'Consumables & Store A/c',
      'Spare Parts & Machine Maintenance',
      'General Purchase A/c',
    ];
    if (Array.isArray(ledgers) && ledgers.length > 0) {
      ledgers.forEach((l) => {
        if (l?.name && !list.includes(l.name)) {
          list.push(l.name);
        }
      });
    }
    return list;
  }, [ledgers]);

  const handleInlineLedgerChange = async (itemId: string, field: 'salesAc' | 'purchaseAc', value: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;
    const updatedItem: InventoryItem = {
      ...targetItem,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    try {
      await dbStorage.saveInventoryItem(updatedItem);
      setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
      await refreshActiveData();
      showNotification(
        `"${targetItem.name}" ${field === 'salesAc' ? 'Sales A/c' : 'Purchase A/c'} set to "${value}"`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showNotification('Failed to update ledger account.', 'error');
    }
  };

  const handleInlineTaxChange = async (itemId: string, value: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetItem) return;
    const numVal = value !== '' ? Number(value) : undefined;
    const updatedItem: InventoryItem = {
      ...targetItem,
      taxPercent: numVal !== undefined && !isNaN(numVal) ? numVal : undefined,
      updatedAt: new Date().toISOString(),
    };
    try {
      await dbStorage.saveInventoryItem(updatedItem);
      setItems((prev) => prev.map((it) => (it.id === itemId ? updatedItem : it)));
      await refreshActiveData();
      showNotification(
        `"${targetItem.name}" Tax % set to ${value !== '' ? `${value}%` : '0%'}`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showNotification('Failed to update tax percent.', 'error');
    }
  };

  const filteredItems = items.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && item.isActive !== false) ||
      (statusFilter === 'INACTIVE' && item.isActive === false);

    return matchSearch && matchCategory && matchStatus;
  });

  // Keyboard navigation for Item Master table
  const { selectedIndex, setSelectedIndex } = useTableKeyboardNavigation({
    totalRows: filteredItems.length,
    tableId: 'item-master-table',
    enabled: !itemModalOpen && !confirmModal.isOpen && !categoryModalOpen,
  });

  const totalValuation = items.reduce((sum, item) => sum + (item.openingValue || (item.openingQty || 0) * (item.openingRate || 0)), 0);
  const activeCount = items.filter((i) => i.isActive !== false).length;

  const openNewItemModal = () => {
    setEditingItem(null);
    setCode('');
    setName('');
    setTaxPercent('');
    setCategory('');
    setCustomCategory('');
    setSalesAc('');
    setPurchaseAc('');
    setPrimaryUnit('');
    setAlternateUnit('');
    setConversionFactor('');
    setConversionDirection('PRIMARY_TO_ALT');
    setDecimalPlaces('');
    setLocationRows([
      { id: '1', locationId: '', qty: '', rate: '', amount: '' },
    ]);
    setValuationMethod('');
    setIsActive(true);
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setCode(item.code || '');
    setName(cleanItemName(item.name));
    setTaxPercent(item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : '');
    setCategory(categories.includes(item.category || '') ? (item.category || '') : (item.category ? 'CUSTOM' : ''));
    setCustomCategory(categories.includes(item.category || '') ? '' : (item.category || ''));
    setSalesAc(item.salesAc || '');
    setPurchaseAc(item.purchaseAc || '');
    setPrimaryUnit(item.primaryUnit || '');
    setAlternateUnit(item.alternateUnit || '');
    setConversionFactor(item.conversionFactor !== undefined && item.conversionFactor !== null ? item.conversionFactor : '');
    setConversionDirection(item.conversionDirection || 'PRIMARY_TO_ALT');
    setDecimalPlaces(
      item.decimalPlaces !== undefined && item.decimalPlaces !== null && !isNaN(Number(item.decimalPlaces))
        ? item.decimalPlaces
        : ''
    );

    if (item.locationBalances && item.locationBalances.length > 0) {
      setLocationRows(
        item.locationBalances.map((lb, idx) => ({
          id: lb.id || String(idx + 1),
          locationId: lb.locationId || '',
          qty: lb.qty !== 0 ? lb.qty : '',
          rate: lb.rate !== 0 ? lb.rate : '',
          amount: lb.amount !== 0 ? lb.amount : '',
        }))
      );
    } else {
      const initialQty = item.openingQty ?? item.openingQuantity ?? 0;
      const initialRate = item.openingRate ?? 0;
      const initialVal = item.openingValue ?? Math.round(initialQty * initialRate * 100) / 100;
      setLocationRows([
        {
          id: '1',
          locationId: item.defaultLocationId || '',
          qty: initialQty !== 0 ? initialQty : '',
          rate: initialRate !== 0 ? initialRate : '',
          amount: initialVal !== 0 ? initialVal : '',
        },
      ]);
    }

    setValuationMethod(item.valuationMethod || '');
    setIsActive(item.isActive !== false);
    setItemModalOpen(true);
  };

  // --- Location Row Change & Auto-Calculation Handler ---
  const handleLocationRowChange = (
    index: number,
    field: 'locationId' | 'qty' | 'rate' | 'amount',
    val: string
  ) => {
    setLocationRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: val };

      const q = parseFloat(String(field === 'qty' ? val : row.qty));
      const r = parseFloat(String(field === 'rate' ? val : row.rate));
      const a = parseFloat(String(field === 'amount' ? val : row.amount));

      if (field === 'qty') {
        if (!isNaN(q) && !isNaN(r) && r > 0) {
          row.amount = Number((q * r).toFixed(2));
        } else if (!isNaN(q) && q > 0 && !isNaN(a) && a > 0) {
          row.rate = Number((a / q).toFixed(2));
        }
      } else if (field === 'rate') {
        if (!isNaN(q) && !isNaN(r) && q > 0) {
          row.amount = Number((q * r).toFixed(2));
        } else if (!isNaN(r) && r > 0 && !isNaN(a) && a > 0) {
          row.qty = Number((a / r).toFixed(3));
        }
      } else if (field === 'amount') {
        if (!isNaN(a) && !isNaN(r) && r > 0) {
          row.qty = Number((a / r).toFixed(3));
        } else if (!isNaN(a) && !isNaN(q) && q > 0) {
          row.rate = Number((a / q).toFixed(2));
        }
      }

      updated[index] = row;
      return updated;
    });
  };

  const addLocationRow = () => {
    // Pick next unused location if possible, otherwise default or first location
    const usedLocationIds = locationRows.map((r) => r.locationId);
    const unusedLoc = locations.find((l) => !usedLocationIds.includes(l.id));
    const nextLocId = unusedLoc?.id || locations.find((l) => l.isDefault)?.id || locations[0]?.id || '';
    const lastRowRate = locationRows[locationRows.length - 1]?.rate || '';

    setLocationRows((prev) => [
      ...prev,
      {
        id: String(Date.now()) + Math.random().toString(36).substring(2, 6),
        locationId: nextLocId,
        qty: '',
        rate: lastRowRate,
        amount: '',
      },
    ]);
  };

  const removeLocationRow = (index: number) => {
    if (locationRows.length <= 1) {
      setLocationRows([
        {
          id: String(Date.now()),
          locationId: locations.find((l) => l.isDefault)?.id || locations[0]?.id || '',
          qty: '',
          rate: '',
          amount: '',
        },
      ]);
      return;
    }
    setLocationRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveItem = async () => {
    const cleanedName = cleanItemName(name.trim());
    if (!cleanedName) {
      showNotification('Please enter Item Name.', 'error');
      return;
    }
    if (!currentCompany) return;

    const trimmedName = cleanedName.toLowerCase();
    const duplicateName = items.find(
      (i) => i.id !== editingItem?.id && cleanItemName(i.name).trim().toLowerCase() === trimmedName
    );
    if (duplicateName) {
      showNotification(`Warning: An item named "${cleanedName}" already exists. Duplicate item names are not allowed.`, 'error');
      return;
    }

    // Auto-generate or preserve code in the background (hidden from user view)
    let finalCode = (code && code.trim()) ? code.trim().toUpperCase() : (editingItem?.code || '');
    if (!finalCode) {
      const cleanPrefix = name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'ITM') || 'ITM';
      finalCode = `${cleanPrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    if (items.some((i) => i.id !== editingItem?.id && i.code === finalCode)) {
      finalCode = `${finalCode}-${Math.floor(10 + Math.random() * 90)}`;
    }

    if (category === 'CUSTOM') {
      if (!customCategory.trim()) {
        showNotification('Please enter custom category name.', 'error');
        return;
      }
      const dupCat = categories.find(
        (c) => c.trim().toLowerCase() === customCategory.trim().toLowerCase()
      );
      if (dupCat) {
        showNotification(`Warning: Item Category "${customCategory.trim()}" already exists. Duplicate category names are not allowed.`, 'error');
        return;
      }
    }

    const finalCategory = category === 'CUSTOM' ? customCategory.trim() : category;
    if (category === 'CUSTOM' && customCategory.trim()) {
      if (!customCategories.includes(customCategory.trim())) {
        const updated = [...customCategories, customCategory.trim()];
        setCustomCategories(updated);
        try {
          localStorage.setItem('bahi_khata_item_categories', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
      }
    }

    const now = new Date().toISOString();

    // Process location rows
    const nonZeroRows = locationRows.filter(
      (r) => (parseFloat(String(r.qty)) || 0) > 0 || (parseFloat(String(r.amount)) || 0) > 0 || r.locationId
    );
    const activeRows = nonZeroRows.length > 0 ? nonZeroRows : locationRows;

    let opQty = 0;
    let opVal = 0;
    const finalLocationBalances = activeRows.map((r) => {
      const q = parseFloat(String(r.qty)) || 0;
      const rt = parseFloat(String(r.rate)) || 0;
      let am = parseFloat(String(r.amount)) || 0;
      if (am === 0 && q > 0 && rt > 0) {
        am = Math.round(q * rt * 100) / 100;
      }
      opQty += q;
      opVal += am;
      const locObj = locations.find((l) => l.id === r.locationId);
      return {
        id: r.id,
        locationId: r.locationId,
        locationName: locObj ? locObj.name : undefined,
        qty: q,
        rate: rt > 0 ? rt : (q > 0 ? Math.round((am / q) * 100) / 100 : 0),
        amount: Math.round(am * 100) / 100,
      };
    });

    const opRate = opQty > 0 ? Math.round((opVal / opQty) * 100) / 100 : (finalLocationBalances[0]?.rate ? Number(finalLocationBalances[0]?.rate) : 0);
    const firstLocId = finalLocationBalances[0]?.locationId || locations[0]?.id || '';
    const firstLoc = locations.find((l) => l.id === firstLocId);

    const itemData: InventoryItem = {
      id: editingItem ? editingItem.id : `item-${Date.now()}`,
      uuid: editingItem?.uuid || uuidv4(),
      companyId: currentCompany.id,
      code: finalCode,
      name: cleanedName,
      taxPercent: taxPercent !== '' && !isNaN(Number(taxPercent)) ? Number(taxPercent) : undefined,
      category: finalCategory || undefined,
      salesAc: salesAc || undefined,
      purchaseAc: purchaseAc || undefined,
      primaryUnit: (primaryUnit || '').toUpperCase(),
      alternateUnit: alternateUnit ? alternateUnit.toUpperCase() : undefined,
      conversionFactor: alternateUnit && conversionFactor !== '' ? Number(conversionFactor) : undefined,
      conversionDirection: alternateUnit ? conversionDirection : undefined,
      decimalPlaces: decimalPlaces !== '' && !isNaN(Number(decimalPlaces)) ? Number(decimalPlaces) : undefined,
      openingQty: opQty,
      openingQuantity: opQty,
      openingRate: opRate,
      openingValue: Math.round(opVal * 100) / 100,
      locationBalances: finalLocationBalances,
      defaultLocationId: firstLocId || undefined,
      defaultGodown: firstLoc ? firstLoc.name : undefined,
      valuationMethod: (valuationMethod || undefined) as 'FIFO' | 'WEIGHTED_AVG' | 'MOVING_AVG' | undefined,
      isActive,
      createdAt: editingItem?.createdAt || now,
      updatedAt: now,
    };

    try {
      await dbStorage.saveInventoryItem(itemData);
      // Synchronize master changes to all sales/purchase bills, vouchers & transactions
      await masterSyncService.syncInventoryItemMaster(itemData, editingItem);

      // Reset form to blank / refreshed state
      setEditingItem(null);
      setCode('');
      setName('');
      setTaxPercent('');
      setCategory('');
      setCustomCategory('');
      setSalesAc('');
      setPurchaseAc('');
      setPrimaryUnit('');
      setAlternateUnit('');
      setConversionFactor('');
      setConversionDirection('PRIMARY_TO_ALT');
      setDecimalPlaces('');
      setLocationRows([{ id: '1', locationId: '', qty: '', rate: '', amount: '' }]);
      setValuationMethod('');
      setIsActive(true);
      setItemModalOpen(false);
      await loadData();
      await refreshActiveData();
      showNotification(
        `Item "${itemData.name}" ${editingItem ? 'updated' : 'created'} successfully.`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showNotification('Failed to save item. Please try again.', 'error');
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    setConfirmModal({
      isOpen: true,
      type: 'DELETE',
      title: 'Delete Inventory Item',
      message: `Are you sure you want to delete "${item.name}"? This will permanently remove the item master definition.`,
      itemDetails: [
        { label: 'Item Name', value: item.name },
        { label: 'Tax %', value: item.taxPercent !== undefined && item.taxPercent !== null && item.taxPercent !== '' ? `${item.taxPercent}%` : '0%' },
        { label: 'Category', value: item.category || 'General' },
        { label: 'Sales A/c', value: item.salesAc || 'GST Sales 18%' },
        { label: 'Purchase A/c', value: item.purchaseAc || 'Purchase Account' },
        { label: 'Opening Qty', value: `${item.openingQty || 0} ${item.primaryUnit}` },
      ],
      onConfirm: async () => {
        try {
          await dbStorage.deleteInventoryItem(item.id);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          await loadData();
          await refreshActiveData();
          showNotification(`Item "${item.name}" deleted successfully.`, 'info');
        } catch (err) {
          console.error(err);
          showNotification('Failed to delete item.', 'error');
        }
      },
    });
  };

  const handleExportCSV = () => {
    const exportData = filteredItems.map((item) => ({
      'Category': item.category || 'General',
      'Item Name': item.name,
      'Tax %': item.taxPercent !== undefined && item.taxPercent !== null && item.taxPercent !== '' ? `${item.taxPercent}%` : '0%',
      'Sales A/c': item.salesAc || 'GST Sales 18%',
      'Purchase A/c': item.purchaseAc || 'Purchase Account',
      'Primary Unit': item.primaryUnit,
      'Alternate Unit': item.alternateUnit || '-',
      'Conversion Factor': item.conversionFactor || 1,
      'Decimal Places': item.decimalPlaces !== undefined ? item.decimalPlaces : 2,
      'Opening Qty': item.openingQty || 0,
      'Opening Rate (₹)': item.openingRate || 0,
      'Opening Value (₹)': item.openingValue || (item.openingQty || 0) * (item.openingRate || 0),
      'Locations':
        item.locationBalances && item.locationBalances.length > 0
          ? item.locationBalances.map((lb) => `${lb.locationName || locations.find((l) => l.id === lb.locationId)?.name || 'Godown'} (${lb.qty})`).join(', ')
          : (item.defaultGodown || locations.find((l) => l.id === item.defaultLocationId)?.name || '-'),
      'Valuation Method': item.valuationMethod || 'WEIGHTED_AVG',
      'Status': item.isActive !== false ? 'Active' : 'Inactive',
    }));

    ExportEngine.exportToCsv(exportData, `Item_Master_${currentCompany?.name || 'ERP'}`);
    showNotification('Item Master exported successfully.', 'success');
  };

  return (
    <div className="space-y-2" id="item_master_view">
      {/* Header Section */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-3.5 py-2 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[rgba(57,167,255,0.15)] border border-[rgba(112,185,245,0.25)] flex items-center justify-center text-[#2588E8] shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#FFFFFF] tracking-wide flex items-center gap-2">
                Item Master
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[rgba(18,48,76,0.48)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] font-mono">
                  Master Data
                </span>
              </h1>
              <p className="text-[10.5px] text-[#7F98AE] hidden sm:block">
                Manage finished stone products, rough quarry blocks, polished slabs &amp; material definitions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition-colors cursor-pointer"
            >
              <ExcelFileIcon className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#2588E8]" />
              <span>Print</span>
            </button>
            <button
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>
            <button
              onClick={openNewItemModal}
              id="add_new_item_btn"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Item</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-[rgba(112,185,245,0.25)]">
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#7F98AE] tracking-wider">Total Items</span>
            <p className="text-base font-black text-[#FFFFFF] font-mono">{items.length}</p>
          </div>
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#2588E8] tracking-wider">Active Items</span>
            <p className="text-base font-black text-[#2588E8] font-mono">{activeCount}</p>
          </div>
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#2588E8] tracking-wider">Categories</span>
            <p className="text-base font-black text-[#2588E8] font-mono">{categories.length}</p>
          </div>
          <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-3 py-1.5 rounded-lg border border-[rgba(112,185,245,0.25)] flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#2588E8] tracking-wider">Opening Val.</span>
            <p className="text-base font-black text-[#2588E8] font-mono">
              ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-1.5 flex flex-col md:flex-row items-center justify-between gap-2 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-[#7F98AE] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by item name, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-9 pr-3 py-1 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8] transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7F98AE] hover:text-[#FFFFFF]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#7F98AE] font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#7F98AE] font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Item Master Table */}
      <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl overflow-hidden shadow-lg w-full">
        <div className="overflow-x-auto w-full scrollbar-thin">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] text-[10px] font-bold text-[#7F98AE] uppercase tracking-wider leading-tight">
                <th className="py-0.5 px-3 whitespace-nowrap">Category</th>
                <th className="py-0.5 px-3 min-w-[150px] max-w-[220px]">Item Name</th>
                <th className="py-0.5 px-2 text-center whitespace-nowrap min-w-[85px]">Tax %</th>
                <th className="py-0.5 px-2 min-w-[125px] max-w-[145px]">Sales A/c</th>
                <th className="py-0.5 px-2 min-w-[125px] max-w-[145px]">Purchase A/c</th>
                <th className="py-0.5 px-2.5 whitespace-nowrap">Units</th>
                <th className="py-0.5 px-2.5 text-right whitespace-nowrap">Op. Qty</th>
                <th className="py-0.5 px-2 text-right whitespace-nowrap">Op. Rate</th>
                <th className="py-0.5 px-2.5 text-right whitespace-nowrap">Op. Value</th>
                <th className="py-0.5 px-2.5 text-left min-w-[110px] max-w-[135px]">Location</th>
                <th className="py-0.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-0.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(112,185,245,0.15)]/40 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#7F98AE]">
                    <Package className="w-10 h-10 mx-auto text-[#7F98AE] mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-[#B7C9D9]">No items found matching your filters</p>
                    <p className="text-xs text-[#7F98AE] mt-1">
                      Click "Add New Item" above to create an inventory item master.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const opVal = item.openingValue || (item.openingQty || 0) * (item.openingRate || 0);
                  const isItemActive = item.isActive !== false;
                  const displayName = cleanItemName(item.name);

                  return (
                    <tr
                      key={item.id}
                      data-table-id="item-master-table"
                      data-row-idx={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition-colors group cursor-pointer ${
                        isSelected
                          ? 'bg-[#184271] ring-2 ring-inset ring-[#39A7FF] border-l-4 border-l-[#F2C94C] text-white shadow-md font-semibold'
                          : 'hover:bg-[rgba(18,48,76,0.42)] backdrop-blur-xl'
                      }`}
                      data-item-code={item.code}
                    >
                      {/* 1. Category */}
                      <td className="py-1 px-3 whitespace-nowrap">
                        <span className="px-1.5 py-0.2 rounded-md bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] text-[#2588E8] font-semibold text-[10px] inline-block">
                          {item.category || 'General'}
                        </span>
                      </td>

                      {/* 2. Item Name (without Main Central Godown) */}
                      <td className="py-1 px-3 min-w-[150px] max-w-[220px]">
                        <div className="font-semibold text-[#FFFFFF] group-hover:text-[#2588E8] transition-colors text-xs leading-snug" title={displayName}>
                          {displayName}
                        </div>
                        <div className="text-[10px] text-[#7F98AE] flex items-center gap-1.5 mt-0.5">
                          <span className="text-[#7F98AE] font-mono text-[9px]">
                            {item.valuationMethod || 'WEIGHTED_AVG'}
                          </span>
                        </div>
                      </td>

                      {/* Tax % */}
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <select
                          value={item.taxPercent !== undefined && item.taxPercent !== null && item.taxPercent !== '' ? String(item.taxPercent) : '18'}
                          onChange={(e) => handleInlineTaxChange(item.id, e.target.value)}
                          className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-emerald-400 rounded-md px-1.5 py-0.5 text-[10.5px] text-emerald-400 font-semibold focus:outline-hidden focus:border-emerald-400 cursor-pointer"
                          title="Item GST / Tax %"
                        >
                          <option value="0" className="bg-[rgba(18,48,76,0.95)] text-white">0% (Nil)</option>
                          <option value="0.1" className="bg-[rgba(18,48,76,0.95)] text-white">0.1%</option>
                          <option value="0.25" className="bg-[rgba(18,48,76,0.95)] text-white">0.25%</option>
                          <option value="1.5" className="bg-[rgba(18,48,76,0.95)] text-white">1.5%</option>
                          <option value="3" className="bg-[rgba(18,48,76,0.95)] text-white">3%</option>
                          <option value="5" className="bg-[rgba(18,48,76,0.95)] text-white">5%</option>
                          <option value="6" className="bg-[rgba(18,48,76,0.95)] text-white">6%</option>
                          <option value="12" className="bg-[rgba(18,48,76,0.95)] text-white">12%</option>
                          <option value="18" className="bg-[rgba(18,48,76,0.95)] text-white">18%</option>
                          <option value="28" className="bg-[rgba(18,48,76,0.95)] text-white">28%</option>
                          {item.taxPercent !== undefined && item.taxPercent !== '' && ![0, 0.1, 0.25, 1.5, 3, 5, 6, 12, 18, 28].includes(Number(item.taxPercent)) && (
                            <option value={String(item.taxPercent)} className="bg-[rgba(18,48,76,0.95)] text-white">
                              {item.taxPercent}%
                            </option>
                          )}
                        </select>
                      </td>

                      {/* 3. Sales A/c Dropdown */}
                      <td className="py-1 px-2 min-w-[125px] max-w-[145px]">
                        <select
                          value={item.salesAc || 'GST Sales 18%'}
                          onChange={(e) => handleInlineLedgerChange(item.id, 'salesAc', e.target.value)}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[#2588E8] rounded-md px-1.5 py-0.5 text-[10.5px] text-[#2588E8] font-medium focus:outline-hidden focus:border-[#2588E8] cursor-pointer truncate"
                          title="Sales Ledger Account"
                        >
                          {salesLedgerOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 4. Purchase A/c Dropdown */}
                      <td className="py-1 px-2 min-w-[125px] max-w-[145px]">
                        <select
                          value={item.purchaseAc || 'Purchase Account'}
                          onChange={(e) => handleInlineLedgerChange(item.id, 'purchaseAc', e.target.value)}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] hover:border-[#2588E8] rounded-md px-1.5 py-0.5 text-[10.5px] text-[#2588E8] font-medium focus:outline-hidden focus:border-[#2588E8] cursor-pointer truncate"
                          title="Purchase Ledger Account"
                        >
                          {purchaseLedgerOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 5. Units & Conversion */}
                      <td className="py-1 px-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[#FFFFFF]">
                          <span className="font-bold text-[#2588E8] text-xs">{item.primaryUnit}</span>
                          {item.alternateUnit && item.alternateUnit !== item.primaryUnit && (
                            <>
                              <ArrowRightLeft className="w-2.5 h-2.5 text-[#7F98AE]" />
                              <span className="text-[#7F98AE] text-xs">{item.alternateUnit}</span>
                            </>
                          )}
                        </div>
                        {item.conversionFactor && item.conversionFactor > 0 && item.alternateUnit && (
                          <div className="text-[9px] text-[#7F98AE] font-mono mt-0.5">
                            {item.conversionDirection === 'PRIMARY_TO_ALT' || item.conversionFactor < 1
                              ? `1 ${item.primaryUnit} = ${item.conversionFactor} ${item.alternateUnit}`
                              : `1 ${item.alternateUnit} = ${item.conversionFactor} ${item.primaryUnit}`}
                          </div>
                        )}
                      </td>

                      {/* 6. Opening Qty */}
                      <td className="py-1 px-2.5 text-right font-mono font-medium text-[#FFFFFF] whitespace-nowrap text-xs">
                        {item.openingQty !== undefined && item.openingQty !== null && item.openingQty !== ''
                          ? Number(item.openingQty).toLocaleString('en-IN', {
                              minimumFractionDigits: item.decimalPlaces !== undefined && item.decimalPlaces !== null && (item.decimalPlaces as any) !== '' ? Number(item.decimalPlaces) : 2,
                              maximumFractionDigits: item.decimalPlaces !== undefined && item.decimalPlaces !== null && (item.decimalPlaces as any) !== '' ? Number(item.decimalPlaces) : 2,
                            })
                          : '0.00'}{' '}
                        <span className="text-[10px] text-[#7F98AE]">{item.primaryUnit}</span>
                        {item.alternateUnit && item.conversionFactor && item.conversionFactor > 0 && (
                          <div className="text-[9px] text-[#7F98AE] font-mono">
                            ≈ {inventoryEngine.convertUnits(item.openingQty || 0, 'PRIMARY', item.conversionFactor, item.conversionDirection).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.alternateUnit}
                          </div>
                        )}
                      </td>

                      {/* 7. Opening Rate */}
                      <td className="py-1 px-2 text-right font-mono text-[#B7C9D9] whitespace-nowrap text-xs">
                        ₹{(item.openingRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 8. Opening Value */}
                      <td className="py-1 px-2.5 text-right font-mono font-bold text-[#2588E8] whitespace-nowrap text-xs">
                        ₹{opVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 9. Location / Storage */}
                      <td className="py-1 px-2.5 text-left min-w-[110px] max-w-[135px]">
                        {item.locationBalances && item.locationBalances.length > 1 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] text-[#2588E8] font-semibold text-[10px] w-fit">
                              <MapPin className="w-2.5 h-2.5 text-[#2588E8]" />
                              {item.locationBalances.length} Godowns
                            </span>
                            <div className="text-[9px] text-[#7F98AE] font-mono truncate" title={item.locationBalances.map((lb) => `${lb.locationName || locations.find(l => l.id === lb.locationId)?.name || 'Godown'} (${lb.qty})`).join(', ')}>
                              {item.locationBalances.map((lb) => `${lb.locationName || locations.find(l => l.id === lb.locationId)?.name || 'Godown'} (${lb.qty})`).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[#B7C9D9] font-mono text-[11px]">
                            <MapPin className="w-2.5 h-2.5 text-[#2588E8] shrink-0" />
                            <span className="truncate max-w-[120px]" title={item.locationBalances?.[0]?.locationName || locations.find((l) => l.id === item.locationBalances?.[0]?.locationId)?.name || item.defaultGodown || 'Central Godown'}>
                              {item.locationBalances?.[0]?.locationName ||
                               locations.find((l) => l.id === item.locationBalances?.[0]?.locationId)?.name ||
                               item.defaultGodown ||
                               locations.find((l) => l.id === item.defaultLocationId)?.name ||
                               'Central Godown'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 10. Status */}
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[9.5px] font-bold ${
                            isItemActive
                              ? 'bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)]'
                              : 'bg-[#421d23] text-[#fca5a5] border border-rose-800/40'
                          }`}
                        >
                          {isItemActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* 11. Actions */}
                      <td className="py-1 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditItemModal(item)}
                            title="Edit Item"
                            className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#2588E8] border border-[rgba(112,185,245,0.25)] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            title="Delete Item"
                            className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[#421d23] text-[#B7C9D9] hover:text-[#fca5a5] border border-[rgba(112,185,245,0.25)] transition-colors cursor-pointer"
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

      {/* Add / Edit Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md z-50 flex items-center justify-center p-1.5 sm:p-3">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl w-full max-w-[980px] max-h-[96vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-[#FFFFFF]">
            {/* Modal Header */}
            <div className="px-5 py-2.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center font-bold">
                  <Boxes className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#FFFFFF]">
                    {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
                  </h2>
                  <p className="text-[10px] text-[#7F98AE]">
                    Define product details, units, conversions, valuation & opening stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemModalOpen(false)}
                className="text-[#7F98AE] hover:text-[#FFFFFF] p-1.5 rounded-lg hover:bg-[rgba(37, 136, 232, 0.10)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-4 py-2 sm:px-5 sm:py-2.5 space-y-2 flex-1 max-h-[calc(96vh-85px)] overflow-y-auto scrollbar-thin">
              {/* Hidden Item Code (Kept in background for data table/internal references) */}
              <input type="hidden" value={code} />

              {/* Row 1: Category, Item Name & Tax Percent */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                    Category <span className="text-[#2588E8]">*</span>
                  </label>
                  <div className="space-y-1.5">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((c) => (
                        <option key={c} value={c} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">{c}</option>
                      ))}
                      <option value="CUSTOM" className="bg-[rgba(18,48,76,0.48)] text-[#2588E8]">+ Add Custom Category</option>
                    </select>

                    {category === 'CUSTOM' && (
                      <div>
                        <input
                          type="text"
                          placeholder="Enter custom category name"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[#2588E8] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden"
                        />
                        {Boolean(customCategory.trim() && categories.some((c) => c.trim().toLowerCase() === customCategory.trim().toLowerCase())) && (
                          <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10.5px] flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>Warning: Category &quot;{customCategory.trim()}&quot; already exists.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                    Item Name <span className="text-[#fca5a5]">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    autoFocus
                    placeholder="e.g. Kota Stone Blue 22x22 (Hand Cut)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                  />
                  {Boolean(name.trim() && items.some((i) => i.id !== editingItem?.id && i.name.trim().toLowerCase() === name.trim().toLowerCase())) && (
                    <div className="mt-1 p-1.5 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[10.5px] flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Warning: Item &quot;{name.trim()}&quot; already exists. Duplicate item names not allowed.</span>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                    Tax Percent (%) <span className="text-emerald-400 font-semibold">GST</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      list="item_tax_percent_list"
                      placeholder="e.g. 18"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(e.target.value)}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 pr-7 text-xs text-emerald-400 font-semibold placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 pointer-events-none">
                      %
                    </span>
                    <datalist id="item_tax_percent_list">
                      <option value="0" label="0% (Nil)" />
                      <option value="0.1" label="0.1%" />
                      <option value="0.25" label="0.25%" />
                      <option value="1.5" label="1.5%" />
                      <option value="3" label="3%" />
                      <option value="5" label="5%" />
                      <option value="6" label="6%" />
                      <option value="12" label="12%" />
                      <option value="18" label="18%" />
                      <option value="28" label="28%" />
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Row 2: Sales A/c (in place of Category) & Purchase A/c (next to Sales A/c) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                    Sales A/c
                  </label>
                  <select
                    id="item_master_sales_ac_select"
                    value={salesAc}
                    title="Default ledger credited for sales invoices"
                    onChange={(e) => {
                      if (e.target.value === '__ADD_LEDGER__') {
                        setQuickLedgerTarget('sales');
                        setQuickLedgerModalOpen(true);
                        e.target.value = salesAc;
                        return;
                      }
                      setSalesAc(e.target.value);
                    }}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#2588E8] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                  >
                    <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">-- Select Sales A/c --</option>
                    <option value="__ADD_LEDGER__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">+ Add Account Ledger...</option>
                    {salesLedgerOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold uppercase text-[#7F98AE] mb-1">
                    Purchase A/c
                  </label>
                  <select
                    id="item_master_purchase_ac_select"
                    value={purchaseAc}
                    title="Default ledger debited for purchase vouchers"
                    onChange={(e) => {
                      if (e.target.value === '__ADD_LEDGER__') {
                        setQuickLedgerTarget('purchase');
                        setQuickLedgerModalOpen(true);
                        e.target.value = purchaseAc;
                        return;
                      }
                      setPurchaseAc(e.target.value);
                    }}
                    className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#2588E8] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                  >
                    <option value="" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE]">-- Select Purchase A/c --</option>
                    <option value="__ADD_LEDGER__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">+ Add Account Ledger...</option>
                    {purchaseLedgerOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Units & Multi-Unit Conversion with Formula, Valuation & Status */}
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-4 py-2 rounded-xl border border-[rgba(112,185,245,0.25)] space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase text-[#7F98AE]">
                        Primary Unit (Base)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setUnitTarget('primary');
                          setUnitModalOpen(true);
                        }}
                        className="text-[9px] text-[#2588E8] hover:underline font-semibold cursor-pointer"
                      >
                        +Add
                      </button>
                    </div>
                    <select
                      value={primaryUnit}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_UNIT__') {
                          setUnitTarget('primary');
                          setUnitModalOpen(true);
                        } else {
                          setPrimaryUnit(e.target.value);
                        }
                      }}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                    >
                      <option value="">-- Select Primary Unit --</option>
                      <option value="__ADD_UNIT__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">
                        + Add Measurement Unit...
                      </option>
                      <option value="SQFT">SQFT (Square Feet)</option>
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="SQMT">SQMT (Square Meter)</option>
                      <option value="TON">TON (Metric Ton)</option>
                      <option value="BOX">BOX (Box / Carton)</option>
                      <option value="NOS">NOS (Numbers)</option>
                      <option value="KG">KG (Kilogram)</option>
                      <option value="LTR">LTR (Litre)</option>
                      {units.map((u) => u.symbol && !['SQFT','PCS','SQMT','TON','BOX','NOS','KG','LTR'].includes(u.symbol.toUpperCase()) ? (
                        <option key={u.id} value={u.symbol.toUpperCase()}>{u.symbol.toUpperCase()} ({u.name})</option>
                      ) : null)}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase text-[#7F98AE]">
                        Alternate Unit
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setUnitTarget('alternate');
                          setUnitModalOpen(true);
                        }}
                        className="text-[9px] text-[#2588E8] hover:underline font-semibold cursor-pointer"
                      >
                        +Add
                      </button>
                    </div>
                    <select
                      value={alternateUnit}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_UNIT__') {
                          setUnitTarget('alternate');
                          setUnitModalOpen(true);
                        } else {
                          const val = e.target.value;
                          setAlternateUnit(val);
                          if (!val) {
                            setConversionFactor('');
                          }
                        }
                      }}
                      className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                    >
                      <option value="">-- Select Alternate Unit (Optional) --</option>
                      <option value="__ADD_UNIT__" className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-amber-400 font-bold">
                        + Add Measurement Unit...
                      </option>
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="SQFT">SQFT (Square Feet)</option>
                      <option value="BOX">BOX (Box)</option>
                      <option value="NOS">NOS (Numbers)</option>
                      <option value="TON">TON (Metric Ton)</option>
                      <option value="SQMT">SQMT (Square Meter)</option>
                      <option value="KG">KG (Kilogram)</option>
                      <option value="LTR">LTR (Litre)</option>
                      {units.map((u) => u.symbol && !['PCS','SQFT','BOX','NOS','TON','SQMT','KG','LTR'].includes(u.symbol.toUpperCase()) ? (
                        <option key={u.id} value={u.symbol.toUpperCase()}>{u.symbol.toUpperCase()} ({u.name})</option>
                      ) : null)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1">
                      Formula Basis
                    </label>
                    <select
                      value={conversionDirection}
                      disabled={!alternateUnit}
                      onChange={(e) => setConversionDirection(e.target.value as any)}
                      className={`w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2.5 py-1.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] ${
                        !alternateUnit ? 'opacity-40 cursor-not-allowed bg-[#0B1E16] text-[#7F98AE]' : 'cursor-pointer'
                      }`}
                    >
                      {!alternateUnit ? (
                        <option value="">-- No Alternate Unit --</option>
                      ) : (
                        <>
                          <option value="PRIMARY_TO_ALT">
                            1 {primaryUnit || 'Primary Unit'} = X {alternateUnit}
                          </option>
                          <option value="ALT_TO_PRIMARY">
                            1 {alternateUnit} = X {primaryUnit || 'Primary Unit'}
                          </option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1 truncate" title="Conversion Factor">
                        Conversion Factor
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        disabled={!alternateUnit}
                        value={conversionFactor}
                        onChange={(e) => setConversionFactor(e.target.value === '' ? '' : (parseFloat(e.target.value) || ''))}
                        placeholder={!alternateUnit ? '--' : (conversionDirection === 'PRIMARY_TO_ALT' ? `1 ${primaryUnit || 'Base'} = ? ${alternateUnit}` : `1 ${alternateUnit} = ? ${primaryUnit || 'Base'}`)}
                        className={`w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1.5 text-xs font-mono text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] ${
                          !alternateUnit ? 'opacity-40 cursor-not-allowed bg-[#0B1E16] placeholder-[#55695C]' : ''
                        }`}
                      />
                    </div>
                    <div className="w-20 shrink-0">
                      <label className="block text-[10px] font-bold uppercase text-[#7F98AE] mb-1 truncate" title="Decimal Places">
                        Decimal
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        step="1"
                        value={decimalPlaces}
                        onChange={(e) => setDecimalPlaces(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        placeholder="0-4"
                        className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-1.5 text-xs font-mono text-center text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8]"
                        title="Number of decimal places (0 to 4)"
                      />
                    </div>
                  </div>
                </div>

                {/* Formula Bar + Valuation Method + Item Active in same line */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[rgba(112,185,245,0.25)]">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Compact Formula Field */}
                    <div className="w-fit inline-flex items-center text-[10.5px] font-mono text-[#FFFFFF] bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-2.5 py-0.5 rounded-lg border border-[rgba(112,185,245,0.25)] whitespace-nowrap">
                      {!alternateUnit ? (
                        <span className="text-[#7F98AE] italic">
                          Formula: Single Unit ({primaryUnit || 'No Unit Selected'})
                        </span>
                      ) : conversionDirection === 'PRIMARY_TO_ALT' ? (
                        <>
                          Formula: 1 {primaryUnit || 'Base'} = <span className="text-[#2588E8] font-bold mx-1">{conversionFactor !== '' ? conversionFactor : 'X'}</span> {alternateUnit}
                        </>
                      ) : (
                        <>
                          Formula: 1 {alternateUnit} = <span className="text-[#2588E8] font-bold mx-1">{conversionFactor !== '' ? conversionFactor : 'X'}</span> {primaryUnit || 'Base'}
                        </>
                      )}
                    </div>

                    {/* Valuation Method */}
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-bold uppercase text-[#7F98AE] whitespace-nowrap">
                        Valuation:
                      </label>
                      <select
                        value={valuationMethod}
                        onChange={(e) => setValuationMethod(e.target.value as any)}
                        className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-2 py-0.5 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                      >
                        <option value="">-- Select Valuation Method --</option>
                        <option value="WEIGHTED_AVG">Weighted Average (Standard)</option>
                        <option value="FIFO">First-In First-Out (FIFO)</option>
                        <option value="MOVING_AVG">Moving Average</option>
                      </select>
                    </div>
                  </div>

                  {/* Item Active Toggle */}
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#2588E8]"></div>
                      <span className="ml-1.5 text-xs font-bold uppercase text-[#B7C9D9] whitespace-nowrap">
                        {isActive ? 'Item Active' : 'Item Inactive'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Opening Stock by Location */}
              <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-xl px-3.5 py-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-[#FFFFFF] flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-[#2588E8]" />
                    <span>Opening Stock by Location</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {locationRows.map((row, idx) => (
                    <div
                      key={row.id || idx}
                      className="p-1.5 sm:px-2.5 sm:py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                        {/* 1. Opening Qty */}
                        <div className="w-full sm:w-24 shrink-0">
                          <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                            Qty ({primaryUnit})
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={row.qty}
                            onChange={(e) => handleLocationRowChange(idx, 'qty', e.target.value)}
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 py-1 text-xs font-mono text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                          />
                          {alternateUnit && Number(conversionFactor) > 0 && Number(row.qty) > 0 && (
                            <div className="mt-0.5 text-[8.5px] text-[#2588E8] font-mono">
                              ≈ {inventoryEngine.convertUnits(Number(row.qty), 'PRIMARY', Number(conversionFactor) || 1, conversionDirection).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {alternateUnit}
                            </div>
                          )}
                        </div>

                        {/* 2. Opening Rate */}
                        <div className="w-full sm:w-24 shrink-0">
                          <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                            Rate (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1 text-xs font-mono text-[#7F98AE]">₹</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={row.rate}
                              onChange={(e) => handleLocationRowChange(idx, 'rate', e.target.value)}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-4 pr-1.5 py-1 text-xs font-mono text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                            />
                          </div>
                        </div>

                        {/* 3. Total Amount */}
                        <div className="w-full sm:w-28 shrink-0">
                          <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5">
                            Amount (₹)
                          </label>
                          <div className="relative">
                            <span className="absolute left-1.5 top-1 text-xs font-mono text-[#7F98AE]">₹</span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={row.amount}
                              onChange={(e) => handleLocationRowChange(idx, 'amount', e.target.value)}
                              className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg pl-4 pr-1.5 py-1 text-xs font-mono font-bold text-[#2588E8] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8]"
                            />
                          </div>
                        </div>

                        {/* 4. Location Dropdown (Total Amount ke aage - Compact Width) */}
                        <div className="w-full sm:w-44 shrink-0">
                          <label className="block text-[9.5px] font-bold uppercase text-[#7F98AE] mb-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#2588E8]" />
                            Location
                          </label>
                          <select
                            value={row.locationId}
                            onChange={(e) => handleLocationRowChange(idx, 'locationId', e.target.value)}
                            className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2 py-1 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] cursor-pointer"
                          >
                            <option value="">-- Select Godown / Location --</option>
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id} className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#FFFFFF]">
                                {loc.name} {loc.code ? `(${loc.code})` : ''} - {loc.type}
                                {loc.isDefault ? ' ★' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 5. Plus (+) aur uske aage Delete (-) button */}
                        <div className="flex items-center gap-1 shrink-0 sm:pb-0.5">
                          <button
                            type="button"
                            onClick={addLocationRow}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-[rgba(57,167,255,0.15)] text-[#2588E8] hover:bg-[#2588E8] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] transition-colors cursor-pointer"
                            title="Add Next Location Line (+)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLocationRow(idx)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#421d23] text-[#fca5a5] hover:bg-rose-600 hover:text-white border border-rose-800/40 transition-colors cursor-pointer"
                            title={locationRows.length > 1 ? "Delete this location row" : "Clear this location row"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Combined Total Summary */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-lg border border-[rgba(112,185,245,0.25)] text-[10.5px] font-mono">
                  <div className="text-[#7F98AE] flex items-center gap-1">
                    <span>Total across</span>
                    <span className="text-[#FFFFFF] font-bold">{locationRows.length}</span>
                    <span>location{locationRows.length > 1 ? 's' : ''}:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#B7C9D9]">
                      Qty: <strong className="text-[#2588E8]">{locationRows.reduce((sum, r) => sum + (parseFloat(String(r.qty)) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: decimalPlaces !== '' && decimalPlaces !== undefined && decimalPlaces !== null ? Number(decimalPlaces) : 2, maximumFractionDigits: decimalPlaces !== '' && decimalPlaces !== undefined && decimalPlaces !== null ? Number(decimalPlaces) : 2 })}</strong> {primaryUnit}
                    </div>
                    <div className="text-[#B7C9D9]">
                      Value: <strong className="text-[#2588E8]">₹{locationRows.reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSaveItem}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingItem ? 'Update Item' : 'Save Item'}</span>
              </button>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] text-xs font-semibold border border-[rgba(112,185,245,0.25)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(8,24,40,0.50)] backdrop-blur-xl/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[rgba(13,38,62,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-[#FFFFFF]">
            <div className="bg-[rgba(18,48,76,0.48)] backdrop-blur-xl px-5 py-3.5 border-b border-[rgba(112,185,245,0.25)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[rgba(57,167,255,0.15)] text-[#2588E8] border border-[rgba(112,185,245,0.25)] flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#FFFFFF]">Item Categories Master</h3>
                  <p className="text-[11px] text-[#7F98AE]">View and create unique inventory categories</p>
                </div>
              </div>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1.5 rounded-lg text-[#7F98AE] hover:text-[#FFFFFF] hover:bg-[rgba(37, 136, 232, 0.10)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Add New Category */}
              <div className="space-y-2 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl p-3.5 rounded-xl border border-[rgba(112,185,245,0.25)]">
                <label className="block text-[11px] font-bold uppercase text-[#7F98AE]">
                  Add New Item Category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Polished Tiles or Cobble Stones"
                    className="flex-1 bg-[rgba(18,48,76,0.48)] border border-[rgba(112,185,245,0.25)] rounded-xl px-3 py-2 text-xs text-[#FFFFFF] placeholder-[#7F98AE] focus:outline-hidden focus:border-[#2588E8] font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2588E8] hover:bg-[#39A7FF] text-[#FFFFFF] font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {Boolean(newCategoryName.trim() && categories.some((c) => c.trim().toLowerCase() === newCategoryName.trim().toLowerCase())) && (
                  <div className="p-2.5 bg-[#421d23] border border-rose-800/60 rounded-xl text-[#fca5a5] text-[11px] flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Warning: Item Category &quot;{newCategoryName.trim()}&quot; already exists. Duplicate category names are not allowed.</span>
                  </div>
                )}
              </div>

              {/* Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[#7F98AE] font-semibold text-[11px] px-1">
                  <span>Existing Categories ({categories.length})</span>
                  <div className="flex items-center gap-6">
                    <span>Items Count</span>
                    <span className="w-16 text-center">Action</span>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {categories.map((cat) => {
                    const count = items.filter((i) => (i.category || '').toLowerCase() === cat.toLowerCase()).length;
                    const isEditing = editingCategory === cat;
                    return (
                      <div
                        key={cat}
                        className={`flex items-center justify-between p-2.5 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl hover:bg-[rgba(18,48,76,0.48)] backdrop-blur-xl rounded-xl border transition gap-2 ${
                          isEditing ? 'border-[#2588E8] ring-1 ring-[#2588E8]/30' : 'border-[rgba(112,185,245,0.25)]'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-[#2588E8] shrink-0"></span>
                            <input
                              type="text"
                              value={editingCategoryValue}
                              onChange={(e) => setEditingCategoryValue(e.target.value)}
                              className="flex-1 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded-lg px-2.5 py-1 text-xs text-[#FFFFFF] focus:outline-hidden focus:border-[#2588E8] font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveEditCategory(cat);
                                } else if (e.key === 'Escape') {
                                  setEditingCategory(null);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditCategory(cat)}
                              title="Save Changes"
                              className="p-1.5 rounded-lg bg-[#2588E8] text-[#FFFFFF] hover:bg-[#39A7FF] transition cursor-pointer shrink-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategory(null)}
                              title="Cancel"
                              className="p-1.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[#7F98AE] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] transition cursor-pointer shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-2 h-2 rounded-full bg-[#2588E8] shrink-0"></span>
                              <span className="text-[#FFFFFF] font-medium truncate">{cat}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="px-2 py-0.5 rounded-lg bg-[rgba(18,48,76,0.48)] backdrop-blur-xl text-[10px] text-[#B7C9D9] font-mono border border-[rgba(112,185,245,0.25)]">
                                {count} {count === 1 ? 'item' : 'items'}
                              </span>
                              <div className="flex items-center gap-1 border-l border-[rgba(112,185,245,0.25)] pl-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCategory(cat)}
                                  title="Edit Category"
                                  className="p-1.5 rounded-lg text-[#7F98AE] hover:text-[#2588E8] hover:bg-[rgba(57,167,255,0.15)] transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat)}
                                  title="Delete Category"
                                  className="p-1.5 rounded-lg text-[#7F98AE] hover:text-[#fca5a5] hover:bg-[rgba(239,68,68,0.15)] transition cursor-pointer"
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

            <div className="px-5 py-3 bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border-t border-[rgba(112,185,245,0.25)] flex justify-end">
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[rgba(18,48,76,0.48)] hover:bg-[rgba(57,167,255,0.15)] text-[#B7C9D9] hover:text-[#FFFFFF] border border-[rgba(112,185,245,0.25)] text-xs font-semibold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

      {/* Quick Create Ledger Modal */}
      {quickLedgerModalOpen && (
        <QuickCreateLedgerModal
          initialName=""
          onClose={() => setQuickLedgerModalOpen(false)}
          onCreated={async (newLedger) => {
            await refreshActiveData();
            if (quickLedgerTarget === 'sales') {
              setSalesAc(newLedger.name);
              setTimeout(() => document.getElementById('item_master_sales_ac_select')?.focus(), 60);
            } else {
              setPurchaseAc(newLedger.name);
              setTimeout(() => document.getElementById('item_master_purchase_ac_select')?.focus(), 60);
            }
            setQuickLedgerModalOpen(false);
          }}
        />
      )}

      {/* Full Measurement Unit Master Modal */}
      <FullUnitMasterModal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        onCreated={(newUnit) => {
          const sym = newUnit.symbol.toUpperCase();
          setUnits((prev) => [...prev, newUnit]);
          if (unitTarget === 'primary') {
            setPrimaryUnit(sym);
          } else {
            setAlternateUnit(sym);
          }
          setUnitModalOpen(false);
        }}
      />
    </div>
  );
};
export default ItemMasterView;
