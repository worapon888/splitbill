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
          : "โหลดรายการกลุ่มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
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
            : "โหลดข้อมูลกลุ่มไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
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
      setSuccessMessage(
        `บันทึก "${created.description}" แล้ว สรุปยอดของกลุ่มอัปเดตเรียบร้อย`,
      );

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
          : "บันทึกค่าใช้จ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
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
      setSuccessMessage("ลบรายการแล้ว สรุปยอดของกลุ่มอัปเดตเรียบร้อย");

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
          : "ลบรายการค่าใช้จ่ายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
      setErrorMessage(msg);
      return false;
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              SplitBill
            </h1>
            <p className="text-sm text-slate-500">
              แชร์ค่าใช้จ่ายกับเพื่อน หารเงินง่าย ๆ
            </p>
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

        {/* Section 1: User and Group Selection */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section aria-label="เลือกผู้ใช้งาน">
            <UserSelector
              currentUser={currentUser}
              onSelectUser={handleUserChange}
            />
          </section>

          <section aria-label="เลือกกลุ่มค่าใช้จ่าย">
            <GroupSelector
              groups={groups}
              selectedGroupId={selectedGroupId}
              groupDetail={groupDetail}
              isLoading={isLoadingGroups}
              onSelectGroup={handleGroupSelect}
            />
          </section>
        </div>

        {/* Section 2: Main Content */}
        {selectedGroupId !== null && groupDetail ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <section aria-label="เพิ่มค่าใช้จ่าย">
              <ExpenseForm
                members={groupDetail.members}
                currentUser={currentUser}
                isSubmitting={isSubmitting}
                onSubmit={handleCreateExpense}
              />
            </section>

            <div className="flex flex-col gap-6">
              <section aria-label="สรุปยอดของกลุ่ม">
                <BalancesCard
                  balances={balances}
                  currentUser={currentUser}
                  isLoading={isLoadingGroupData}
                />
              </section>

              <section aria-label="รายการค่าใช้จ่าย">
                <ExpenseList
                  expenses={expenses}
                  currentUser={currentUser}
                  isLoading={isLoadingGroupData}
                  onDeleteExpense={handleDeleteExpense}
                />
              </section>
            </div>
          </div>
        ) : (
          !isLoadingGroups && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <p className="text-base font-semibold text-slate-700">
                ยังไม่ได้เลือกกลุ่ม
              </p>
              <p className="mt-1 text-sm text-slate-400">
                เลือกกลุ่มค่าใช้จ่ายด้านบนเพื่อดูสรุปยอดและเพิ่มค่าใช้จ่าย
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
