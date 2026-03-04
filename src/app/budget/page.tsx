"use client";

import { BudgetSummary } from "@/components/budget/BudgetSummary";

export default function BudgetPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Budget Summary — FY27</h1>
      <BudgetSummary />
    </div>
  );
}
