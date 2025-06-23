import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GenesisBet - Premier Crypto Casino",
  description: "Experience the future of online gambling with provably fair games, instant crypto deposits, and massive jackpots.",
  keywords: "crypto casino, bitcoin gambling, provably fair, online casino, crash game, dice game",
  authors: [{ name: "GenesisBet" }],
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
  openGraph: {
    title: "GenesisBet - Premier Crypto Casino",
    description: "Experience the future of online gambling with provably fair games, instant crypto deposits, and massive jackpots.",
    type: "website",
    locale: "en_US",
    siteName: "GenesisBet",
  },
  twitter: {
    card: "summary_large_image",
    title: "GenesisBet - Premier Crypto Casino",
    description: "Experience the future of online gambling with provably fair games, instant crypto deposits, and massive jackpots.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-900 text-white antialiased`}>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

