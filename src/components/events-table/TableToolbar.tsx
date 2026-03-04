"use client";

import { Search, Download, Plus, Columns3, X } from "lucide-react";
import { BUSINESS_UNITS, STATUSES, REGIONS, EVENT_TYPES } from "@/lib/constants";
import { BU_COLORS } from "@/lib/constants";
import { useUIStore, useAuthStore } from "@/lib/store";
import { useState, useRef, useEffect } from "react";
import { columns } from "./columns";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  filters: {
    businessUnit: string;
    status: string;
    region: string;
    eventType: string;
    search: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onExportCSV: () => void;
  onAddEvent: () => void;
  eventCount: number;
}

export function TableToolbar({ filters, onFilterChange, onExportCSV, onAddEvent, eventCount }: ToolbarProps) {
  const { isAdmin } = useAuthStore();
  const { columnVisibility, toggleColumn } = useUIStore();
  const [showColumns, setShowColumns] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowColumns(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      {/* BU Tabs */}
      <div className="flex items-center gap-1 border-b">
        {BUSINESS_UNITS.map((bu) => {
          const isActive = filters.businessUnit === bu || (bu === "All" && !filters.businessUnit);
          const colors = bu !== "All" ? BU_COLORS[bu] : null;
          return (
            <button
              key={bu}
              onClick={() => onFilterChange("businessUnit", bu === "All" ? "" : bu)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? `border-current ${colors?.text || "text-slate-900"}`
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {bu}
            </button>
          );
        })}
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange("search", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Region filter */}
        <select
          value={filters.region}
          onChange={(e) => onFilterChange("region", e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">All Regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Event Type filter */}
        <select
          value={filters.eventType}
          onChange={(e) => onFilterChange("eventType", e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">{eventCount} events</span>

          {/* Column visibility */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowColumns(!showColumns)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded-md hover:bg-slate-50"
            >
              <Columns3 size={14} />
              Columns
            </button>
            {showColumns && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-30 w-56 max-h-80 overflow-y-auto p-2">
                {columns.map((col) => {
                  const id = (col as { accessorKey?: string }).accessorKey;
                  if (!id) return null;
                  const isVisible = columnVisibility[id] !== false;
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumn(id)}
                        className="rounded"
                      />
                      {typeof col.header === "string" ? col.header : id.replace(/_/g, " ")}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* CSV Export */}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border rounded-md hover:bg-slate-50"
          >
            <Download size={14} />
            CSV
          </button>

          {/* Add Event (admin only) */}
          {isAdmin && (
            <button
              onClick={onAddEvent}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0b1a3b] text-white rounded-md hover:bg-[#152a52]"
            >
              <Plus size={14} />
              Add Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
