import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface SubmissionFields {
  event_name: string;
  city: string;
  country: string;
  venue: string;
  event_description: string;
  target_audience: string;
  key_topics: string;
  why_attend: string;
}

async function cleanseWithAI(fields: SubmissionFields): Promise<SubmissionFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fields;

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You cleanse event submission data. For each field:
- If the value is a non-answer (e.g. "I don't know", "not sure", "n/a", "no", "none", "?", gibberish, or irrelevant text), return an empty string.
- If the value is meaningful, clean it up: fix capitalisation, remove trailing punctuation, tidy grammar, but keep the meaning intact. Keep it concise.
- For city: just the city name, properly capitalised.
- For country: full country name, properly capitalised.
- For venue: proper venue name if recognisable, otherwise keep as-is or empty if nonsense.
- For event_name: proper event name with correct capitalisation.
- For key_topics: comma-separated list, cleanly formatted.
- For event_description, target_audience, why_attend: clean, concise sentences.

Return ONLY valid JSON with the same field names. No markdown, no explanation.`,
      messages: [{
        role: "user",
        content: `Cleanse this event submission data:\n${JSON.stringify(fields, null, 2)}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fields;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      event_name: typeof parsed.event_name === "string" ? parsed.event_name : fields.event_name,
      city: typeof parsed.city === "string" ? parsed.city : fields.city,
      country: typeof parsed.country === "string" ? parsed.country : fields.country,
      venue: typeof parsed.venue === "string" ? parsed.venue : fields.venue,
      event_description: typeof parsed.event_description === "string" ? parsed.event_description : fields.event_description,
      target_audience: typeof parsed.target_audience === "string" ? parsed.target_audience : fields.target_audience,
      key_topics: typeof parsed.key_topics === "string" ? parsed.key_topics : fields.key_topics,
      why_attend: typeof parsed.why_attend === "string" ? parsed.why_attend : fields.why_attend,
    };
  } catch (err) {
    console.error("AI cleanse failed, using raw data:", err);
    return fields;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      submitter_name, event_name, business_unit, event_type, region,
      start_date, end_date, city, country, why_attend, event_url,
      venue, event_description, target_audience, key_topics,
    } = body;

    if (!event_name || !business_unit || !event_type || !region) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // AI-cleanse the free-text fields
    const cleaned = await cleanseWithAI({
      event_name, city: city || "", country: country || "",
      venue: venue || "", event_description: event_description || "",
      target_audience: target_audience || "", key_topics: key_topics || "",
      why_attend: why_attend || "",
    });

    const budgetMonth = start_date
      ? MONTH_NAMES[new Date(start_date).getMonth()]
      : MONTH_NAMES[new Date().getMonth()];

    // Build pre_event_goals from submitter name and why_attend
    const goalParts: string[] = [];
    if (submitter_name) goalParts.push(`Submitted by: ${submitter_name}`);
    if (cleaned.why_attend) goalParts.push(`Why attend: ${cleaned.why_attend}`);
    const preEventGoals = goalParts.length > 0 ? goalParts.join("\n") : null;

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
        ${cleaned.event_name}, ${business_unit}, ${event_type}, ${region},
        ${cleaned.city || null}, ${cleaned.country || null}, ${cleaned.venue || null},
        ${start_date || null}, ${end_date || null},
        ${1}, ${0}, ${null},
        ${0}, ${0}, ${0}, ${0},
        ${0}, ${0}, ${0}, ${budgetMonth},
        ${"Requested"}, ${null}, ${null}, ${event_url || null},
        ${cleaned.event_description || null}, ${cleaned.target_audience || null}, ${cleaned.key_topics || null}, ${null},
        ${preEventGoals}, ${null}, ${"Not Started"}, ${null}
      ) RETURNING id`;

    return NextResponse.json({ success: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error("Suggest route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
