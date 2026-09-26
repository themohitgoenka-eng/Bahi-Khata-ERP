import { BrsRule, Ledger, BankStatementTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_RULES: BrsRule[] = [
  {
    id: 'rule-ganpati',
    name: 'Ganpati Corp NEFT',
    keywords: ['GANPATI', 'GANPATI COR', 'GANPATI CORPORATION'],
    targetLedgerId: '',
    targetLedgerName: 'GANPATI CORPORATION',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-bank-interest',
    name: 'Bank Interest & Collection',
    keywords: ['Int.Coll', 'INTEREST', 'INT COLL', 'INT.COLL'],
    targetLedgerId: '',
    targetLedgerName: 'BANK INTEREST PAID',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-deepak-travel',
    name: 'Deepak Singh Travel & Food',
    keywords: ['DEEPAK SINGH', 'Food jaipur', 'Food'],
    targetLedgerId: '',
    targetLedgerName: 'TRAVELLING & TOURING EXPENSES',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-sukhram-salary',
    name: 'Sukhram Salary',
    keywords: ['Sukhram Sukhra', 'SUKHRAM', 'Salary'],
    targetLedgerId: '',
    targetLedgerName: 'FACTORY SALARY PAYABLE',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-indore-stone',
    name: 'Indore Stone NEFT',
    keywords: ['INDORE STON', 'INDORE STONE'],
    targetLedgerId: '',
    targetLedgerName: 'INDORE STONE COMPANY',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-blue-lotus',
    name: 'Blue Lotus Stone Mandi',
    keywords: ['BLUE LOTUS', 'BLUE LOTUS STONE'],
    targetLedgerId: '',
    targetLedgerName: 'BLUE LOTUS STONE (Mandi)',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-mukut-bihar',
    name: 'Mukut Bihar / Bihari',
    keywords: ['MUKUT BIHAR', 'Mukut Bihari', 'Loading 2apr'],
    targetLedgerId: '',
    targetLedgerName: 'VINNY STONE INDUSTRIES',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-coco-petrol',
    name: 'COCO Petrol / Fuel',
    keywords: ['COCO', 'COCO Bhilwara', 'Petrol', 'Diesel', 'Fuel'],
    targetLedgerId: '',
    targetLedgerName: 'CAR RUNNING EXPENSES',
    transactionType: 'Payment',
    isActive: true,
  },
  {
    id: 'rule-marble-sales',
    name: 'Marble Sales Deposit',
    keywords: ['MARBLE-SALES', 'SALES ADVANCE', 'STONE SALES', 'BUYER'],
    targetLedgerId: '',
    targetLedgerName: 'MARBLE SALES REVENUE',
    transactionType: 'Receipt',
    isActive: true,
  },
];

class BrsRuleService {
  private storageKey(companyId: string): string {
    const key = `BahiKhata_BrsRules_${companyId}`;
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(key)) {
      const legacy = localStorage.getItem(`LekhaVeda_BrsRules_${companyId}`);
      if (legacy) {
        localStorage.setItem(key, legacy);
      }
    }
    return key;
  }

  public getRules(companyId: string): BrsRule[] {
    if (!companyId) return DEFAULT_RULES;
    try {
      const data = localStorage.getItem(this.storageKey(companyId));
      if (!data) {
        // Initialize with default rules
        this.saveRules(companyId, DEFAULT_RULES);
        return DEFAULT_RULES;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_RULES;
    }
  }

  public saveRules(companyId: string, rules: BrsRule[]): void {
    if (!companyId) return;
    try {
      localStorage.setItem(this.storageKey(companyId), JSON.stringify(rules));
    } catch (e) {
      console.error('Failed to save BRS rules:', e);
    }
  }

  public addRule(companyId: string, rule: Omit<BrsRule, 'id'>): BrsRule {
    const newRule: BrsRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    const current = this.getRules(companyId);
    current.push(newRule);
    this.saveRules(companyId, current);
    return newRule;
  }

  public updateRule(companyId: string, rule: BrsRule): void {
    const current = this.getRules(companyId);
    const idx = current.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      current[idx] = rule;
      this.saveRules(companyId, current);
    }
  }

  public deleteRule(companyId: string, ruleId: string): void {
    const current = this.getRules(companyId).filter((r) => r.id !== ruleId);
    this.saveRules(companyId, current);
  }

  // Smart suggestion extraction logic
  public extractSuggestedLedger(
    narration: string,
    txnType: 'Payment' | 'Receipt' | 'Contra' | 'DEBIT' | 'CREDIT',
    ledgers: Ledger[],
    rules: BrsRule[]
  ): { suggestedName: string; matchedLedger?: Ledger; autoAssign?: boolean } {
    if (!narration) return { suggestedName: '' };
    const cleanNarr = narration.trim();
    const upperNarr = cleanNarr.toUpperCase();

    // 1. Check custom rules first
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const typeMatches =
        rule.transactionType === 'ANY' ||
        (rule.transactionType === 'Payment' && (txnType === 'Payment' || txnType === 'DEBIT')) ||
        (rule.transactionType === 'Receipt' && (txnType === 'Receipt' || txnType === 'CREDIT'));

      if (!typeMatches) continue;

      for (const kw of rule.keywords) {
        if (kw && upperNarr.includes(kw.toUpperCase().trim())) {
          // Find matching ledger in current ledgers list
          const matched =
            ledgers.find((l) => l.id === rule.targetLedgerId) ||
            ledgers.find((l) => l.name.toLowerCase() === rule.targetLedgerName.toLowerCase()) ||
            ledgers.find((l) => l.name.toLowerCase().includes(rule.targetLedgerName.toLowerCase()));

          return {
            suggestedName: rule.targetLedgerName.toLowerCase(),
            matchedLedger: matched,
            autoAssign: true,
          };
        }
      }
    }

    // 2. Pattern Matching for Indian Banking Narration standard formats
    // NEFT / RTGS / IMPS pattern: e.g. "MB: Sent NEFT/GANPATI COR/ HDFC / 0985256000006"
    const neftMatch = cleanNarr.match(/(?:NEFT|RTGS|IMPS|IFT)\/([A-Z0-9\s._-]+?)\//i);
    if (neftMatch && neftMatch[1]) {
      const extracted = neftMatch[1].trim();
      const matched = this.findClosestLedger(extracted, ledgers);
      return {
        suggestedName: extracted.toLowerCase(),
        matchedLedger: matched,
      };
    }

    // UPI pattern: e.g. "UPI/DEEPAK SINGH AI/609214359795/Food jaipur" or "UPI/COCO Bhilwara/..."
    const upiMatch = cleanNarr.match(/UPI\/([A-Za-z0-9\s._-]+?)\//i);
    if (upiMatch && upiMatch[1]) {
      let extracted = upiMatch[1].trim();
      // Remove trailing noise like AI, UPI ID suffix
      extracted = extracted.replace(/\s+AI$/i, '').trim();
      const matched = this.findClosestLedger(extracted, ledgers);
      return {
        suggestedName: extracted.toLowerCase(),
        matchedLedger: matched,
      };
    }

    // Specific Bank keywords
    if (upperNarr.includes('INT.COLL') || upperNarr.includes('INT:COLL') || upperNarr.includes('INTEREST')) {
      const matched = ledgers.find((l) => l.name.toUpperCase().includes('INTEREST'));
      return { suggestedName: 'bank interest paid', matchedLedger: matched };
    }

    if (upperNarr.includes('CHARGES') || upperNarr.includes('CHG') || upperNarr.includes('ANNUAL FEE')) {
      const matched = ledgers.find((l) => l.name.toUpperCase().includes('BANK CHARGE'));
      return { suggestedName: 'bank charges', matchedLedger: matched };
    }

    if (upperNarr.includes('PETROL') || upperNarr.includes('DIESEL') || upperNarr.includes('FUEL')) {
      const matched = ledgers.find((l) => l.name.toUpperCase().includes('CAR') || l.name.toUpperCase().includes('VEHICLE') || l.name.toUpperCase().includes('FUEL'));
      return { suggestedName: 'car running expenses', matchedLedger: matched };
    }

    if (upperNarr.includes('SALARY') || upperNarr.includes('WAGES')) {
      const matched = ledgers.find((l) => l.name.toUpperCase().includes('SALARY') || l.name.toUpperCase().includes('WAGES'));
      return { suggestedName: 'factory salary payable', matchedLedger: matched };
    }

    // Fallback: Take first 2-3 words of narration
    const words = cleanNarr.split(/[\s/:]+/).filter((w) => w.length > 2 && !['SENT', 'TRANSFER', 'FROM', 'PAID', 'TO', 'THE', 'AND', 'MB'].includes(w.toUpperCase()));
    const simpleExtract = words.slice(0, 2).join(' ').toLowerCase();
    const fallbackMatched = simpleExtract ? this.findClosestLedger(simpleExtract, ledgers) : undefined;

    return {
      suggestedName: simpleExtract || 'general ledger',
      matchedLedger: fallbackMatched,
    };
  }

  private findClosestLedger(searchStr: string, ledgers: Ledger[]): Ledger | undefined {
    const s = searchStr.toLowerCase().trim();
    if (!s) return undefined;

    // Exact match
    let found = ledgers.find((l) => l.name.toLowerCase() === s);
    if (found) return found;

    // Word boundary or substring
    found = ledgers.find((l) => {
      const ln = l.name.toLowerCase();
      return ln.includes(s) || s.includes(ln);
    });
    if (found) return found;

    // Match first key word
    const firstWord = s.split(' ')[0];
    if (firstWord && firstWord.length > 3) {
      found = ledgers.find((l) => l.name.toLowerCase().includes(firstWord));
    }
    return found;
  }
}

export const brsRuleService = new BrsRuleService();
