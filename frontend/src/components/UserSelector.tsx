"use client";

import React from "react";
import { USERS, ValidUser } from "../types";

interface UserSelectorProps {
  currentUser: ValidUser;
  onSelectUser: (user: ValidUser) => void;
  disabled?: boolean;
}

export function UserSelector({
  currentUser,
  onSelectUser,
  disabled = false,
}: UserSelectorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          ผู้ใช้งานปัจจุบันจำลอง (เฮดเดอร์ X-User)
        </label>
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          กำลังใช้งานในชื่อ{" "}
          <span className="font-bold capitalize">{currentUser}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {USERS.map((user) => {
          const isSelected = user === currentUser;
          return (
            <button
              key={user}
              type="button"
              disabled={disabled}
              onClick={() => onSelectUser(user)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                isSelected
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold uppercase ${
                  isSelected
                    ? "bg-white text-indigo-600"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {user[0]}
              </span>
              <span className="capitalize">{user}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
