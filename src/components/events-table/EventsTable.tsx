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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filters, setFilters] = useState({
    businessUnit: "",
    status: "",
    region: "",
    eventType: "",
    search: "",
  });

  const queryString = buildQueryString(filters);
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
    if (!events.length) return;
    const headers = columns
      .map((c) => (c as { accessorKey?: string }).accessorKey)
      .filter(Boolean) as string[];
    const csvRows = [
      headers.map((h) => h.replace(/_/g, " ")).join(","),
      ...events.map((event) =>
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

  const table = useReactTable({
    data: events,
    columns: columnsWithActions,
    state: { sorting, columnVisibility },
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
        eventCount={events.length}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : events.length === 0 ? (
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
              {table.getRowModel().rows.map((row) => {
                const bu = row.original.business_unit;
                const buColor = BU_COLORS[bu];
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-l-4 hover:bg-slate-50/50 transition-colors",
                      buColor?.border || "border-l-transparent"
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
              })}
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
