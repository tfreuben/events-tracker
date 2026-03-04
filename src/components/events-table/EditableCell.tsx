"use client";

import { useState, useRef, useEffect } from "react";
import { TFEvent } from "@/types";
import { STATUSES, REGIONS, EVENT_TYPES, BUSINESS_UNITS, WORDPRESS_STATUSES, BUDGET_MONTHS } from "@/lib/constants";

type CellType = "text" | "number" | "currency" | "date" | "select" | "textarea";

const FIELD_CONFIG: Record<string, { type: CellType; options?: readonly string[] }> = {
  event_name: { type: "text" },
  business_unit: { type: "select", options: BUSINESS_UNITS.slice(1) },
  event_type: { type: "select", options: EVENT_TYPES },
  region: { type: "select", options: REGIONS },
  city: { type: "text" },
  country: { type: "text" },
  venue: { type: "text" },
  start_date: { type: "date" },
  end_date: { type: "date" },
  number_of_days: { type: "number" },
  sales_staff_attending: { type: "number" },
  staff_names: { type: "text" },
  event_booth_cost: { type: "currency" },
  est_daily_rate: { type: "currency" },
  flight_cost_per_person: { type: "currency" },
  budget_month: { type: "select", options: BUDGET_MONTHS },
  status: { type: "select", options: STATUSES },
  sponsorship_level: { type: "text" },
  booth_number: { type: "text" },
  event_website_url: { type: "text" },
  event_description: { type: "textarea" },
  target_audience: { type: "textarea" },
  key_topics: { type: "text" },
  products_to_feature: { type: "text" },
  pre_event_goals: { type: "textarea" },
  post_event_notes: { type: "textarea" },
  wordpress_article_status: { type: "select", options: WORDPRESS_STATUSES },
  article_url: { type: "text" },
};

// Computed fields that should not be editable
const COMPUTED_FIELDS = ["total_daily_rate", "total_flight_cost", "total_travel_cost", "total_event_cost", "id", "created_at", "updated_at"];

interface EditableCellProps {
  event: TFEvent;
  field: string;
  value: string | number | null;
  isAdmin: boolean;
  onSave: (eventId: number, field: string, value: string | number | null) => Promise<void>;
  children: React.ReactNode;
}

export function EditableCell({ event, field, value, isAdmin, onSave, children }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  const config = FIELD_CONFIG[field];
  const isComputed = COMPUTED_FIELDS.includes(field);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  if (!isAdmin || isComputed || !config) {
    return <>{children}</>;
  }

  const startEdit = () => {
    setEditValue(value != null ? String(value) : "");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    let saveValue: string | number | null = editValue || null;
    if (config.type === "number" || config.type === "currency") {
      saveValue = editValue ? parseInt(editValue, 10) : 0;
    }
    try {
      await onSave(event.id, field, saveValue);
    } catch {
      // Error handled by parent
    }
    setSaving(false);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && config.type !== "textarea") {
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  };

  if (!editing) {
    return (
      <div
        onClick={startEdit}
        className="cursor-pointer rounded px-1 -mx-1 hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 min-h-[24px]"
        title="Click to edit"
      >
        {children}
      </div>
    );
  }

  const inputClass = "w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (config.type === "select") {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          // Auto-save on select change
          const val = e.target.value || null;
          setSaving(true);
          onSave(event.id, field, val).finally(() => {
            setSaving(false);
            setEditing(false);
          });
        }}
        onBlur={cancel}
        className={inputClass}
        disabled={saving}
      >
        <option value="">—</option>
        {config.options?.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (config.type === "textarea") {
    return (
      <div className="relative">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          className={`${inputClass} min-h-[60px] resize-y`}
          disabled={saving}
        />
      </div>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={config.type === "date" ? "date" : config.type === "number" || config.type === "currency" ? "number" : "text"}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      onKeyDown={handleKeyDown}
      className={inputClass}
      disabled={saving}
    />
  );
}
