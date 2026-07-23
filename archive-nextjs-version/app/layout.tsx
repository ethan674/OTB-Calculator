import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTB Planner",
  description: "Open-to-Buy budget planning tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
