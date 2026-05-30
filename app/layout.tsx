import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almanac — Pin-anchored feedback for any web page",
  description:
    "Upload an HTML page, share a link, and let your team drop pinned feedback exactly where it matters.",
  keywords: [
    "feedback",
    "design review",
    "comments",
    "html",
    "collaboration",
    "figma alternative",
  ],
  openGraph: {
    title: "Almanac — Pin-anchored feedback for any web page",
    description:
      "Upload an HTML page, share a link, and let your team drop pinned feedback exactly where it matters.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
