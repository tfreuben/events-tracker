"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { TFEvent } from "@/types";
import { BU_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { Loader2, CheckCircle, Trash2, ExternalLink, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function parsePreEventGoals(goals: string | null): { submittedBy: string | null; whyAttend: string | null } {
  if (!goals) return { submittedBy: null, whyAttend: null };

  let submittedBy: string | null = null;
  let whyAttend: string | null = null;

  for (const line of goals.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Submitted by:")) {
      submittedBy = trimmed.replace(/^Submitted by:\s*/i, "");
    } else if (trimmed.startsWith("Why attend:")) {
      whyAttend = trimmed.replace(/^Why attend:\s*/i, "");
    }
  }

  // Backwards compatibility: if no "Why attend:" prefix found and no "Submitted by:" either,
  // the whole string is just the old submitter-only format
  if (!submittedBy && !whyAttend) {
    submittedBy = goals.replace(/^Submitted by:\s*/i, "");
  }

  return { submittedBy, whyAttend };
}

export default function SubmissionsPage() {
  const { isAdmin } = useAuthStore();
  const { data: events = [], mutate, isLoading } = useSWR<TFEvent[]>(
    "/api/events?status=Requested",
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleApprove = useCallback(
    async (eventId: number) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Planned" }),
      });
      if (res.ok) mutate();
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (eventId: number) => {
      if (!confirm("Delete this submission?")) return;
      mutate(
        (current) => current?.filter((e) => e.id !== eventId),
        false
      );
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) mutate();
    },
    [mutate]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-slate-400" size={24} />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Inbox size={40} className="text-slate-300" />
        <p className="text-sm">No pending submissions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 py-2">
      <p className="text-sm text-slate-500">
        {events.length} pending submission{events.length !== 1 ? "s" : ""}
      </p>
      {events.map((event) => {
        const buColor = BU_COLORS[event.business_unit];
        const { submittedBy, whyAttend } = parsePreEventGoals(event.pre_event_goals);
        const location = [event.city, event.country].filter(Boolean).join(", ");
        const dateRange = event.start_date
          ? event.end_date && event.end_date !== event.start_date
            ? `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`
            : formatDate(event.start_date)
          : null;

        return (
          <div
            key={event.id}
            className={cn(
              "bg-white rounded-lg border border-l-4 p-5 shadow-sm",
              buColor?.border || "border-l-slate-300"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">{event.event_name}</h3>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      buColor?.bg,
                      buColor?.text
                    )}
                  >
                    {event.business_unit}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {event.event_type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {dateRange && <span>{dateRange}</span>}
                  {location && <span>{location}</span>}
                  {event.venue && <span>{event.venue}</span>}
                  <span>{event.region}</span>
                </div>
                {event.event_website_url && (
                  <a
                    href={event.event_website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline w-fit"
                  >
                    <ExternalLink size={12} />
                    {event.event_website_url}
                  </a>
                )}
                {event.event_description && (
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    <span className="font-medium">About: </span>
                    {event.event_description}
                  </p>
                )}
                {event.target_audience && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <span className="font-medium">Audience: </span>
                    {event.target_audience}
                  </p>
                )}
                {event.key_topics && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    <span className="font-medium">Topics: </span>
                    {event.key_topics}
                  </p>
                )}
                {whyAttend && (
                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    <span className="font-medium">Why attend: </span>
                    {whyAttend}
                  </p>
                )}
                {submittedBy && (
                  <p className="text-xs text-slate-400 mt-1">Submitted by {submittedBy}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    onClick={() => handleApprove(event.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={14} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Delete submission"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
