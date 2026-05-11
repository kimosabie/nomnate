import type { Metadata } from "next";
import { Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { InstallPrompt } from "@/components/InstallPrompt";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "NomNate — Family meal planning",
  description: "Plan your family's weekly meals together with voting, AI suggestions, and SA store shopping lists.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NomNate",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-96.png", type: "image/png", sizes: "96x96" },
    ],
    apple: "/icons/icon-192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#E8621A",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${plusJakarta.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
