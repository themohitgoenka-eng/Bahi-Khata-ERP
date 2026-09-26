import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, Layers, Settings, Check, RefreshCw, Edit2 } from "lucide-react";
import { db, SeriesConfigRecord } from "../db";
import { useApp } from "../context/AppContext";

export const SeriesBillSundryManager: React.FC<{ seriesType?: "sales" | "purchase" }> = ({ seriesType = "sales" }) => {
  const { ledgers } = useApp();
  const [seriesName, setSeriesName] = useState("MAIN");
  const [seriesList, setSeriesList] = useState<SeriesConfigRecord[]>([]);
  const [sundries, setSundries] = useState([
    { name: "FREIGHT / TRANSPORT CHARGES", defaultAmount: 4500, type: "ADD", isPercentage: false },
    { name: "CGST 9%", defaultAmount: 9, type: "ADD", isPercentage: true },
    { name: "SGST 9%", defaultAmount: 9, type: "ADD", isPercentage: true },
    { name: "ROUND OFF", defaultAmount: 0, type: "ADD_LESS", isPercentage: false }
  ]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customTextRows, setCustomTextRows] = useState<{ [index: number]: boolean }>({});

  const taxLedgers = useMemo(() => {
    return ledgers.filter(
      (l) =>
        l.groupId === "grp-duties-taxes" ||
        l.accountType === "LIABILITY" ||
        l.name.toUpperCase().includes("GST") ||
        l.name.toUpperCase().includes("TAX") ||
        l.name.toUpperCase().includes("TCS")
    );
  }, [ledgers]);

  const expenseLedgers = useMemo(() => {
    return ledgers.filter(
      (l) =>
        (l.accountType === "DIRECT_EXPENSE" ||
          l.accountType === "INDIRECT_EXPENSE" ||
          l.name.toUpperCase().includes("FREIGHT") ||
          l.name.toUpperCase().includes("DISCOUNT") ||
          l.name.toUpperCase().includes("ROUND")) &&
        !taxLedgers.some((t) => t.id === l.id)
    );
  }, [ledgers, taxLedgers]);

  const otherLedgers = useMemo(() => {
    const existing = new Set([...taxLedgers.map((l) => l.id), ...expenseLedgers.map((l) => l.id)]);
    return ledgers.filter((l) => !existing.has(l.id));
  }, [ledgers, taxLedgers, expenseLedgers]);

  // Load existing series configurations
  const loadSeries = async (selectedName?: string) => {
    try {
      const all = await db.seriesList.toArray();
      const filtered = all.filter((s) => s.seriesType === seriesType);
      setSeriesList(filtered);

      const targetName = selectedName || seriesName;
      const current = filtered.find((s) => s.name === targetName);
      if (current && current.sundries) {
        setSundries(current.sundries);
      }
    } catch (err) {
      console.error("Error loading series config:", err);
    }
  };

  useEffect(() => {
    loadSeries();
  }, [seriesType]);

  const handleSeriesChange = async (newName: string) => {
    setSeriesName(newName);
    try {
      const rec = await db.seriesList.get(newName);
      if (rec && rec.sundries) {
        setSundries(rec.sundries);
      } else {
        // Fallback default
        setSundries([
          { name: "FREIGHT / TRANSPORT CHARGES", defaultAmount: 0, type: "ADD", isPercentage: false },
          { name: "ROUND OFF", defaultAmount: 0, type: "ADD_LESS", isPercentage: false },
        ]);
      }
    } catch (err) {
      console.error("Error reading series:", err);
    }
  };

  const addSundryRow = () => {
    setSundries([...sundries, { name: "", defaultAmount: 0, type: "ADD", isPercentage: false }]);
  };

  const handleSaveSeriesSundry = async () => {
    await db.seriesList.put({
      name: seriesName,
      prefix: seriesName === "MAIN" ? "INV" : seriesName.slice(0, 3).toUpperCase(),
      seriesType: (seriesType || "sales") as "sales" | "purchase",
      sundries: sundries as any,
      createdAt: Date.now()
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    loadSeries(seriesName);
  };

  return (
    <div className="bg-[#121214] border border-white/10 rounded-xl p-6 max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Sales Bill Sundry &amp; Series Configuration</span>
          </h2>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">Configure default taxes, freight, and round-offs per sales series</p>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}
          <button onClick={handleSaveSeriesSundry} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase rounded flex items-center gap-1.5 shadow-md shadow-amber-600/20">
            <Save className="w-3.5 h-3.5" /> Save Series
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="w-64">
          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Select Sales Series</label>
          <select value={seriesName} onChange={e => handleSeriesChange(e.target.value)} className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-3 py-2 text-xs text-white">
            <option value="MAIN">MAIN</option>
            <option value="GST SALES">GST SALES</option>
            <option value="RETAIL">RETAIL</option>
            {seriesList
              .filter(s => !["MAIN", "GST SALES", "RETAIL"].includes(s.name))
              .map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))
            }
          </select>
        </div>

        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1A1A1A] text-gray-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Sundry Name</th>
                <th className="p-2.5 w-40">Calculation Type</th>
                <th className="p-2.5 w-32 text-right">Default Value</th>
                <th className="p-2.5 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sundries.map((s, idx) => (
                <tr key={idx} className="hover:bg-white/5">
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      {customTextRows[idx] ? (
                        <input
                          type="text"
                          value={s.name}
                          onChange={(e) => {
                            const copy = [...sundries];
                            copy[idx].name = e.target.value;
                            setSundries(copy);
                          }}
                          placeholder="e.g. CGST, FREIGHT..."
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2 py-1 text-white text-xs"
                        />
                      ) : (
                        <select
                          value={s.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__CUSTOM__') {
                              setCustomTextRows((prev) => ({ ...prev, [idx]: true }));
                              return;
                            }
                            const copy = [...sundries];
                            copy[idx].name = val;

                            const upper = val.toUpperCase();
                            if (upper.includes('DISCOUNT') || upper.includes('REBATE') || upper.includes('LESS')) {
                              copy[idx].type = 'SUBTRACT';
                            } else if (upper.includes('ROUND')) {
                              copy[idx].type = 'ADD_LESS';
                            } else {
                              copy[idx].type = 'ADD';
                            }

                            if (upper.includes('9%')) {
                              copy[idx].defaultAmount = 9;
                            } else if (upper.includes('18%')) {
                              copy[idx].defaultAmount = 18;
                            } else if (upper.includes('28%')) {
                              copy[idx].defaultAmount = 28;
                            } else if (upper.includes('5%')) {
                              copy[idx].defaultAmount = 5;
                            }
                            setSundries(copy);
                          }}
                          className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2 py-1 text-white text-xs focus:border-[#2588E8] focus:outline-hidden cursor-pointer"
                        >
                          <option value="">-- Select Account Ledger --</option>
                          {s.name &&
                            !taxLedgers.some((l) => l.name === s.name) &&
                            !expenseLedgers.some((l) => l.name === s.name) &&
                            !otherLedgers.some((l) => l.name === s.name) && (
                              <option value={s.name}>{s.name}</option>
                            )}

                          <optgroup label="Duties & Taxes (GST)">
                            {taxLedgers.length > 0 ? (
                              taxLedgers.map((l) => (
                                <option key={l.id} value={l.name}>
                                  {l.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="CGST 9%">CGST 9%</option>
                                <option value="SGST 9%">SGST 9%</option>
                                <option value="IGST 18%">IGST 18%</option>
                              </>
                            )}
                          </optgroup>

                          <optgroup label="Direct / Indirect Expenses & Charges">
                            <option value="FREIGHT / TRANSPORT CHARGES">FREIGHT / TRANSPORT CHARGES</option>
                            <option value="LOADING & PACKING CHARGES">LOADING & PACKING CHARGES</option>
                            <option value="INSURANCE CHARGES">INSURANCE CHARGES</option>
                            <option value="DISCOUNT">DISCOUNT</option>
                            <option value="ROUND OFF">ROUND OFF</option>
                            {expenseLedgers.map((l) => (
                              <option key={l.id} value={l.name}>
                                {l.name}
                              </option>
                            ))}
                          </optgroup>

                          {otherLedgers.length > 0 && (
                            <optgroup label="All Company Ledgers">
                              {otherLedgers.map((l) => (
                                <option key={l.id} value={l.name}>
                                  {l.name}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          <option value="__CUSTOM__">+ Type Custom Name...</option>
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCustomTextRows((prev) => ({ ...prev, [idx]: !prev[idx] }))
                        }
                        title={customTextRows[idx] ? 'Switch to Ledger Dropdown' : 'Type Custom Name'}
                        className="p-1 text-gray-400 hover:text-amber-300 hover:bg-white/5 rounded transition cursor-pointer shrink-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-2">
                    <select value={s.type} onChange={e => {
                      const copy = [...sundries];
                      copy[idx].type = e.target.value as any;
                      setSundries(copy);
                    }} className="w-full bg-[rgba(18,48,76,0.48)] backdrop-blur-xl border border-[rgba(112,185,245,0.25)] rounded px-2 py-1 text-white text-xs">
                      <option value="ADD">ADD (+)</option>
                      <option value="SUBTRACT">SUBTRACT (-)</option>
                      <option value="ADD_LESS">ADD / LESS (+/-)</option>
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <input type="number" value={s.defaultAmount} onChange={e => {
                      const copy = [...sundries];
                      copy[idx].defaultAmount = Number(e.target.value);
                      setSundries(copy);
                    }} className="w-28 text-right bg-transparent border border-white/10 rounded px-2 py-1 text-white font-mono" />
                  </td>
                  <td className="p-2 text-center">
                    <button type="button" onClick={() => setSundries(sundries.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-rose-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={addSundryRow} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded font-bold text-xs uppercase flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-amber-500" /> Add Sundry
        </button>
      </div>
    </div>
  );
};
