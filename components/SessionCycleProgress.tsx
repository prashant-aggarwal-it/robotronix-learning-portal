import React from "react";

/** Attendance-cycle math is independent of course-hour progress. */
export function sessionCycleInfo(attended:number,total:number,blockSize=8){
 const safeAttended=Math.max(0,attended||0),safeTotal=Math.max(0,total||0);
 const capped=safeTotal?Math.min(safeAttended,safeTotal):safeAttended;
 const completedCycles=Math.floor(capped/blockSize);
 const remainder=capped%blockSize;
 const nextMilestone=(completedCycles+1)*blockSize;
 return {capped,safeTotal,completedCycles,remainder,nextMilestone};
}
const fmt=(n:number)=>Number(n.toFixed(2)).toLocaleString("en-IN",{maximumFractionDigits:2});
/** Primary target and progress always describe verified *instructional hours*, not class counts. */
export function SessionCycleProgress({hoursCompleted,plannedHours,attendedClasses,compact=false}:{hoursCompleted?:number;plannedHours?:number;attendedClasses?:number;compact?:boolean}){
 const known=typeof hoursCompleted==="number"&&Number.isFinite(hoursCompleted);
 const hours=Math.max(0,known?Number(hoursCompleted):0),total=Math.max(0,Number(plannedHours)||0);
 const remaining=Math.max(0,total-hours);
 const pct=total>0?Math.min(100,hours/total*100):0;
 const pctLabel=Number(pct.toFixed(1));
 const markers:number[]=[];
 if(total>0){const step=total<=16?4:8;for(let h=step;h<total;h+=step)markers.push(h);markers.push(total)}
 if(compact)return <div className="sessionCycleProgress compact"><b>{known?`${fmt(hours)} / ${fmt(total)} hrs`:"Hours not verified"}</b><div className="cellSub">{total>0?`${fmt(remaining)} instructional hours remaining`:"Instructional-hour target not set"}</div><div className="miniProgress"><span style={{width:`${pct}%`}}/></div>{typeof attendedClasses==="number"&&<small className="cellSub">{attendedClasses} classes attended</small>}</div>;
 return <div className="sessionCycleProgress hoursProgress">
  <div className="sessionCycleTop"><div><span>Course progress · instructional hours</span><b>{known?`${fmt(hours)} of ${fmt(total)} hours completed`:"Delivered hours awaiting verification"}</b><small>{total>0?`${fmt(remaining)} hours remaining`:"Set the total instructional hours in Course Setup."}</small></div><strong>{total>0?`${pctLabel}%`:"—"}</strong></div>
  <div className="milestoneTrack" aria-label={`${pctLabel}% of instructional hours complete`}><span className="milestoneFill" style={{width:`${pct}%`}}/>{markers.map(m=><i className={known&&hours>=m?"reached":""} key={m} style={{left:`${Math.min(100,m/total*100)}%`}} title={`${fmt(m)} instructional hours`}><em>{fmt(m)} h</em></i>)}</div>
  {typeof attendedClasses==="number"&&<div className="sessionCycleBand attendanceOnly"><div><span>Attendance reference · classes attended</span><b>{attendedClasses} classes</b></div><small>Class counts are separate from delivered instructional hours and billing.</small></div>}
 </div>;
}
