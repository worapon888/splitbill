/**
 * Integer-satang financial arithmetic utilities.
 *
 * Requirements:
 * 1. Strictly forbid JavaScript floating-point arithmetic (0.1 + 0.2 === 0.30000000000000004).
 * 2. 1 THB = 100 integer satang.
 * 3. Exact string-based decimal parsing and formatting.
 * 4. Deterministic order-based remainder satang distribution.
 */

const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a monetary string into integer satang without using parseFloat or Number math.
 * Returns null if the input is empty, negative, has >2 decimals, or contains invalid characters.
 */
export function parseToSatang(amountStr: string): number | null {
  if (typeof amountStr !== "string") return null;
  const trimmed = amountStr.trim();
  if (!trimmed || !MONEY_REGEX.test(trimmed)) {
    return null;
  }

  const [bahtPart, satangPart] = trimmed.split(".");
  const baht = parseInt(bahtPart, 10);
  if (Number.isNaN(baht)) return null;

  let satang = 0;
  if (satangPart !== undefined) {
    if (satangPart.length === 1) {
      satang = parseInt(satangPart + "0", 10);
    } else if (satangPart.length === 2) {
      satang = parseInt(satangPart, 10);
    }
  }

  return baht * 100 + satang;
}

/**
 * Format integer satang into a standard 2-decimal monetary string (e.g. 10000 -> "100.00", -1667 -> "-16.67").
 */
export function satangToString(satang: number): string {
  const isNegative = satang < 0;
  const absSatang = Math.abs(satang);
  const baht = Math.floor(absSatang / 100);
  const rem = absSatang % 100;
  const sign = isNegative ? "-" : "";
  return `${sign}${baht}.${rem.toString().padStart(2, "0")}`;
}

/**
 * Format monetary string or satang into Thai formatted currency with comma grouping (e.g. "1,000.00").
 */
export function formatThaiCurrency(
  value: string | number,
  prefix = "",
): string {
  let satang: number | null;
  if (typeof value === "number") {
    satang = value;
  } else {
    // Check if value is signed string like "-33.33"
    const isNegative = value.trim().startsWith("-");
    const absStr = value.trim().replace(/^-/, "");
    const parsed = parseToSatang(absStr);
    if (parsed === null) return value;
    satang = isNegative ? -parsed : parsed;
  }

  const isNegative = satang < 0;
  const absSatang = Math.abs(satang);
  const baht = Math.floor(absSatang / 100);
  const rem = absSatang % 100;

  // Insert thousands commas into baht integer part
  const bahtFormatted = baht.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = `${bahtFormatted}.${rem.toString().padStart(2, "0")}`;
  const sign = isNegative ? "-" : "";

  return `${sign}${prefix}${formatted}`;
}

export interface EqualSplitShare {
  username: string;
  amount: string; // e.g. "33.34"
  satang: number;
}

/**
 * Divide total amount equally among members allocating remaining satang (0.01 at a time)
 * to members in the exact order specified.
 */
export function calculateEqualSplit(
  totalAmountStr: string,
  members: string[],
): EqualSplitShare[] | null {
  if (members.length === 0) return null;
  const totalSatang = parseToSatang(totalAmountStr);
  if (totalSatang === null || totalSatang <= 0) return null;

  const n = members.length;
  const baseSatang = Math.floor(totalSatang / n);
  const remainderSatang = totalSatang % n;

  return members.map((member, index) => {
    const shareSatang = baseSatang + (index < remainderSatang ? 1 : 0);
    return {
      username: member,
      amount: satangToString(shareSatang),
      satang: shareSatang,
    };
  });
}

export interface ExactSplitValidation {
  totalSatang: number | null;
  assignedSatang: number;
  remainingSatang: number | null;
  assignedAmount: string;
  remainingAmount: string;
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Validate exact split shares against the total amount using exact satang arithmetic.
 */
export function validateExactSplit(
  totalAmountStr: string,
  shares: Record<string, string>,
  selectedMembers: string[],
): ExactSplitValidation {
  const totalSatang = parseToSatang(totalAmountStr);
  let assignedSatang = 0;
  let hasEmptyOrInvalidShare = false;

  for (const member of selectedMembers) {
    const shareStr = (shares[member] || "").trim();
    if (!shareStr) {
      hasEmptyOrInvalidShare = true;
      continue;
    }
    const shareSatang = parseToSatang(shareStr);
    if (shareSatang === null || shareSatang <= 0) {
      hasEmptyOrInvalidShare = true;
      continue;
    }
    assignedSatang += shareSatang;
  }

  const assignedAmount = satangToString(assignedSatang);

  if (totalSatang === null || totalSatang <= 0) {
    return {
      totalSatang: null,
      assignedSatang,
      remainingSatang: null,
      assignedAmount,
      remainingAmount: "0.00",
      isValid: false,
      errorMessage: "กรุณากรอกยอดรวมที่มากกว่า 0 ให้ถูกต้อง",
    };
  }

  const remainingSatang = totalSatang - assignedSatang;
  const remainingAmount = satangToString(remainingSatang);

  if (selectedMembers.length === 0) {
    return {
      totalSatang,
      assignedSatang: 0,
      remainingSatang,
      assignedAmount: "0.00",
      remainingAmount,
      isValid: false,
      errorMessage: "กรุณาเลือกสมาชิกอย่างน้อย 1 คน",
    };
  }

  if (hasEmptyOrInvalidShare) {
    return {
      totalSatang,
      assignedSatang,
      remainingSatang,
      assignedAmount,
      remainingAmount,
      isValid: false,
      errorMessage: "ยอดของสมาชิกทุกคนต้องมากกว่า 0",
    };
  }

  if (remainingSatang !== 0) {
    return {
      totalSatang,
      assignedSatang,
      remainingSatang,
      assignedAmount,
      remainingAmount,
      isValid: false,
      errorMessage:
        remainingSatang > 0
          ? `ยังแบ่งไม่ครบ: เหลืออีก ${remainingAmount} บาท`
          : `แบ่งเกินยอดรวม ${satangToString(Math.abs(remainingSatang))} บาท`,
    };
  }

  return {
    totalSatang,
    assignedSatang,
    remainingSatang: 0,
    assignedAmount,
    remainingAmount: "0.00",
    isValid: true,
  };
}
