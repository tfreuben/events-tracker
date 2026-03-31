import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface EnrichedEvent {
  event_name: string | null;
  event_description: string | null;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  target_audience: string | null;
  key_topics: string | null;
  region: string | null;
  event_type: string | null;
}

const EMPTY_RESULT: EnrichedEvent = {
  event_name: null, event_description: null, start_date: null, end_date: null,
  city: null, country: null, venue: null, target_audience: null, key_topics: null,
  region: null, event_type: null,
};

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

function fallbackHtmlExtract(html: string): EnrichedEvent {
  const result: EnrichedEvent = { ...EMPTY_RESULT };

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
          if (obj.description) result.event_description = String(obj.description).replace(/<[^>]+>/g, "").slice(0, 300);
          const loc = obj.location as Record<string, unknown> | undefined;
          if (loc) {
            if (typeof loc.name === "string") result.venue = loc.name;
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
  if (!result.event_description) result.event_description = getMeta(html, "og:description") ?? getMeta(html, "description");

  return result;
}

function stripHtmlToText(html: string): string {
  let text = html;
  text = text.replace(/<(script|style|nav|footer|header|aside|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// Search for event URLs using multiple search engines for reliability
async function searchForEventUrls(eventName: string, year?: number, max = 5): Promise<string[]> {
  const searchYear = year || new Date().getFullYear();
  const query = `${eventName} ${searchYear} event`;
  const urls: string[] = [];
  const seenDomains = new Set<string>();

  function addUrl(url: string) {
    const domain = url.replace(/^https?:\/\//, "").split("/")[0];
    if (!seenDomains.has(domain) && urls.length < max) {
      seenDomains.add(domain);
      urls.push(url);
    }
  }

  // Try DuckDuckGo
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const html = await res.text();
      const uddgPattern = /uddg=([^&"]+)/g;
      let match: RegExpExecArray | null;
      while ((match = uddgPattern.exec(html)) !== null) {
        const raw = match[1].replace(/&amp;/g, "&");
        addUrl(decodeURIComponent(raw));
      }
    }
  } catch (err) { console.error("[enrich] DDG search failed:", err); }

  // If DDG returned nothing, try Google search scraping as fallback
  if (urls.length === 0) {
    try {
      const gRes = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(6000),
      });
      if (gRes.ok) {
        const html = await gRes.text();
        const linkPattern = /href="\/url\?q=([^&"]+)/g;
        let match: RegExpExecArray | null;
        while ((match = linkPattern.exec(html)) !== null) {
          const url = decodeURIComponent(match[1]);
          if (url.startsWith("http") && !url.includes("google.com")) addUrl(url);
        }
      }
    } catch (err) { console.error("[enrich] Google search failed:", err); }
  }

  console.log(`[enrich] Search for "${query}" found URLs:`, urls);
  return urls;
}

async function enrichWithClaude(content: string, source: "url" | "name"): Promise<EnrichedEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ...EMPTY_RESULT };

  const client = new Anthropic({ apiKey });

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const systemPrompt = source === "url"
    ? `You extract structured event information from webpage content. Return ONLY valid JSON with these fields:
{
  "event_name": "string or null - the official event name",
  "event_description": "1-2 sentence description of the event or null",
  "start_date": "YYYY-MM-DD or null",
  "end_date": "YYYY-MM-DD or null",
  "city": "string or null",
  "country": "string or null",
  "venue": "venue name or null",
  "target_audience": "brief description of who attends or null",
  "key_topics": "comma-separated topics or null",
  "region": "EMEA, NA, LATAM, or APAC based on location - null if unknown",
  "event_type": "Conference/Trade Show, Forum, Workshop, or Dinner/Reception - null if unknown"
}
No markdown, no explanation, just the JSON object.`
    : `You are an expert on industry events, conferences, and trade shows worldwide. Today is ${today}. The user will give you an event name. Return details about the NEXT UPCOMING edition (on or after today). If the ${currentYear} edition has already passed, return the ${currentYear + 1} edition instead. Consider that events may have been renamed (e.g. Heli-Expo became Verticon). Return ONLY valid JSON:
{
  "event_name": "string or null - the official event name including year",
  "event_description": "1-2 sentence description or null",
  "start_date": "YYYY-MM-DD or null - MUST be on or after ${today}",
  "end_date": "YYYY-MM-DD or null",
  "city": "string or null",
  "country": "string or null",
  "venue": "venue name or null",
  "target_audience": "brief description of who attends or null",
  "key_topics": "comma-separated topics or null",
  "region": "EMEA, NA, LATAM, or APAC based on location - null if unknown",
  "event_type": "Conference/Trade Show, Forum, Workshop, or Dinner/Reception - null if unknown"
}
No markdown, no explanation, just the JSON object. Try your best to provide dates, city, country, and venue.`;

  const userPrompt = source === "url"
    ? `Extract event details from this webpage content. Pay close attention to dates, location, and venue:\n\n${content}`
    : `What do you know about this event? Return the next upcoming edition (after ${today}):\n\n${content}`;

  // Use Sonnet for name-only lookups (more world knowledge), Haiku for URL extraction (speed)
  const model = source === "name" ? "claude-sonnet-4-5-20250929" : "claude-haiku-4-5-20251001";

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ...EMPTY_RESULT };

    const parsed = JSON.parse(jsonMatch[0]);
    const validRegions = ["EMEA", "NA", "LATAM", "APAC"];
    const validTypes = ["Conference/Trade Show", "Forum", "Workshop", "Dinner/Reception"];
    return {
      event_name: typeof parsed.event_name === "string" ? parsed.event_name : null,
      event_description: typeof parsed.event_description === "string" ? parsed.event_description : null,
      start_date: extractDate(parsed.start_date),
      end_date: extractDate(parsed.end_date),
      city: typeof parsed.city === "string" ? parsed.city : null,
      country: typeof parsed.country === "string" ? parsed.country : null,
      venue: typeof parsed.venue === "string" ? parsed.venue : null,
      target_audience: typeof parsed.target_audience === "string" ? parsed.target_audience : null,
      key_topics: typeof parsed.key_topics === "string" ? parsed.key_topics : null,
      region: typeof parsed.region === "string" && validRegions.includes(parsed.region) ? parsed.region : null,
      event_type: typeof parsed.event_type === "string" && validTypes.includes(parsed.event_type) ? parsed.event_type : null,
    };
  } catch (err) {
    console.error("Claude enrichment failed:", err);
    return { ...EMPTY_RESULT };
  }
}

