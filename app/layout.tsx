import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./schedule-unified.css";
import {GridHorizontalScrollBridge} from "@/components/admin/GridHorizontalScrollBridge";
import {productionConfigurationError} from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL("https://portal.robotronixstemlab.com"),
  applicationName: "Robotronix™ Learning Portal",
  title: {
    default: "Robotronix™ Learning Portal",
    template: "%s | Robotronix™ Learning Portal",
  },
  description:
    "Secure learning and operations portal for Robotronix™ families, learners, trainers and administrators.",
  keywords: [
    "Robotronix",
    "Robotronix STEM Lab",
    "STEM education",
    "robotics education",
    "coding classes",
    "Arduino training",
    "online robotics classes",
    "student learning portal",
    "trainer portal",
    "parent learning portal",
  ],
  creator: "Robotronix™",
  publisher: "Robotronix™",
  category: "education",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" data-portal-theme="ai-flow">
      <body>{productionConfigurationError ? <main className="loginShell"><section className="card"><h1>Portal configuration required</h1><p>The production portal is not connected to its database. Contact the Robotronix administrator.</p></section></main> : <>{children}<GridHorizontalScrollBridge/></>}</body>
    </html>
  );
}
