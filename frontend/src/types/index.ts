/**
 * SplitBill TypeScript domain types matching FastAPI Pydantic schemas.
 */

export type SplitType = "equal" | "exact";

export interface GroupResponse {
  id: number;
  name: string;
}

export interface GroupDetailResponse {
  id: number;
  name: string;
  members: string[];
}

export interface ExpenseShareItem {
  username: string;
  amount: string;
}

export interface ExpenseSplit {
  type: SplitType;
  members?: string[];
  shares?: Record<string, string>;
}

export interface ExpenseCreate {
  description: string;
  amount: string;
  paid_by: string;
  split: ExpenseSplit;
}

export interface ExpenseResponse {
  id: number;
  group_id: number;
  paid_by: string;
  description: string;
  amount: string;
  created_at: string;
  shares: ExpenseShareItem[];
}

export interface BalanceResponse {
  username: string;
  balance: string;
}

export const USERS = ["alice", "bob", "carol", "dan"] as const;
export type ValidUser = (typeof USERS)[number];
