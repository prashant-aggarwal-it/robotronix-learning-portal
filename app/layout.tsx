import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./schedule-unified.css";
import "./typography.css";
import "./ui-foundations.css";
import "./ui-role-experiences.css";
import {GridHorizontalScrollBridge} from "@/components/admin/GridHorizontalScrollBridge";
import {GlobalEscapeDismiss} from "@/components/GlobalEscapeDismiss";
import {productionConfigurationError} from "@/lib/config";
import {getProductBrand} from "@/lib/platform/branding";

const brand=getProductBrand(process.env);
export const metadata:Metadata={
 ...(brand.appName==="Robotronix™ Learning Portal"?{metadataBase:new URL("https://portal.robotronixstemlab.com")}:{}),
 applicationName:brand.appName,
 title:{default:brand.title,template:"%s | "+brand.appName},
 description:brand.description,
 creator:"Robotronix™",
 publisher:"Robotronix™",
 category:brand.category,
 robots:{index:false,follow:false,nocache:true,
  googleBot:{index:false,follow:false,noimageindex:true}}
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" data-portal-theme="ai-flow">
      <body>{productionConfigurationError ? <main className="loginShell"><section className="card"><h1>{brand.appName} configuration required</h1><p>This application is not connected to its database. Contact your administrator.</p></section></main> : <><GlobalEscapeDismiss/>{children}<GridHorizontalScrollBridge/></>}</body>
    </html>
  );
}
