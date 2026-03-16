import { NextRequest, NextResponse } from "next/server";

interface ExtractedEvent {
  event_name: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
}

function extractDate(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const m = val.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function getMeta(html: string, name: string): string | null {
  for (const re of [
    new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i"),
  ]) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TrustFlightEvents/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: "Could not fetch" }, { status: 400 });

    const html = await res.text();
    const result: ExtractedEvent = { event_name: null, start_date: null, end_date: null, city: null, country: null, description: null };

    // JSON-LD structured data
    const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of scripts) {
      try {
        const data = JSON.parse(match[1]);
        const items: unknown[] = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const obj = item as Record<string, unknown>;
          const t = obj["@type"];
          if (typeof t === "string" && /event/i.test(t)) {
            if (obj.name) result.event_name = String(obj.name);
            if (obj.startDate) result.start_date = extractDate(obj.startDate);
            if (obj.endDate) result.end_date = extractDate(obj.endDate);
            if (obj.description) result.description = String(obj.description).replace(/<[^>]+>/g, "").slice(0, 300);
            const loc = obj.location as Record<string, unknown> | undefined;
            if (loc) {
              const addr = (loc.address ?? loc) as Record<string, unknown>;
              if (addr.addressLocality) result.city = String(addr.addressLocality);
              if (addr.addressCountry) result.country = String(addr.addressCountry);
            }
            break;
          }
        }
        if (result.event_name) break;
      } catch { /* skip malformed JSON-LD */ }
    }

    // Fallback to meta tags
    if (!result.event_name) result.event_name = getMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
    if (!result.description) result.description = getMeta(html, "og:description") ?? getMeta(html, "description");

    return NextResponse.json(result);
  } catch (err) {
    console.error("fetch-event-url:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
