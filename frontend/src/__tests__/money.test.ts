import { describe, it, expect } from "vitest";
import {
  parseToSatang,
  satangToString,
  formatThaiCurrency,
  calculateEqualSplit,
  validateExactSplit,
} from "@/lib/money";

describe("money utilities - parseToSatang", () => {
  it("correctly parses integer THB string into satang", () => {
    expect(parseToSatang("100")).toBe(10000);
    expect(parseToSatang("0")).toBe(0);
    expect(parseToSatang("1")).toBe(100);
  });

  it("correctly parses decimal THB string with 1 or 2 decimals into satang", () => {
    expect(parseToSatang("100.5")).toBe(10050);
    expect(parseToSatang("100.50")).toBe(10050);
    expect(parseToSatang("100.05")).toBe(10005);
    expect(parseToSatang("0.01")).toBe(1);
    expect(parseToSatang("0.10")).toBe(10);
    expect(parseToSatang("0.20")).toBe(20);
  });

  it("handles standard floating-point trap: 0.10 + 0.20 === 0.30 in satang", () => {
    const s1 = parseToSatang("0.10")!;
    const s2 = parseToSatang("0.20")!;
    expect(s1 + s2).toBe(30);
    expect(satangToString(s1 + s2)).toBe("0.30");
  });

  it("returns null for invalid characters, negative numbers, or empty string", () => {
    expect(parseToSatang("")).toBeNull();
    expect(parseToSatang("abc")).toBeNull();
    expect(parseToSatang("100.123")).toBeNull();
    expect(parseToSatang("-50.00")).toBeNull();
  });
});

describe("money utilities - satangToString and formatThaiCurrency", () => {
  it("formats satang to standard 2-decimal string", () => {
    expect(satangToString(10000)).toBe("100.00");
    expect(satangToString(10050)).toBe("100.50");
    expect(satangToString(5)).toBe("0.05");
    expect(satangToString(0)).toBe("0.00");
    expect(satangToString(-50)).toBe("-0.50");
    expect(satangToString(-1234)).toBe("-12.34");
  });

  it("formats Thai currency display with thousands separators and ' บาท' suffix", () => {
    expect(formatThaiCurrency("0.00")).toBe("0.00 บาท");
    expect(formatThaiCurrency("0.01")).toBe("0.01 บาท");
    expect(formatThaiCurrency("133.00")).toBe("133.00 บาท");
    expect(formatThaiCurrency("1000.00")).toBe("1,000.00 บาท");
    expect(formatThaiCurrency("-500.50")).toBe("-500.50 บาท");
    expect(formatThaiCurrency("1234567.89")).toBe("1,234,567.89 บาท");
    expect(formatThaiCurrency("1000.00", "")).toBe("1,000.00");
  });
});

describe("money utilities - calculateEqualSplit", () => {
  it("splits 100.00 THB equally among 3 members: 33.34, 33.33, 33.33", () => {
    const participants = ["alice", "bob", "carol"];
    const shares = calculateEqualSplit("100.00", participants);

    expect(shares).toEqual([
      { username: "alice", amount: "33.34", satang: 3334 },
      { username: "bob", amount: "33.33", satang: 3333 },
      { username: "carol", amount: "33.33", satang: 3333 },
    ]);

    // Sum of shares in satang must equal total satang
    const totalSatang = shares!.reduce((sum, s) => sum + s.satang, 0);
    expect(totalSatang).toBe(10000);
  });

  it("distributes remainder satang based on order of participants", () => {
    // 100.00 split among bob, alice, carol
    const participants = ["bob", "alice", "carol"];
    const shares = calculateEqualSplit("100.00", participants);

    expect(shares).toEqual([
      { username: "bob", amount: "33.34", satang: 3334 },
      { username: "alice", amount: "33.33", satang: 3333 },
      { username: "carol", amount: "33.33", satang: 3333 },
    ]);
  });

  it("handles remainder of 2 satang (e.g. 100.01 split across 3 members)", () => {
    // 100.01 = 10001 satang / 3 = 3333 with remainder 2
    // 1st gets 33.34, 2nd gets 33.34, 3rd gets 33.33
    const shares = calculateEqualSplit("100.01", ["alice", "bob", "carol"]);
    expect(shares).toEqual([
      { username: "alice", amount: "33.34", satang: 3334 },
      { username: "bob", amount: "33.34", satang: 3334 },
      { username: "carol", amount: "33.33", satang: 3333 },
    ]);
  });

  it("splits evenly when there is no remainder", () => {
    const shares = calculateEqualSplit("100.00", ["alice", "bob"]);
    expect(shares).toEqual([
      { username: "alice", amount: "50.00", satang: 5000 },
      { username: "bob", amount: "50.00", satang: 5000 },
    ]);
  });

  it("returns null when participants is empty or amount is invalid", () => {
    expect(calculateEqualSplit("100.00", [])).toBeNull();
    expect(calculateEqualSplit("invalid", ["alice"])).toBeNull();
  });
});

describe("money utilities - validateExactSplit", () => {
  it("validates exact match correctly (1000.00 = 500.00 + 300.00 + 200.00)", () => {
    const shares = {
      alice: "500.00",
      bob: "300.00",
      carol: "200.00",
    };
    const members = ["alice", "bob", "carol"];
    const result = validateExactSplit("1000.00", shares, members);
    expect(result.isValid).toBe(true);
    expect(result.assignedSatang).toBe(100000);
    expect(result.remainingSatang).toBe(0);
    expect(result.errorMessage).toBeUndefined();
  });

  it("detects under-allocation (sum < total)", () => {
    const shares = {
      alice: "500.00",
      bob: "300.00",
    };
    const members = ["alice", "bob"];
    const result = validateExactSplit("1000.00", shares, members);
    expect(result.isValid).toBe(false);
    expect(result.assignedSatang).toBe(80000);
    expect(result.remainingSatang).toBe(20000); // 200.00 unallocated
    expect(result.errorMessage).toContain("ยังแบ่งไม่ครบ: เหลืออีก 200.00 บาท");
  });

  it("detects over-allocation (sum > total)", () => {
    const shares = {
      alice: "600.00",
      bob: "500.00",
    };
    const members = ["alice", "bob"];
    const result = validateExactSplit("1000.00", shares, members);
    expect(result.isValid).toBe(false);
    expect(result.assignedSatang).toBe(110000);
    expect(result.remainingSatang).toBe(-10000); // 100.00 over
    expect(result.errorMessage).toContain("แบ่งเกินยอดรวม 100.00 บาท");
  });

  it("rejects non-positive share amounts", () => {
    const shares = {
      alice: "100.00",
      bob: "0.00",
    };
    const members = ["alice", "bob"];
    const result = validateExactSplit("100.00", shares, members);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBe("ยอดของสมาชิกทุกคนต้องมากกว่า 0");
  });
});
