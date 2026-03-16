import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { submitter_name, event_name, business_unit, event_type, region, start_date, end_date, city, country, why_attend, event_url } = body;

    if (!event_name || !business_unit || !event_type || !region) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const budgetMonth = start_date
      ? MONTH_NAMES[new Date(start_date).getMonth()]
      : MONTH_NAMES[new Date().getMonth()];

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
        ${event_name}, ${business_unit}, ${event_type}, ${region},
        ${city || null}, ${country || null}, ${null},
        ${start_date || null}, ${end_date || null},
        ${1}, ${0}, ${null},
        ${0}, ${0}, ${0}, ${0},
        ${0}, ${0}, ${0}, ${budgetMonth},
        ${"Requested"}, ${null}, ${null}, ${event_url || null},
        ${why_attend || null}, ${null}, ${null}, ${null},
        ${submitter_name ? `Submitted by: ${submitter_name}` : null}, ${null}, ${"Not Started"}, ${null}
      ) RETURNING id`;

    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error("Suggest route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
