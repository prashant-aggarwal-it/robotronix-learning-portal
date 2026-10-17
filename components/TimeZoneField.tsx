"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {isValidTimeZone,shortTimeZoneLabel,supportedTimeZones,timeZoneLabel} from "@/lib/timezones";

export function TimeZoneField({
  value,
  onChange,
  label="Learning timezone",
  required=false,
  disabled=false,
  error,
  hint="",
  className="",
  autoMode=false,
  locationLabel="",
}:{
  value:string;
  onChange:(value:string)=>void;
  label?:string;
  required?:boolean;
  disabled?:boolean;
  error?:string;
  hint?:string;
  className?:string;
  autoMode?:boolean;
  locationLabel?:string;
}){
  const [zones,setZones]=useState<string[]>([]);
  const [query,setQuery]=useState(()=>timeZoneLabel(value));
  const [open,setOpen]=useState(false);
  const [manual,setManual]=useState(false);
  const root=useRef<HTMLDivElement>(null);

  useEffect(()=>setZones(supportedTimeZones()),[]);
  useEffect(()=>{
    setQuery(timeZoneLabel(value));
    if(autoMode)setManual(false);
  },[value,autoMode]);

  useEffect(()=>{
    const close=(event:MouseEvent)=>{
      if(root.current&&!root.current.contains(event.target as Node)){
        setOpen(false);
        setQuery(timeZoneLabel(value));
      }
    };
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[value]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const source=zones.length?zones:supportedTimeZones();
    if(!q||q===timeZoneLabel(value).toLowerCase())return source.slice(0,18);
    return source.filter(zone=>`${timeZoneLabel(zone)} ${zone}`.toLowerCase().includes(q)).slice(0,30);
  },[zones,query,value]);

  function select(zone:string){onChange(zone);setQuery(timeZoneLabel(zone));setOpen(false);setManual(false)}
  function typed(next:string){
    setQuery(next);setOpen(true);
    const trimmed=next.trim();
    if(isValidTimeZone(trimmed))onChange(trimmed);
  }

  const autoReady=autoMode&&!manual&&!disabled;
  const location=locationLabel.trim();
  const valid=isValidTimeZone(value);

  return <div className={`formGroup timezoneField ${className}`} ref={root}>
    <label>{label}{required?" *":""}</label>

    {autoReady?(
      <div className={`autoTimezoneCard ${error?"invalid":""}`}>
        <div className="autoTimezoneText">
          <span>{valid?`${shortTimeZoneLabel(value)} · automatically selected`:"Automatic timezone"}</span>
          <b>{valid?timeZoneLabel(value):(location?`Detecting from ${location}…`:"Select country, state and city first")}</b>
          {valid&&<small>{value}</small>}
          {valid&&location&&<em>✓ Automatically selected from {location}</em>}
        </div>
        <button type="button" className="linkButton timezoneManualButton" onClick={()=>{setManual(true);setOpen(false)}}>Change manually</button>
      </div>
    ):(
      <div className={`timezoneCombobox ${disabled?"disabled":""}`}>
        <input
          className={`input ${error?"invalid":""}`}
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder="Search city or timezone, e.g. Paris / Europe/Paris"
          onFocus={()=>{if(!disabled){setOpen(true);setQuery("")}}}
          onChange={e=>typed(e.target.value)}
          onKeyDown={e=>{
            if(e.key==="Escape"){setOpen(false);setQuery(timeZoneLabel(value));}
            if(e.key==="Enter"&&open&&filtered[0]){e.preventDefault();select(filtered[0]);}
          }}
        />
        {!disabled&&<span className="timezoneSearchIcon">⌕</span>}
        {open&&!disabled&&<div className="timezoneMenu">
          <div className="timezoneMenuTitle">Worldwide timezones</div>
          {filtered.length?filtered.map(zone=><button type="button" key={zone} className={zone===value?"selected":""} onMouseDown={e=>e.preventDefault()} onClick={()=>select(zone)}><span>{timeZoneLabel(zone)}</span><small>{zone}</small></button>):<div className="timezoneNoMatch">No matching timezone. You can type a valid IANA value such as <b>Europe/Paris</b>.</div>}
        </div>}
        {autoMode&&!disabled&&<button type="button" className="linkButton timezoneAutoButton" onClick={()=>setManual(false)}>Use automatic timezone</button>}
      </div>
    )}

    {hint&&<small className="fieldHint">{hint}</small>}
    {error&&<div className="fieldError">{error}</div>}
  </div>;
}
