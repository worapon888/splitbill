/**
 * Typed API client for SplitBill FastAPI backend.
 */

import {
  BalanceResponse,
  ExpenseCreate,
  ExpenseResponse,
  GroupDetailResponse,
  GroupResponse,
} from "../types";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail || message;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000";

async function request<T>(
  path: string,
  options: {
    method?: string;
    currentUser: string;
    idempotencyKey?: string;
    body?: unknown;
  },
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-User": options.currentUser,
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers,
      body,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "ไม่สามารถเชื่อมต่อระบบหลังบ้านได้";
    throw new ApiError(
      0,
      `ไม่สามารถเชื่อมต่อ SplitBill API ที่ ${API_BASE_URL} กรุณาตรวจสอบว่าระบบหลังบ้านกำลังทำงานอยู่ (${errorMsg})`,
      `ไม่สามารถเชื่อมต่อระบบหลังบ้านได้ กรุณาตรวจสอบว่า FastAPI กำลังทำงานอยู่ที่ ${API_BASE_URL}`,
    );
  }

  if (!response.ok) {
    let errorDetail = `คำขอล้มเหลว (สถานะ ${response.status})`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        errorDetail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // FastAPI / Pydantic validation errors
        errorDetail = data.detail
          .map(
            (item: { msg?: string; loc?: string[] }) =>
              item.msg || "ข้อมูลไม่ถูกต้อง",
          )
          .join("; ");
      }
    } catch {
      // Non-JSON error body
      errorDetail = await response.text().catch(() => errorDetail);
    }
    throw new ApiError(response.status, errorDetail, errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  /**
   * List accessible groups for the active user.
   */
  async listGroups(currentUser: string): Promise<GroupResponse[]> {
    return request<GroupResponse[]>("/groups", { currentUser });
  },

  /**
   * Fetch group details and membership list.
   */
  async getGroupDetail(
    currentUser: string,
    groupId: number,
  ): Promise<GroupDetailResponse> {
    return request<GroupDetailResponse>(`/groups/${groupId}`, {
      currentUser,
    });
  },

  /**
   * Record a new expense with optional idempotency key.
   */
  async createExpense(
    currentUser: string,
    groupId: number,
    payload: ExpenseCreate,
    idempotencyKey?: string,
  ): Promise<ExpenseResponse> {
    return request<ExpenseResponse>(`/groups/${groupId}/expenses`, {
      method: "POST",
      currentUser,
      idempotencyKey,
      body: payload,
    });
  },

  /**
   * List active expenses for a group in reverse chronological order.
   */
  async listExpenses(
    currentUser: string,
    groupId: number,
  ): Promise<ExpenseResponse[]> {
    return request<ExpenseResponse[]>(`/groups/${groupId}/expenses`, {
      currentUser,
    });
  },

  /**
   * Soft-delete an expense (payer only).
   */
  async deleteExpense(
    currentUser: string,
    groupId: number,
    expenseId: number,
  ): Promise<{ message: string; id: number }> {
    return request<{ message: string; id: number }>(
      `/groups/${groupId}/expenses/${expenseId}`,
      {
        method: "DELETE",
        currentUser,
      },
    );
  },

  /**
   * Fetch member balances for a group.
   */
  async getBalances(
    currentUser: string,
    groupId: number,
  ): Promise<BalanceResponse[]> {
    return request<BalanceResponse[]>(`/groups/${groupId}/balances`, {
      currentUser,
    });
  },
};
