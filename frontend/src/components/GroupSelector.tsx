"use client";

import React from "react";
import { GroupDetailResponse, GroupResponse } from "../types";

interface GroupSelectorProps {
  groups: GroupResponse[];
  selectedGroupId: number | null;
  groupDetail: GroupDetailResponse | null;
  isLoading: boolean;
  onSelectGroup: (groupId: number) => void;
}

export function GroupSelector({
  groups,
  selectedGroupId,
  groupDetail,
  isLoading,
  onSelectGroup,
}: GroupSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-5 w-24 rounded-sm bg-slate-200"></div>
        <div className="h-9 w-48 rounded-lg bg-slate-200"></div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        No groups found for this user. Switch to another user (e.g. Alice or
        Bob) to view groups.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="group-select"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Select Accessible Group
        </label>
        {groupDetail && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Members:</span>
            <div className="flex flex-wrap gap-1">
              {groupDetail.members.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-700"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const isSelected = group.id === selectedGroupId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                isSelected
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span>{group.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
