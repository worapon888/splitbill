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
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-section-card">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          คุณกำลังใช้งานในชื่อใคร?
        </h2>
        <p className="text-xs text-slate-500">เลือกชื่อของคุณเพื่อดูกลุ่มที่คุณเป็นสมาชิก</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {USERS.map((user) => {
          const isSelected = user === currentUser;
          return (
            <button
              key={user}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onSelectUser(user)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition focus:outline-hidden focus:ring-2 focus:ring-primary/30 ${
                isSelected
                  ? "bg-primary-gradient border-primary text-white shadow-primary-card"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary-border hover:bg-primary-light"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold uppercase ${
                  isSelected
                    ? "bg-white text-primary"
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
