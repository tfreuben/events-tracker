import { NextRequest, NextResponse } from "next/server";
import { sql, initDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import type { TFEvent } from "@/types";
import { computeDueTouchpoints } from "@/lib/alerts/compute";
import { CADENCE, renderActionChecklistHtml } from "@/lib/alerts/cadence";
import { resolveRecipients, type RecipientsByBU } from "@/lib/alerts/recipients";
import { sendTransactional } from "@/lib/hubspot";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.ALERT_RUN_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") || "";
    if (header === `Bearer ${secret}`) return true;
  }
  return isAdmin();
}

export async function POST(req: NextRequest) {
  const ok = await authorize(req);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const forcedEventId = req.nextUrl.searchParams.get("event_id");
  const forcedTouchpoint = req.nextUrl.searchParams.get("touchpoint");
  const today = new Date().toISOString().substring(0, 10);

  // Clear stale failed sends so the retry path picks them up again.
  if (!dryRun) {
    await sql`DELETE FROM alert_sends WHERE status = 'failed'`;
  }

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

  let due = computeDueTouchpoints(today, events, alreadySent);

  if (forcedEventId && forcedTouchpoint) {
    const id = parseInt(forcedEventId, 10);
    const event = events.find((e) => e.id === id);
    const touchpoint = CADENCE.find((t) => t.code === forcedTouchpoint);
    if (!event || !touchpoint) {
      return NextResponse.json(
        { error: "Forced event/touchpoint not found" },
        { status: 404 }
      );
    }
    if (!dryRun) {
      await sql`DELETE FROM alert_sends WHERE event_id = ${id} AND touchpoint_code = ${forcedTouchpoint}`;
    }
    due = [
      {
        event,
        touchpoint,
        dueDate: today,
      },
    ];
  }

  const results: Array<{
    event_id: number;
    event_name: string;
    touchpoint_code: string;
    due_date: string;
    recipients: string[];
    status: string;
    error?: string;
  }> = [];

  for (const item of due) {
    const recipients = resolveRecipients(item.event, recipientsByBU);

    if (recipients.length === 0) {
      results.push({
        event_id: item.event.id,
        event_name: item.event.event_name,
        touchpoint_code: item.touchpoint.code,
        due_date: item.dueDate,
        recipients,
        status: "skipped_no_recipients",
      });
      if (!dryRun) {
        await sql`
          INSERT INTO alert_sends (event_id, touchpoint_code, due_date, recipients, status)
          VALUES (${item.event.id}, ${item.touchpoint.code}, ${item.dueDate}, '', 'skipped_no_recipients')
          ON CONFLICT (event_id, touchpoint_code) DO NOTHING
        `;
      }
      continue;
    }

    if (dryRun) {
      results.push({
        event_id: item.event.id,
        event_name: item.event.event_name,
        touchpoint_code: item.touchpoint.code,
        due_date: item.dueDate,
        recipients,
        status: "dry_run",
      });
      continue;
    }

    const templateId = process.env[item.touchpoint.templateEnvKey];
    if (!templateId) {
      const errMsg = `${item.touchpoint.templateEnvKey} not set`;
      await sql`
        INSERT INTO alert_sends (event_id, touchpoint_code, due_date, recipients, status, error)
        VALUES (${item.event.id}, ${item.touchpoint.code}, ${item.dueDate}, ${recipients.join(",")}, 'failed', ${errMsg})
        ON CONFLICT (event_id, touchpoint_code) DO NOTHING
      `;
      results.push({
        event_id: item.event.id,
        event_name: item.event.event_name,
        touchpoint_code: item.touchpoint.code,
        due_date: item.dueDate,
        recipients,
        status: "failed",
        error: errMsg,
      });
      continue;
    }

    const customProperties: Record<string, string | number | null> = {
      event_name: item.event.event_name,
      start_date_display: formatDate(item.event.start_date),
      city: item.event.city,
      country: item.event.country,
      venue: item.event.venue,
      business_unit: item.event.business_unit,
      booth_number: item.event.booth_number,
      products_to_feature: item.event.products_to_feature,
      pre_event_goals: item.event.pre_event_goals,
      touchpoint_subject: item.touchpoint.subject,
      action_checklist_html: renderActionChecklistHtml(item.touchpoint.actions),
    };

    const messageIds: string[] = [];
    const errors: string[] = [];
    for (const to of recipients) {
      const send = await sendTransactional({
        emailId: templateId,
        to,
        customProperties,
      });
      if (send.ok && send.messageId) messageIds.push(send.messageId);
      if (!send.ok && send.error) errors.push(`${to}: ${send.error}`);
    }

    const status = errors.length === 0 ? "sent" : "failed";
    const error = errors.length > 0 ? errors.join(" | ").slice(0, 1000) : null;

    await sql`
      INSERT INTO alert_sends (event_id, touchpoint_code, due_date, recipients, hubspot_message_ids, status, error)
      VALUES (
        ${item.event.id}, ${item.touchpoint.code}, ${item.dueDate},
        ${recipients.join(",")}, ${messageIds.join(",")}, ${status}, ${error}
      )
      ON CONFLICT (event_id, touchpoint_code) DO UPDATE SET
        recipients = EXCLUDED.recipients,
        hubspot_message_ids = EXCLUDED.hubspot_message_ids,
        status = EXCLUDED.status,
        error = EXCLUDED.error,
        sent_at = NOW()
    `;

    results.push({
      event_id: item.event.id,
      event_name: item.event.event_name,
      touchpoint_code: item.touchpoint.code,
      due_date: item.dueDate,
      recipients,
      status,
      error: error || undefined,
    });
  }

  return NextResponse.json({
    today,
    dry_run: dryRun,
    count: results.length,
    results,
  });
}
