import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FARLANDS — Submission & Review",
  description: "VISHWAKARMA FARLANDS private presentation review portal",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
