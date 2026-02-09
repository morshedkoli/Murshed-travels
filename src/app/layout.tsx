import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ToastProvider } from '@/components/ui/toast';

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Murshed Travels Dashboard",
  description: "Travel agency management system",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key='murshed-travels:theme-mode';var saved=localStorage.getItem(key);var mode=(saved==='light'||saved==='dark'||saved==='system')?saved:'system';var isDark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${manrope.variable} bg-background text-text-primary`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
