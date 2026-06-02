import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Sen } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  display: "swap",
});

const senLogo = Sen({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-logo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stacca",
  description: "Registro ore — Corzano e Paterno",
  applicationName: "Stacca",
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={`${bricolage.variable} ${senLogo.variable}`}>
      <body className={bricolage.className}>{children}</body>
    </html>
  );
}
