"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TFEvent } from "@/types";
import { BUSINESS_UNITS, EVENT_TYPES, REGIONS, STATUSES, BUDGET_MONTHS } from "@/lib/constants";

interface Props {
  onClose: () => void;
  onSave: (event: Partial<TFEvent>) => Promise<void>;
}

export function AddEventDialog({ onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    event_name: "",
    business_unit: "TrustFlight",
    event_type: "Conference",
    region: "EMEA",
    city: "",
    country: "",
    venue: "",
    start_date: "",
    end_date: "",
    number_of_days: 2,
    sales_staff_attending: 1,
    event_booth_cost: 0,
    est_daily_rate: 300,
    flight_cost_per_person: 500,
    budget_month: "Apr",
    status: "Planned",
    event_website_url: "",
    event_description: "",
    target_audience: "",
    key_topics: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.event_name) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass = "w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "text-xs font-medium text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add New Event</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Event Name *</label>
              <input className={inputClass} value={form.event_name} onChange={(e) => update("event_name", e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Business Unit</label>
              <select className={inputClass} value={form.business_unit} onChange={(e) => update("business_unit", e.target.value)}>
                {BUSINESS_UNITS.slice(1).map((bu) => <option key={bu}>{bu}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Event Type</label>
              <select className={inputClass} value={form.event_type} onChange={(e) => update("event_type", e.target.value)}>
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Region</label>
              <select className={inputClass} value={form.region} onChange={(e) => update("region", e.target.value)}>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input className={inputClass} value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input className={inputClass} value={form.country} onChange={(e) => update("country", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Venue</label>
              <input className={inputClass} value={form.venue} onChange={(e) => update("venue", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Budget Month</label>
              <select className={inputClass} value={form.budget_month} onChange={(e) => update("budget_month", e.target.value)}>
                {BUDGET_MONTHS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" className={inputClass} value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>End Date</label>
              <input type="date" className={inputClass} value={form.end_date} onChange={(e) => update("end_date", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>No. of Days</label>
              <input type="number" className={inputClass} value={form.number_of_days} onChange={(e) => update("number_of_days", parseInt(e.target.value) || 0)} min={1} />
            </div>
            <div>
              <label className={labelClass}>Sales Staff Attending</label>
              <input type="number" className={inputClass} value={form.sales_staff_attending} onChange={(e) => update("sales_staff_attending", parseInt(e.target.value) || 0)} min={1} />
            </div>
            <div>
              <label className={labelClass}>Event/Booth Cost ($)</label>
              <input type="number" className={inputClass} value={form.event_booth_cost} onChange={(e) => update("event_booth_cost", parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div>
              <label className={labelClass}>Est. Daily Rate ($/person/day)</label>
              <input type="number" className={inputClass} value={form.est_daily_rate} onChange={(e) => update("est_daily_rate", parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div>
              <label className={labelClass}>Flight Cost ($/person)</label>
              <input type="number" className={inputClass} value={form.flight_cost_per_person} onChange={(e) => update("flight_cost_per_person", parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div>
              <label className={labelClass}>Website URL</label>
              <input className={inputClass} value={form.event_website_url} onChange={(e) => update("event_website_url", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Event Description</label>
              <textarea className={`${inputClass} h-20`} value={form.event_description} onChange={(e) => update("event_description", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Target Audience</label>
              <textarea className={`${inputClass} h-16`} value={form.target_audience} onChange={(e) => update("target_audience", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Key Topics</label>
              <input className={inputClass} value={form.key_topics} onChange={(e) => update("key_topics", e.target.value)} placeholder="Comma-separated" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.event_name}
              className="px-4 py-2 text-sm bg-[#0b1a3b] text-white rounded-md hover:bg-[#152a52] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
