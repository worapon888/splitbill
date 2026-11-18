"use client";

import React, { useState } from "react";
import { formatThaiCurrency } from "../lib/money";
import { ExpenseResponse } from "../types";

interface ExpenseListProps {
  expenses: ExpenseResponse[];
  currentUser: string;
  isLoading: boolean;
  onDeleteExpense: (expenseId: number) => Promise<boolean>;
}

export function ExpenseList({
  expenses,
  currentUser,
  isLoading,
  onDeleteExpense,
}: ExpenseListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleConfirmDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await onDeleteExpense(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex animate-pulse flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
        <div className="h-5 w-40 rounded-sm bg-slate-200"></div>
        <div className="h-20 rounded-lg bg-slate-100"></div>
        <div className="h-20 rounded-lg bg-slate-100"></div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-8 py-10 text-center text-slate-500 shadow-section-card">
        <svg
          className="h-9 w-9 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          ยังไม่มีรายการค่าใช้จ่าย
        </p>
        <p className="text-xs text-slate-400">
          เพิ่มรายการแรกของกลุ่มนี้ได้จากฟอร์มเพิ่มค่าใช้จ่าย
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            รายการค่าใช้จ่าย
          </h2>
          <p className="text-xs text-slate-500">เรียงจากรายการล่าสุด</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {expenses.length} รายการ
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {expenses.map((expense) => {
          const isPayer = expense.paid_by === currentUser;
          const isDeleting = deletingId === expense.id;
          const isConfirming = confirmDeleteId === expense.id;

          // Format Date
          let formattedDate = "";
          try {
            formattedDate = new Date(expense.created_at).toLocaleString(
              "th-TH",
              {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              },
            );
          } catch {
            formattedDate = expense.created_at;
          }

          return (
            <div
              key={expense.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-xs"
            >
              {/* Header: Title, Amount, Payer */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {expense.description}
                    </span>
                    <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                      #{expense.id}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                      ออกเงินโดย{" "}
                      <span className="font-semibold capitalize text-slate-700">
                        {expense.paid_by}
                      </span>
                      {isPayer && (
                        <span className="ml-1 text-primary font-medium">
                          (คุณ)
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-base font-bold text-slate-900">
                    {formatThaiCurrency(expense.amount)}
                  </span>
                </div>
              </div>

              {/* Share Breakdown */}
              <div className="rounded-md bg-slate-50 p-2.5 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  ส่วนแบ่งค่าใช้จ่ายของแต่ละคน
                </span>
                <div className="flex flex-wrap gap-2">
                  {expense.shares.map((share) => (
                    <span
                      key={share.username}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 border border-slate-200 text-slate-700 font-medium"
                    >
                      <span className="capitalize">{share.username}:</span>
                      <span className="font-mono text-primary font-bold">
                        {formatThaiCurrency(share.amount)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions: Delete for Payer Only */}
              {isPayer && (
                <div className="flex items-center justify-end border-t border-slate-100 pt-2">
                  {isConfirming ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-700 font-medium">
                        ต้องการลบรายการนี้หรือไม่?
                      </span>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleConfirmDelete(expense.id)}
                        className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition"
                      >
                        {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(expense.id)}
                      className="text-xs font-medium text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
                      title="เฉพาะคนที่ออกเงินเท่านั้นที่ลบรายการนี้ได้"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span>ลบ</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
