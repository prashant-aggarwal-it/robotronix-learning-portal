"use client";
import {useMemo,useState} from "react";
import type {ConnectInquiry} from "@/features/connect/api/client";
import {channelColor} from "../connect-palette";

const offsetMs=5.5*60*60*1000;
function indiaDay(value:number){return new Date(value+offsetMs).toISOString().slice(0,10);}
function dayLabel(key:string){return new Date(key+"T00:00:00Z").toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"UTC"});}
function sourceLabel(source:string){return source.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase())||"Unknown";}
export function ConnectEnquiryVisualizations({inquiries,onSelectSource}:{inquiries:ConnectInquiry[];onSelectSource?:(source:string)=>void}){
 const [period,setPeriod]=useState<7|14>(14);
 const [selectedDay,setSelectedDay]=useState<string|null>(null);
 const data=useMemo(()=>{
  const today=Date.parse(indiaDay(Date.now())+"T00:00:00Z");
  const buckets=new Map<string,number>();
  for(const inquiry of inquiries){const when=Date.parse(inquiry.received_at);if(Number.isFinite(when)){const key=indiaDay(when);buckets.set(key,(buckets.get(key)||0)+1);}}
  const days=Array.from({length:period},(_,index)=>{
   const date=new Date(today-(period-index-1)*86400000).toISOString().slice(0,10);
   return {date,count:buckets.get(date)||0};
  });
  const bySource=new Map<string,number>();
  for(const item of inquiries){const source=(item.source||"unknown").toLowerCase();bySource.set(source,(bySource.get(source)||0)+1);}
  const sources=[...bySource].sort((a,b)=>b[1]-a[1]).slice(0,6);
  return {days,sources};
 },[inquiries,period]);
 const max=Math.max(1,...data.days.map(d=>d.count));
 const points=data.days.map((d,i)=>({x:34+i*(560/(period-1)),y:143-(d.count/max)*105,...d}));
 const line=points.map(p=>p.x+","+p.y).join(" ");
 const area="34,143 "+line+" 594,143";
 const sum=data.days.reduce((n,d)=>n+d.count,0);
 const totalSources=data.sources.reduce((n,s)=>n+s[1],0);
 const circumference=2*Math.PI*46;
 let running=0;
 return <section className={"cx-viz-widget"} aria-label="Enquiry activity and channel analytics">
  <div className={"cx-viz-head"}><div><h3>Enquiry insights</h3><p>Visual trends from {inquiries.length} loaded enquiries</p></div><span className={"cx-viz-label"}>Loaded records</span></div>
  <div className={"cx-viz-trend-head"}><div><strong>Enquiry activity</strong><span>{sum} enquiries in the last {period} days</span></div>
   <div className={"cx-viz-switcher"} role="group" aria-label="Enquiry chart time range">
    {([7,14] as const).map(n=><button type="button" key={n} className={period===n?"cx-viz-selected":"cx-viz-range"} aria-pressed={period===n} onClick={()=>{setPeriod(n);setSelectedDay(null);}}>{n} days</button>)}
   </div>
  </div>
  <div className={"cx-viz-chart"}>
   <svg viewBox="0 0 625 177" role="img" aria-label={"Enquiries per day over the last "+period+" days"} preserveAspectRatio="xMidYMid meet">
    {[0,1,2,3].map(i=><g key={i}><line x1="34" x2="594" y1={143-i*35} y2={143-i*35} stroke="#e5eef5" strokeDasharray={i===0?"0":"4 5"}/>
     <text x="25" y={147-i*35} textAnchor="end" fontSize="10" fill="#8ca0af">{Math.round(max*i/3)}</text></g>)}
    <polygon points={area} fill="#d9f2fc" opacity=".65"/>
    <polyline points={line} fill="none" stroke="#138cbe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map(p=><g key={p.date}><circle cx={p.x} cy={p.y} r={selectedDay===p.date?6:3.8} fill={selectedDay===p.date?"#f0a544":"#138cbe"} stroke="white" strokeWidth="2"/>
      <title>{dayLabel(p.date)+": "+p.count+" enquiries"}</title></g>)}
    <text x="34" y="166" textAnchor="start" fontSize="11" fill="#7b92a3">{dayLabel(data.days[0].date)}</text>
    <text x="594" y="166" textAnchor="end" fontSize="11" fill="#7b92a3">{dayLabel(data.days[data.days.length-1].date)}</text>
   </svg>
  </div>
  <div className={"cx-viz-day-buttons"} aria-label="Explore daily enquiry count">{data.days.map(d=><button key={d.date} type="button" aria-label={dayLabel(d.date)+": "+d.count+" enquiries"} aria-pressed={selectedDay===d.date} className={selectedDay===d.date?"cx-viz-day-active":"cx-viz-day"} onClick={()=>setSelectedDay(selectedDay===d.date?null:d.date)} title={dayLabel(d.date)+": "+d.count+" enquiries"}><span style={{height:Math.max(2,Math.round((d.count/max)*17))+"px"}}/></button>)}</div>
  {selectedDay&&<p className={"cx-viz-day-detail"}>{dayLabel(selectedDay)}: <strong>{data.days.find(d=>d.date===selectedDay)?.count||0} enquiries</strong></p>}
  <div className={"cx-viz-divider"}/>
  <div className={"cx-viz-mix-title"}><strong>Channel mix</strong><span>{totalSources} enquiries · Select a source to filter</span></div>
  {totalSources===0?<p className={"cx-viz-empty"}>No enquiries in this workspace yet.</p>:<div className={"cx-viz-mix"}>
   <svg className={"cx-viz-donut"} viewBox="0 0 140 140" role="img" aria-label="Enquiries by channel">
    <circle cx="70" cy="70" r="46" fill="none" stroke="#eef4f8" strokeWidth="16"/>
    {data.sources.map(([source,count])=>{const share=count/totalSources*circumference;const start=running;running+=share;return <circle key={source} cx="70" cy="70" r="46" fill="none" stroke={channelColor(source)} strokeWidth="16" strokeDasharray={share+" "+(circumference-share)} strokeDashoffset={-start} transform="rotate(-90 70 70)"><title>{sourceLabel(source)+": "+count}</title></circle>;})}
    <text x="70" y="69" textAnchor="middle" fill="#173951" fontSize="24" fontWeight="800">{totalSources}</text>
    <text x="70" y="84" textAnchor="middle" fill="#8193a0" fontSize="9">enquiries</text>
   </svg>
   <div className={"cx-viz-legend"}>{data.sources.map(([source,count],i)=><button type="button" key={source} className={"cx-viz-source"} onClick={()=>onSelectSource?.(source)} disabled={!onSelectSource} aria-label={"Show "+sourceLabel(source)+" enquiries"}>
    <span className={"cx-viz-source-name"}><i style={{background:channelColor(source)}}/>{sourceLabel(source)}</span><span><strong>{count}</strong><small>{Math.round(count/totalSources*100)}%</small></span>
   </button>)}</div>
  </div>}
  <p className={"cx-viz-note"}>Charts use loaded workspace records, not projected revenue or inferred conversions.</p>
 </section>;
}
