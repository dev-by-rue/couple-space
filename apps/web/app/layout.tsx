import type { Metadata, Viewport } from "next";
import { Figtree, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { ThemeLab } from "@/components/dev/theme-lab";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const brico = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeLabEnabled = process.env.NEXT_PUBLIC_THEME_LAB === "1";

export const metadata: Metadata = {
  title: "Couple Space",
  description: "Private couple space",
  applicationName: "Couple Space",
  appleWebApp: {
    capable: true,
    title: "Couple Space",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F3F0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-palette="harbor"
      className={cn(
        "h-full antialiased font-sans",
        figtree.variable,
        brico.variable,
        geistMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
        {themeLabEnabled ? <ThemeLab /> : null}
      </body>
    </html>
  );
}
