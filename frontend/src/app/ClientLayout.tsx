// File: frontend/app/ClientLayout.tsx
'use client';

import { Inter } from "next/font/google";
import { AuthProvider } from "../contexts/AuthContext";
import { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={`${inter.variable}`}>
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}