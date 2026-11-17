import {notFound} from "next/navigation";
import {BrandingStudio} from "@/features/branding/BrandingStudio";
/** DEV-only test fixture; never available in production or ordinary development. */
export default function BrandingStudioQaFixture(){
 if(process.env.NODE_ENV!=="development"||process.env.PHASE5B_UI_QA!=="1")notFound();
 return <main style={{padding:"24px",maxWidth:"1180px",margin:"0 auto"}}>
  <BrandingStudio organizations={[
   {id:"11111111-1111-4111-8111-111111111111",slug:"qa-academy-a",display_name:"QA Academy Alpha"},
   {id:"22222222-2222-4222-8222-222222222222",slug:"qa-academy-b",display_name:"QA Academy Beta"}
  ]}/>
 </main>;
}
