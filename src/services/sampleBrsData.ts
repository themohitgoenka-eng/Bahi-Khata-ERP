import { BankStatementTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const generateSampleBrsTransactions = (
  bankAccountId: string,
  companyId: string,
  fiscalYearId: string
): BankStatementTransaction[] => {
  const transactions: BankStatementTransaction[] = [];
  const now = new Date().toISOString();

  // Defined transactions matching the real-world screenshot exactly
  const baseRows: Array<{
    date: string;
    narration: string;
    type: 'DEBIT' | 'CREDIT';
    amount: number;
    suggested: string;
    selected: string;
    status: 'POSTED' | 'UNMATCHED';
  }> = [
    {
      date: '2026-04-01',
      narration: 'MB: Sent NEFT/GANPATI COR/ HDFC / 0985256000006',
      type: 'DEBIT',
      amount: 31860.0,
      suggested: 'ganpati cor',
      selected: 'GANPATI CORPORATION',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'Int.Coll:9350054343:02-03-2026 to 01-04-2026',
      type: 'DEBIT',
      amount: 13125.0,
      suggested: 'bank interest paid',
      selected: 'BANK INTEREST PAID',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'UPI/DEEPAK SINGH AI/609214359795/Food jaipur',
      type: 'DEBIT',
      amount: 1085.0,
      suggested: 'deepak singh',
      selected: 'TRAVELLING & TOURING EXPENSES',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'UPI/Sukhram Sukhra/609217917362/Purchase',
      type: 'DEBIT',
      amount: 16390.0,
      suggested: 'sukhram sukhra',
      selected: 'FACTORY SALARY PAYABLE',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'MB: Sent NEFT/INDORE STON/ HDFC /502000064906',
      type: 'DEBIT',
      amount: 100000.0,
      suggested: 'indore ston',
      selected: 'INDORE STONE COMPANY',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'MB: Sent NEFT/BLUE LOTUS / HDFC / 502000232149',
      type: 'DEBIT',
      amount: 53827.0,
      suggested: 'BLUE LOTUS STONE (Mandi)',
      selected: 'BLUE LOTUS STONE (Mandi)',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'MB: Sent NEFT/MUKUT BIHAR/ STATE/61089208435/',
      type: 'DEBIT',
      amount: 60054.0,
      suggested: 'mukut bihar',
      selected: 'VINNY STONE INDUSTRIES',
      status: 'POSTED',
    },
    {
      date: '2026-04-02',
      narration: 'MB: Sent NEFT/MUKUT BIHAR/ STATE/61089208435/',
      type: 'DEBIT',
      amount: 21750.0,
      suggested: 'mukut bihar',
      selected: 'FACTORY SALARY PAYABLE',
      status: 'POSTED',
    },
    {
      date: '2026-04-03',
      narration: 'UPI/Mukut Bihari/609312963615/Loading 2apr',
      type: 'DEBIT',
      amount: 4600.0,
      suggested: 'mukut bihari',
      selected: 'FACTORY SALARY PAYABLE',
      status: 'POSTED',
    },
    {
      date: '2026-04-03',
      narration: 'UPI/COCO Bhilwara/609312981705/Petrol',
      type: 'DEBIT',
      amount: 453.0,
      suggested: 'coco bhilwara',
      selected: 'CAR RUNNING EXPENSES',
      status: 'POSTED',
    },
    {
      date: '2026-04-04',
      narration: 'MB: Sent NEFT/KAUSHAL STO/ ICICI / 001205001234',
      type: 'DEBIT',
      amount: 45000.0,
      suggested: 'kaushal stone',
      selected: 'KAUSHAL STONE TRADERS',
      status: 'POSTED',
    },
    {
      date: '2026-04-05',
      narration: 'RTGS/INWARD/MARBLE SALES ADVANCE/JAIPUR BUILDERS',
      type: 'CREDIT',
      amount: 500000.0,
      suggested: 'jaipur builders',
      selected: 'JAIPUR BUILDERS & MARBLE',
      status: 'POSTED',
    },
    {
      date: '2026-04-06',
      narration: 'NEFT/INWARD/SHREE RAM TILES/ADVANCE',
      type: 'CREDIT',
      amount: 350000.0,
      suggested: 'shree ram tiles',
      selected: 'SHREE RAM GRANITE & TILES',
      status: 'POSTED',
    },
    {
      date: '2026-04-07',
      narration: 'UPI/Direct Deposit/Client Settlement',
      type: 'CREDIT',
      amount: 158102.45,
      suggested: 'client settlement',
      selected: 'DIRECT CUSTOMER RECEIPTS',
      status: 'POSTED',
    },
    {
      date: '2026-04-08',
      narration: 'CHQ/984321/ROYAL STONE MINING EXPENSES',
      type: 'DEBIT',
      amount: 85400.0,
      suggested: 'royal stone',
      selected: 'ROYAL MINING & QUARRY SUPPLIES',
      status: 'POSTED',
    },
    {
      date: '2026-04-09',
      narration: 'UPI/Shyam Diesel Pump/Diesel for Tipper RJ06',
      type: 'DEBIT',
      amount: 18500.0,
      suggested: 'shyam diesel',
      selected: 'CAR RUNNING EXPENSES',
      status: 'POSTED',
    },
    {
      date: '2026-04-10',
      narration: 'MB: Sent NEFT/AMBICA MINING/ AXIS / 9190100455',
      type: 'DEBIT',
      amount: 125000.0,
      suggested: 'ambica mining',
      selected: 'AMBICA MINING & CRUSHERS',
      status: 'POSTED',
    },
    {
      date: '2026-04-11',
      narration: 'UPI/GANESH ELECTRICALS/Wire & Cutter Repair',
      type: 'DEBIT',
      amount: 7850.0,
      suggested: 'ganesh electricals',
      selected: 'FACTORY REPAIR & MAINTENANCE',
      status: 'POSTED',
    },
    {
      date: '2026-04-12',
      narration: 'NEFT/INWARD/MAHADEV EXPORTS/STONE SLABS',
      type: 'CREDIT',
      amount: 300000.0,
      suggested: 'mahadev exports',
      selected: 'MAHADEV EXPORTS & TILES',
      status: 'POSTED',
    },
    {
      date: '2026-04-13',
      narration: 'BANK CHG/SMS ALERTS & QTRLY MAINTENANCE',
      type: 'DEBIT',
      amount: 354.0,
      suggested: 'bank charges',
      selected: 'BANK CHARGES',
      status: 'POSTED',
    },
    {
      date: '2026-04-14',
      narration: 'UPI/RAMESH TRANSPORT/Bhilwara To Udaipur Freight',
      type: 'DEBIT',
      amount: 14500.0,
      suggested: 'ramesh transport',
      selected: 'FREIGHT & CARTAGE INWARD',
      status: 'POSTED',
    },
    {
      date: '2026-04-15',
      narration: 'MB: Sent NEFT/DEVENDRA TILES/ SBI / 300984758',
      type: 'DEBIT',
      amount: 72000.0,
      suggested: 'devendra tiles',
      selected: 'DEVENDRA TILES & STONES',
      status: 'POSTED',
    },
    // Unposted sample rows matching the "Unposted Transactions (2)" from the screenshot!
    {
      date: '2026-04-16',
      narration: 'UPI/Kishan Lal/Direct Vendor Transfer/Wire Rods',
      type: 'DEBIT',
      amount: 18500.0,
      suggested: 'kishan lal',
      selected: '',
      status: 'UNMATCHED',
    },
    {
      date: '2026-04-17',
      narration: 'MB: Sent NEFT/RAJASTHAN EXPLOSIVES/ SBI / 2039485',
      type: 'DEBIT',
      amount: 45200.0,
      suggested: 'rajasthan explosives',
      selected: '',
      status: 'UNMATCHED',
    },
  ];

  let idCounter = 1;
  for (const row of baseRows) {
    transactions.push({
      id: `stmt-tx-${Date.now()}-${idCounter}`,
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId,
      date: row.date,
      narration: row.narration,
      description: row.narration,
      referenceNo: `REF-${100000 + idCounter}`,
      type: row.type,
      amount: row.amount,
      debit: row.type === 'DEBIT' ? row.amount : undefined,
      credit: row.type === 'CREDIT' ? row.amount : undefined,
      suggestedLedgerName: row.suggested,
      selectedLedgerName: row.selected || undefined,
      transactionType: row.type === 'DEBIT' ? 'Payment' : 'Receipt',
      reconciliationStatus: row.status === 'POSTED' ? 'POSTED' : 'UNMATCHED',
      createdAt: now,
    });
    idCounter++;
  }

  // Generate more realistic batches to reach ~239 total transactions if needed
  const vendors = [
    'GANPATI CORPORATION',
    'INDORE STONE COMPANY',
    'BLUE LOTUS STONE (Mandi)',
    'VINNY STONE INDUSTRIES',
    'FACTORY SALARY PAYABLE',
    'CAR RUNNING EXPENSES',
    'TRAVELLING & TOURING EXPENSES',
    'BANK INTEREST PAID',
    'KAUSHAL STONE TRADERS',
    'AMBICA MINING & CRUSHERS',
    'SHREE RAM GRANITE & TILES',
  ];

  const descriptions = [
    'MB: Sent NEFT/GANPATI COR/ HDFC /',
    'UPI/Sukhram Sukhra/Factory Exp',
    'MB: Sent NEFT/INDORE STON/ HDFC /',
    'UPI/COCO Bhilwara/Diesel Refuel',
    'MB: Sent NEFT/BLUE LOTUS / HDFC /',
    'UPI/DEEPAK SINGH AI/Food jaipur',
    'MB: Sent NEFT/MUKUT BIHAR/ STATE/',
    'Int.Coll:9350054343:Qtrly Int',
    'UPI/Mukut Bihari/Loading Labor',
  ];

  for (let i = idCounter; i <= 239; i++) {
    const isCredit = i % 10 === 0; // 1 in 10 is receipt
    const day = Math.min(28, (i % 28) + 1);
    const month = ((i % 4) + 4).toString().padStart(2, '0'); // April to July
    const dateStr = `2026-${month}-${day.toString().padStart(2, '0')}`;
    const vendor = vendors[i % vendors.length];
    const descPrefix = descriptions[i % descriptions.length];
    const amount = isCredit
      ? Math.round((25000 + (i * 350) % 45000) * 100) / 100
      : Math.round((1200 + (i * 420) % 85000) * 100) / 100;

    transactions.push({
      id: `stmt-tx-${Date.now()}-${i}`,
      uuid: uuidv4(),
      companyId,
      fiscalYearId,
      bankAccountId,
      date: dateStr,
      narration: `${descPrefix}${9000000000 + i}/Ref${i}`,
      description: `${descPrefix}${9000000000 + i}/Ref${i}`,
      referenceNo: `REF-${200000 + i}`,
      type: isCredit ? 'CREDIT' : 'DEBIT',
      amount,
      debit: !isCredit ? amount : undefined,
      credit: isCredit ? amount : undefined,
      suggestedLedgerName: vendor.toLowerCase().slice(0, 16),
      selectedLedgerName: vendor,
      transactionType: isCredit ? 'Receipt' : 'Payment',
      reconciliationStatus: 'POSTED',
      createdAt: now,
    });
  }

  return transactions;
};
