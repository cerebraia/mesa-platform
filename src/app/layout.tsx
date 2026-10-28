import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { Nunito } from "next/font/google";

const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa — Tu catálogo digital",
  description: "Organiza tu catálogo con fotos, precios y opciones. Personalízalo con tu marca y comparte un enlace para que tus clientes descubran lo que ofreces.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${poppins.variable} ${nunito.variable}`}>{children}</body>
    </html>
  );
}
