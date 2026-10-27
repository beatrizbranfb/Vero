import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Nunito } from "next/font/google";

import { MenuTelas } from "@/components/MenuTelas";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Vero",
  description: "Gestão financeira simples, acessível e sem linguagem contábil.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7C3AED",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${nunito.variable} ${atkinson.variable}`}>
        <MenuTelas />
        {children}
      </body>
    </html>
  );
}
