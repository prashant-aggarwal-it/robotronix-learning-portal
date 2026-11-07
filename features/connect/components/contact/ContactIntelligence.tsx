"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
export type ContactInsight={
 person_id:string;name:string;enquiry_count:number;first_enquiry_at:string|null;last_enquiry_at:string|null;
 open_tasks:number;overdue_tasks:number;next_followup_at:string|null;upcoming_appointments:number;
 open_opportunities:number;won_opportunities:number;has_owner:boolean;last_interaction_at:string|null;priority:number;
};
type Payload={ok:true;items:ContactInsight[];asOf:string;scope:string};
function daysSince(date:string|null,asOf:string){if(!date)return null;const n=Math.floor((new Date(asOf).getTime()-new Date(date).getTime())/86400000);return Number.isFinite(n)?Math.max(0,n):null;}
function when(date:string|null){if(!date)return "No recorded activity";return new Date(date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});}
function guidance(v:ContactInsight,asOf:string){
 const days=daysSince(v.last_interaction_at,asOf);
 const results:Array<{type:"urgent"|"attention"|"info";title:string;why:string;next:string}>=[];
 if(v.overdue_tasks>0)results.push({type:"urgent",title:v.overdue_tasks+" overdue follow-up"+(v.overdue_tasks===1?"":"s"),why:"Open tasks have due dates before now.",next:"Review overdue tasks and schedule the next contact."});
 if(v.open_opportunities>0&&v.open_tasks===0&&v.upcoming_appointments===0)
  results.push({type:"attention",title:"No next step scheduled",why:"There is an active opportunity, but no open task or upcoming appointment.",next:"Create a follow-up or book a demo."});
 if(v.open_opportunities>0&&days!==null&&days>=7)
  results.push({type:"attention",title:"No recent recorded interaction",why:"Latest recorded activity was "+days+" days ago.",next:"Review the conversation history and reconnect when appropriate."});
 if(v.enquiry_count>0&&!v.has_owner)
  results.push({type:"info",title:"Contact owner unassigned",why:"This contact has an enquiry but no dedicated contact owner.",next:"Ask a manager to assign a team member."});
 if(v.open_tasks>0&&v.next_followup_at)results.push({type:"info",title:"Next follow-up scheduled",why:"Next due: "+when(v.next_followup_at)+".",next:"Review the planned action."});
 if(!results.length)results.push({type:"info",title:"No immediate rule-based alerts",why:"No overdue follow-up or missing next step was detected in the recorded CRM data.",next:"Review the contact history as needed."});
 return results;
}
function useIntelligence(tenantId:string,personId:string|null,refreshKey:number,limit:number){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const generation=useRef(0);
 const load=useCallback(async()=>{
  const n=++generation.current;setLoading(true);setError("");
  try{
   const q=new URLSearchParams({limit:String(limit)});if(personId)q.set("personId",personId);
   const response=await connectFetch<Payload>("/api/connect/workspaces/"+encodeURIComponent(tenantId)+"/intelligence?"+q);
   if(n===generation.current)setData(response);
  }catch(e){if(n===generation.current)setError(e instanceof Error?e.message:"Intelligence summary unavailable.");}
  finally{if(n===generation.current)setLoading(false);}
 },[tenantId,personId,limit]);
 useEffect(()=>{setData(null);void load();return()=>{generation.current++;};},[load,refreshKey]);
 return {data,loading,error,load};
}
export function ContactIntelligence({tenantId,personId,refreshKey,onOpenFollowups,onOpenRelations}:{
 tenantId:string;personId:string;refreshKey:number;onOpenFollowups:()=>void;onOpenRelations:()=>void;
}){
 const {data,loading,error,load}=useIntelligence(tenantId,personId,refreshKey,1);
 const insight=data?.items[0],asOf=data?.asOf||new Date().toISOString();
 return <section className="cx-contact-intelligence">
  <div className="cx-intel-head"><div><span className="cx-kicker">CONTACT INTELLIGENCE</span><h3>What needs attention?</h3><p>Explainable recommendations based on recorded CRM activity—not AI predictions.</p></div>
   <button type="button" className="cx-secondary" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
  {loading?<p className="cx-insight-empty" role="status">Checking contact activity…</p>:error?<p className="cx-alert" role="alert">{error}</p>:!insight?<p className="cx-insight-empty">No contact information available.</p>:<>
   <div className="cx-intel-health"><span className={"cx-intel-health-pill "+(insight.priority>=3?"needs-action":insight.priority>0?"review":"clear")}>{insight.priority>=3?"Follow-up needs attention":insight.priority>0?"Review suggested":"No immediate alerts"}</span><small>{daysSince(insight.last_enquiry_at,asOf)===null?"No enquiry recorded":daysSince(insight.last_enquiry_at,asOf)+" days since latest enquiry"}</small></div>
   <div className="cx-intel-facts">
    <span><strong>{insight.enquiry_count}</strong> Enquiries</span>
    <span><strong>{insight.open_opportunities}</strong> Active opportunities</span>
    <span><strong>{insight.open_tasks}</strong> Open follow-ups</span>
    <span><strong>{insight.upcoming_appointments}</strong> Upcoming appointments</span>
   </div>
   <div className="cx-intel-digest"><strong>Contact summary</strong><p>{insight.name} has {insight.enquiry_count} recorded {insight.enquiry_count===1?"enquiry":"enquiries"}, {insight.open_opportunities} active opportunity{insight.open_opportunities===1?"":"ies"}, and {insight.open_tasks} open follow-up{insight.open_tasks===1?"":"s"}. Last recorded interaction: {when(insight.last_interaction_at)}.</p></div>
   <div className="cx-intel-advice">{guidance(insight,asOf).map((item,i)=><article className={"cx-intel-advice-item cx-intel-"+item.type} key={i}><strong>{item.title}</strong><p>{item.why}</p><small>Suggested action: {item.next}</small></article>)}</div>
   <div className="cx-intel-actions"><button className="cx-secondary" onClick={onOpenFollowups} type="button">Open follow-ups</button><button className="cx-secondary" onClick={onOpenRelations} type="button">View ownership</button></div>
  </>}
 </section>;
}
export function WorkspaceIntelligence({tenantId,refreshKey,onOpenContact,onViewAll}:{
 tenantId:string;refreshKey:number;onOpenContact:(personId:string)=>void;onViewAll?:()=>void;
}){
 const {data,loading,error,load}=useIntelligence(tenantId,null,refreshKey,50);
 const asOf=data?.asOf||new Date().toISOString();
 const flagged=(data?.items||[]).filter(x=>x.priority>0);
 return <section className="cx-insight-panel cx-intelligence-board">
  <div className="cx-insight-panel-heading"><div><h3>Contacts needing attention</h3><p>Top 5 rule-based priorities from up to 50 checked contacts</p></div><div className="cx-overview-actions">{onViewAll&&<button type="button" onClick={onViewAll}>View contacts ↗</button>}<button type="button" onClick={()=>void load()} disabled={loading}>Refresh</button></div></div>
  {loading?<p className="cx-insight-empty" role="status">Checking contact priorities…</p>:error?<p className="cx-alert" role="alert">{error}</p>:
   flagged.length===0?<p className="cx-insight-empty">No follow-up gaps or overdue contacts identified among the contacts checked.</p>:
   <div className="cx-intel-board-rows">{flagged.slice(0,5).map(c=><button className="cx-intel-board-row" type="button" key={c.person_id} onClick={()=>onOpenContact(c.person_id)}>
    <span className={"cx-intel-dot "+(c.priority>=4?"urgent":"")}/>
    <span><strong>{c.name}</strong><small>{guidance(c,asOf)[0].title} · Latest contact {when(c.last_interaction_at)}</small></span>
    <span aria-hidden="true">›</span>
   </button>)}</div>}
  <p className="cx-timeline-note">Rules-based operational reminders; not lead-quality predictions or automated outreach.</p>
 </section>;
}
