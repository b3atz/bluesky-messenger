// frontend/app/layout.tsx
import { Inter } from "next/font/google";
import { AuthProvider } from "contexts/AuthContext";

// Import global CSS
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
      <head>
        {/* Add direct link to CSS */}
        <link href="/styles.css" rel="stylesheet" />
      </head>
      <body className={`${inter.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}