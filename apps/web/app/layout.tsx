import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", weight: ["700"] });

export const metadata: Metadata = {
  title: "12AM",
  description: "Your fully customizable fantasy baseball platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '12AM',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} ${orbitron.variable} min-h-full bg-gray-950 text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
