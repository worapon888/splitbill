"use client";

import React from "react";
import { formatThaiCurrency, parseToSatang } from "../lib/money";
import { BalanceResponse } from "../types";

interface BalancesCardProps {
  balances: BalanceResponse[];
  currentUser: string;
  isLoading: boolean;
}

export function BalancesCard({
  balances,
  currentUser,
  isLoading,
}: BalancesCardProps) {
  if (isLoading) {
    return (
      <div className="flex animate-pulse flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
        <div className="h-5 w-32 rounded-sm bg-slate-200"></div>
        <div className="h-14 rounded-xl bg-slate-100"></div>
        <div className="h-14 rounded-xl bg-slate-100"></div>
        <div className="h-14 rounded-xl bg-slate-100"></div>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
        <h2 className="text-base font-semibold text-slate-900">สรุปยอดของกลุ่ม</h2>
        <p className="text-sm text-slate-500">ยังไม่มีข้อมูลยอดคงเหลือ</p>
      </div>
    );
  }

  // Calculate sum of balances for visual zero-sum validation
  const totalBalanceSatang = balances.reduce((sum, b) => {
    const isNeg = b.balance.trim().startsWith("-");
    const absStr = b.balance.trim().replace(/^-/, "");
    const parsed = parseToSatang(absStr) || 0;
    return sum + (isNeg ? -parsed : parsed);
  }, 0);

  const isZeroSum = totalBalanceSatang === 0;

  // Prioritize the currently selected user at the top without mutating the original array
  const orderedBalances = [
    ...balances.filter((b) => b.username === currentUser),
    ...balances.filter((b) => b.username !== currentUser),
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">สรุปยอดของกลุ่ม</h2>
        <p className="text-xs text-slate-500">ยอดสุทธิจากค่าใช้จ่ายที่บันทึกไว้</p>
      </div>

      {!isZeroSum && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
        >
          พบความคลาดเคลื่อนของข้อมูล: ยอดรวมคงเหลือของสมาชิกไม่สมดุล (
          {formatThaiCurrency(totalBalanceSatang)})
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {orderedBalances.map((item) => {
          const isCurrentUser = item.username === currentUser;
          const isNeg = item.balance.trim().startsWith("-");
          const absStr = item.balance.trim().replace(/^-/, "");
          const satang = parseToSatang(absStr) || 0;
          const isZero = satang === 0;

          let statusText = "ไม่มียอดค้าง";
          let statusColor = "bg-slate-100 text-slate-600";
          let amountColor = "text-slate-500";

          if (!isZero) {
            if (isNeg) {
              statusText = "ต้องจ่าย";
              statusColor = "bg-rose-50 text-rose-700";
              amountColor = "text-rose-600";
            } else {
              statusText = "ต้องได้รับคืน";
              statusColor = "bg-emerald-50 text-emerald-700";
              amountColor = "text-emerald-600";
            }
          }

          return (
            <li
              key={item.username}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isCurrentUser
                  ? "bg-primary-gradient border-primary text-white shadow-primary-card"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span
                  className={`text-sm font-bold capitalize ${
                    isCurrentUser ? "text-white" : "text-slate-900"
                  }`}
                >
                  {item.username}{" "}
                  {isCurrentUser && (
                    <span className="text-xs font-semibold text-white">
                      (คุณ)
                    </span>
                  )}
                </span>
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                    isCurrentUser ? "bg-white/20 text-white" : statusColor
                  }`}
                >
                  {statusText}
                </span>
              </div>
              <span
                className={`text-lg font-bold tracking-tight ${
                  isCurrentUser ? "text-white" : amountColor
                }`}
              >
                {!isZero && !isNeg ? "+" : ""}
                {formatThaiCurrency(item.balance)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
