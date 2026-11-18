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
      className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card"
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">เพิ่มค่าใช้จ่าย</h2>
        <p className="text-xs text-slate-500">
          กรอกรายละเอียด แล้วระบบจะช่วยคำนวณว่าแต่ละคนต้องจ่ายเท่าไร
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Description */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor={`${formId}-desc`}
            className="text-xs font-semibold text-slate-700"
          >
            ค่าใช้จ่ายคืออะไร?
          </label>
          <input
            id={`${formId}-desc`}
            type="text"
            required
            placeholder="เช่น มื้อเย็น ค่าแท็กซี่ ค่ากาแฟ"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Amount in THB */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${formId}-amount`}
            className="text-xs font-semibold text-slate-700"
          >
            จำนวนเงิน (บาท)
          </label>
          <div className="relative">
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="decimal"
              required
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-12 pl-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-slate-400">
              บาท
            </span>
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
            className="text-xs font-semibold text-slate-700"
          >
            ใครออกเงินก่อน?
          </label>
          <select
            id={`${formId}-payer`}
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm capitalize text-slate-900 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
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
        <span className="text-xs font-semibold text-slate-700">วิธีหารเงิน</span>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setSplitType("equal")}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              splitType === "equal"
                ? "bg-primary-gradient text-white shadow-xs"
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
                ? "bg-primary-gradient text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            กำหนดเอง
          </button>
        </div>
      </div>

      {/* Participants & Split Inputs */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-700">
          หารกับใครบ้าง?
        </span>

        {splitType === "equal" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {members.map((member) => {
              const isChecked = selectedMembers.includes(member);
              return (
                <label
                  key={member}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                    isChecked
                      ? "border-primary-border bg-primary-light text-slate-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleMember(member)}
                    className="h-4 w-4 rounded-sm border-slate-300 accent-primary text-primary focus:ring-primary"
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
                      ? "border-primary-border bg-primary-light/60"
                      : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(member)}
                    className="h-4 w-4 rounded-sm border-slate-300 accent-primary text-primary focus:ring-primary"
                  />
                  <span className="w-24 font-medium capitalize text-slate-800">
                    {member}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!isSelected}
                      placeholder="0.00"
                      value={exactShares[member] || ""}
                      onChange={(e) =>
                        handleExactShareChange(member, e.target.value)
                      }
                      className="w-full rounded-md border border-slate-200 bg-white py-1.5 pr-10 pl-2.5 text-sm text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-400">
                      บาท
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Split Preview Box */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <span className="text-xs font-bold text-slate-700">
            ตัวอย่างการหารเงิน
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
                ? "ครบพอดีแล้ว"
                : exactValidation.errorMessage}
            </span>
          )}
        </div>

        {/* Equal Split Preview Details */}
        {splitType === "equal" && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {equalShares && equalShares.length > 0 ? (
              <>
                <p className="text-xs text-slate-600">
                  ยอดรวม{" "}
                  <span className="font-bold text-slate-900">
                    {formatThaiCurrency(amount)}
                  </span>{" "}
                  หาร {equalShares.length} คน
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {equalShares.map((s) => (
                    <div
                      key={s.username}
                      className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs border border-slate-200"
                    >
                      <span className="font-semibold capitalize text-slate-800">
                        {s.username}
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {formatThaiCurrency(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Notice if satang allocation differed */}
                {equalShares.some(
                  (s) => s.satang !== equalShares[0].satang,
                ) && (
                  <p className="mt-1 text-xs text-slate-500 italic">
                    เศษสตางค์จะแบ่งให้ตามลำดับชื่อสมาชิก
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">
                กรอกจำนวนเงินและเลือกคนที่หารด้วยกัน เพื่อดูว่าแต่ละคนต้องจ่ายเท่าไร
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
                {amount ? formatThaiCurrency(amount) : formatThaiCurrency(0)}
              </span>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">หารไปแล้ว</span>
              <span className="font-bold text-slate-900">
                {formatThaiCurrency(exactValidation.assignedAmount)}
              </span>
            </div>
            <div className="rounded-md bg-white p-2 border border-slate-200">
              <span className="text-slate-500 block">ยังไม่ได้หาร</span>
              <span
                className={`font-bold ${
                  exactValidation.remainingSatang === 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {exactValidation.remainingAmount
                  ? formatThaiCurrency(exactValidation.remainingAmount)
                  : formatThaiCurrency(0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting}
        className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition focus:outline-hidden focus:ring-2 focus:ring-primary/30 ${
          isFormValid && !isSubmitting
            ? "bg-primary-gradient shadow-primary-card cursor-pointer"
            : "bg-slate-300/70 cursor-not-allowed"
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
      {!isFormValid && !isSubmitting && (
        <p className="text-center text-xs text-slate-500">
          {!isDescriptionValid
            ? "กรอกชื่อค่าใช้จ่ายก่อนบันทึก"
            : !isAmountValid
              ? "กรอกจำนวนเงินก่อนบันทึก"
              : !hasParticipants
                ? "เลือกคนที่หารด้วยกันอย่างน้อย 1 คน"
                : splitType === "exact"
                  ? "ยอดที่กำหนดต้องรวมกันเท่ากับยอดทั้งหมดก่อนบันทึก"
                  : "กรุณาตรวจสอบข้อมูลอีกครั้ง"}
        </p>
      )}
    </form>
  );
}
