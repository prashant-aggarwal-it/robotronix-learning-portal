"use client";
import {useState} from "react";

type Payout = {accountHolderName?:string;bankName?:string;accountNumber?:string;ifsc?:string;upiId?:string;pan?:string;preferredPayoutMethod?:string};
type Request = Payout & {id:string;status:string;submittedAt:string;trainerNote?:string;adminNote?:string};
type Props={request:Request;approved:Payout|null;onDecision:(id:string,action:"approve"|"request_correction"|"reject",note:string)=>Promise<{ok:boolean;error?:string}>};
const fields:Array<{key:keyof Payout;label:string;sensitive?:boolean}>=[
 {key:"preferredPayoutMethod",label:"Payment method"},{key:"accountHolderName",label:"Account holder"},
 {key:"bankName",label:"Bank"},{key:"accountNumber",label:"Account number",sensitive:true},
 {key:"ifsc",label:"IFSC"},{key:"upiId",label:"UPI ID",sensitive:true},{key:"pan",label:"PAN",sensitive:true}
];
function conceal(value:string,key:string){
 if(!value)return "Not provided";
 if(key==="accountNumber"||key==="pan")return "••••"+value.slice(-4);
 if(key==="upiId"){const at=value.indexOf("@");return value.slice(0,2)+"••••"+(at>=0?value.slice(at):"");}
 return value;
}
export function PayoutReview({request,approved,onDecision}:Props){
 const[showFull,setShowFull]=useState(false);
 const[note,setNote]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState("");
 const[confirm,setConfirm]=useState(false);
 const[decision,setDecision]=useState<"approve"|"request_correction"|"reject">("approve");
 const changed=fields.filter(f=>String(approved?.[f.key]||"")!==String(request[f.key]||""));
 const pending=request.status==="pending";
 async function submit(){
  if((decision==="request_correction"||decision==="reject")&&!note.trim()){setError("Please explain what the trainer needs to correct.");return;}
  setBusy(true);setError("");
  try{
   const result=await onDecision(request.id,decision,note.trim());
   if(!result.ok){setError(result.error||"Unable to save this decision");return;}
   setConfirm(false);setNote("");
  }catch{setError("Request could not be reviewed. Try again.");}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Trainer payout change request">
  <div className="panelHeader"><div><b>{pending?"Awaiting finance review":request.status.replaceAll("_"," ")}</b><p className="cellSub">Submitted {new Date(request.submittedAt).toLocaleString("en-IN")} · {changed.length} changed field(s)</p></div>
  <button type="button" className="button ghost smallButton" onClick={()=>setShowFull(x=>!x)}>{showFull?"Mask sensitive values":"Reveal for authorized review"}</button></div>
  <div style={{overflowX:"auto"}}>
   <table style={{width:"100%",borderCollapse:"collapse"}}>
    <thead><tr><th style={{textAlign:"left",padding:"8px"}}>Field</th><th style={{textAlign:"left",padding:"8px"}}>Approved on file</th><th style={{textAlign:"left",padding:"8px"}}>Trainer's proposed change</th></tr></thead>
    <tbody>{fields.map(f=>{
      const oldValue=String(approved?.[f.key]||"");
      const newValue=String(request[f.key]||"");
      const isChanged=oldValue!==newValue;
      const display=(s:string)=>f.sensitive&&!showFull?conceal(s,String(f.key)):s||"Not provided";
      return <tr key={f.key} style={{background:isChanged?"var(--surface-soft, #f7f4ff)":"transparent"}}>
       <th scope="row" style={{padding:"8px",textAlign:"left"}}>{f.label}{isChanged?" · Changed":""}</th>
       <td style={{padding:"8px",overflowWrap:"anywhere"}}>{display(oldValue)}</td>
       <td style={{padding:"8px",overflowWrap:"anywhere"}}>{display(newValue)}</td>
      </tr>;
     })}</tbody>
   </table>
  </div>
  {request.trainerNote&&<p className="cellSub">Trainer's note: {request.trainerNote}</p>}
  {request.adminNote&&<p className="cellSub">Previous Admin note: {request.adminNote}</p>}
  {pending&&<div className="formStack">
    <p className="cellSub">Approval authorizes use of these details only under the configured payroll cutoff policy. It is not independent bank-account verification.</p>
    <label>Review decision<select className="input" value={decision} onChange={e=>{setDecision(e.target.value as typeof decision);setConfirm(false);setError("");}}><option value="approve">Accept submitted details</option><option value="request_correction">Request correction</option><option value="reject">Reject change</option></select></label>
    <label>Reason / internal review note<textarea className="input" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder={decision==="approve"?"Optional review note":"Required: what needs to be corrected?"}/></label>
    {error&&<div role="alert" className="errorBanner">{error}</div>}
    {!confirm?<button className="button smallButton" type="button" onClick={()=>{setConfirm(true);setError("");}}>Review decision</button>:<div className="formActions">
     <span>Confirm {decision.replaceAll("_"," ")}?</span>
     <button className="button smallButton" type="button" disabled={busy} onClick={submit}>{busy?"Saving…":"Confirm decision"}</button>
     <button className="button ghost smallButton" type="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button>
    </div>}
   </div>}
 </section>;
}
