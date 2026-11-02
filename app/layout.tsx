import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Bagdar — өз бағытыңды тап",
  description:
    "Қызығушылықтарыңды таны. Мүмкіндіктеріңді аш. Өз болашағыңа алғашқы қадам жаса.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="kk" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
