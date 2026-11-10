import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const themeScript =
  '(function(){try{var dark=localStorage.getItem("boardui:theme")==="dark";document.documentElement.classList.toggle("dark",dark)}catch(e){document.documentElement.classList.remove("dark")}})();';

export const metadata: Metadata = {
  title: {
    default: "Veyra",
    template: "%s · Veyra",
  },
  description:
    "The infrastructure for programmable ownership. Assets that own, earn, interact and evolve.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background-primary-default text-text-primary">
        <Script id="boardui-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <DirectionProvider locale="en-US">
          <Providers>
            <Suspense
              fallback={
                <div className="min-h-full bg-background-secondary-default" />
              }
            >
              <Shell>{children}</Shell>
            </Suspense>
          </Providers>
        </DirectionProvider>
      </body>
    </html>
  );
}
