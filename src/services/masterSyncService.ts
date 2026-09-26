import { db, TransactionRecord } from '../db';
import { dbStorage } from './storage/indexedDbStorage';
import { InventoryItem, Ledger, Location, Voucher } from '../types';
import { inventoryEngine } from './inventoryEngine';

class MasterSyncService {
  /**
   * Helper to check if an invoice item row or line references an updated item
   */
  private isItemMatch(
    nameCandidate: string | undefined,
    idCandidate: string | undefined,
    item: InventoryItem,
    prevItem?: InventoryItem | null
  ): boolean {
    if (idCandidate && idCandidate === item.id) return true;
    if (!nameCandidate) return false;

    const cand = nameCandidate.trim().toLowerCase();
    const currName = (item.name || '').trim().toLowerCase();
    const prevName = (prevItem?.name || '').trim().toLowerCase();
    const currCode = (item.code || '').trim().toLowerCase();
    const prevCode = (prevItem?.code || '').trim().toLowerCase();

    if (cand === currName) return true;
    if (prevName && cand === prevName) return true;
    if (currCode && cand === currCode) return true;
    if (prevCode && cand === prevCode) return true;

    // Fuzzy partial match for descriptive item strings (e.g. "Kota Stone" vs "Kota Stone Blue 22x22 (Hand Cut)")
    if (currName.length >= 4 && (cand.includes(currName) || currName.includes(cand))) {
      return true;
    }
    if (prevName && prevName.length >= 4 && (cand.includes(prevName) || prevName.includes(cand))) {
      return true;
    }

    return false;
  }

