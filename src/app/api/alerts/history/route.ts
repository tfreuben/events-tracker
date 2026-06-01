import { NextRequest, NextResponse } from "next/server";
import { sql, initDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();

  const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);

  const result = await sql`
    SELECT
      s.id,
      s.event_id,
      e.event_name,
      e.business_unit,
      s.touchpoint_code,
      s.due_date,
      s.recipients,
      s.hubspot_message_ids,
      s.status,
      s.error,
      s.sent_at
    FROM alert_sends s
    JOIN events e ON e.id = s.event_id
    WHERE s.sent_at >= NOW() - (${days} || ' days')::interval
    ORDER BY s.sent_at DESC
  `;

  return NextResponse.json(result.rows);
}
