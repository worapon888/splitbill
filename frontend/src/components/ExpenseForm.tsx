"use client";

import React, { useEffect, useId, useState } from "react";
import {
  calculateEqualSplit,
  formatThaiCurrency,
  parseToSatang,
  validateExactSplit,
} from "../lib/money";
import { ExpenseCreate, SplitType } from "../types";

interface ExpenseFormProps {
  members: string[];
  currentUser: string;
  isSubmitting: boolean;
  onSubmit: (
    expense: ExpenseCreate,
    idempotencyKey: string,
  ) => Promise<boolean>;
}

export function ExpenseForm({
  members,
  currentUser,
  isSubmitting,
  onSubmit,
}: ExpenseFormProps) {
  const formId = useId();

  // Form Fields
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(currentUser);
  const [splitType, setSplitType] = useState<SplitType>("equal");

  // Selected participants (order preserved)
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members);

  // Exact split shares mapping: username -> amount string
  const [exactShares, setExactShares] = useState<Record<string, string>>({});

  // Idempotency Key (preserved across retries, renewed on success)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID(),
  );

  // Update defaults when members or currentUser change
  useEffect(() => {
    setSelectedMembers(members);
    if (members.includes(currentUser)) {
      setPaidBy(currentUser);
    } else if (members.length > 0) {
      setPaidBy(members[0]);
    }
  }, [members, currentUser]);

  // Toggle member selection (preserves order of members)
  const toggleMember = (member: string) => {
    if (selectedMembers.includes(member)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== member));
    } else {
      // Keep original order from members list
      const updated = members.filter(
        (m) => m === member || selectedMembers.includes(m),
      );
      setSelectedMembers(updated);
    }
  };

  const handleExactShareChange = (member: string, val: string) => {
    setExactShares((prev) => ({
      ...prev,
      [member]: val,
    }));
  };

  // Live Calculations
  const equalShares =
    splitType === "equal" ? calculateEqualSplit(amount, selectedMembers) : null;

  const exactValidation =
    splitType === "exact"
      ? validateExactSplit(amount, exactShares, selectedMembers)
      : null;

  // Validation Checks
  const parsedTotalSatang = parseToSatang(amount);
  const isAmountValid = parsedTotalSatang !== null && parsedTotalSatang > 0;
  const isDescriptionValid = description.trim().length > 0;
  const hasParticipants = selectedMembers.length > 0;

  const isFormValid =
    isDescriptionValid &&
    isAmountValid &&
    hasParticipants &&
    (splitType === "equal"
      ? equalShares !== null
      : exactValidation !== null && exactValidation.isValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    let payload: ExpenseCreate;

    if (splitType === "equal") {
      payload = {
        description: description.trim(),
        amount: amount.trim(),
        paid_by: paidBy,
        split: {
          type: "equal",
          members: selectedMembers,
        },
      };
    } else {
      // Clean exact shares
      const cleanedShares: Record<string, string> = {};
      for (const m of selectedMembers) {
        cleanedShares[m] = (exactShares[m] || "").trim();
      }
      payload = {
        description: description.trim(),
        amount: amount.trim(),
        paid_by: paidBy,
        split: {
          type: "exact",
          shares: cleanedShares,
        },
      };
    }

    const success = await onSubmit(payload, idempotencyKey);
    if (success) {
      // Reset form on success and generate fresh idempotency key
      setDescription("");
      setAmount("");
      setExactShares({});
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">
          บันทึกค่าใช้จ่ายใหม่
        </h2>
        <p className="text-xs text-slate-500">
          แบ่งค่าใช้จ่ายร่วมกันอย่างแม่นยำถึงระดับสตางค์ (0.01 บาท)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Description */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor={`${formId}-desc`}
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            รายละเอียด *
          </label>
          <input
            id={`${formId}-desc`}
            type="text"
            required
            placeholder="เช่น มื้อเย็นที่นิมมาน, ค่าแท็กซี่, กาแฟที่ออฟฟิศ"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Amount in THB */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-amount`}
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            จำนวนเงิน (บาท) *
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-bold text-slate-400">
              ฿
            </span>
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="decimal"
              required
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {amount && !isAmountValid && (
            <span className="text-xs text-rose-600">
              กรอกจำนวนเงินมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง
            </span>
          )}
        </div>

        {/* Paid By */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-payer`}
            className="text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            ผู้ชำระเงิน *
          </label>
          <select
            id={`${formId}-payer`}
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            {members.map((member) => (
              <option key={member} value={member}>
                {member} {member === currentUser ? "(คุณ)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Split Type Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          วิธีแบ่งค่าใช้จ่าย
        </label>
        <div className="flex rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => setSplitType("equal")}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              splitType === "equal"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            หารเท่ากัน
          </button>
          <button
            type="button"
            onClick={() => setSplitType("exact")}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              splitType === "exact"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ระบุจำนวนเงิน
          </button>
        </div>
      </div>

      {/* Participants & Split Inputs */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          ผู้ร่วมจ่าย
        </label>

        {splitType === "equal" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((member) => {
              const isChecked = selectedMembers.includes(member);
              return (
                <label
                  key={member}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                    isChecked
                      ? "border-indigo-300 bg-indigo-50/50 text-indigo-950 font-medium"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleMember(member)}
                    className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="capitalize">{member}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {members.map((member) => {
              const isSelected = selectedMembers.includes(member);
              return (
                <div
                  key={member}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm transition ${
                    isSelected
                      ? "border-slate-300 bg-white"
                      : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(member)}
                    className="h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="w-24 font-medium capitalize text-slate-800">
                    {member}
                  </span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-xs text-slate-400">
                      ฿
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!isSelected}
                      placeholder="0.00"
                      value={exactShares[member] || ""}
                      onChange={(e) =>
                        handleExactShareChange(member, e.target.value)
                      }
                      className="w-full rounded-md border border-slate-200 py-1.5 pr-2.5 pl-6 text-sm text-slate-900 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Split Preview Box */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            ตัวอย่างการแบ่งค่าใช้จ่าย
          </span>
          {splitType === "exact" && exactValidation && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                exactValidation.isValid
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {exactValidation.isValid
                ? "ยอดตรงกัน (0.00 บาท)"
                : exactValidation.errorMessage}
            </span>
          )}
        </div>

        {/* Equal Split Preview Details */}
        {splitType === "equal" && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {equalShares && equalShares.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {equalShares.map((s) => (
                    <div
                      key={s.username}
                      className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs border border-slate-200"
                    >
                      <span className="font-semibold capitalize text-slate-800">
                        {s.username}
                      </span>
                      <span className="font-mono font-bold text-indigo-600">
                        {formatThaiCurrency(s.amount, "฿")}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Notice if satang allocation differed */}
                {equalShares.some(
                  (s) => s.satang !== equalShares[0].satang,
                ) && (
                  <p className="mt-1 text-xs text-slate-500 italic">
                    เศษสตางค์จะถูกแจกตามลำดับสมาชิกที่เลือก
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">
                กรอกจำนวนเงินและเลือกสมาชิกเพื่อดูยอดที่แต่ละคนต้องจ่าย
              </p>
            )}
          </div>
        )}

        {/* Exact Split Preview Summary */}
        {splitType === "exact" && exactValidation && (
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">ยอดรวม</span>
              <span className="font-bold text-slate-900">
                {amount ? formatThaiCurrency(amount, "฿") : "฿0.00"}
              </span>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">แบ่งแล้ว</span>
              <span className="font-bold text-slate-900">
                {formatThaiCurrency(exactValidation.assignedAmount, "฿")}
              </span>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">คงเหลือ</span>
              <span
                className={`font-bold ${
                  exactValidation.remainingSatang === 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {exactValidation.remainingAmount
                  ? formatThaiCurrency(exactValidation.remainingAmount, "฿")
                  : "฿0.00"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting}
        className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold text-white shadow-xs transition ${
          isFormValid && !isSubmitting
            ? "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
            : "bg-slate-300 cursor-not-allowed opacity-75"
        }`}
      >
        {isSubmitting ? (
          <>
            <svg
              className="h-4 w-4 animate-spin text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              ></path>
            </svg>
            <span>กำลังบันทึก...</span>
          </>
        ) : (
          <span>บันทึกค่าใช้จ่าย</span>
        )}
      </button>
    </form>
  );
}
