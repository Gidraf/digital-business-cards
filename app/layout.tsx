import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import I18nProvider from "./components/I18nProvider";
import ToastProvider from "./components/ToastProvider";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Cards & Print — CVPAP",
    description: "Design business cards, flyers and event cards, lay them out on A4/A3 sheets, then print or save as PDF.",
    robots: { index: false },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
            </head>
            <body className="flex min-h-full flex-col" style={{ fontFamily: "'Manrope', var(--font-geist-sans), system-ui, sans-serif" }}>
                <I18nProvider>
                    <ToastProvider>
                        <Navbar />
                        <main className="flex flex-1 flex-col">{children}</main>
                    </ToastProvider>
                </I18nProvider>
            </body>
        </html>
    );
}
