"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
type Brand={slug:string;name:string;tagline:string;logoUrl:string;accentColor:string};
export default function AcademyEntry(){
 const params=useParams<{academySlug:string}>();
 const slug=params.academySlug;
 const [brand,setBrand]=useState<Brand|null>(null);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{try{
   if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(slug))return;
   const client=getSupabaseBrowserClient();if(!client)return;
   const {data,error}=await client.rpc("saas_public_academy_brand",{p_slug:slug});
   if(live&&!error&&data)setBrand(data as Brand);
 }finally{if(live)setLoading(false);}})();return()=>{live=false};},[slug]);
 if(loading)return <main className="authPage"><section className="authCard" role="status">Loading academy…</section></main>;
 if(!brand)return <main className="authPage"><section className="authCard"><h1>Academy not found</h1><p>This academy URL is unavailable.</p><Link href="/">Robotronix Education Suite</Link></section></main>;
 return <main className="authPage"><section className="authCard" style={{textAlign:"center",borderTop:"5px solid "+brand.accentColor}}>
   {brand.logoUrl?<img src={brand.logoUrl} alt={brand.name+" logo"} style={{maxWidth:170,maxHeight:100,objectFit:"contain",margin:"0 auto 18px"}}/>:<div style={{fontSize:46,marginBottom:12}} aria-hidden="true">🎓</div>}
   <h1>{brand.name}</h1>
   <p>{brand.tagline||"Welcome to your academy learning portal."}</p>
   <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:26}}>
    <Link className="button fullButton" href={"/login?academy="+encodeURIComponent(brand.slug)}>Sign in to your academy</Link>
    <p style={{fontSize:13,color:"#66738c"}}>Admins, trainers, parents and students sign in with their existing account.</p>
   </div>
 </section></main>;
}