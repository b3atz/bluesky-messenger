// File: frontend/app/layout.tsx
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Metadata must be in a separate file or removed from client components
export const metadata = {
  title: "Bluesky Messenger",
  description: "Private messaging for Bluesky",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}