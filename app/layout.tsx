import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Desk",
  description:
    "Weather-triggered lead generation for FieldSense: county weather in, scored and drafted opportunities out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
