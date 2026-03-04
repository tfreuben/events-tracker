import { TFEvent } from "@/types";

export function computeCosts(event: Partial<TFEvent>): {
  total_daily_rate: number;
  total_flight_cost: number;
  total_travel_cost: number;
  total_event_cost: number;
} {
  const staff = event.sales_staff_attending ?? 0;
  const days = event.number_of_days ?? 0;
  const dailyRate = event.est_daily_rate ?? 0;
  const flightCost = event.flight_cost_per_person ?? 0;
  const boothCost = event.event_booth_cost ?? 0;

  const total_daily_rate = staff * days * dailyRate;
  const total_flight_cost = staff * flightCost;
  const total_travel_cost = total_daily_rate + total_flight_cost;
  const total_event_cost = boothCost + total_travel_cost;

  return { total_daily_rate, total_flight_cost, total_travel_cost, total_event_cost };
}
