import { NextRequest, NextResponse } from "next/server";
import { sql, initDB } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();

  const result = await sql`
    SELECT id, business_unit, emails, updated_at
    FROM alert_recipients
    ORDER BY business_unit ASC
  `;
  return NextResponse.json(result.rows);
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const businessUnit = typeof body.business_unit === "string" ? body.business_unit.trim() : "";
  const emails = typeof body.emails === "string" ? body.emails.trim() : "";

  if (!businessUnit) {
    return NextResponse.json({ error: "business_unit required" }, { status: 400 });
  }

  const result = await sql`
    INSERT INTO alert_recipients (business_unit, emails, updated_at)
    VALUES (${businessUnit}, ${emails}, NOW())
    ON CONFLICT (business_unit) DO UPDATE SET
      emails = EXCLUDED.emails,
      updated_at = NOW()
    RETURNING id, business_unit, emails, updated_at
  `;

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessUnit = req.nextUrl.searchParams.get("business_unit");
  if (!businessUnit) {
    return NextResponse.json({ error: "business_unit required" }, { status: 400 });
  }

  await sql`DELETE FROM alert_recipients WHERE business_unit = ${businessUnit}`;
  return NextResponse.json({ ok: true });
}
