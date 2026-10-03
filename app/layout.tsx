import type { Metadata } from "next";
import "./globals.css";
import {GridHorizontalScrollBridge} from "@/components/admin/GridHorizontalScrollBridge";
import {productionConfigurationError} from "@/lib/config";

export const metadata: Metadata = {
  title: "Robotronix™ Learning Portal",
  description: "Secure learning and operations portal for Robotronix™ families, learners, trainers and administrators.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{productionConfigurationError ? <main className="loginShell"><section className="card"><h1>Portal configuration required</h1><p>The production portal is not connected to its database. Contact the Robotronix administrator.</p></section></main> : <>{children}<GridHorizontalScrollBridge/></>}</body>
    </html>
  );
}
