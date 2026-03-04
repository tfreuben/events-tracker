import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { computeCosts } from "@/lib/computations";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const businessUnit = params.get("businessUnit");
  const status = params.get("status");
  const region = params.get("region");
  const eventType = params.get("eventType");
  const search = params.get("search");
  const sortBy = params.get("sortBy") || "id";
  const sortOrder = params.get("sortOrder") === "desc" ? "DESC" : "ASC";

  const conditions: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (businessUnit && businessUnit !== "All") {
    conditions.push(`business_unit = $${paramIndex++}`);
    values.push(businessUnit);
  }
  if (status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(status);
  }
  if (region) {
    conditions.push(`region = $${paramIndex++}`);
    values.push(region);
  }
  if (eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    values.push(eventType);
  }
  if (search) {
    conditions.push(`(event_name ILIKE $${paramIndex} OR city ILIKE $${paramIndex} OR country ILIKE $${paramIndex} OR venue ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  const allowedSortColumns = [
    "id", "event_name", "business_unit", "event_type", "region", "city",
    "country", "start_date", "end_date", "number_of_days", "sales_staff_attending",
    "event_booth_cost", "total_event_cost", "budget_month", "status",
    "total_travel_cost", "total_daily_rate", "total_flight_cost",
  ];
  const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "id";

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM events ${where} ORDER BY ${safeSortBy} ${sortOrder}`;

  const result = await sql.query(query, values);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const costs = computeCosts(body);
  const event = { ...body, ...costs };

  const result = await sql`
    INSERT INTO events (
      event_name, business_unit, event_type, region, city, country, venue,
      start_date, end_date, number_of_days, sales_staff_attending, staff_names,
      event_booth_cost, est_daily_rate, total_daily_rate, flight_cost_per_person,
      total_flight_cost, total_travel_cost, total_event_cost, budget_month,
      status, sponsorship_level, booth_number, event_website_url,
      event_description, target_audience, key_topics, products_to_feature,
      pre_event_goals, post_event_notes, wordpress_article_status, article_url
    ) VALUES (
      ${event.event_name}, ${event.business_unit}, ${event.event_type},
      ${event.region}, ${event.city || null}, ${event.country || null},
      ${event.venue || null}, ${event.start_date || null}, ${event.end_date || null},
      ${event.number_of_days}, ${event.sales_staff_attending}, ${event.staff_names || null},
      ${event.event_booth_cost}, ${event.est_daily_rate}, ${event.total_daily_rate},
      ${event.flight_cost_per_person}, ${event.total_flight_cost}, ${event.total_travel_cost},
      ${event.total_event_cost}, ${event.budget_month}, ${event.status || 'Planned'},
      ${event.sponsorship_level || null}, ${event.booth_number || null},
      ${event.event_website_url || null}, ${event.event_description || null},
      ${event.target_audience || null}, ${event.key_topics || null},
      ${event.products_to_feature || null}, ${event.pre_event_goals || null},
      ${event.post_event_notes || null}, ${event.wordpress_article_status || 'Not Started'},
      ${event.article_url || null}
    ) RETURNING *`;

  return NextResponse.json(result.rows[0], { status: 201 });
}
