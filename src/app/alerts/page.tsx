"use client";

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Save, Send, Bell } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { BU_COLORS, BUSINESS_UNITS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { AlertRecipient, AlertSend, UpcomingTouchpoint } from "@/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const EDITABLE_BUS = BUSINESS_UNITS.filter((b) => b !== "All");

export default function AlertsPage() {
  const { isAdmin } = useAuthStore();

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-medium">Admin only</p>
        <p className="text-sm mt-1">
          Log in with the admin password to manage alert recipients and view scheduled touchpoints.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-3">
        <Bell size={22} className="text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-sm text-slate-500">
            Pre-event touchpoints sent via HubSpot. Daily Northflank job triggers sends at 08:00 Europe/London.
          </p>
        </div>
      </header>

      <RecipientsEditor />
      <UpcomingTable />
      <HistoryTable />
    </div>
  );
}

function RecipientsEditor() {
  const { data, mutate, isLoading } = useSWR<AlertRecipient[]>("/api/recipients", fetcher);

  const lookup = new Map<string, AlertRecipient>();
  (data || []).forEach((r) => lookup.set(r.business_unit, r));

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Distribution lists</h2>
      <p className="text-sm text-slate-500 mb-4">
        Comma-separated emails per business unit. Each event also appends its <code className="bg-slate-100 px-1 rounded">staff_emails</code> column.
      </p>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 w-44">Business unit</th>
              <th className="text-left px-4 py-2">Emails</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  <Loader2 className="animate-spin inline" size={16} />
                </td>
              </tr>
            )}
            {EDITABLE_BUS.map((bu) => (
              <RecipientRow
                key={bu}
                bu={bu}
                initial={lookup.get(bu)?.emails || ""}
                onSaved={() => mutate()}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecipientRow({
  bu,
  initial,
  onSaved,
}: {
  bu: string;
  initial: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = value !== initial;
  const colors = BU_COLORS[bu];

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_unit: bu, emails: value }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2">
        <span
          className={cn(
            "inline-block px-2 py-0.5 rounded text-xs font-medium border-l-4",
            colors?.bg,
            colors?.border,
            colors?.text
          )}
        >
          {bu}
        </span>
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="alice@trustflight.com, bob@trustflight.com"
          className="w-full px-2 py-1 border rounded text-sm font-mono"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={cn(
            "inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium",
            dirty
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
          {savedAt && !dirty ? "Saved" : "Save"}
        </button>
      </td>
    </tr>
  );
}

function UpcomingTable() {
  const { data, isLoading, mutate } = useSWR<UpcomingTouchpoint[]>(
    "/api/alerts/preview?days=14",
    fetcher
  );

  const [sendingKey, setSendingKey] = useState<string | null>(null);

  async function sendNow(eventId: number, touchpoint: string) {
    const key = `${eventId}:${touchpoint}`;
    setSendingKey(key);
    try {
      await fetch(
        `/api/alerts/run?event_id=${eventId}&touchpoint=${encodeURIComponent(touchpoint)}`,
        { method: "POST" }
      );
      mutate();
    } finally {
      setSendingKey(null);
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Upcoming (next 14 days)</h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Due</th>
              <th className="text-left px-4 py-2">Touchpoint</th>
              <th className="text-left px-4 py-2">Event</th>
              <th className="text-left px-4 py-2">BU</th>
              <th className="text-left px-4 py-2">Event date</th>
              <th className="text-left px-4 py-2">Recipients</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  <Loader2 className="animate-spin inline" size={16} />
                </td>
              </tr>
            )}
            {!isLoading && (data || []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Nothing scheduled in the next 14 days.
                </td>
              </tr>
            )}
            {(data || []).map((row) => {
              const key = `${row.event_id}:${row.touchpoint_code}`;
              return (
                <tr key={key} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{formatDate(row.due_date)}</td>
                  <td className="px-4 py-2">
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{row.touchpoint_code}</code>
                    <span className="ml-2 text-slate-500 text-xs">{row.touchpoint_subject}</span>
                  </td>
                  <td className="px-4 py-2">{row.event_name}</td>
                  <td className="px-4 py-2 text-xs">{row.business_unit}</td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{formatDate(row.start_date)}</td>
                  <td className="px-4 py-2 text-xs">
                    {row.resolved_recipients.length === 0 ? (
                      <span className="text-amber-600">no recipients</span>
                    ) : (
                      <span className="text-slate-600">
                        {row.resolved_recipients.length} recipient{row.resolved_recipients.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => sendNow(row.event_id, row.touchpoint_code)}
                      disabled={sendingKey === key || row.resolved_recipients.length === 0}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs",
                        row.resolved_recipients.length === 0
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      )}
                    >
                      {sendingKey === key ? (
                        <Loader2 className="animate-spin" size={11} />
                      ) : (
                        <Send size={11} />
                      )}
                      Send now
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryTable() {
  const { data, isLoading } = useSWR<(AlertSend & { event_name: string; business_unit: string })[]>(
    "/api/alerts/history?days=30",
    fetcher
  );

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Recent sends (last 30 days)</h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">Sent</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Touchpoint</th>
              <th className="text-left px-4 py-2">Event</th>
              <th className="text-left px-4 py-2">Recipients</th>
              <th className="text-left px-4 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  <Loader2 className="animate-spin inline" size={16} />
                </td>
              </tr>
            )}
            {!isLoading && (data || []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No sends in the last 30 days.
                </td>
              </tr>
            )}
            {(data || []).map((row) => (
              <tr key={row.id} className="border-b last:border-b-0 align-top">
                <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{formatDate(row.sent_at)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-2">
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{row.touchpoint_code}</code>
                </td>
                <td className="px-4 py-2">
                  <div>{row.event_name}</div>
                  <div className="text-xs text-slate-500">{row.business_unit}</div>
                </td>
                <td className="px-4 py-2 text-xs font-mono break-all">{row.recipients || "—"}</td>
                <td className="px-4 py-2 text-xs text-red-600 break-all">{row.error || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    skipped_no_recipients: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium", map[status] || "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}
