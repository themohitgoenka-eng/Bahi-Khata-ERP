import { VoucherType, VoucherSeriesConfig } from '../types';

const STORAGE_KEY = 'bahikhata_voucher_series_configs_v2';
const LEGACY_STORAGE_KEY = 'lekhaveda_voucher_series_configs_v2';

export const DEFAULT_VOUCHER_SERIES: VoucherSeriesConfig[] = [
  // PAYMENT
  {
    id: 'ser-pmt-main',
    voucherType: 'PAYMENT',
    seriesName: 'MAIN',
    prefix: 'PMT/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-pmt-bank',
    voucherType: 'PAYMENT',
    seriesName: 'BANK',
    prefix: 'BPAY/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },
  {
    id: 'ser-pmt-cash',
    voucherType: 'PAYMENT',
    seriesName: 'CASH',
    prefix: 'CPAY/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // RECEIPT
  {
    id: 'ser-rec-main',
    voucherType: 'RECEIPT',
    seriesName: 'MAIN',
    prefix: 'RCT/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-rec-bank',
    voucherType: 'RECEIPT',
    seriesName: 'BANK',
    prefix: 'BREC/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },
  {
    id: 'ser-rec-cash',
    voucherType: 'RECEIPT',
    seriesName: 'CASH',
    prefix: 'CREC/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // CONTRA
  {
    id: 'ser-ctr-main',
    voucherType: 'CONTRA',
    seriesName: 'MAIN',
    prefix: 'CTR/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-ctr-bank',
    voucherType: 'CONTRA',
    seriesName: 'BANK',
    prefix: 'BCTR/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // JOURNAL
  {
    id: 'ser-jrn-main',
    voucherType: 'JOURNAL',
    seriesName: 'MAIN',
    prefix: 'JRN/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-jrn-gen',
    voucherType: 'JOURNAL',
    seriesName: 'GENERAL',
    prefix: 'GEN/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // DEBIT NOTE (PURCHASE_RETURN)
  {
    id: 'ser-dn-main',
    voucherType: 'PURCHASE_RETURN',
    seriesName: 'MAIN',
    prefix: 'DN/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-dn-gst',
    voucherType: 'PURCHASE_RETURN',
    seriesName: 'GST',
    prefix: 'DN-GST/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // CREDIT NOTE (SALES_RETURN)
  {
    id: 'ser-cn-main',
    voucherType: 'SALES_RETURN',
    seriesName: 'MAIN',
    prefix: 'CN/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
  },
  {
    id: 'ser-cn-gst',
    voucherType: 'SALES_RETURN',
    seriesName: 'GST',
    prefix: 'CN-GST/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
  },

  // SALES
  {
    id: 'ser-sal-main',
    voucherType: 'SALES',
    seriesName: 'MAIN',
    prefix: 'SAL/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
    useDefaultPattern: true,
    defaultSundries: [
      { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
    ],
  },
  {
    id: 'ser-sal-gst',
    voucherType: 'SALES',
    seriesName: 'GST SALES',
    prefix: 'SAL/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: false,
    useDefaultPattern: true,
    defaultSundries: [
      { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
    ],
  },
  {
    id: 'ser-sal-retail',
    voucherType: 'SALES',
    seriesName: 'RETAIL',
    prefix: 'RET/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: false,
    useDefaultPattern: false,
    defaultSundries: [
      { name: 'FREIGHT / TRANSPORT CHARGES', amount: 0, type: 'ADD', isPercentage: false },
      { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
    ],
  },
  // PURCHASE
  {
    id: 'ser-pur-main',
    voucherType: 'PURCHASE',
    seriesName: 'MAIN',
    prefix: 'PUR/',
    suffix: '/{FY}',
    nextNumber: 1001,
    numberPadding: 4,
    isDefault: true,
    useDefaultPattern: true,
    defaultSundries: [
      { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
      { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
    ],
  },
];

export const voucherSeriesService = {
  getStoredSeriesConfigs(): VoucherSeriesConfig[] {
    try {
      let data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        data = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (data) {
          localStorage.setItem(STORAGE_KEY, data);
        }
      }
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize only legacy factory default configs that were saved without trailing slash
          const factoryDefaultMap: Record<string, string> = {
            'ser-pmt-main': 'PMT/',
            'ser-pmt-bank': 'BPAY/',
            'ser-pmt-cash': 'CPAY/',
            'ser-rec-main': 'RCT/',
            'ser-rec-bank': 'BREC/',
            'ser-rec-cash': 'CREC/',
            'ser-ctr-main': 'CTR/',
            'ser-ctr-bank': 'BCTR/',
            'ser-jrn-main': 'JRN/',
            'ser-jrn-gen': 'GEN/',
            'ser-dn-main': 'DN/',
            'ser-dn-gst': 'DN-GST/',
            'ser-cn-main': 'CN/',
            'ser-cn-gst': 'CN-GST/',
            'ser-sal-main': 'SAL/',
            'ser-pur-main': 'PUR/',
          };
          let changed = false;
          let updated = parsed.map((c: VoucherSeriesConfig) => {
            let item = { ...c };
            if (factoryDefaultMap[c.id] && c.prefix && !c.prefix.endsWith('/') && !c.prefix.endsWith('-')) {
              changed = true;
              item.prefix = factoryDefaultMap[c.id];
            }
            if (item.useDefaultPattern === undefined) {
              changed = true;
              item.useDefaultPattern = item.isDefault ?? true;
            }
            if (item.voucherType === 'SALES' && (!item.defaultSundries || item.defaultSundries.length === 0)) {
              changed = true;
              if (item.seriesName === 'RETAIL') {
                item.defaultSundries = [
                  { name: 'FREIGHT / TRANSPORT CHARGES', amount: 0, type: 'ADD', isPercentage: false },
                  { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
                ];
              } else {
                item.defaultSundries = [
                  { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
                  { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
                  { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
                ];
              }
            }
            return item;
          });

          // If SALES voucher type only has MAIN in legacy storage, inject GST SALES & RETAIL
          const hasSalesGst = updated.some((s: VoucherSeriesConfig) => s.voucherType === 'SALES' && s.seriesName === 'GST SALES');
          if (!hasSalesGst) {
            changed = true;
            const salesDefaults = DEFAULT_VOUCHER_SERIES.filter((s) => s.voucherType === 'SALES' && s.seriesName !== 'MAIN');
            updated = [...updated, ...JSON.parse(JSON.stringify(salesDefaults))];
          }

          if (changed) {
            this.saveSeriesConfigs(updated);
          }
          return updated;
        }
      }
    } catch (e) {
      console.error('Failed to parse voucher series configs', e);
    }
    // Fallback to default
    this.saveSeriesConfigs(DEFAULT_VOUCHER_SERIES);
    return DEFAULT_VOUCHER_SERIES;
  },

  saveSeriesConfigs(configs: VoucherSeriesConfig[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (e) {
      console.error('Failed to save voucher series configs', e);
    }
  },

  resetToFactoryDefaults(): VoucherSeriesConfig[] {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_VOUCHER_SERIES));
    this.saveSeriesConfigs(defaults);
    return defaults;
  },

  resetVoucherTypeToDefaults(voucherType: VoucherType): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const typeDefaults = DEFAULT_VOUCHER_SERIES.filter((s) => s.voucherType === voucherType);

    // Keep all other voucher types untouched
    const otherTypesConfigs = all.filter((s) => s.voucherType !== voucherType);
    const updated = [...otherTypesConfigs, ...JSON.parse(JSON.stringify(typeDefaults))];

    this.saveSeriesConfigs(updated);
    return updated;
  },

  getSeriesForVoucherType(voucherType: VoucherType): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const matches = all.filter((s) => s.voucherType === voucherType);
    if (matches.length > 0) return matches;

    // If none found for this voucher type, create a default MAIN
    const fallback: VoucherSeriesConfig = {
      id: `ser-${voucherType.toLowerCase()}-main-${Date.now()}`,
      voucherType,
      seriesName: 'MAIN',
      prefix: voucherType.slice(0, 3).toUpperCase(),
      suffix: '/{FY}',
      nextNumber: 1001,
      numberPadding: 4,
      isDefault: true,
    };
    all.push(fallback);
    this.saveSeriesConfigs(all);
    return [fallback];
  },

  formatVoucherNumber(config: VoucherSeriesConfig, fyShort: string, num?: number): string {
    const targetNum = num !== undefined ? num : (config.nextNumber !== undefined ? config.nextNumber : 1);
    const numStr = (config.numberPadding && config.numberPadding > 0)
      ? String(targetNum).padStart(config.numberPadding, '0')
      : String(targetNum);

    const prefix = config.prefix || '';
    let suffix = config.suffix || '';
    suffix = suffix.replace('{FY}', fyShort).replace('{fy}', fyShort);

    return `${prefix}${numStr}${suffix}`;
  },

  incrementSeriesNumber(voucherType: VoucherType, seriesName: string) {
    const all = this.getStoredSeriesConfigs();
    const item = all.find((s) => s.voucherType === voucherType && s.seriesName === seriesName);
    if (item) {
      item.nextNumber = (Number(item.nextNumber) || 1000) + 1;
      this.saveSeriesConfigs(all);
    }
  },

  incrementVoucherNumber(id: string): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const updated = all.map((item) =>
      item.id === id ? { ...item, nextNumber: (Number(item.nextNumber) || 1000) + 1 } : item
    );
    this.saveSeriesConfigs(updated);
    return updated;
  },

  saveSeriesConfig(config: VoucherSeriesConfig): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const existingIndex = all.findIndex((item) => item.id === config.id);
    let updated: VoucherSeriesConfig[];
    if (existingIndex >= 0) {
      updated = [...all];
      updated[existingIndex] = config;
    } else {
      updated = [...all, config];
    }
    this.saveSeriesConfigs(updated);
    return updated;
  },

  createSeries(
    type: VoucherType,
    seriesName: string,
    prefix?: string,
    suffix?: string,
    startNumber?: number,
    numberPadding?: number
  ): VoucherSeriesConfig {
    const all = this.getStoredSeriesConfigs();
    const newId = `ser-${type.toLowerCase()}-${seriesName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const newConfig: VoucherSeriesConfig = {
      id: newId,
      voucherType: type,
      seriesName: seriesName.trim().toUpperCase(),
      prefix: prefix !== undefined ? prefix : `${seriesName.slice(0, 3).toUpperCase()}/`,
      suffix: suffix !== undefined ? suffix : '/{FY}',
      nextNumber: startNumber || 1001,
      numberPadding: numberPadding !== undefined ? numberPadding : 4,
      useDefaultPattern: false,
      isDefault: false,
      defaultSundries:
        type === 'SALES'
          ? [
              { name: 'CGST 9%', amount: 9, type: 'ADD', isPercentage: true },
              { name: 'SGST 9%', amount: 9, type: 'ADD', isPercentage: true },
              { name: 'ROUND OFF', amount: 0, type: 'ADD_LESS', isPercentage: false },
            ]
          : [],
    };
    all.push(newConfig);
    this.saveSeriesConfigs(all);
    return newConfig;
  },

  deleteSeries(id: string): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const updated = all.filter((item) => item.id !== id);
    this.saveSeriesConfigs(updated);
    return updated;
  },

  setDefaultSeries(id: string): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const target = all.find((item) => item.id === id);
    if (!target) return all;

    const updated = all.map((item) => {
      if (item.voucherType === target.voucherType) {
        return { ...item, isDefault: item.id === id };
      }
      return item;
    });
    this.saveSeriesConfigs(updated);
    return updated;
  },

  syncDefaultPatternForVoucherType(
    voucherType: VoucherType,
    prefix: string,
    suffix: string,
    padding: number
  ): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const updated = all.map((item) => {
      if (item.voucherType === voucherType && item.useDefaultPattern !== false) {
        return {
          ...item,
          prefix,
          suffix,
          numberPadding: padding,
        };
      }
      return item;
    });
    this.saveSeriesConfigs(updated);
    return updated;
  },

  applyPrefixSuffixToAll(targetType: VoucherType | 'ALL', prefix: string, suffix: string): VoucherSeriesConfig[] {
    const all = this.getStoredSeriesConfigs();
    const updated = all.map((item) => {
      if (targetType === 'ALL' || item.voucherType === targetType) {
        return {
          ...item,
          prefix: prefix.trim(),
          suffix: suffix.trim(),
        };
      }
      return item;
    });
    this.saveSeriesConfigs(updated);
    return updated;
  },

  getVoucherTypeLabel(type: VoucherType): string {
    switch (type) {
      case 'PAYMENT':
        return 'Payment';
      case 'RECEIPT':
        return 'Receipt';
      case 'CONTRA':
        return 'Contra';
      case 'JOURNAL':
        return 'Journal';
      case 'PURCHASE_RETURN':
        return 'Debit Note';
      case 'SALES_RETURN':
        return 'Credit Note';
      case 'SALES':
        return 'Sales';
      case 'PURCHASE':
        return 'Purchase';
      default:
        return type;
    }
  },
};
