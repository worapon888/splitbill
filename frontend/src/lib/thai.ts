const GROUP_NAME_TRANSLATIONS: Record<string, string> = {
  "Chiang Mai trip": "ทริปเชียงใหม่",
  "Office lunch": "มื้อกลางวันที่ออฟฟิศ",
};

const API_ERROR_TRANSLATIONS: Record<string, string> = {
  "Not a member of this group": "คุณไม่ได้เป็นสมาชิกของกลุ่มนี้",
  "Group not found": "ไม่พบกลุ่มนี้",
  "Expense not found": "ไม่พบรายการค่าใช้จ่ายนี้",
  "Only the payer can delete this expense": "เฉพาะคนที่ออกเงินเท่านั้นที่ลบรายการนี้ได้",
  "Payer is not a member of this group": "คนที่ออกเงินไม่ได้เป็นสมาชิกของกลุ่มนี้",
  "The shares do not add up to the total": "ยอดที่แบ่งรวมกันไม่เท่ากับยอดค่าใช้จ่ายทั้งหมด",
  "Idempotency key reused with different request payload":
    "ไม่สามารถส่งคำขอเดิมซ้ำด้วยข้อมูลที่แตกต่างกันได้",
  "Database connection failed": "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
};

export function getThaiGroupName(name: string): string {
  return GROUP_NAME_TRANSLATIONS[name] ?? name;
}

export function getThaiApiError(detail: string): string {
  const exactTranslation = API_ERROR_TRANSLATIONS[detail];
  if (exactTranslation) return exactTranslation;

  const userNotFound = detail.match(/^User '(.+)' not found\.?$/);
  if (userNotFound) return `ไม่พบผู้ใช้ '${userNotFound[1]}'`;

  const payerNotMember = detail.match(
    /^Payer '(.+)' is not a member of this group\.?$/,
  );
  if (payerNotMember) {
    return `${payerNotMember[1]} ไม่ได้เป็นสมาชิกของกลุ่มนี้ จึงออกเงินแทนไม่ได้`;
  }

  const participantNotMember = detail.match(
    /^Participant '(.+)' is not a member of this group\.?$/,
  );
  if (participantNotMember) {
    return `${participantNotMember[1]} ไม่ได้เป็นสมาชิกของกลุ่มนี้ จึงหารด้วยกันไม่ได้`;
  }

  if (detail.startsWith("Idempotency key reused")) {
    return "ไม่สามารถส่งคำขอเดิมซ้ำด้วยข้อมูลที่แตกต่างกันได้";
  }

  return detail;
}
