import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// preload: false — event pages use their own font, so they shouldn't download Inter (the admin still uses it).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "Event Registration",
  description: "Register for events",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
