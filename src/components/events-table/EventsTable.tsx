"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import useSWR from "swr";
import { TFEvent } from "@/types";
import { columns } from "./columns";
import { EditableCell } from "./EditableCell";
import { TableToolbar } from "./TableToolbar";
import { AddEventDialog } from "./AddEventDialog";
import { useAuthStore, useUIStore } from "@/lib/store";
import { BU_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Loader2, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

export function EventsTable() {
  const { isAdmin } = useAuthStore();
  const { columnVisibility } = useUIStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "start_date", desc: false }]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState({
    businessUnit: "",
    status: "",
    region: "",
    eventType: "",
    search: "",
    timeframe: "upcoming",
  });

  const { timeframe, ...serverFilters } = filters;
  const queryString = buildQueryString(serverFilters);
  const { data: events = [], mutate, isLoading } = useSWR<TFEvent[]>(
    `/api/events${queryString ? `?${queryString}` : ""}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(
    async (eventId: number, field: string, value: string | number | null) => {
      // Optimistic update
      mutate(
        (current) =>
          current?.map((e) =>
            e.id === eventId ? { ...e, [field]: value } : e
          ),
        false
      );

      const res = await fetch(`/api/events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!res.ok) {
        // Revert on failure
        mutate();
        throw new Error("Failed to save");
      }

      // Update with server response (includes recomputed costs)
      const updated = await res.json();
      mutate(
        (current) =>
          current?.map((e) => (e.id === updated.id ? updated : e)),
        false
      );
    },
    [mutate]
  );

  const handleDelete = useCallback(
    async (eventId: number) => {
      if (!confirm("Delete this event?")) return;
      mutate(
        (current) => current?.filter((e) => e.id !== eventId),
        false
      );
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) mutate();
    },
    [mutate]
  );

  const handleExportCSV = useCallback(() => {
    if (!displayEvents.length) return;
    const headers = columns
      .map((c) => (c as { accessorKey?: string }).accessorKey)
      .filter(Boolean) as string[];
    const csvRows = [
      headers.map((h) => h.replace(/_/g, " ")).join(","),
      ...displayEvents.map((event) =>
        headers
          .map((h) => {
            const val = event[h as keyof TFEvent];
            if (val == null) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "events-tracker.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  const handleAddEvent = useCallback(async (eventData: Partial<TFEvent>) => {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
    if (res.ok) {
      mutate();
      setShowAddDialog(false);
    }
  }, [mutate]);

  // Deduplicate events on the "All" tab: group by event name + dates, merge BU badges
  const displayEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = events;

    if (timeframe === "upcoming") {
      filtered = events.filter((e) => {
        if (!e.end_date) return true;
        const datePart = e.end_date.substring(0, 10);
        return new Date(datePart + "T00:00:00") >= today;
      });
    } else if (timeframe === "past") {
      filtered = events.filter((e) => {
        if (!e.end_date) return false;
        const datePart = e.end_date.substring(0, 10);
        return new Date(datePart + "T00:00:00") < today;
      });
    }

    if (filters.businessUnit) return filtered;
    const seen = new Map<string, TFEvent & { _all_bus?: string[] }>();
    for (const event of filtered) {
      const key = `${event.event_name}__${event.start_date}__${event.end_date}`;
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        if (!existing._all_bus) existing._all_bus = [existing.business_unit];
        if (!existing._all_bus.includes(event.business_unit)) {
          existing._all_bus.push(event.business_unit);
        }
      } else {
        seen.set(key, { ...event, _all_bus: [event.business_unit] });
      }
    }
    return Array.from(seen.values());
  }, [events, filters.businessUnit, timeframe]);

  const columnsWithActions = useMemo(() => {
    if (!isAdmin) return columns;
    return [
      ...columns,
      {
        id: "actions",
        header: "",
        cell: ({ row }: { row: { original: TFEvent } }) => (
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-1 text-slate-400 hover:text-red-500 rounded"
            title="Delete event"
          >
            <Trash2 size={14} />
          </button>
        ),
        size: 40,
      },
    ];
  }, [isAdmin, handleDelete]);

  const COST_COLUMNS = [
    "event_booth_cost", "est_daily_rate", "total_daily_rate",
    "flight_cost_per_person", "total_flight_cost", "total_travel_cost", "total_event_cost",
  ];

  const effectiveVisibility = useMemo(() => {
    if (isAdmin) return columnVisibility;
    const hidden: Record<string, boolean> = { ...columnVisibility };
    for (const col of COST_COLUMNS) hidden[col] = false;
    return hidden;
  }, [isAdmin, columnVisibility]);

  const table = useReactTable({
    data: displayEvents,
    columns: columnsWithActions,
    state: { sorting, columnVisibility: effectiveVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <TableToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onExportCSV={handleExportCSV}
        onAddEvent={() => setShowAddDialog(true)}
        eventCount={displayEvents.length}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          No events found. {isAdmin && "Click 'Add Event' to create one."}
        </div>
      ) : (
        <div className="table-container border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left px-3 py-2.5 text-xs font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap border-b"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return table.getRowModel().rows.map((row) => {
                const allBus: string[] = (row.original as TFEvent & { _all_bus?: string[] })._all_bus || [row.original.business_unit];
                const buColor = allBus.length === 1 ? BU_COLORS[allBus[0]] : null;
                const endDate = row.original.end_date ? new Date(row.original.end_date.substring(0, 10) + 'T00:00:00') : null;
                const isPast = endDate !== null && endDate < today;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-l-4 transition-colors",
                      isPast ? "bg-slate-50 opacity-60 hover:opacity-80" : "hover:bg-slate-50/50",
                      buColor?.border || "border-l-slate-200"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const field = (cell.column.columnDef as { accessorKey?: string }).accessorKey;
                      const value = field ? row.original[field as keyof TFEvent] : null;
                      return (
                        <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                          {field ? (
                            <EditableCell
                              event={row.original}
                              field={field}
                              value={value as string | number | null}
                              isAdmin={isAdmin}
                              onSave={handleSave}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </EditableCell>
                          ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {showAddDialog && (
        <AddEventDialog
          onClose={() => setShowAddDialog(false)}
          onSave={handleAddEvent}
        />
      )}
    </div>
  );
}
