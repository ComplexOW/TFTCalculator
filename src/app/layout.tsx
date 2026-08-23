import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavigation } from "@/components/navigation/AppNavigation";
import { TftDataProvider } from "@/components/data/tft-data-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import data from "@/data/tft-set.json";
import type { TftSet } from "@/data/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TFT Lab",
    template: "%s | TFT Lab",
  },
  description: "Build Teamfight Tactics comps and explore champion damage scenarios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider delay={150}>
          <TftDataProvider initialData={data as unknown as TftSet}>
            <AppNavigation />
            <div id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
              {children}
            </div>
          </TftDataProvider>
        </TooltipProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
