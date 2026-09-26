import React from 'react';
import { FileText, Truck, Receipt } from 'lucide-react';
import { TransactionCrudTable } from '../TransactionCrudTable';
import { SeriesBillSundryManager } from '../SeriesBillSundryManager';

export type SalesTab = 'sales_quotation' | 'sales_invoice' | 'sales_challan' | 'sales_sundry';

interface SalesViewProps {
  initialSubTab?: SalesTab;
}

export const SalesView: React.FC<SalesViewProps> = ({ initialSubTab = 'sales_invoice' }) => {
  return (
    <div className="flex-1 flex flex-col text-slate-100 min-h-full">
      {initialSubTab === 'sales_quotation' && (
        <TransactionCrudTable
          formType="sales_quotation"
          title="Sales Quotation Register & Entry"
          subtitle="Manage rate estimates, validity periods, customer quotations, and sqft calculations"
          icon={<FileText className="w-5 h-5 text-amber-400" />}
        />
      )}

      {initialSubTab === 'sales_invoice' && (
        <TransactionCrudTable
          formType="sales_invoice"
          title="Sales Invoices & Billing Register"
          subtitle="Full GST Tax Invoices with Series, Godowns, Vehicle Logistics, Sundry Taxes, and Pakka/Kacha Split"
          icon={<Receipt className="w-5 h-5 text-amber-400" />}
        />
      )}

      {initialSubTab === 'sales_challan' && (
        <TransactionCrudTable
          formType="sales_challan"
          title="Sales Delivery Challan & Dispatch"
          subtitle="Track outgoing material, vehicle / truck dispatch numbers, slab pieces, and net sqft"
          icon={<Truck className="w-5 h-5 text-amber-400" />}
        />
      )}

      {initialSubTab === 'sales_sundry' && (
        <div className="flex justify-center">
          <SeriesBillSundryManager seriesType="sales" />
        </div>
      )}
    </div>
  );
};
