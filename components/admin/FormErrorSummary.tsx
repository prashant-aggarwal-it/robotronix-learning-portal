"use client";
import type {FormIssue} from "@/lib/form-errors";

export function FormErrorSummary({issues}:{issues:FormIssue[]}){
 if(!issues.length)return null;
 return <div role="alert" className="errorBanner" style={{margin:"12px 0",padding:14}}>
  <strong>Review the following fields before saving:</strong>
  <ul style={{margin:"8px 0 0",paddingLeft:22}}>
   {issues.map(x=><li key={x.field}><button type="button" style={{background:"none",border:0,padding:0,textDecoration:"underline",cursor:"pointer",color:"inherit",textAlign:"left"}} onClick={()=>{const el=document.getElementById("field-"+x.field);el?.scrollIntoView({behavior:"smooth",block:"center"});el?.focus()}}>{x.message}</button></li>)}
  </ul>
 </div>;
}
