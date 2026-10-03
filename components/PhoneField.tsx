"use client";
import {useEffect,useMemo,useState} from "react";
import {DIAL_COUNTRIES,countryIsoFromName,detectDial,nationalPhone,toE164} from "@/lib/phones";

export function PhoneField({
  label,value,onChange,country,error,required=false,className="",hint="Saved with international country code.",
}:{
  label:string;value:string;onChange:(v:string)=>void;country?:string;error?:string;required?:boolean;className?:string;hint?:string;
}){
 const fallback=useMemo(()=>countryIsoFromName(country),[country]);
 const initial=detectDial(value,fallback);
 const[iso,setIso]=useState(initial.iso);
 useEffect(()=>{if(value?.startsWith("+"))setIso(detectDial(value,fallback).iso);else if(!value)setIso(fallback)},[value,fallback]);
 const local=nationalPhone(value,iso);
 function changeIso(next:string){setIso(next);onChange(toE164(local,next))}
 return <div className={`formGroup phoneField ${className}`.trim()}><label>{label}{required?" *":""}</label><div className={`phoneInputWrap ${error?"invalid":""}`}><select className="input phoneDial" value={iso} onChange={e=>changeIso(e.target.value)} aria-label={`${label} country code`}>{DIAL_COUNTRIES.map(c=><option key={c.iso} value={c.iso}>{c.name} {c.dial}</option>)}</select><input className="input phoneNumber" inputMode="tel" autoComplete="tel" value={local} onChange={e=>onChange(toE164(e.target.value,iso))} placeholder="Mobile number"/></div>{error&&<div className="fieldError">{error}</div>}{hint&&<small className="fieldHint">{hint}</small>}</div>
}
