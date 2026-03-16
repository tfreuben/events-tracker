"use client";

import { ColumnDef } from "@tanstack/react-table";
import { TFEvent } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BU_COLORS } from "@/lib/constants";
import { ArrowUpDown, ExternalLink } from "lucide-react";

function SortHeader({
  column,
  label,
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  label: string;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-slate-900 font-medium"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown size={13} className="text-slate-400" />
    </button>
  );
}

export const columns: ColumnDef<TFEvent>[] = [
  {
    accessorKey: "event_name",
    header: ({ column }) => <SortHeader column={column} label="Event Name" />,
    cell: ({ row }) => (
      <div className="font-medium min-w-[220px]">
        {row.original.event_name}
      </div>
    ),
    size: 280,
  },
  {
    accessorKey: "business_unit",
    header: ({ column }) => <SortHeader column={column} label="Business Unit" />,
    cell: ({ row }) => {
      const allBus: string[] = (row.original as TFEvent & { _all_bus?: string[] })._all_bus || [row.original.business_unit];
      return (
        <div className="flex flex-row gap-1">
          {allBus.map((bu) => {
            const colors = BU_COLORS[bu];
            return (
              <span key={bu} className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${colors?.text || ""} ${colors?.bg || ""}`}>
                {bu}
              </span>
            );
          })}
        </div>
      );
    },
    size: 260,
  },
  {
    accessorKey: "event_type",
    header: ({ column }) => <SortHeader column={column} label="Type" />,
    size: 120,
  },
  {
    accessorKey: "region",
    header: ({ column }) => <SortHeader column={column} label="Region" />,
    size: 80,
  },
  {
    accessorKey: "city",
    header: "City",
    size: 120,
  },
  {
    accessorKey: "country",
    header: ({ column }) => <SortHeader column={column} label="Country" />,
    size: 130,
  },
  {
    accessorKey: "venue",
    header: "Venue",
    size: 180,
  },
  {
    accessorKey: "start_date",
    header: ({ column }) => <SortHeader column={column} label="Start Date" />,
    cell: ({ row }) => formatDate(row.original.start_date),
    size: 110,
  },
  {
    accessorKey: "end_date",
    header: ({ column }) => <SortHeader column={column} label="End Date" />,
    cell: ({ row }) => formatDate(row.original.end_date),
    size: 110,
  },
  {
    accessorKey: "number_of_days",
    header: "Days",
    size: 60,
  },
  {
    accessorKey: "sales_staff_attending",
    header: "No. of Staff",
    size: 90,
  },
  {
    accessorKey: "staff_names",
    header: "Staff Names",
    size: 150,
  },
  {
    accessorKey: "event_booth_cost",
    header: ({ column }) => <SortHeader column={column} label="Booth Cost" />,
    cell: ({ row }) => formatCurrency(row.original.event_booth_cost),
    size: 110,
  },
  {
    accessorKey: "est_daily_rate",
    header: "Daily Rate",
    cell: ({ row }) => formatCurrency(row.original.est_daily_rate),
    size: 100,
  },
  {
    accessorKey: "total_daily_rate",
    header: "Total Daily",
    cell: ({ row }) => formatCurrency(row.original.total_daily_rate),
    size: 100,
  },
  {
    accessorKey: "flight_cost_per_person",
    header: "Flight/Person",
    cell: ({ row }) => formatCurrency(row.original.flight_cost_per_person),
    size: 110,
  },
  {
    accessorKey: "total_flight_cost",
    header: "Total Flights",
    cell: ({ row }) => formatCurrency(row.original.total_flight_cost),
    size: 110,
  },
  {
    accessorKey: "total_travel_cost",
    header: ({ column }) => <SortHeader column={column} label="Total Travel" />,
    cell: ({ row }) => formatCurrency(row.original.total_travel_cost),
    size: 110,
  },
  {
    accessorKey: "total_event_cost",
    header: ({ column }) => <SortHeader column={column} label="Total Cost" />,
    cell: ({ row }) => (
      <span className="font-semibold">{formatCurrency(row.original.total_event_cost)}</span>
    ),
    size: 110,
  },
  {
    accessorKey: "budget_month",
    header: ({ column }) => <SortHeader column={column} label="Month" />,
    size: 80,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const s = row.original.status;
      const statusColors: Record<string, string> = {
        Planned: "bg-yellow-100 text-yellow-800",
        Confirmed: "bg-green-100 text-green-800",
        Completed: "bg-blue-100 text-blue-800",
        Cancelled: "bg-red-100 text-red-800",
        Requested: "bg-purple-100 text-purple-800",
      };
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || "bg-gray-100 text-gray-800"}`}>
          {s}
        </span>
      );
    },
    size: 100,
  },
  {
    accessorKey: "sponsorship_level",
    header: "Sponsorship",
    size: 120,
  },
  {
    accessorKey: "booth_number",
    header: "Booth #",
    size: 80,
  },
  {
    accessorKey: "event_website_url",
    header: "Website",
    cell: ({ row }) => {
      const url = row.original.event_website_url;
      if (!url) return null;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          <ExternalLink size={13} />
          <span className="text-xs">Link</span>
        </a>
      );
    },
    size: 80,
  },
  {
    accessorKey: "event_description",
    header: "Description",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate text-xs text-slate-600">
        {row.original.event_description}
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "target_audience",
    header: "Audience",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate text-xs text-slate-600">
        {row.original.target_audience}
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "key_topics",
    header: "Topics",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate text-xs text-slate-600">
        {row.original.key_topics}
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "products_to_feature",
    header: "Products",
    size: 150,
  },
  {
    accessorKey: "pre_event_goals",
    header: "Goals",
    size: 150,
  },
  {
    accessorKey: "post_event_notes",
    header: "Notes / Leads",
    size: 150,
  },
  {
    accessorKey: "wordpress_article_status",
    header: "WP Status",
    cell: ({ row }) => {
      const s = row.original.wordpress_article_status;
      const wpColors: Record<string, string> = {
        "Not Started": "bg-gray-100 text-gray-600",
        Draft: "bg-yellow-100 text-yellow-700",
        Published: "bg-green-100 text-green-700",
      };
      return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${wpColors[s] || "bg-gray-100"}`}>
          {s}
        </span>
      );
    },
    size: 110,
  },
  {
    accessorKey: "article_url",
    header: "Article URL",
    cell: ({ row }) => {
      const url = row.original.article_url;
      if (!url) return null;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-xs">
          View
        </a>
      );
    },
    size: 90,
  },
];
