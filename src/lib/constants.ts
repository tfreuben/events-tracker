export const BU_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Redline: { bg: "bg-red-50", border: "border-l-red-500", text: "text-red-700" },
  "Baines Simmons": { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  Kenyon: { bg: "bg-green-50", border: "border-l-green-500", text: "text-green-700" },
  TrustFlight: { bg: "bg-slate-50", border: "border-l-slate-700", text: "text-slate-700" },
};

export const BUSINESS_UNITS = ["All", "Redline", "Baines Simmons", "Kenyon", "TrustFlight"] as const;

export const EVENT_TYPES = ["Conference", "Trade Show", "Forum", "Workshop", "Dinner/Reception"] as const;

export const REGIONS = ["EMEA", "NA", "LATAM"] as const;

export const STATUSES = ["Planned", "Confirmed", "Completed", "Cancelled"] as const;

export const BUDGET_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export const WORDPRESS_STATUSES = ["Not Started", "Draft", "Published"] as const;
