export interface TFEvent {
  id: number;
  event_name: string;
  business_unit: string;
  event_type: string;
  region: string;
  city: string | null;
  country: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  number_of_days: number;
  sales_staff_attending: number;
  staff_names: string | null;
  event_booth_cost: number;
  est_daily_rate: number;
  total_daily_rate: number;
  flight_cost_per_person: number;
  total_flight_cost: number;
  total_travel_cost: number;
  total_event_cost: number;
  budget_month: string;
  status: string;
  sponsorship_level: string | null;
  booth_number: string | null;
  event_website_url: string | null;
  event_description: string | null;
  target_audience: string | null;
  key_topics: string | null;
  products_to_feature: string | null;
  pre_event_goals: string | null;
  post_event_notes: string | null;
  wordpress_article_status: string;
  article_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFilters {
  businessUnit?: string;
  status?: string;
  region?: string;
  eventType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthState {
  isAdmin: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export type ColumnVisibilityState = Record<string, boolean>;
