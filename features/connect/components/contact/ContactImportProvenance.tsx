"use client";
import {useEffect,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
type ImportedSource={source_type:string;source_label:string;file_name:string;company:string|null;city:string|null;notes:string|null;tags:string[]|null;source_reference:string|null;imported_at:string};
type Profile={ok:boolean;consent:string;sources:ImportedSource[]};
export function ContactImportProvenance({tenantId,personId}:{tenantId:string;personId:string}){
 const [data,setData]=useState<Profile|null>(null);
 useEffect(()=>{let alive=true;setData(null);
  void connectFetch<Profile>("/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/contacts/import/person/"+encodeURIComponent(personId))
   .then(r=>{if(alive)setData(r);}).catch(()=>{});
  return()=>{alive=false;};
 },[tenantId,personId]);
 if(!data||data.sources.length===0)return null;
 return <section className="cx-provenance" aria-label="Imported contact information">
  <header><h3>Imported contact information</h3><span>WhatsApp marketing: {data.consent==="opted_in"?"Verified opt-in":data.consent==="opted_out"?"Opted out":"Not verified"}</span></header>
  {data.sources.map((source,index)=><div className="cx-provenance-source" key={index}>
   <div><strong>{source.source_label}</strong><small>{source.source_type} · {new Date(source.imported_at).toLocaleDateString("en-IN")}</small></div>
   {(source.company||source.city)&&<p>{[source.company,source.city].filter(Boolean).join(" · ")}</p>}
   {Boolean(source.tags?.length)&&<p>Tags: {(source.tags||[]).join(", ")}</p>}
   {source.notes&&<p>{source.notes}</p>}
   {source.source_reference&&/^https:\/\//i.test(source.source_reference)&&<a href={source.source_reference} target="_blank" rel="noopener noreferrer">Source reference ↗</a>}
  </div>)}
 </section>;
}