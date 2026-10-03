"use client";
import {useId,useMemo} from "react";
import {COUNTRIES} from "@/lib/geography-data";
import {SUBDIVISIONS} from "@/lib/subdivisions-data";
import {REGION_CITIES} from "@/lib/region-city-suggestions";
import {SearchableSelect} from "@/components/admin/SearchableSelect";
/** Parent/admin shared location controls. Legacy records without state remain editable. */
export function CountryCityFields({country,state="",city,onCountryChange,onStateChange,onCityChange,countryError,cityError}:{
 country:string;state?:string;city:string;onCountryChange:(v:string)=>void;onStateChange?:(v:string)=>void;onCityChange:(v:string)=>void;countryError?:string;cityError?:string;
}){
 const id=useId();
 const options=useMemo(()=>COUNTRIES.map(c=>({value:c.name,label:c.name,meta:c.iso})),[]);
 const selected=COUNTRIES.find(c=>c.name.toLowerCase()===country.toLowerCase());
 const subdivisions=selected?SUBDIVISIONS[selected.iso]??[]:[];
 const regionalCities=selected&&state.trim()?REGION_CITIES[selected.iso]?.[state.trim()]:undefined;
 // Never offer a city known to be in the wrong state. Unknown state -> free-text city input.
 const citySuggestions=state.trim()?regionalCities??[]:selected?.cities??[];
 return <>
  <div className="formGroup"><label>Country *</label><SearchableSelect items={options} value={country} placeholder="Search your country…" onChange={name=>{if(name===country)return;onCountryChange(name);onStateChange?.("");onCityChange("");}}/>{countryError&&<div className="fieldError">{countryError}</div>}</div>
  {onStateChange&&subdivisions.length>0&&<div className="formGroup"><label htmlFor={`${id}-state`}>{selected?.iso==="US"?"State":selected?.iso==="CA"?"Province":selected?.iso==="AU"?"State / Territory":"State / Province / Region"}</label><input id={`${id}-state`} className="input" autoComplete="address-level1" list={`${id}-states`} value={state} onChange={e=>{onStateChange(e.target.value);onCityChange("");}} placeholder="Choose or enter your state / region"/><datalist id={`${id}-states`}>{subdivisions.map(s=><option key={s} value={s}/>)}</datalist><small className="fieldHint">Choose from suggestions or enter an unlisted region. Leave blank if not applicable.</small></div>}
  <div className="formGroup"><label htmlFor={`${id}-city`}>City *</label><input className={`input ${cityError?"invalid":""}`} id={`${id}-city`} list={`${id}-cities`} value={city} onChange={e=>onCityChange(e.target.value)} autoComplete="address-level2" placeholder={country?"Choose or enter your city":"Choose a country first"}/><datalist id={`${id}-cities`}>{citySuggestions.map(c=><option key={c} value={c}/>)}</datalist><small className="fieldHint">{state?`Suggestions for ${state}, ${country}`:`Suggestions for ${country||"your country"}`}; enter your city if not listed.</small>{cityError&&<div className="fieldError">{cityError}</div>}</div>
 </>;
}
