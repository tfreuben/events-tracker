import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { sendTransactional } from "@/lib/hubspot";
import { TFEvent } from "@/types";

export async function POST(
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

  const body = await req.json().catch(() => ({}));
  const reason: string | null = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  const current = await sql`SELECT * FROM events WHERE id = ${id}`;
  if (current.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const event = current.rows[0] as TFEvent;
  if (event.status !== "Requested") {
    return NextResponse.json(
      { error: `Cannot decline a submission with status "${event.status}"` },
      { status: 400 }
    );
  }

  const result = await sql`
    UPDATE events SET status = 'Declined', updated_at = NOW() WHERE id = ${id} RETURNING *
  `;
  const updated = result.rows[0];

  let emailSent = false;
  let emailError: string | undefined;

  if (event.submitter_email) {
    const templateId = process.env.HUBSPOT_TEMPLATE_DECLINED;
    if (!templateId) {
      emailError = "HUBSPOT_TEMPLATE_DECLINED not set";
    } else {
      const send = await sendTransactional({
        emailId: templateId,
        to: event.submitter_email,
        customProperties: {
          event_name: event.event_name,
          business_unit: event.business_unit,
          reason,
        },
      });
      emailSent = send.ok;
      if (!send.ok) emailError = send.error;
    }
  }

  return NextResponse.json({ ...updated, emailSent, emailError });
}