  /**
   * Synchronizes an updated Inventory Item across all Sales & Purchase bills,
   * quotations, challans, and accounting vouchers.
   */
  public async syncInventoryItemMaster(
    updatedItem: InventoryItem,
    previousItem?: InventoryItem | null
  ): Promise<void> {
    try {
      // 1. Sync db.transactions (Sales Invoices, Purchase Invoices, Quotations, Challans)
      const transactions = await db.transactions.toArray();
      let txUpdatedCount = 0;

      for (const rec of transactions) {
        if (!rec.notes) continue;
        try {
          const details = JSON.parse(rec.notes);
          if (!Array.isArray(details.items) || details.items.length === 0) continue;

          let hasChanges = false;
          const updatedItems = details.items.map((row: any) => {
            if (this.isItemMatch(row.item, row.itemId, updatedItem, previousItem)) {
              hasChanges = true;
              const newRow = { ...row };

              // Update item identification and primary unit
              newRow.item = updatedItem.name;
              newRow.unit = updatedItem.primaryUnit || newRow.unit;

              // Recalculate quantity from pcs if conversion factor exists
              if (
                updatedItem.alternateUnit &&
                updatedItem.conversionFactor &&
                newRow.pcs !== '' &&
                newRow.pcs !== undefined &&
                !isNaN(Number(newRow.pcs)) &&
                Number(newRow.pcs) > 0
              ) {
                newRow.pcs = Number(Number(newRow.pcs).toFixed(2));
                const calculatedQty = inventoryEngine.convertUnits(
                  Number(newRow.pcs),
                  'ALTERNATE',
                  updatedItem.conversionFactor,
                  updatedItem.conversionDirection
                );
                newRow.qty = calculatedQty;
              } else if (
                updatedItem.alternateUnit &&
                updatedItem.conversionFactor &&
                (!newRow.pcs || Number(newRow.pcs) === 0) &&
                Number(newRow.qty) > 0
              ) {
                // Auto-calculate PCS if missing
                const calculatedPcs = inventoryEngine.convertUnits(
                  Number(newRow.qty),
                  'PRIMARY',
                  updatedItem.conversionFactor,
                  updatedItem.conversionDirection
                );
                newRow.pcs = Number(calculatedPcs.toFixed(2));
              } else if (newRow.pcs !== '' && newRow.pcs !== undefined && !isNaN(Number(newRow.pcs))) {
                newRow.pcs = Number(Number(newRow.pcs).toFixed(2));
              }

              // Apply Decimal precision if configured
              if (
                updatedItem.decimalPlaces !== undefined &&
                updatedItem.decimalPlaces !== null &&
                !isNaN(Number(updatedItem.decimalPlaces))
              ) {
                const dec = Number(updatedItem.decimalPlaces);
                if (newRow.qty !== '' && newRow.qty !== undefined && !isNaN(Number(newRow.qty))) {
                  newRow.qty = Number(Number(newRow.qty).toFixed(dec));
                }
              }

              // Ensure Rate & Amount calculations respect decimals
              const q = parseFloat(String(newRow.qty));
              const r = parseFloat(String(newRow.rate));
              if (!isNaN(q) && !isNaN(r) && q > 0) {
                const dec =
                  updatedItem.decimalPlaces !== undefined &&
                  updatedItem.decimalPlaces !== null &&
                  !isNaN(Number(updatedItem.decimalPlaces))
                    ? Math.max(2, Number(updatedItem.decimalPlaces))
                    : 2;
                newRow.amount = Number((q * r).toFixed(dec));
              }

              return newRow;
            }
            return row;
          });

          if (hasChanges) {
            details.items = updatedItems;
            const parseClean = (v: any) => {
              if (v === undefined || v === null || v === "") return 0;
              const n = Number(String(v).replace(/,/g, "").trim());
              return isNaN(n) ? 0 : n;
            };
            const newTotalQty = updatedItems.reduce(
              (acc: number, curr: any) => acc + parseClean(curr.qty),
              0
            );
            const newItemTotal = updatedItems.reduce(
              (acc: number, curr: any) => acc + parseClean(curr.amount),
              0
            );

            // Recompute grand total with bill sundries
            let newGrandTotal = newItemTotal;
            if (Array.isArray(details.billSundries)) {
              for (const s of details.billSundries) {
                const amt = parseClean(s.amount);
                if (s.type === 'SUBTRACT') {
                  newGrandTotal -= amt;
                } else {
                  newGrandTotal += amt;
                }
              }
            }

            const itemDec =
              updatedItem.decimalPlaces !== undefined &&
              updatedItem.decimalPlaces !== null &&
              !isNaN(Number(updatedItem.decimalPlaces))
                ? Number(updatedItem.decimalPlaces)
                : 2;

            const isPcs = rec.formType === 'sales_challan' || (updatedItem.alternateUnit || '').toUpperCase() === 'PCS';
            rec.secondaryVal = isPcs ? Number(newTotalQty.toFixed(2)) : Number(newTotalQty.toFixed(itemDec));
            rec.amount = Number(newGrandTotal.toFixed(Math.max(2, itemDec)));
            details.totalAmount = rec.amount;
            rec.notes = JSON.stringify(details);
            rec.updatedAt = Date.now();

            await db.transactions.put(rec);
            txUpdatedCount++;
          }
        } catch {
          // Ignore invalid JSON notes
        }
      }

      // 2. Sync Vouchers (SALES, PURCHASE, SALES_RETURN, PURCHASE_RETURN)
      const vouchers = await dbStorage.getVouchers();
      for (const v of vouchers) {
        if (!v.inventoryLines || v.inventoryLines.length === 0) continue;

        let voucherChanged = false;
        const updatedLines = v.inventoryLines.map((line) => {
          if (this.isItemMatch(line.itemName, line.itemId, updatedItem, previousItem)) {
            voucherChanged = true;
            const updatedLine = { ...line };
            updatedLine.itemId = updatedItem.id;
            updatedLine.itemName = updatedItem.name;
            updatedLine.itemCode = updatedItem.code;
            updatedLine.unit = updatedItem.primaryUnit;
            updatedLine.alternateUnit = updatedItem.alternateUnit;

            // Apply conversion factor
            if (updatedItem.conversionFactor && updatedLine.quantity) {
              const altQ = inventoryEngine.convertUnits(
                Number(updatedLine.quantity),
                'PRIMARY',
                updatedItem.conversionFactor
              );
              const isPcs = (updatedItem.alternateUnit || '').toUpperCase() === 'PCS';
              updatedLine.alternateQty = isPcs ? Number(altQ.toFixed(2)) : Number(altQ.toFixed(2));
            }

            // Apply Decimal Places
            if (
              updatedItem.decimalPlaces !== undefined &&
              updatedItem.decimalPlaces !== null &&
              !isNaN(Number(updatedItem.decimalPlaces))
            ) {
              const dec = Number(updatedItem.decimalPlaces);
              updatedLine.quantity = Number(Number(updatedLine.quantity).toFixed(dec));
              const lineDec = Math.max(2, dec);
              updatedLine.amount = Number(Number(updatedLine.amount).toFixed(lineDec));
            }

            return updatedLine;
          }
          return line;
        });

        if (voucherChanged) {
          v.inventoryLines = updatedLines;
          v.updatedAt = new Date().toISOString();
          await dbStorage.saveVoucher(v);
        }
      }

      // 3. Broadcast master-updated event across the app for real-time UI reactive updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('master-updated', {
            detail: { type: 'item', item: updatedItem, previousItem },
          })
        );
      }
    } catch (err) {
      console.error('MasterSyncService: error syncing item master:', err);
    }
  }

  /**
   * Synchronizes an updated Ledger across vouchers and transactions
   */
  public async syncLedgerMaster(
    updatedLedger: Ledger,
    previousLedger?: Ledger | null
  ): Promise<void> {
    try {
      const prevName = previousLedger?.name?.trim().toLowerCase();
      const currName = updatedLedger.name.trim();

      // 1. Sync Vouchers
      const vouchers = await dbStorage.getVouchers();
      for (const v of vouchers) {
        if (!v.lines || v.lines.length === 0) continue;
        let changed = false;
        v.lines.forEach((l) => {
          if (
            l.ledgerId === updatedLedger.id ||
            (prevName && l.ledgerName && l.ledgerName.trim().toLowerCase() === prevName)
          ) {
            l.ledgerName = currName;
            l.ledgerId = updatedLedger.id;
            changed = true;
          }
        });
        if (changed) {
          v.updatedAt = new Date().toISOString();
          await dbStorage.saveVoucher(v);
        }
      }

      // 2. Sync Transactions
      if (prevName) {
        const transactions = await db.transactions.toArray();
        for (const rec of transactions) {
          let recChanged = false;
          if (rec.partyName && rec.partyName.trim().toLowerCase() === prevName) {
            rec.partyName = currName;
            recChanged = true;
          }
          if (rec.notes) {
            try {
              const details = JSON.parse(rec.notes);
              if (details.party && details.party.trim().toLowerCase() === prevName) {
                details.party = currName;
                rec.notes = JSON.stringify(details);
                recChanged = true;
              }
            } catch {}
          }
          if (recChanged) {
            rec.updatedAt = Date.now();
            await db.transactions.put(rec);
          }
        }
      }

      // 3. Broadcast master-updated event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('master-updated', {
            detail: { type: 'ledger', ledger: updatedLedger, previousLedger },
          })
        );
      }
    } catch (err) {
      console.error('MasterSyncService: error syncing ledger master:', err);
    }
  }

  /**
   * Synchronizes an updated Location / Godown
   */
  public async syncLocationMaster(
    updatedLocation: Location,
    previousLocation?: Location | null
  ): Promise<void> {
    try {
      const prevName = previousLocation?.name?.trim().toLowerCase();
      const currName = updatedLocation.name.trim();

      // 1. Sync Vouchers
      const vouchers = await dbStorage.getVouchers();
      for (const v of vouchers) {
        if (!v.inventoryLines || v.inventoryLines.length === 0) continue;
        let changed = false;
        v.inventoryLines.forEach((l) => {
          if (
            l.locationId === updatedLocation.id ||
            (prevName && l.godown && l.godown.trim().toLowerCase() === prevName)
          ) {
            l.godown = currName;
            l.locationId = updatedLocation.id;
            changed = true;
          }
        });
        if (changed) {
          v.updatedAt = new Date().toISOString();
          await dbStorage.saveVoucher(v);
        }
      }

      // 2. Sync Inventory Items defaultGodown and locationBalances
      const items = await dbStorage.getInventoryItems();
      for (const item of items) {
        let changed = false;
        if (item.defaultLocationId === updatedLocation.id || item.defaultGodown === previousLocation?.name) {
          item.defaultGodown = currName;
          changed = true;
        }
        if (item.locationBalances && item.locationBalances.length > 0) {
          item.locationBalances.forEach((lb) => {
            if (lb.locationId === updatedLocation.id || (prevName && lb.locationName?.toLowerCase() === prevName)) {
              lb.locationName = currName;
              changed = true;
            }
          });
        }
        if (changed) {
          await dbStorage.saveInventoryItem(item);
        }
      }

      // 3. Broadcast master-updated event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('master-updated', {
            detail: { type: 'location', location: updatedLocation, previousLocation },
          })
        );
      }
    } catch (err) {
      console.error('MasterSyncService: error syncing location master:', err);
    }
  }

  /**
   * Runs a complete auto-synchronization pass across all masters.
   * Ensures that any item configuration (such as Kota Stone decimal places or conversion factor)
   * previously saved in the database is automatically synced to all sale and purchase transactions.
   */
  public async syncAllMasterData(): Promise<void> {
    try {
      const items = await dbStorage.getInventoryItems();
      for (const itm of items) {
        await this.syncInventoryItemMaster(itm);
      }
    } catch (err) {
      console.error('MasterSyncService: error syncing all master data:', err);
    }
  }
}

export const masterSyncService = new MasterSyncService();
