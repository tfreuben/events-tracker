// Seed script - run with: npx tsx scripts/seed.ts <base-url> <admin-password>
// Example: npx tsx scripts/seed.ts https://events-tracker-mu.vercel.app trustflight2027

import { seedEvents } from "../src/lib/seed-data";

const baseUrl = process.argv[2] || "http://localhost:3000";
const password = process.argv[3] || "trustflight2027";

async function seed() {
  console.log(`Seeding ${seedEvents.length} events to ${baseUrl}...`);

  // Login first
  const loginRes = await fetch(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!loginRes.ok) {
    console.error("Login failed:", await loginRes.text());
    process.exit(1);
  }

  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) {
    console.error("No cookie received from login");
    process.exit(1);
  }

  // Transform camelCase seed data to snake_case for API
  const events = seedEvents.map((e) => ({
    event_name: e.eventName,
    business_unit: e.businessUnit,
    event_type: e.eventType,
    region: e.region,
    city: e.city,
    country: e.country,
    venue: e.venue,
    start_date: e.startDate,
    end_date: e.endDate,
    number_of_days: e.numberOfDays,
    sales_staff_attending: e.salesStaffAttending,
    staff_names: e.staffNames,
    event_booth_cost: e.eventBoothCost,
    est_daily_rate: e.estDailyRate,
    total_daily_rate: e.totalDailyRate,
    flight_cost_per_person: e.flightCostPerPerson,
    total_flight_cost: e.totalFlightCost,
    total_travel_cost: e.totalTravelCost,
    total_event_cost: e.totalEventCost,
    budget_month: e.budgetMonth,
    status: e.status,
    sponsorship_level: e.sponsorshipLevel,
    booth_number: e.boothNumber,
    event_website_url: e.eventWebsiteUrl,
    event_description: e.eventDescription,
    target_audience: e.targetAudience,
    key_topics: e.keyTopics,
    products_to_feature: e.productsToFeature,
    pre_event_goals: e.preEventGoals,
    post_event_notes: e.postEventNotes,
    wordpress_article_status: e.wordpressArticleStatus,
    article_url: e.articleUrl,
  }));

  const bulkRes = await fetch(`${baseUrl}/api/events/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ events, resetTable: true }),
  });

  if (!bulkRes.ok) {
    console.error("Bulk import failed:", await bulkRes.text());
    process.exit(1);
  }

  const result = await bulkRes.json();
  console.log(`Successfully seeded ${result.inserted} events!`);
}

seed().catch(console.error);
