"use client";
import {useEffect,useRef,useState,type CSSProperties,type DragEvent} from "react";
import {themeToCssVariables} from "@/lib/theme/tokens";
import {getSupabaseBrowserClient} from "@/lib/supabase/browser";
import {detectLogoPalette,generatePalette,validatePublicLogoUrl,type SuggestedPalette} from "@/lib/theme/logo-palette";
import "./branding-studio.css";

export type BrandingOrganization={id:string;slug:string;display_name:string};
type BrandData={tagline:string;logoUrl:string;accentColor:string;palette:SuggestedPalette|null};
const initial:BrandData={tagline:"",logoUrl:"",accentColor:"#4537a5",palette:null};
const MAX=3*1024*1024;
async function authHeaders():Promise<Record<string,string>>{
 const client=getSupabaseBrowserClient();
 if(!client)throw new Error("Authentication unavailable");
 const {data:{session}}=await client.auth.getSession();
 if(!session)throw new Error("Sign in first");
 return {Authorization:"Bearer "+session.access_token};
}
export function BrandingStudio({organizations,ownerMode=false,initialOrganizationId=""}:{organizations:BrandingOrganization[];ownerMode?:boolean;initialOrganizationId?:string}){
 const [organizationId,setOrganizationId]=useState(initialOrganizationId);
 const [saved,setSaved]=useState<BrandData>(initial);
 const [tagline,setTagline]=useState("");
 const [logoUrl,setLogoUrl]=useState("");
 const [palette,setPalette]=useState<SuggestedPalette>(generatePalette("#4537a5"));
 const [recommended,setRecommended]=useState<SuggestedPalette>(generatePalette("#4537a5"));
 const [file,setFile]=useState<File|null>(null);
 const [localPreview,setLocalPreview]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [message,setMessage]=useState(""),[error,setError]=useState("");
 const input=useRef<HTMLInputElement>(null);
 const analysisVersion=useRef(0);
 const [analyzing,setAnalyzing]=useState(false);
 const [canEdit,setCanEdit]=useState(false);
 const [brandingLevel,setBrandingLevel]=useState<"standard"|"custom"|"white_label"|null>(null);
 const selected=organizations.find(o=>o.id===organizationId);
 useEffect(()=>{setOrganizationId(v=>initialOrganizationId&&organizations.some(o=>o.id===initialOrganizationId)?initialOrganizationId:organizations.some(o=>o.id===v)?v:organizations[0]?.id||"");},[organizations,initialOrganizationId]);
 useEffect(()=>{
  if(!file){setLocalPreview("");return;}
  const url=URL.createObjectURL(file);setLocalPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[file]);
 useEffect(()=>{
  if(!organizationId)return;
  let live=true;analysisVersion.current++;setAnalyzing(false);setLoading(true);setError("");setMessage("");setFile(null);setSaved(initial);setTagline("");setLogoUrl("");setPalette(generatePalette("#4537a5"));setCanEdit(false);setBrandingLevel(null);
  (async()=>{try{
   const response=await fetch("/api/branding-studio?organizationId="+encodeURIComponent(organizationId),
    {headers:await authHeaders(),cache:"no-store"});
   const body=await response.json();
   if(!response.ok||!body.ok)throw new Error(body.error||"Could not load branding");
   if(!live)return;
   const tier=await fetch("/api/platform/branding-entitlements?organizationId="+encodeURIComponent(organizationId),{headers:await authHeaders(),cache:"no-store"});
   const tierData=await tier.json();if(!tier.ok||!tierData.ok)throw new Error(tierData.error||"Branding tier unavailable");
   if(!live)return;
   setCanEdit(body.canEdit===true);setBrandingLevel(tierData.level);
   const brand=body.branding as BrandData;
   const existing=brand.palette?generatePalette(brand.palette.primary,brand.palette.secondary,brand.palette.accent):generatePalette(brand.accentColor||"#4537a5");
   setSaved({...brand,palette:existing});setTagline(brand.tagline||"");setLogoUrl(brand.logoUrl||"");
   setPalette(existing);setRecommended(existing);
  }catch(e){if(live)setError(e instanceof Error?e.message:"Branding unavailable");}
   finally{if(live)setLoading(false);}
  })();return()=>{live=false};
 },[organizationId]);
 const isDirty=tagline!==saved.tagline||logoUrl!==saved.logoUrl||!!file||
  JSON.stringify(palette)!==JSON.stringify(saved.palette||generatePalette(saved.accentColor||"#4537a5"));
 async function analyze(blob:Blob,fromUpload=false){
  const version=++analysisVersion.current;
  setAnalyzing(true);
  try{
   const suggestion=await detectLogoPalette(blob);
   if(version!==analysisVersion.current)return;
   setPalette(suggestion);setRecommended(suggestion);
   setError("");setMessage("Brand colors detected. Review the preview before saving.");
  }catch(e){
   if(version!==analysisVersion.current)return;
   if(fromUpload)setFile(null);
   setError(e instanceof Error?e.message:"Unable to detect colors");
  }finally{if(version===analysisVersion.current)setAnalyzing(false);}
 }
 function acceptFile(candidate:File|null){
  if(!candidate||!canEdit)return;
  if(!["image/png","image/jpeg","image/webp"].includes(candidate.type)||candidate.size>MAX||candidate.size<=0){
   setError("Choose a PNG, JPEG or WebP logo smaller than 3 MB.");return;
  }
  setFile(candidate);setError("");void analyze(candidate,true);
 }
 function drop(e:DragEvent<HTMLDivElement>){e.preventDefault();if(canEdit)acceptFile(e.dataTransfer.files[0]||null);}
 async function detectUrl(){
  if(!logoUrl||!validatePublicLogoUrl(logoUrl)){setError("Provide a valid HTTPS image URL.");return;}
  setBusy(true);setError("");
  try{
   const response=await fetch(logoUrl,{mode:"cors",credentials:"omit"});
   if(!response.ok)throw new Error("The image could not be retrieved");
   const blob=await response.blob();await analyze(blob);
  }catch{setError("The image host does not allow browser color extraction. Upload the logo file instead, or set the colors manually.");}
  finally{setBusy(false);}
 }
 function changeColor(key:"primary"|"secondary"|"accent",value:string){
  setPalette(p=>generatePalette(key==="primary"?value:p.primary,key==="secondary"?value:p.secondary,key==="accent"?value:p.accent));
 }
 function reset(){
  analysisVersion.current++;setAnalyzing(false);
  setFile(null);setTagline(saved.tagline);setLogoUrl(saved.logoUrl);
  setPalette(saved.palette||generatePalette(saved.accentColor));setMessage("Unsaved changes reset.");setError("");
 }
 async function save(){
  if(!organizationId||busy||loading||analyzing||!canEdit)return;
  if(!validatePublicLogoUrl(logoUrl)){setError("Logo URL must be a valid HTTPS address.");return;}
  setBusy(true);setError("");setMessage("");
  try{
   const headers=await authHeaders();let finalLogo=logoUrl;
   if(file){
    const form=new FormData();form.set("logo",file);
    const upload=await fetch("/api/branding-studio/upload",{method:"POST",headers:{...headers,"x-branding-organization":organizationId},body:form});
    const uploaded=await upload.json();if(!upload.ok||!uploaded.ok)throw new Error(uploaded.error||"Upload failed");
    finalLogo=uploaded.logoUrl;
   }
   const response=await fetch("/api/branding-studio",{method:"POST",
    headers:{...headers,"Content-Type":"application/json"},
    body:JSON.stringify({organizationId,tagline,logoUrl:finalLogo,primary:palette.primary,secondary:palette.secondary,accent:palette.accent})});
   const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Could not save branding");
   const updated=data.branding as BrandData;
   setSaved(updated);setTagline(updated.tagline);setLogoUrl(updated.logoUrl);
   setFile(null);setPalette(updated.palette||palette);setRecommended(updated.palette||palette);
   window.dispatchEvent(new Event("robotronix:branding-saved"));
   setMessage("Branding saved for "+selected?.display_name+". Your active workspace will update automatically.");
  }catch(e){setError(e instanceof Error?e.message:"Branding could not be saved");}
  finally{setBusy(false);}
 }
 const previewLogo=localPreview||logoUrl;
 const previewStyle=themeToCssVariables(palette) as CSSProperties;
 return <section className="brandingStudio">
  <div className="brandingStudioHeader"><div><span>ORGANIZATION IDENTITY</span><h2>Branding Studio</h2><p>Upload your logo, automatically detect brand colors, and preview your Academy theme.</p></div>
   {isDirty&&<span className="brandingUnsaved" role="status">Unsaved changes</span>}
  </div>
  <div className="brandingStudioGrid">
   <div className="brandingEditor">
    <label className="brandingField">Organization
     <select aria-label="Choose organization" value={organizationId} disabled={busy||loading} onChange={e=>setOrganizationId(e.target.value)}>
      {organizations.length===0&&<option value="">No accessible organization</option>}
      {organizations.map(o=><option key={o.id} value={o.id}>{o.display_name}</option>)}
     </select>
    </label>
    {!loading&&brandingLevel==="standard"&&!canEdit&&<p className="brandingEntitlementNotice" role="status">Standard branding is active. Custom logo, colors and tagline are available after an upgrade. Previously saved branding is safely retained.</p>}
    <fieldset className="brandingEntitlementFields" disabled={!canEdit||busy||loading}>
    <div className="brandingSectionTitle">1. Your logo</div>
    <div className="brandingDrop" onDragOver={e=>e.preventDefault()} onDrop={drop}>
     <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const selected=e.currentTarget.files?.[0]||null;e.currentTarget.value="";acceptFile(selected)}} className="brandingFileInput" aria-label="Upload organization logo"/>
     {previewLogo?<img src={previewLogo} alt="Current organization logo" className="brandingUploadedLogo"/>:<div className="brandingLogoPlaceholder" aria-hidden="true">◎</div>}
     <button type="button" onClick={()=>input.current?.click()} disabled={busy||loading}>{previewLogo?"Replace logo":"Browse logo"}</button>
     <small>Drag PNG, JPG or WebP here · Up to 3 MB</small>
     {previewLogo&&<button type="button" className="brandingTextButton" onClick={()=>{analysisVersion.current++;setAnalyzing(false);setFile(null);setLogoUrl("");}} disabled={busy}>Remove logo</button>}
    </div>
    <label className="brandingField">Or paste an HTTPS logo URL
     <input type="url" value={logoUrl} onChange={e=>{analysisVersion.current++;setAnalyzing(false);setFile(null);setLogoUrl(e.target.value)}} placeholder="https://example.com/academy-logo.png" maxLength={600} disabled={busy}/>
    </label>
    <button type="button" className="brandingSecondaryButton" disabled={!logoUrl||busy} onClick={()=>void detectUrl()}>Detect colors from URL</button>
    <div className="brandingSectionTitle">2. Brand colors</div>
    <p className="brandingHint">Detected suggestions can be adjusted. Button text is automatically kept readable.</p>
    {(["primary","secondary","accent"] as const).map(key=><label key={key} className="brandingColorField"><span>{key[0].toUpperCase()+key.slice(1)}</span><input aria-label={key+" color"} type="color" value={palette[key]} onChange={e=>changeColor(key,e.target.value)} disabled={busy}/><input aria-label={key+" hex"} type="text" key={key+palette[key]} defaultValue={palette[key]} maxLength={7} onBlur={e=>{const value=e.currentTarget.value;if(/^#[0-9a-fA-F]{6}$/.test(value))changeColor(key,value);else e.currentTarget.value=palette[key]}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}} disabled={busy}/></label>)}
    <button type="button" className="brandingSecondaryButton" onClick={()=>setPalette(recommended)} disabled={busy}>Restore suggested palette</button>
    <div className="brandingSectionTitle">3. Academy tagline</div>
    <label className="brandingField">Tagline
     <input value={tagline} onChange={e=>setTagline(e.target.value)} maxLength={180} disabled={busy} placeholder="Learn. Build. Create."/>
    </label>
    <div className="brandingActions">
     <button type="button" className="brandingSaveButton" disabled={busy||loading||analyzing||!organizationId||!isDirty} onClick={()=>void save()}>{busy?"Saving…":"Save branding"}</button>
     <button type="button" className="brandingSecondaryButton" disabled={busy||loading||analyzing||!isDirty} onClick={reset}>Reset changes</button>
    </div>
    </fieldset>
    {loading&&<p role="status">Loading saved branding…</p>}
    {analyzing&&<p role="status">Analyzing logo colors…</p>}
    {error&&<p className="brandingError" role="alert">{error}</p>}
    {message&&<p className="brandingSuccess" role="status">{message}</p>}
   </div>
   <div className="brandingPreviewCol">
    <div className="brandingPreviewCaption">LIVE PREVIEW · NOT APPLIED TO YOUR WORKSPACE</div>
    <div className="brandingPreview" style={previewStyle}>
     <aside className="brandingPreviewSidebar">
      {previewLogo?<img src={previewLogo} alt="" className="brandingPreviewLogo"/>:<strong>{selected?.display_name||"Your academy"}</strong>}
      <div className="brandingPreviewNav active">◫ &nbsp; Overview</div>
      <div className="brandingPreviewNav">▦ &nbsp; Students</div>
      <div className="brandingPreviewNav">▤ &nbsp; Courses</div>
      <div className="brandingPreviewNav">◷ &nbsp; Schedule</div>
     </aside>
     <main className="brandingPreviewMain">
      <div className="brandingPreviewTop"><strong>{selected?.display_name||"Your academy"}</strong><small>{tagline||"Welcome to your academy"}</small></div>
      <div className="brandingPreviewKpis"><div><span>Students</span><strong>128</strong></div><div><span>Courses</span><strong>12</strong></div></div>
      <div className="brandingPreviewCourse"><span>COURSE OVERVIEW</span><strong>Python Foundations</strong><p>Build practical coding skills.</p><span className="brandingPreviewDemoAction">View course</span></div>
      <div className="brandingPreviewActions"><span className="brandingPreviewDemoAction">Primary action</span><span className="brandingPreviewDemoSecondary">Secondary</span></div>
      <label className="brandingPreviewInput">Example input<input readOnly value="Academy demo" aria-label="Preview example input"/></label>
     </main>
    </div>
    <p className="brandingHint">Preview values are isolated to this panel until saved.</p>
   </div>
  </div>
 </section>;
}