async function fetchAndExtract(url: string): Promise<EnrichedEvent> {
  let html: string | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) html = await res.text();
    else console.log("[enrich] Page fetch failed with status:", res.status);
  } catch (err) { console.error("[enrich] Page fetch error:", err); }

  if (!html) return { ...EMPTY_RESULT };

  const pageText = stripHtmlToText(html).slice(0, 15000);
  const aiResult = await enrichWithClaude(pageText, "url");

  if (aiResult.event_name || aiResult.event_description) {
    const fallback = fallbackHtmlExtract(html);
    return {
      event_name: aiResult.event_name || fallback.event_name,
      event_description: aiResult.event_description || fallback.event_description,
      start_date: aiResult.start_date || fallback.start_date,
      end_date: aiResult.end_date || fallback.end_date,
      city: aiResult.city || fallback.city,
      country: aiResult.country || fallback.country,
      venue: aiResult.venue || fallback.venue,
      target_audience: aiResult.target_audience,
      key_topics: aiResult.key_topics,
      region: aiResult.region,
      event_type: aiResult.event_type,
    };
  }

  return fallbackHtmlExtract(html);
}

function isEventPast(result: EnrichedEvent): boolean {
  const checkDate = result.end_date || result.start_date;
  if (!checkDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(checkDate + "T00:00:00") < today;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, event_name } = body;
    console.log("[enrich] Request body:", JSON.stringify(body));

    if (!url && !event_name) {
      return NextResponse.json({ error: "Provide url or event_name" }, { status: 400 });
    }

    // URL-based extraction
    if (url) {
      const result = await fetchAndExtract(url);
      return NextResponse.json(result);
    }

    // Name-only: search the web, try multiple results until one yields good data
    // If all results are past events, retry with next year
    const currentYear = new Date().getFullYear();
    let hadPastResults = false;

    for (const year of [currentYear, currentYear + 1]) {
      const foundUrls = await searchForEventUrls(event_name, year);
      for (const foundUrl of foundUrls) {
        console.log("[enrich] Trying URL:", foundUrl);
        const webResult = await fetchAndExtract(foundUrl);
        console.log("[enrich] Web extraction result:", JSON.stringify(webResult));
        if (isEventPast(webResult)) {
          console.log("[enrich] Skipping past event:", webResult.end_date || webResult.start_date);
          hadPastResults = true;
          continue;
        }
        if (webResult.start_date || webResult.city) {
          return NextResponse.json(webResult);
        }
      }
      if (hadPastResults && year === currentYear) {
        console.log(`[enrich] All ${currentYear} results were past events, retrying with ${currentYear + 1}`);
        continue;
      }
      break;
    }

    // Fall back to Claude's knowledge (uses Sonnet for better world knowledge)
    console.log("[enrich] Falling back to Claude knowledge for:", event_name);
    const aiResult = await enrichWithClaude(event_name, "name");
    if (isEventPast(aiResult)) {
      console.log("[enrich] AI result is still past, clearing dates");
      aiResult.start_date = null;
      aiResult.end_date = null;
    }
    return NextResponse.json(aiResult);
  } catch (err) {
    console.error("enrich-event:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
