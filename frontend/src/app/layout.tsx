import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitBill — จัดการค่าใช้จ่ายร่วมกัน",
  description: "บันทึกค่าใช้จ่ายร่วมกันและคำนวณยอดสุทธิของสมาชิก",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
