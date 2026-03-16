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

function extractJsonLdBlocks(html: string): string[] {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);
  return blocks;
}

async function tryDirectFetch(url: string): Promise<ExtractedEvent | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const html = await res.text();
  const result: ExtractedEvent = { event_name: null, start_date: null, end_date: null, city: null, country: null, description: null };

  for (const block of extractJsonLdBlocks(html)) {
    try {
      const data = JSON.parse(block);
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        if (typeof obj["@type"] === "string" && /event/i.test(obj["@type"])) {
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
    } catch { /* skip */ }
  }

  if (!result.event_name) result.event_name = getMeta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  if (!result.description) result.description = getMeta(html, "og:description") ?? getMeta(html, "description");

  return result;
}

async function tryMicrolink(url: string): Promise<ExtractedEvent | null> {
  const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const json = await res.json() as { status: string; data: Record<string, unknown> };
  if (json.status !== "success") return null;

  const d = json.data;
  return {
    event_name: typeof d.title === "string" ? d.title : null,
    description: typeof d.description === "string" ? d.description : null,
    start_date: null,
    end_date: null,
    city: null,
    country: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    // Try direct fetch first, fall back to Microlink
    let result = await tryDirectFetch(url).catch(() => null);
    if (!result || !result.event_name) {
      const ml = await tryMicrolink(url).catch(() => null);
      if (ml) {
        result = {
          event_name: result?.event_name ?? ml.event_name,
          start_date: result?.start_date ?? ml.start_date,
          end_date: result?.end_date ?? ml.end_date,
          city: result?.city ?? ml.city,
          country: result?.country ?? ml.country,
          description: result?.description ?? ml.description,
        };
      }
    }

    if (!result) return NextResponse.json({ error: "Could not fetch" }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("fetch-event-url:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
