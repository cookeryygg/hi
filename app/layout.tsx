import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "Hi — First Contact",
    description: "A playable first-person hello from the edge of the web.",
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: "Hi — First Contact",
      description: "A playable first-person hello from the edge of the web.",
      type: "website",
      images: [
        {
          url: `${baseUrl}/og-game.png`,
          width: 1731,
          height: 909,
          alt: "First Contact browser FPS.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hi — First Contact",
      description: "A playable first-person hello from the edge of the web.",
      images: [`${baseUrl}/og-game.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
