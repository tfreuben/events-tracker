import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { computeCosts } from "@/lib/computations";

const UPDATABLE_FIELDS = [
  "event_name", "business_unit", "event_type", "region", "city", "country",
  "venue", "start_date", "end_date", "number_of_days", "sales_staff_attending",
  "staff_names", "event_booth_cost", "est_daily_rate", "flight_cost_per_person",
  "budget_month", "status", "sponsorship_level", "booth_number",
  "event_website_url", "event_description", "target_audience", "key_topics",
  "products_to_feature", "pre_event_goals", "post_event_notes",
  "wordpress_article_status", "article_url",
];

const COST_INPUT_FIELDS = [
  "sales_staff_attending", "number_of_days", "est_daily_rate",
  "flight_cost_per_person", "event_booth_cost",
];

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await req.json();

  // Check if any cost input field changed — if so, recompute costs
  const needsRecompute = COST_INPUT_FIELDS.some((f) => f in body);

  let updates = { ...body };

  if (needsRecompute) {
    // Fetch current event to merge with updates for recomputation
    const current = await sql`SELECT * FROM events WHERE id = ${id}`;
    if (current.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const merged = { ...current.rows[0], ...updates };
    const costs = computeCosts(merged);
    updates = { ...updates, ...costs };
  }

  // Build dynamic SET clause
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (UPDATABLE_FIELDS.includes(key) || key.startsWith("total_")) {
      setClauses.push(`${key} = $${paramIndex++}`);
      values.push(value as string | number | null);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const query = `UPDATE events SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
  const result = await sql.query(query, values);

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const result = await sql`DELETE FROM events WHERE id = ${id} RETURNING id`;
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
