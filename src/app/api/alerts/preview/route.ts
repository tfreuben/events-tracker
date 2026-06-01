import { NextRequest, NextResponse } from "next/server";
import { sql, initDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import type { TFEvent } from "@/types";
import { computeUpcomingWindow } from "@/lib/alerts/compute";
import { resolveRecipients, type RecipientsByBU } from "@/lib/alerts/recipients";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();

  const windowDays = parseInt(req.nextUrl.searchParams.get("days") || "14", 10);
  const today = new Date().toISOString().substring(0, 10);

  const eventsRes = await sql`SELECT * FROM events WHERE start_date IS NOT NULL`;
  const events = eventsRes.rows as TFEvent[];

  const sentRes = await sql`SELECT event_id, touchpoint_code FROM alert_sends WHERE status IN ('sent', 'skipped_no_recipients')`;
  const alreadySent = new Set(
    sentRes.rows.map((r) => `${r.event_id}:${r.touchpoint_code}`)
  );

  const recipientsRes = await sql`SELECT business_unit, emails FROM alert_recipients`;
  const recipientsByBU: RecipientsByBU = {};
  for (const row of recipientsRes.rows) {
    recipientsByBU[row.business_unit as string] = row.emails as string;
  }

  const upcoming = computeUpcomingWindow(today, windowDays, events, alreadySent);

  return NextResponse.json(
    upcoming.map((u) => ({
      event_id: u.event.id,
      event_name: u.event.event_name,
      business_unit: u.event.business_unit,
      start_date: u.event.start_date,
      touchpoint_code: u.touchpoint.code,
      touchpoint_subject: u.touchpoint.subject,
      due_date: u.dueDate,
      resolved_recipients: resolveRecipients(u.event, recipientsByBU),
    }))
  );
}
