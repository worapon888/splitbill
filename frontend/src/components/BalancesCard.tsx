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
      <div className="flex animate-pulse flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="h-5 w-32 rounded-sm bg-slate-200"></div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="h-16 rounded-lg bg-slate-100"></div>
          <div className="h-16 rounded-lg bg-slate-100"></div>
          <div className="h-16 rounded-lg bg-slate-100"></div>
        </div>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-semibold text-slate-900">
          ยอดคงเหลือของสมาชิก
        </h2>
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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            ยอดคงเหลือของสมาชิก
          </h2>
          <p className="text-xs text-slate-500">
            ยอดสุทธิ: (+) สมาชิกต้องได้รับคืน, (-) สมาชิกต้องจ่าย
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isZeroSum
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isZeroSum ? "bg-emerald-500" : "bg-rose-500"
            }`}
          ></span>
          <span>ยอดรวมสมดุล: 0.00 บาท</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((item) => {
          const isCurrentUser = item.username === currentUser;
          const isNeg = item.balance.trim().startsWith("-");
          const absStr = item.balance.trim().replace(/^-/, "");
          const satang = parseToSatang(absStr) || 0;
          const isZero = satang === 0;

          let badgeStyle = "bg-slate-50 border-slate-200 text-slate-700";
          let statusText = "ชำระครบแล้ว";
          let amountColor = "text-slate-700";

          if (!isZero) {
            if (isNeg) {
              badgeStyle = "bg-rose-50 border-rose-200 text-rose-800";
              statusText = "ต้องจ่าย";
              amountColor = "text-rose-600 font-bold";
            } else {
              badgeStyle = "bg-emerald-50 border-emerald-200 text-emerald-800";
              statusText = "ต้องได้รับคืน";
              amountColor = "text-emerald-600 font-bold";
            }
          }

          return (
            <div
              key={item.username}
              className={`flex flex-col justify-between rounded-lg border p-3.5 transition ${badgeStyle} ${
                isCurrentUser ? "ring-2 ring-indigo-500 ring-offset-1" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold capitalize text-slate-900">
                  {item.username}{" "}
                  {isCurrentUser && (
                    <span className="text-xs font-normal text-indigo-600">
                      (คุณ)
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {statusText}
                </span>
              </div>
              <div className="mt-2 text-xl tracking-tight">
                <span className={amountColor}>
                  {!isZero && !isNeg ? "+" : ""}
                  {formatThaiCurrency(item.balance, "฿")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
