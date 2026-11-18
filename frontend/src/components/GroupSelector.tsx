"use client";

import React from "react";
import { getThaiGroupName } from "../lib/thai";
import { GroupDetailResponse, GroupResponse } from "../types";

interface GroupSelectorProps {
  groups: GroupResponse[];
  selectedGroupId: number | null;
  groupDetail: GroupDetailResponse | null;
  isLoading: boolean;
  onSelectGroup: (groupId: number) => void;
}

const CARD =
  "h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card";

export function GroupSelector({
  groups,
  selectedGroupId,
  groupDetail,
  isLoading,
  onSelectGroup,
}: GroupSelectorProps) {
  if (isLoading) {
    return (
      <div className={`${CARD} flex animate-pulse flex-col gap-3`}>
        <div className="h-5 w-40 rounded-sm bg-slate-200"></div>
        <div className="h-14 rounded-xl bg-slate-100"></div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={`${CARD} flex flex-col gap-2`}>
        <h2 className="text-base font-semibold text-slate-900">
          เลือกกลุ่มค่าใช้จ่าย
        </h2>
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          ไม่พบกลุ่มสำหรับผู้ใช้นี้ ลองเลือกชื่ออื่นทางด้านซ้าย
        </div>
      </div>
    );
  }

  return (
    <div className={`${CARD} flex flex-col gap-3`}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          เลือกกลุ่มค่าใช้จ่าย
        </h2>
        <p className="text-xs text-slate-500">แสดงเฉพาะกลุ่มที่คุณเป็นสมาชิก</p>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((group) => {
          const isSelected = group.id === selectedGroupId;
          const members =
            isSelected && groupDetail && groupDetail.id === group.id
              ? groupDetail.members
              : null;
          return (
            <button
              key={group.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectGroup(group.id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-hidden focus:ring-2 focus:ring-primary/30 ${
                isSelected
                  ? "border-primary bg-primary-light ring-1 ring-primary"
                  : "border-slate-200 bg-white hover:border-primary-border hover:bg-slate-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? "bg-primary-gradient border-primary"
                    : "border-slate-300 bg-white"
                }`}
              >
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-slate-900">
                  {getThaiGroupName(group.name)}
                </span>
                {members && (
                  <span className="text-xs text-slate-600">
                    สมาชิก:{" "}
                    <span className="capitalize">{members.join(", ")}</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
