"use client";

import useSWR from "swr";
import { TFEvent } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { BU_COLORS, BUDGET_MONTHS } from "@/lib/constants";
import { Loader2, DollarSign, Calendar, MapPin, Building2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function BudgetSummary() {
  const { data: events = [], isLoading } = useSWR<TFEvent[]>("/api/events", fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  // Aggregate by BU
  const byBU: Record<string, { count: number; booth: number; travel: number; total: number }> = {};
  for (const e of events) {
    if (!byBU[e.business_unit]) byBU[e.business_unit] = { count: 0, booth: 0, travel: 0, total: 0 };
    byBU[e.business_unit].count++;
    byBU[e.business_unit].booth += e.event_booth_cost;
    byBU[e.business_unit].travel += e.total_travel_cost;
    byBU[e.business_unit].total += e.total_event_cost;
  }

  // Aggregate by month
  const byMonth: Record<string, { count: number; total: number }> = {};
  for (const m of BUDGET_MONTHS) byMonth[m] = { count: 0, total: 0 };
  for (const e of events) {
    if (byMonth[e.budget_month]) {
      byMonth[e.budget_month].count++;
      byMonth[e.budget_month].total += e.total_event_cost;
    }
  }

  // Aggregate by region
  const byRegion: Record<string, { count: number; total: number }> = {};
  for (const e of events) {
    if (!byRegion[e.region]) byRegion[e.region] = { count: 0, total: 0 };
    byRegion[e.region].count++;
    byRegion[e.region].total += e.total_event_cost;
  }

  const grandTotal = events.reduce((sum, e) => sum + e.total_event_cost, 0);

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <span className="text-sm text-slate-600">Total Events</span>
          </div>
          <p className="text-2xl font-bold">{events.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <DollarSign size={18} className="text-green-600" />
            </div>
            <span className="text-sm text-slate-600">Total Budget</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-50">
              <Building2 size={18} className="text-purple-600" />
            </div>
            <span className="text-sm text-slate-600">Business Units</span>
          </div>
          <p className="text-2xl font-bold">{Object.keys(byBU).length}</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-50">
              <MapPin size={18} className="text-orange-600" />
            </div>
            <span className="text-sm text-slate-600">Regions</span>
          </div>
          <p className="text-2xl font-bold">{Object.keys(byRegion).length}</p>
        </div>
      </div>

      {/* Budget by BU */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Budget by Business Unit</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Business Unit</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Events</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Booth Costs</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Travel Costs</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byBU)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([bu, data]) => {
                  const colors = BU_COLORS[bu];
                  return (
                    <tr key={bu} className="border-t hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors?.text || ""} ${colors?.bg || ""}`}>
                          {bu}
                        </span>
                      </td>
                      <td className="text-right px-5 py-3">{data.count}</td>
                      <td className="text-right px-5 py-3">{formatCurrency(data.booth)}</td>
                      <td className="text-right px-5 py-3">{formatCurrency(data.travel)}</td>
                      <td className="text-right px-5 py-3 font-semibold">{formatCurrency(data.total)}</td>
                    </tr>
                  );
                })}
              <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                <td className="px-5 py-3">Total</td>
                <td className="text-right px-5 py-3">{events.length}</td>
                <td className="text-right px-5 py-3">{formatCurrency(Object.values(byBU).reduce((s, d) => s + d.booth, 0))}</td>
                <td className="text-right px-5 py-3">{formatCurrency(Object.values(byBU).reduce((s, d) => s + d.travel, 0))}</td>
                <td className="text-right px-5 py-3">{formatCurrency(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Monthly Budget (FY27)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Month</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Events</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total Spend</th>
                <th className="px-4 py-3 font-medium text-slate-600">Distribution</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_MONTHS.map((month) => {
                const data = byMonth[month];
                const pct = grandTotal > 0 ? (data.total / grandTotal) * 100 : 0;
                return (
                  <tr key={month} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium">{month}</td>
                    <td className="text-right px-4 py-2.5">{data.count || "—"}</td>
                    <td className="text-right px-4 py-2.5">{data.total ? formatCurrency(data.total) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">
                          {pct > 0 ? `${pct.toFixed(0)}%` : ""}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Region */}
      <div className="bg-white rounded-lg border">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Budget by Region</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5">
          {Object.entries(byRegion)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([region, data]) => (
              <div key={region} className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-600 mb-1">{region}</h3>
                <p className="text-xl font-bold">{formatCurrency(data.total)}</p>
                <p className="text-xs text-slate-500 mt-1">{data.count} events</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
