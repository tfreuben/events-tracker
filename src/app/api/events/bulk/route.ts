import { NextRequest, NextResponse } from "next/server";
import { sql, initDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { events, resetTable } = await req.json();

  // Initialize schema
  await initDB();

  if (resetTable) {
    await sql`DELETE FROM events`;
  }

  let inserted = 0;
  for (const e of events) {
    await sql`
      INSERT INTO events (
        event_name, business_unit, event_type, region, city, country, venue,
        start_date, end_date, number_of_days, sales_staff_attending, staff_names,
        event_booth_cost, est_daily_rate, total_daily_rate, flight_cost_per_person,
        total_flight_cost, total_travel_cost, total_event_cost, budget_month,
        status, sponsorship_level, booth_number, event_website_url,
        event_description, target_audience, key_topics, products_to_feature,
        pre_event_goals, post_event_notes, wordpress_article_status, article_url
      ) VALUES (
        ${e.event_name}, ${e.business_unit}, ${e.event_type},
        ${e.region}, ${e.city || null}, ${e.country || null},
        ${e.venue || null}, ${e.start_date || null}, ${e.end_date || null},
        ${e.number_of_days}, ${e.sales_staff_attending}, ${e.staff_names || null},
        ${e.event_booth_cost}, ${e.est_daily_rate}, ${e.total_daily_rate},
        ${e.flight_cost_per_person}, ${e.total_flight_cost}, ${e.total_travel_cost},
        ${e.total_event_cost}, ${e.budget_month}, ${e.status || 'Planned'},
        ${e.sponsorship_level || null}, ${e.booth_number || null},
        ${e.event_website_url || null}, ${e.event_description || null},
        ${e.target_audience || null}, ${e.key_topics || null},
        ${e.products_to_feature || null}, ${e.pre_event_goals || null},
        ${e.post_event_notes || null}, ${e.wordpress_article_status || 'Not Started'},
        ${e.article_url || null}
      )`;
    inserted++;
  }

  return NextResponse.json({ inserted });
}
