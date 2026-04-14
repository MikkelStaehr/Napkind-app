import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const outfit = localFont({
  src: [
    { path: "./fonts/Outfit-Light.woff2", weight: "300", style: "normal" },
  ],
  variable: "--font-outfit",
  display: "swap",
});

const boska = localFont({
  src: [
    { path: "./fonts/Boska-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-boska",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Napkind",
  description: "Det enkle booking system til din restaurant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${outfit.variable} ${boska.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-light">{children}</body>
    </html>
  );
}
