import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { UserSelector } from "@/components/UserSelector";
import { GroupSelector } from "@/components/GroupSelector";
import { BalancesCard } from "@/components/BalancesCard";
import { ExpenseList } from "@/components/ExpenseList";
import { AlertBanner } from "@/components/AlertBanner";
import { ExpenseForm } from "@/components/ExpenseForm";
import type { GroupResponse, ExpenseResponse, BalanceResponse } from "@/types";

describe("UserSelector component", () => {
  it("renders all available users as buttons and calls onSelectUser", () => {
    const onSelect = vi.fn();
    render(<UserSelector currentUser="alice" onSelectUser={onSelect} />);

    expect(screen.getByText(/คุณกำลังใช้งานในชื่อใคร/i)).toBeDefined();
    const bobBtn = screen.getByRole("button", { name: /bob/i });
    expect(bobBtn).toBeDefined();

    fireEvent.click(bobBtn);
    expect(onSelect).toHaveBeenCalledWith("bob");
  });
});

describe("GroupSelector component", () => {
  const groups: GroupResponse[] = [
    { id: 1, name: "Chiang Mai trip" },
    { id: 2, name: "Office lunch" },
  ];

  it("renders groups as buttons and triggers onSelectGroup", () => {
    const onSelect = vi.fn();
    render(
      <GroupSelector
        groups={groups}
        selectedGroupId={1}
        groupDetail={{
          id: 1,
          name: "Chiang Mai trip",
          members: ["alice", "bob", "carol"],
        }}
        isLoading={false}
        onSelectGroup={onSelect}
      />,
    );

    const officeLunchBtn = screen.getByRole("button", {
      name: /มื้อกลางวันที่ออฟฟิศ/i,
    });
    expect(officeLunchBtn).toBeDefined();

    fireEvent.click(officeLunchBtn);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("renders empty state when user belongs to no groups", () => {
    render(
      <GroupSelector
        groups={[]}
        selectedGroupId={null}
        groupDetail={null}
        isLoading={false}
        onSelectGroup={vi.fn()}
      />,
    );

    expect(screen.getByText(/ไม่พบกลุ่มสำหรับผู้ใช้นี้/i)).toBeDefined();
  });
});

describe("BalancesCard component", () => {
  it("displays valid zero-sum balances without redundant badge or error alert", () => {
    const balances: BalanceResponse[] = [
      { username: "alice", balance: "66.66" },
      { username: "bob", balance: "-33.33" },
      { username: "carol", balance: "-33.33" },
    ];

    render(
      <BalancesCard
        balances={balances}
        currentUser="alice"
        isLoading={false}
      />,
    );

    expect(screen.getByText("สรุปยอดของกลุ่ม")).toBeDefined();
    expect(screen.getByText("+66.66 บาท")).toBeDefined();
    expect(screen.getAllByText("-33.33 บาท").length).toBe(2);
    expect(screen.queryByText(/ยอดรวมสมดุล/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("displays a clear Thai error message when balances do not sum to zero", () => {
    const invalidBalances: BalanceResponse[] = [
      { username: "alice", balance: "66.66" },
      { username: "bob", balance: "-30.00" },
      { username: "carol", balance: "-33.33" },
    ];

    render(
      <BalancesCard
        balances={invalidBalances}
        currentUser="alice"
        isLoading={false}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain(
      "พบความคลาดเคลื่อนของข้อมูล: ยอดรวมคงเหลือของสมาชิกไม่สมดุล",
    );
    expect(alert.textContent).toContain("3.33 บาท");
  });

  it("handles empty balance list cleanly", () => {
    render(
      <BalancesCard balances={[]} currentUser="alice" isLoading={false} />,
    );
    expect(screen.getByText("ยังไม่มีข้อมูลยอดคงเหลือ")).toBeDefined();
  });

  it("prioritizes the current user at the top and highlights their card without mutating input", () => {
    const balances: BalanceResponse[] = [
      { username: "alice", balance: "66.66" },
      { username: "bob", balance: "-33.33" },
      { username: "carol", balance: "-33.33" },
    ];
    const originalOrder = balances.map((b) => b.username);

    const { rerender } = render(
      <BalancesCard balances={balances} currentUser="bob" isLoading={false} />,
    );

    let items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("bob");
    expect(items[0].textContent).toContain("(คุณ)");
    expect(items[0].className).toContain("bg-primary-gradient");
    expect(items[0].className).toContain("border-primary");
    expect(items[0].className).toContain("shadow-primary-card");
    expect(items[1].textContent).toContain("alice");
    expect(items[1].className).toContain("bg-white");
    expect(items[2].textContent).toContain("carol");
    expect(items[2].className).toContain("bg-white");

    // Switching user to alice updates order immediately
    rerender(
      <BalancesCard
        balances={balances}
        currentUser="alice"
        isLoading={false}
      />,
    );

    items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("alice");
    expect(items[0].textContent).toContain("(คุณ)");
    expect(items[0].className).toContain("bg-primary-gradient");
    expect(items[0].className).toContain("border-primary");
    expect(items[0].className).toContain("shadow-primary-card");
    expect(items[1].textContent).toContain("bob");
    expect(items[1].className).toContain("bg-white");
    expect(items[2].textContent).toContain("carol");
    expect(items[2].className).toContain("bg-white");

    // Original array is untouched
    expect(balances.map((b) => b.username)).toEqual(originalOrder);
  });
});

describe("ExpenseList component", () => {
  const expenses: ExpenseResponse[] = [
    {
      id: 10,
      group_id: 1,
      paid_by: "alice",
      description: "Flight tickets",
      amount: "3000.00",
      created_at: "2026-11-12T10:00:00Z",
      shares: [
        { username: "alice", amount: "1000.00" },
        { username: "bob", amount: "1000.00" },
        { username: "carol", amount: "1000.00" },
      ],
    },
  ];

  it("shows delete button ONLY when currentUser is the payer", () => {
    // When alice views (payer)
    const { rerender } = render(
      <ExpenseList
        expenses={expenses}
        currentUser="alice"
        isLoading={false}
        onDeleteExpense={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "ลบ" })).toBeDefined();

    // When bob views (non-payer)
    rerender(
      <ExpenseList
        expenses={expenses}
        currentUser="bob"
        isLoading={false}
        onDeleteExpense={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "ลบ" })).toBeNull();
  });

  it("shows inline confirmation and invokes onDeleteExpense on confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    render(
      <ExpenseList
        expenses={expenses}
        currentUser="alice"
        isLoading={false}
        onDeleteExpense={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ลบ" }));
    expect(screen.getByText(/ต้องการลบรายการนี้หรือไม่\?/i)).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: "ยืนยันการลบ" });
    fireEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledWith(10);
  });
});

describe("AlertBanner component", () => {
  it("renders error message and close button", () => {
    const onDismiss = vi.fn();
    render(
      <AlertBanner
        message="Failed to connect to backend"
        type="error"
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Failed to connect to backend")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "ปิดการแจ้งเตือน" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ExpenseForm component", () => {
  const members = ["alice", "bob", "carol"];

  it("shows real-time equal split preview as amount is entered", async () => {
    render(
      <ExpenseForm
        members={members}
        currentUser="alice"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(/จำนวนเงิน \(บาท\)/i);
    fireEvent.change(amountInput, { target: { value: "100.00" } });

    await waitFor(() => {
      // With all 3 members selected by default:
      // alice gets 33.34 บาท, bob gets 33.33 บาท, carol gets 33.33 บาท
      expect(screen.getByText("33.34 บาท")).toBeDefined();
      expect(screen.getAllByText("33.33 บาท").length).toBe(2);
    });
  });

  it("validates exact split sum matches total", async () => {
    render(
      <ExpenseForm
        members={members}
        currentUser="alice"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    );

    const amountInput = screen.getByLabelText(/จำนวนเงิน \(บาท\)/i);
    fireEvent.change(amountInput, { target: { value: "100.00" } });

    // Switch to exact split by clicking the button
    fireEvent.click(screen.getByRole("button", { name: "กำหนดเอง" }));

    // เมื่อยังไม่กรอกยอดแบ่ง ระบบต้องแจ้งว่ายอดของสมาชิกต้องมากกว่า 0
    expect(screen.getByText("ยอดของสมาชิกทุกคนต้องมากกว่า 0")).toBeDefined();

    const submitBtn = screen.getByRole("button", {
      name: /บันทึกค่าใช้จ่าย/i,
    });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });
});
