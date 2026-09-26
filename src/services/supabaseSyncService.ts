import { getSupabaseClient } from './supabaseClient';
import { dbStorage } from './storage/indexedDbStorage';
import { SyncQueueItem } from '../types';

export class SupabaseSyncService {
  /**
   * Dynamically ensure a table exists on Supabase.
   * Calls the PostgreSQL function create_app_table_if_missing with admin privileges.
   */
  public async ensureTable(tableName: string, columnTypes: Record<string, string> = {}): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    try {
      const { data, error } = await client.rpc('create_app_table_if_missing', {
        p_table_name: tableName,
        p_columns: columnTypes,
      });
      if (error) {
        console.warn(`RPC auto-create notice for [${tableName}]:`, error.message);
        return false;
      }
      return data === 'CREATED' || data === 'EXISTS';
    } catch (e) {
      console.warn(`Could not auto-create table [${tableName}]:`, e);
      return false;
    }
  }

  /**
   * Probe each expected table to see whether it exists in Supabase.
   * Returns a status list without throwing.
   */
  public async checkAllTables(): Promise<{ table: string; exists: boolean }[]> {
    const { EXPECTED_TABLES } = await import('./supabaseSchema');
    const client = getSupabaseClient();
    if (!client) return EXPECTED_TABLES.map((t) => ({ table: t, exists: false }));

    const results = await Promise.all(
      EXPECTED_TABLES.map(async (table) => {
        try {
          const { error } = await client.from(table).select('id').limit(1);
          // Missing-table error codes from PostgREST
          const missing =
            !!error &&
            (error.code === 'PGRST205' ||
              error.code === '42P01' ||
              /does not exist|not find the table/i.test(error.message || ''));
          return { table, exists: !missing };
        } catch {
          return { table, exists: false };
        }
      })
    );
    return results;
  }

  /**
   * One-click initialize: attempts to create every expected table via the
   * create_app_table_if_missing RPC (requires the bootstrap SQL to have been
   * run once so that RPC exists). Returns a per-table result summary.
   */
  public async initializeAllTables(): Promise<{
    success: boolean;
    created: number;
    failed: number;
    total: number;
    rpcAvailable: boolean;
    results: { table: string; ok: boolean }[];
    message: string;
  }> {
    const { EXPECTED_TABLES } = await import('./supabaseSchema');
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        created: 0,
        failed: EXPECTED_TABLES.length,
        total: EXPECTED_TABLES.length,
        rpcAvailable: false,
        results: EXPECTED_TABLES.map((t) => ({ table: t, ok: false })),
        message: 'Supabase is not configured.',
      };
    }

    // Detect whether the bootstrap RPC exists
    let rpcAvailable = true;
    try {
      const probe = await client.rpc('create_app_table_if_missing', {
        p_table_name: 'companies',
        p_columns: {},
      });
      if (probe.error && /function .* does not exist|could not find/i.test(probe.error.message || '')) {
        rpcAvailable = false;
      }
    } catch {
      rpcAvailable = false;
    }

    if (!rpcAvailable) {
      return {
        success: false,
        created: 0,
        failed: EXPECTED_TABLES.length,
        total: EXPECTED_TABLES.length,
        rpcAvailable: false,
        results: EXPECTED_TABLES.map((t) => ({ table: t, ok: false })),
        message:
          'Bootstrap not found. Please run the "Copy SQL Schema" script once in the Supabase SQL Editor, then retry one-click init.',
      };
    }

    const results: { table: string; ok: boolean }[] = [];
    for (const table of EXPECTED_TABLES) {
      const ok = await this.ensureTable(table, {});
      results.push({ table, ok });
    }
    const created = results.filter((r) => r.ok).length;
    const failed = results.length - created;
    return {
      success: failed === 0,
      created,
      failed,
      total: results.length,
      rpcAvailable: true,
      results,
      message:
        failed === 0
          ? `All ${created} tables are initialized and ready.`
          : `${created} ready, ${failed} could not be created automatically.`,
    };
  }


  /**
   * Process a single queued item to Supabase table
   */
  public async processQueueItem(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client is not configured' };
    }

    try {
      const payload: any = item.payload;
      if (!payload) {
        return { success: false, error: 'Payload is empty' };
      }

      switch (item.entityType) {
        case 'VOUCHER': {
          if (item.operation === 'DELETE') {
            await client.from('vouchers').delete().eq('id', payload.id || item.transactionUuid);
          } else {
            const row = {
              id: payload.id,
              uuid: payload.uuid || payload.id,
              company_id: payload.companyId || item.companyId,
              fiscal_year_id: payload.fiscalYearId || item.fiscalYearId,
              voucher_number: payload.voucherNumber,
              series_id: payload.seriesId || payload.series || '',
              series_name: payload.seriesName || payload.series || '',
              voucher_type: payload.voucherType,
              date: payload.date,
              party_id: payload.partyId || (payload.lines && payload.lines.length > 0 ? payload.lines[0].ledgerId : ''),
              party_name: payload.partyName || (payload.lines && payload.lines.length > 0 ? payload.lines[0].ledgerName : ''),
              total_amount: payload.totalAmount ?? payload.totalDebit ?? 0,
              official_amount: payload.officialAmount ?? payload.totalDebit ?? 0,
              informal_amount: payload.informalAmount ?? 0,
              narration: payload.narration || '',
              notes: typeof payload.notes === 'string' ? payload.notes : JSON.stringify(payload.notes || {}),
              items: payload.items || payload.inventoryLines || [],
              ledger_entries: payload.ledgerEntries || payload.lines || [],
              bill_sundries: payload.billSundries || [],
              is_cancelled: Boolean(payload.isCancelled ?? (payload.status === 'CANCELLED')),
              updated_at: new Date().toISOString(),
            };
            const { error } = await client.from('vouchers').upsert(row, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        case 'LEDGER': {
          if (item.operation === 'DELETE') {
            await client.from('ledgers').delete().eq('id', payload.id);
          } else {
            const row = {
              id: payload.id,
              company_id: payload.companyId || item.companyId,
              name: payload.name,
              code: payload.code || '',
              group_id: payload.groupId,
              group_name: payload.groupName || payload.groupId || '',
              account_type: payload.accountType || '',
              nature: payload.nature || '',
              phone: payload.phone || '',
              email: payload.email || '',
              gstin: payload.gstin || '',
              pan: payload.pan || '',
              address: payload.address || '',
              city: payload.city || '',
              state: payload.state || '',
              pincode: payload.pincode || '',
              credit_limit: payload.creditLimit || 0,
              credit_period: payload.creditPeriod || 0,
              opening_balance: payload.openingBalance || 0,
              current_balance: payload.currentBalance || payload.openingBalance || 0,
              balance_type: payload.openingBalanceType || payload.balanceType || 'Dr',
              is_active: payload.isActive !== false,
              updated_at: new Date().toISOString(),
            };
            const { error } = await client.from('ledgers').upsert(row, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        case 'ITEM': {
          if (item.operation === 'DELETE') {
            await client.from('inventory_items').delete().eq('id', payload.id);
          } else {
            const row = {
              id: payload.id,
              company_id: payload.companyId || item.companyId,
              code: payload.code || '',
              name: payload.name,
              category: payload.category || '',
              hsn_code: payload.hsnCode || '',
              sales_ac: payload.salesAc || '',
              purchase_ac: payload.purchaseAc || '',
              primary_unit: payload.primaryUnit || 'NOS',
              alternate_unit: payload.alternateUnit || null,
              conversion_factor: payload.conversionFactor || 1,
              conversion_direction: payload.conversionDirection || 'PRIMARY_TO_ALT',
              decimal_places: payload.decimalPlaces || 2,
              sales_rate: payload.salesRate || payload.saleRate || 0,
              purchase_rate: payload.purchaseRate || 0,
              tax_rate: payload.taxRate || 18,
              valuation_method: payload.valuationMethod || 'WEIGHTED_AVG',
              opening_qty: payload.openingQty || 0,
              opening_rate: payload.openingRate || 0,
              opening_value: payload.openingValue || 0,
              current_stock: payload.currentStock || payload.openingQty || 0,
              is_active: payload.isActive !== false,
              updated_at: new Date().toISOString(),
            };
            const { error } = await client.from('inventory_items').upsert(row, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        case 'STOCK': {
          if (item.operation === 'DELETE') {
            await client.from('stock_transactions').delete().eq('id', payload.id);
          } else {
            const { error } = await client.from('stock_transactions').upsert(payload, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        case 'WASTAGE': {
          if (item.operation === 'DELETE') {
            await client.from('wastage_entries').delete().eq('id', payload.id);
          } else {
            const { error } = await client.from('wastage_entries').upsert(payload, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        case 'BANK_TRANSACTION': {
          if (item.operation === 'DELETE') {
            await client.from('bank_transactions').delete().eq('id', payload.id);
          } else {
            const { error } = await client.from('bank_transactions').upsert(payload, { onConflict: 'id' });
            if (error) throw error;
          }
          break;
        }

        default: {
          // Dynamic handling: Supports any new current or future entity!
          const targetTable = (item.entityType || 'entity').toLowerCase() + 's';
          
          // 1. Try to upsert directly to target table
          const { error: directErr } = await client.from(targetTable).upsert(payload, { onConflict: 'id' });
          if (!directErr) break;

          // 2. If table doesn't exist, auto-create it using RPC
          const created = await this.ensureTable(targetTable);
          if (created) {
            const { error: retryErr } = await client.from(targetTable).upsert(payload, { onConflict: 'id' });
            if (!retryErr) break;
          }

          // 3. Fallback to universal dynamic store (app_dynamic_entities)
          const dynamicRow = {
            id: payload.id || item.transactionUuid,
            entity_type: item.entityType,
            company_id: payload.companyId || item.companyId,
            fiscal_year_id: payload.fiscalYearId || item.fiscalYearId,
            data: payload,
            updated_at: new Date().toISOString(),
          };
          const { error: dynErr } = await client.from('app_dynamic_entities').upsert(dynamicRow, { onConflict: 'id' });
          if (dynErr) throw dynErr;
          break;
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('Supabase sync queue item error:', err);
      return { success: false, error: err.message || 'Sync operation failed' };
    }
  }

  /**
   * Push all current Master & Transaction data to Supabase
   */
  public async pushAllDataToCloud(): Promise<{
    success: boolean;
    counts: Record<string, number>;
    message: string;
  }> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        success: false,
        counts: {},
        message: 'Supabase client is not configured',
      };
    }

    try {
      const companies = await dbStorage.getCompanies();
      const fiscalYears: any[] = [];
      for (const comp of companies) {
        try {
          const compFys = await dbStorage.getFiscalYears(comp.id);
          fiscalYears.push(...compFys);
        } catch (e) {
          console.warn('Could not fetch fiscal years for company:', comp.id, e);
        }
      }

      const ledgers = await dbStorage.getLedgers();
      const items = await dbStorage.getInventoryItems();
      const locations = await dbStorage.getLocations();
      const vouchers = await dbStorage.getVouchers();
      const accountGroups = await dbStorage.getAccountGroups();
      const bankAccounts = await dbStorage.getBankAccounts();
      const itemUnits = await dbStorage.getItemUnits();
      const stockTransactions = await dbStorage.getStockTransactions();
      const stockJournals = await dbStorage.getStockJournals();
      const wastageEntries = await dbStorage.getWastageEntries();
      const bankTransactions = await dbStorage.getBankTransactions();
      const auditLogs = await dbStorage.getAuditLogs();

      const counts: Record<string, number> = {
        companies: 0,
        fiscalYears: 0,
        accountGroups: 0,
        ledgers: 0,
        items: 0,
        locations: 0,
        vouchers: 0,
        bankAccounts: 0,
        itemUnits: 0,
        stockTransactions: 0,
        stockJournals: 0,
        wastageEntries: 0,
        bankTransactions: 0,
        auditLogs: 0,
      };
      const errors: string[] = [];

      // Helper function to safely upsert a dataset
      const safeUpsert = async (tableName: string, rows: any[], countKey: string, customCols: Record<string, string> = {}) => {
        if (!rows || rows.length === 0) return;
        try {
          let { error } = await client.from(tableName).upsert(rows, { onConflict: 'id' });
          if (error) {
            // Try auto-creating table if missing
            await this.ensureTable(tableName, customCols);
            const retry = await client.from(tableName).upsert(rows, { onConflict: 'id' });
            error = retry.error;
          }

          if (error) {
            // Fallback to app_dynamic_entities
            console.warn(`Falling back to app_dynamic_entities for [${tableName}]:`, error.message);
            const dynamicRows = rows.map((r) => ({
              id: r.id || `${tableName}_${Date.now()}_${Math.random()}`,
              entity_type: tableName,
              company_id: r.company_id || r.companyId || (companies[0] ? companies[0].id : ''),
              fiscal_year_id: r.fiscal_year_id || r.fiscalYearId || '',
              data: r,
              updated_at: new Date().toISOString(),
            }));
            const dynRes = await client.from('app_dynamic_entities').upsert(dynamicRows, { onConflict: 'id' });
            if (dynRes.error) throw dynRes.error;
          }
          counts[countKey] = rows.length;
        } catch (e: any) {
          console.error(`Failed to sync ${tableName}:`, e);
          errors.push(`${tableName}: ${e.message || 'Error'}`);
        }
      };

      // 1. Companies
      const compRows = companies.map((c) => ({
        id: c.id,
        name: c.name,
        legal_name: c.legalName || c.name,
        gstin: c.gstin || '',
        pan: c.pan || '',
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        city: c.city || '',
        state: c.state || '',
        pincode: c.pincode || '',
        bank_name: c.bankName || '',
        bank_account_no: c.bankAccountNo || '',
        bank_ifsc: c.bankIfsc || '',
        bank_branch: c.bankBranch || '',
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('companies', compRows, 'companies');

      // 2. Fiscal Years
      const fyRows = fiscalYears.map((f: any) => ({
        id: f.id,
        company_id: f.companyId,
        name: f.name,
        start_date: f.startDate,
        end_date: f.endDate,
        is_closed: Boolean(f.isClosed),
        is_current: Boolean(f.isActive ?? true),
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('fiscal_years', fyRows, 'fiscalYears');

      // 3. Locations
      const locRows = locations.map((l) => ({
        id: l.id,
        company_id: l.companyId,
        code: l.code,
        name: l.name,
        type: l.type || 'GODOWN',
        address: l.address || '',
        city: l.city || '',
        state: l.state || '',
        pincode: l.pincode || '',
        is_default: Boolean(l.isDefault),
        is_active: l.isActive !== false,
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('locations', locRows, 'locations');

      // 4. Ledgers
      const ledgerRows = ledgers.map((l: any) => ({
        id: l.id,
        company_id: l.companyId,
        name: l.name,
        code: l.code || '',
        group_id: l.groupId,
        group_name: l.groupName || l.groupId || '',
        account_type: l.accountType || '',
        nature: l.nature || '',
        phone: l.phone || '',
        email: l.email || '',
        gstin: l.gstin || '',
        pan: l.pan || '',
        address: l.address || '',
        city: l.city || '',
        state: l.state || '',
        pincode: l.pincode || '',
        credit_limit: l.creditLimit || 0,
        credit_period: l.creditPeriod || 0,
        opening_balance: l.openingBalance || 0,
        current_balance: l.currentBalance || l.openingBalance || 0,
        balance_type: l.openingBalanceType || l.balanceType || 'Dr',
        is_active: l.isActive !== false,
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('ledgers', ledgerRows, 'ledgers');

      // 5. Items
      const itemRows = items.map((i: any) => ({
        id: i.id,
        company_id: i.companyId,
        code: i.code || '',
        name: i.name,
        category: i.category || '',
        hsn_code: i.hsnCode || '',
        sales_ac: i.salesAc || '',
        purchase_ac: i.purchaseAc || '',
        primary_unit: i.primaryUnit || 'NOS',
        alternate_unit: i.alternateUnit || null,
        conversion_factor: i.conversionFactor || 1,
        conversion_direction: i.conversionDirection || 'PRIMARY_TO_ALT',
        decimal_places: i.decimalPlaces || 2,
        sales_rate: i.salesRate || i.saleRate || 0,
        purchase_rate: i.purchaseRate || 0,
        tax_rate: i.taxRate || 18,
        valuation_method: i.valuationMethod || 'WEIGHTED_AVG',
        opening_qty: i.openingQty || 0,
        opening_rate: i.openingRate || 0,
        opening_value: i.openingValue || 0,
        current_stock: i.currentStock || i.openingQty || 0,
        is_active: i.isActive !== false,
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('inventory_items', itemRows, 'items');

      // 6. Vouchers
      const voucherRows = vouchers.map((v: any) => ({
        id: v.id,
        uuid: v.uuid || v.id,
        company_id: v.companyId,
        fiscal_year_id: v.fiscalYearId,
        voucher_number: v.voucherNumber,
        series_id: v.seriesId || v.series || '',
        series_name: v.seriesName || v.series || '',
        voucher_type: v.voucherType,
        date: v.date,
        party_id: v.partyId || (v.lines && v.lines.length > 0 ? v.lines[0].ledgerId : ''),
        party_name: v.partyName || (v.lines && v.lines.length > 0 ? v.lines[0].ledgerName : ''),
        total_amount: v.totalAmount ?? v.totalDebit ?? 0,
        official_amount: v.officialAmount ?? v.totalDebit ?? 0,
        informal_amount: v.informalAmount ?? 0,
        narration: v.narration || '',
        notes: typeof v.notes === 'string' ? v.notes : JSON.stringify(v.notes || {}),
        items: v.items || v.inventoryLines || [],
        ledger_entries: v.ledgerEntries || v.lines || [],
        bill_sundries: v.billSundries || [],
        is_cancelled: Boolean(v.isCancelled ?? (v.status === 'CANCELLED')),
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('vouchers', voucherRows, 'vouchers');

      // 7. Account Groups
      const groupRows = accountGroups.map((g: any) => ({
        id: g.id,
        company_id: g.companyId || (companies[0] ? companies[0].id : ''),
        name: g.name,
        primary_group: g.primaryGroup || g.name || '',
        account_type: g.accountType || '',
        nature: g.nature || '',
        parent_group_id: g.parentGroupId || null,
        is_primary: Boolean(g.isPrimary),
        created_at: new Date().toISOString(),
      }));
      await safeUpsert('account_groups', groupRows, 'accountGroups');

      // 8. Bank Accounts
      const bankRows = bankAccounts.map((b: any) => ({
        id: b.id,
        company_id: b.companyId || (companies[0] ? companies[0].id : ''),
        bank_name: b.bankName || b.accountName || 'Bank Account',
        account_number: b.accountNumber || '',
        account_type: b.accountType || 'CURRENT',
        ifsc_code: b.ifscCode || b.ifsc || '',
        branch_name: b.branch || b.branchName || '',
        opening_balance: b.openingBalance || 0,
        current_balance: b.currentBalance || b.openingBalance || 0,
        is_active: b.isActive !== false,
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('bank_accounts', bankRows, 'bankAccounts');

      // 9. Item Units
      const unitRows = itemUnits.map((u: any) => ({
        id: u.id,
        company_id: companies[0] ? companies[0].id : '',
        name: u.name,
        symbol: u.symbol || u.name,
        formal_name: u.formalName || u.name,
        decimal_places: u.decimalPlaces || 2,
        created_at: new Date().toISOString(),
      }));
      await safeUpsert('item_units', unitRows, 'itemUnits');

      // 10. Stock Transactions
      const stRows = stockTransactions.map((st: any) => ({
        id: st.id,
        company_id: st.companyId || (companies[0] ? companies[0].id : ''),
        fiscal_year_id: st.fiscalYearId || '',
        date: st.date,
        item_id: st.itemId,
        voucher_id: st.voucherId,
        voucher_no: st.voucherNo,
        voucher_type: st.voucherType,
        transaction_type: st.transactionType,
        quantity: st.quantity || 0,
        unit: st.unit || '',
        rate: st.rate || 0,
        value: st.value || 0,
        remarks: st.remarks || '',
        created_at: st.createdAt || new Date().toISOString(),
      }));
      await safeUpsert('stock_transactions', stRows, 'stockTransactions');

      // 11. Stock Journals
      const sjRows = stockJournals.map((sj: any) => ({
        id: sj.id,
        company_id: sj.companyId || (companies[0] ? companies[0].id : ''),
        fiscal_year_id: sj.fiscalYearId || '',
        voucher_no: sj.voucherNo,
        date: sj.date,
        journal_type: sj.journalType,
        narration: sj.narration || '',
        reference_no: sj.referenceNo || '',
        source_items: sj.sourceItems || [],
        destination_items: sj.destinationItems || [],
        additional_cost: sj.additionalCost || 0,
        total_source_qty: sj.totalSourceQty || 0,
        total_source_amount: sj.totalSourceAmount || 0,
        total_destination_qty: sj.totalDestinationQty || 0,
        total_destination_amount: sj.totalDestinationAmount || 0,
        status: sj.status || 'POSTED',
        created_at: sj.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      await safeUpsert('stock_journals', sjRows, 'stockJournals');

      // 12. Wastage Entries
      const wstRows = wastageEntries.map((w: any) => ({
        id: w.id,
        company_id: w.companyId || (companies[0] ? companies[0].id : ''),
        fiscal_year_id: w.fiscalYearId || '',
        date: w.date,
        item_id: w.itemId,
        item_name: w.itemName || '',
        quantity: w.quantity || 0,
        unit: w.unit || '',
        rate: w.rate || 0,
        amount: w.amount || 0,
        reason: w.reason || '',
        created_at: w.createdAt || new Date().toISOString(),
      }));
      await safeUpsert('wastage_entries', wstRows, 'wastageEntries');

      // 13. Bank Transactions
      const btRows = bankTransactions.map((bt: any) => ({
        id: bt.id,
        company_id: bt.companyId || (companies[0] ? companies[0].id : ''),
        fiscal_year_id: bt.fiscalYearId || '',
        bank_account_id: bt.bankAccountId || '',
        date: bt.date,
        narration: bt.narration || '',
        reference_no: bt.referenceNo || '',
        type: bt.type || 'CREDIT',
        amount: bt.amount || 0,
        balance: bt.balance || 0,
        reconciliation_status: bt.reconciliationStatus || 'UNMATCHED',
        matched_voucher_id: bt.matchedVoucherId || null,
        matched_date: bt.matchedDate || null,
        match_score: bt.matchScore || 0,
        created_at: bt.createdAt || new Date().toISOString(),
      }));
      await safeUpsert('bank_transactions', btRows, 'bankTransactions');

      // 14. Audit Logs
      const auditRows = auditLogs.map((a: any) => ({
        id: a.id,
        company_id: a.companyId || (companies[0] ? companies[0].id : ''),
        fiscal_year_id: a.fiscalYearId || '',
        date: a.date,
        action: a.action,
        entity: a.entity,
        entity_id: a.entityId,
        summary: a.summary || '',
        old_value: a.oldValue || null,
        new_value: a.newValue || null,
        device_id: a.deviceId || '',
        created_at: a.createdAt || new Date().toISOString(),
      }));
      await safeUpsert('audit_logs', auditRows, 'auditLogs');

      const totalSynced = Object.values(counts).reduce((a, b) => a + b, 0);

      if (errors.length > 0) {
        return {
          success: totalSynced > 0,
          counts,
          message: totalSynced > 0
            ? `Partial upload (${totalSynced} total records synchronized across all tables). Notice: ${errors.join('; ')}`
            : `Upload blocked: ${errors.join('; ')}`,
        };
      }

      return {
        success: true,
        counts,
        message: `All ${totalSynced} records successfully synchronized across all tables in Supabase Cloud!`,
      };
    } catch (err: any) {
      console.error('Failed to push all data to Supabase:', err);
      return {
        success: false,
        counts: {},
        message: err.message || 'Failed to upload data to Supabase.',
      };
    }
  }
}

export const supabaseSyncService = new SupabaseSyncService();
