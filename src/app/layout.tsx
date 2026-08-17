import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "tim-tickets",
  description: "Personal issue tracker",
  appleWebApp: {
    capable: true,
    title: "tim-tickets",
    statusBarStyle: "black",
  },
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      {/* Below lg, the app shell isn't clamped to the viewport — the page grows with its
          content and scrolls normally, so the footer scrolls into view instead of being
          permanently pinned to the bottom. lg and up keeps the fixed-height shell with each
          page's own internal scroll container. */}
      <body className="flex min-h-dvh flex-col lg:h-full">{children}</body>
    </html>
  );
}
