"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertBanner } from "../components/AlertBanner";
import { BalancesCard } from "../components/BalancesCard";
import { ExpenseForm } from "../components/ExpenseForm";
import { ExpenseList } from "../components/ExpenseList";
import { GroupSelector } from "../components/GroupSelector";
import { UserSelector } from "../components/UserSelector";
import { api, ApiError } from "../lib/api";
import { getThaiApiError } from "../lib/thai";
import {
  BalanceResponse,
  ExpenseCreate,
  ExpenseResponse,
  GroupDetailResponse,
  GroupResponse,
  ValidUser,
} from "../types";

export default function SplitBillDashboard() {
  // Current active user (X-User header)
  const [currentUser, setCurrentUser] = useState<ValidUser>("alice");

  // Groups and Selection
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetailResponse | null>(
    null,
  );

  // Group Data
  const [expenses, setExpenses] = useState<ExpenseResponse[]>([]);
  const [balances, setBalances] = useState<BalanceResponse[]>([]);

  // Loading States
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingGroupData, setIsLoadingGroupData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch groups accessible to the current user
  const fetchUserGroups = useCallback(async (user: ValidUser) => {
    setIsLoadingGroups(true);
    setErrorMessage(null);
    try {
      const userGroups = await api.listGroups(user);
      setGroups(userGroups);

      // Auto-select first accessible group if current selection is not valid for this user
      setSelectedGroupId((prevSelected) => {
        if (prevSelected && userGroups.some((g) => g.id === prevSelected)) {
          return prevSelected;
        }
        return userGroups.length > 0 ? userGroups[0].id : null;
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? getThaiApiError(err.detail)
          : "โหลดรายการกลุ่มไม่สำเร็จ";
      setErrorMessage(msg);
      setGroups([]);
      setSelectedGroupId(null);
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  // Fetch group detail, expenses, and balances
  const fetchGroupData = useCallback(
    async (groupId: number, user: ValidUser) => {
      setIsLoadingGroupData(true);
      setErrorMessage(null);
      try {
        const [detail, expenseList, balanceList] = await Promise.all([
          api.getGroupDetail(user, groupId),
          api.listExpenses(user, groupId),
          api.getBalances(user, groupId),
        ]);
        setGroupDetail(detail);
        setExpenses(expenseList);
        setBalances(balanceList);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? getThaiApiError(err.detail)
            : "โหลดข้อมูลกลุ่มไม่สำเร็จ";
        setErrorMessage(msg);
        setGroupDetail(null);
        setExpenses([]);
        setBalances([]);
      } finally {
        setIsLoadingGroupData(false);
      }
    },
    [],
  );

  // Re-fetch groups when user changes
  useEffect(() => {
    fetchUserGroups(currentUser);
  }, [currentUser, fetchUserGroups]);

  // Re-fetch group data when selectedGroupId or currentUser changes
  useEffect(() => {
    if (selectedGroupId !== null) {
      fetchGroupData(selectedGroupId, currentUser);
    } else {
      setGroupDetail(null);
      setExpenses([]);
      setBalances([]);
    }
  }, [selectedGroupId, currentUser, fetchGroupData]);

  // Handle User Change
  const handleUserChange = (newUser: ValidUser) => {
    setCurrentUser(newUser);
    setSuccessMessage(null);
  };

  // Handle Group Selection
  const handleGroupSelect = (newGroupId: number) => {
    setSelectedGroupId(newGroupId);
    setSuccessMessage(null);
  };

  // Handle Expense Recording
  const handleCreateExpense = async (
    payload: ExpenseCreate,
    idempotencyKey: string,
  ): Promise<boolean> => {
    if (selectedGroupId === null) return false;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await api.createExpense(
        currentUser,
        selectedGroupId,
        payload,
        idempotencyKey,
      );
      setSuccessMessage(`บันทึกค่าใช้จ่าย "${created.description}" สำเร็จแล้ว`);

      // Refresh expenses and balances in parallel
      const [updatedExpenses, updatedBalances] = await Promise.all([
        api.listExpenses(currentUser, selectedGroupId),
        api.getBalances(currentUser, selectedGroupId),
      ]);
      setExpenses(updatedExpenses);
      setBalances(updatedBalances);
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? getThaiApiError(err.detail)
          : "บันทึกค่าใช้จ่ายไม่สำเร็จ";
      setErrorMessage(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Expense Soft Deletion
  const handleDeleteExpense = async (expenseId: number): Promise<boolean> => {
    if (selectedGroupId === null) return false;
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.deleteExpense(currentUser, selectedGroupId, expenseId);
      setSuccessMessage("ลบรายการค่าใช้จ่ายสำเร็จแล้ว");

      // Refresh data
      const [updatedExpenses, updatedBalances] = await Promise.all([
        api.listExpenses(currentUser, selectedGroupId),
        api.getBalances(currentUser, selectedGroupId),
      ]);
      setExpenses(updatedExpenses);
      setBalances(updatedBalances);
      return true;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? getThaiApiError(err.detail)
          : "ลบรายการค่าใช้จ่ายไม่สำเร็จ";
      setErrorMessage(msg);
      return false;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              SplitBill
            </h1>
            <p className="text-sm text-slate-500">
              จัดการค่าใช้จ่ายร่วมกัน แม่นยำถึงระดับสตางค์ (0.01 บาท)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              FastAPI + Next.js
            </span>
          </div>
        </header>

        {/* Notifications */}
        {errorMessage && (
          <AlertBanner
            type="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}
        {successMessage && (
          <AlertBanner
            type="success"
            message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* User Selector */}
        <section aria-label="เลือกผู้ใช้งาน">
          <UserSelector
            currentUser={currentUser}
            onSelectUser={handleUserChange}
          />
        </section>

        {/* Group Selector */}
        <section aria-label="เลือกกลุ่ม">
          <GroupSelector
            groups={groups}
            selectedGroupId={selectedGroupId}
            groupDetail={groupDetail}
            isLoading={isLoadingGroups}
            onSelectGroup={handleGroupSelect}
          />
        </section>

        {/* Group Content */}
        {selectedGroupId !== null && groupDetail ? (
          <div className="space-y-6">
            {/* Balances Summary */}
            <section aria-label="ยอดคงเหลือของกลุ่ม">
              <BalancesCard
                balances={balances}
                currentUser={currentUser}
                isLoading={isLoadingGroupData}
              />
            </section>

            {/* Split Entry Form and Expense List Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <ExpenseForm
                  members={groupDetail.members}
                  currentUser={currentUser}
                  isSubmitting={isSubmitting}
                  onSubmit={handleCreateExpense}
                />
              </div>

              <div className="lg:col-span-7">
                <ExpenseList
                  expenses={expenses}
                  currentUser={currentUser}
                  isLoading={isLoadingGroupData}
                  onDeleteExpense={handleDeleteExpense}
                />
              </div>
            </div>
          </div>
        ) : (
          !isLoadingGroups && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <p className="text-base font-semibold text-slate-700">
                ยังไม่ได้เลือกกลุ่ม
              </p>
              <p className="mt-1 text-sm text-slate-400">
                เลือกกลุ่มด้านบนเพื่อดูยอดคงเหลือของสมาชิกและบันทึกค่าใช้จ่ายร่วมกัน
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
