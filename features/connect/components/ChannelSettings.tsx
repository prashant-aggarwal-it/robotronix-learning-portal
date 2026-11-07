"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {connectFetch} from "@/features/connect/api/client";
type Channel={id:string;provider:string;externalId:string;name:string;status:"active"|"inactive"|"disabled"};
type FormKey={id:string;channelId:string;label:string;active:boolean;createdAt:string};
const types=[
 {id:"website",label:"Website form",hint:"Choose any unique site identifier, e.g. academy-main-website"},
 {id:"whatsapp",label:"WhatsApp Cloud API",hint:"Enter the exact Meta phone_number_id, not the visible phone number"},
 {id:"meta_leads",label:"Meta Lead Ads",hint:"Enter the exact Facebook Page ID that receives Lead Ads"},
 {id:"email",label:"Inbound email",hint:"Enter the dedicated recipient email address, e.g. enquiries@leads.example.com"}
];
export function ChannelSettings({tenantId,canManage}:{tenantId:string;canManage:boolean}){
 const[channels,setChannels]=useState<Channel[]>([]);
 const[forms,setForms]=useState<FormKey[]>([]);
 const[provider,setProvider]=useState("website");
 const[externalId,setExternalId]=useState("");
 const[name,setName]=useState("");
 const[formLabel,setFormLabel]=useState("Website enquiries");
 const[notice,setNotice]=useState("");
 const[error,setError]=useState("");
 const[busy,setBusy]=useState(false);
 const[generated,setGenerated]=useState<{key:string;endpoint:string}|null>(null);
 const [showRegister,setShowRegister]=useState(false);
 const reload=useCallback(async()=>{
  const r=await connectFetch<{channels:Channel[]}>("/api/connect/workspaces/"+tenantId+"/channels");
  setChannels(r.channels||[]);
  if(canManage){const f=await connectFetch<{forms:FormKey[]}>("/api/connect/workspaces/"+tenantId+"/forms");setForms(f.forms||[]);}
 },[tenantId,canManage]);
 useEffect(()=>{setChannels([]);setForms([]);setGenerated(null);setNotice("");setError("");void reload().catch(e=>setError(e instanceof Error?e.message:"Could not load integrations."));},[reload]);
 async function act(task:()=>Promise<unknown>,message:string){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{await task();await reload();setNotice(message);}
  catch(e){setError(e instanceof Error?e.message:"Unable to save integration.");}
  finally{setBusy(false);}
 }
 async function create(e:FormEvent){
  e.preventDefault();
  await act(async()=>{
   await connectFetch("/api/connect/workspaces/"+tenantId+"/channels",{
    method:"POST",body:JSON.stringify({provider,externalId,name})
   });
   setName("");setExternalId("");setShowRegister(false);
  },"Channel registered. Activate after configuring its provider credentials.");
 }
 async function changeStatus(channel:Channel){
  if(channel.externalId.startsWith("demo-connect-")){setError("Demo channels cannot be activated. Register a real provider channel to connect live messaging.");return;}
  const next=channel.status==="active"?"disabled":"active";
  await act(()=>connectFetch("/api/connect/workspaces/"+tenantId+"/channels",{
   method:"PATCH",body:JSON.stringify({channelId:channel.id,status:next})
  }),next==="active"?"Channel activated. Verify the provider webhook configuration.":"Channel disabled.");
 }
 async function revokeForm(form:FormKey){
  await act(()=>connectFetch("/api/connect/workspaces/"+tenantId+"/forms",{
   method:"DELETE",body:JSON.stringify({formId:form.id})
  }),"Form revoked. New submissions using its identifier will be rejected.");
 }
 async function createFormKey(channel:Channel){
  await act(async()=>{
   const r=await connectFetch<{formId:string;formKey:string;endpoint:string}>("/api/connect/workspaces/"+tenantId+"/forms",{
    method:"POST",body:JSON.stringify({channelId:channel.id,label:formLabel})
   });
   setGenerated({key:r.formKey,endpoint:r.endpoint});
  },"Website form created. Copy the identifier now; it will not be displayed again.");
 }
 const demoChannels=channels.filter(c=>c.externalId.startsWith("demo-connect-"));
 const realChannels=channels.filter(c=>!c.externalId.startsWith("demo-connect-"));
 const channelRow=(c:Channel)=> <div className="cx-integration-item" key={c.id}>
  <div><strong>{c.name}</strong><small>{types.find(t=>t.id===c.provider)?.label||c.provider} · {c.externalId}</small></div>
  <span className={"cx-status "+(c.status==="active"?"won":"")}>{c.status}</span>
  {canManage&&!c.externalId.startsWith("demo-connect-")&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>void changeStatus(c)}>
   {c.status==="active"?"Disable":"Activate"}</button>}
  {canManage&&c.provider==="website"&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>void createFormKey(c)}>Generate form key</button>}
 </div>;
 return <section className="cx-panel cx-integration-panel">
  <div className="cx-panel-header"><div><h2>Lead capture channels</h2><p>Register website forms, WhatsApp, Meta Lead Ads and inbound email accounts.</p></div></div>
  <div className="cx-integrations">
   {error&&<div className="cx-alert" role="alert">{error}</div>}
   {notice&&<div className="cx-success" role="status">{notice}</div>}
   <div className="cx-settings-integration-summary"><span><strong>{realChannels.length}</strong> real channel{realChannels.length===1?"":"s"}</span><span><strong>{realChannels.filter(c=>c.status==="active").length}</strong> active</span><span><strong>{demoChannels.length}</strong> demo</span></div>
   <h3 className="cx-settings-subhead">Registered channels</h3>
   {realChannels.length===0?<p className="cx-settings-no-channels">No real channels registered yet. Use “Register channel” when you're ready to configure a provider.</p>:realChannels.map(channelRow)}
   {demoChannels.length>0&&<details className="cx-settings-demo-channels">
    <summary><strong>Demo channels ({demoChannels.length})</strong><small>Sample data only · Cannot send or receive real messages</small></summary>
    <div>{demoChannels.map(channelRow)}</div>
   </details>}
   {canManage&&forms.length>0&&<details className="cx-settings-demo-channels"><summary><strong>Website form keys ({forms.length})</strong><small>Manage active keys and revoke unused forms</small></summary><div className="cx-form-inventory">
    {forms.map(f=><div className="cx-integration-item" key={f.id}><div><strong>{f.label}</strong><small>{f.active?"Active":"Revoked"} · {new Date(f.createdAt).toLocaleDateString("en-IN")}</small></div>
     {f.active&&<button type="button" className="cx-secondary" disabled={busy} onClick={()=>void revokeForm(f)}>Revoke form</button>}</div>)}
   </div></details>}
   {generated&&<div className="cx-generated-form" role="status">
    <strong>Website form identifier — copy this now</strong><code>{generated.key}</code>
    <small>POST your verified form to {generated.endpoint}. Public form intake requires Cloudflare Turnstile configuration.</small>
    <button type="button" className="cx-secondary" onClick={()=>void navigator.clipboard.writeText(generated.endpoint)}>Copy endpoint path</button>
    <button type="button" className="cx-secondary" onClick={()=>void navigator.clipboard.writeText(generated.key)}>Copy form identifier</button>
    <button type="button" className="cx-secondary" onClick={()=>setGenerated(null)}>Dismiss</button>
   </div>}
   {canManage&&<div className="cx-settings-register">
    <button type="button" className="cx-secondary" onClick={()=>setShowRegister(v=>!v)} aria-expanded={showRegister}>{showRegister?"Close registration":"＋ Register channel"}</button>
    {showRegister&&<form className="cx-form cx-integration-form" onSubmit={create}>
     <h3>Register a provider account</h3>
     <label>Channel type<select value={provider} onChange={e=>{setProvider(e.target.value);setExternalId("");}}>
      {types.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
     <label>Channel label<input required maxLength={100} placeholder={provider==="website"?"Robotronix website":provider==="email"?"Enquiries mailbox":"Primary "+provider} value={name} onChange={e=>setName(e.target.value)}/></label>
     <label>Provider account identifier<input required minLength={4} maxLength={200} placeholder={types.find(t=>t.id===provider)?.hint}
      value={externalId} onChange={e=>setExternalId(e.target.value)}/></label>
     {provider==="website"&&<label>Website form label (when generating form keys)<input maxLength={100} value={formLabel} onChange={e=>setFormLabel(e.target.value)}/></label>}
     <button className="cx-primary" disabled={busy}>{busy?"Registering…":"Register channel"}</button>
    </form>}
   </div>}
   <p className="cx-muted">Registering a channel does not connect it automatically. Configure and verify the provider webhook before activating. Never enter API keys or secrets in these fields.</p>
  </div>
 </section>;
}
