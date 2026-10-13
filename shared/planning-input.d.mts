export type PlannerPlan = {
  title: string; summary: string; category: string;
  priority: 'low' | 'medium' | 'high'; cadence: string; target_date: string | null;
  tasks: Array<{ title: string }>;
  schedule: { sessions_per_week: number; duration_minutes: number; preferred_time: 'morning' | 'afternoon' | 'evening' | 'any' };
  assumptions: string[]; notes?: string;
};
export type PlannerResult = { plans: PlannerPlan[]; source?: string; notice?: string };
export const MAX_PLAN_INPUT: number;
export function parseStructuredPlans(intent: string): PlannerResult | null;
export function importDraft(intent: string): PlannerResult;
export function validPlan(plan: unknown): plan is PlannerPlan;
