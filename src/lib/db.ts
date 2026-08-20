import { sql } from "@vercel/postgres";

export const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  business_unit TEXT NOT NULL,
  event_type TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT,
  country TEXT,
  venue TEXT,
  start_date DATE,
  end_date DATE,
  number_of_days INTEGER NOT NULL DEFAULT 1,
  sales_staff_attending INTEGER NOT NULL DEFAULT 1,
  staff_names TEXT,
  event_booth_cost INTEGER NOT NULL DEFAULT 0,
  est_daily_rate INTEGER NOT NULL DEFAULT 0,
  total_daily_rate INTEGER NOT NULL DEFAULT 0,
  flight_cost_per_person INTEGER NOT NULL DEFAULT 0,
  total_flight_cost INTEGER NOT NULL DEFAULT 0,
  total_travel_cost INTEGER NOT NULL DEFAULT 0,
  total_event_cost INTEGER NOT NULL DEFAULT 0,
  budget_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planned',
  sponsorship_level TEXT,
  booth_number TEXT,
  event_website_url TEXT,
  event_description TEXT,
  target_audience TEXT,
  key_topics TEXT,
  products_to_feature TEXT,
  pre_event_goals TEXT,
  post_event_notes TEXT,
  wordpress_article_status TEXT NOT NULL DEFAULT 'Not Started',
  article_url TEXT,
  abstract_status TEXT DEFAULT 'Not Required',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_business_unit ON events(business_unit);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_region ON events(region);
CREATE INDEX IF NOT EXISTS idx_events_budget_month ON events(budget_month);

ALTER TABLE events ADD COLUMN IF NOT EXISTS staff_emails TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS abstract_status TEXT DEFAULT 'Not Required';

CREATE TABLE IF NOT EXISTS alert_recipients (
  id SERIAL PRIMARY KEY,
  business_unit TEXT NOT NULL UNIQUE,
  emails TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_sends (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  touchpoint_code TEXT NOT NULL,
  due_date DATE NOT NULL,
  recipients TEXT NOT NULL,
  hubspot_message_ids TEXT,
  status TEXT NOT NULL,
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, touchpoint_code)
);

CREATE INDEX IF NOT EXISTS idx_alert_sends_event_id ON alert_sends(event_id);
CREATE INDEX IF NOT EXISTS idx_alert_sends_status ON alert_sends(status);
`;

export async function initDB() {
  await sql.query(DB_SCHEMA);
}

export { sql };
