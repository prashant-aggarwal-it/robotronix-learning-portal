"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {COUNTRIES} from "@/lib/geography-data";
import {loadCities,loadStates,resolveTimeZone,suggestedTimeZoneForCountry} from "@/lib/location-api";
import {SearchableSelect} from "@/components/admin/SearchableSelect";

export function CountryCityFields({
  country,state="",city,onCountryChange,onStateChange,onCityChange,onTimeZoneSuggestion,countryError,cityError
}:{
  country:string;
  state?:string;
  city:string;
  onCountryChange:(v:string)=>void;
  onStateChange?:(v:string)=>void;
  onCityChange:(v:string)=>void;
  onTimeZoneSuggestion?:(v:string)=>void;
  countryError?:string;
  cityError?:string;
}){
  const countryOptions=useMemo(()=>COUNTRIES.map(c=>({value:c.name,label:c.name,meta:c.iso})),[]);
  const [states,setStates]=useState<string[]>([]);
  const [cities,setCities]=useState<string[]>([]);
  const [statesLoading,setStatesLoading]=useState(false);
  const [citiesLoading,setCitiesLoading]=useState(false);
  const [stateError,setStateError]=useState("");
  const [cityLoadError,setCityLoadError]=useState("");
  const [timezoneError,setTimezoneError]=useState("");
  const [stateReload,setStateReload]=useState(0);
  const [cityReload,setCityReload]=useState(0);
  const stateEnabled=Boolean(onStateChange);
  const timezoneRequest=useRef(0);

  useEffect(()=>{
    let cancelled=false;
    setStates([]);setCities([]);setStateError("");setCityLoadError("");setTimezoneError("");
    if(!country.trim()||!stateEnabled)return;
    setStatesLoading(true);
    loadStates(country).then(rows=>{if(!cancelled)setStates(rows)}).catch(err=>{if(!cancelled)setStateError(err instanceof Error?err.message:"Unable to load states.")}).finally(()=>{if(!cancelled)setStatesLoading(false)});
    return()=>{cancelled=true};
  },[country,stateEnabled,stateReload]);

  useEffect(()=>{
    let cancelled=false;
    setCities([]);setCityLoadError("");setTimezoneError("");
    if(!country.trim()||!state.trim())return;
    setCitiesLoading(true);
    loadCities(country,state).then(rows=>{if(!cancelled)setCities(rows)}).catch(err=>{if(!cancelled)setCityLoadError(err instanceof Error?err.message:"Unable to load cities.")}).finally(()=>{if(!cancelled)setCitiesLoading(false)});
    return()=>{cancelled=true};
  },[country,state,cityReload]);

  const stateItems=useMemo(()=>{
    const rows=[...states];
    if(state.trim()&&!rows.some(x=>x.toLowerCase()===state.trim().toLowerCase()))rows.unshift(state.trim());
    return rows.map(x=>({value:x,label:x}));
  },[states,state]);

  const cityItems=useMemo(()=>{
    const rows=[...cities];
    if(city.trim()&&!rows.some(x=>x.toLowerCase()===city.trim().toLowerCase()))rows.unshift(city.trim());
    return rows.map(x=>({value:x,label:x}));
  },[cities,city]);

  function changeCountry(name:string){
    if(name===country)return;
    timezoneRequest.current+=1;
    onCountryChange(name);
    onStateChange?.("");
    onCityChange("");
    onTimeZoneSuggestion?.("");
    setTimezoneError("");
  }

  function changeState(next:string){
    timezoneRequest.current+=1;
    onStateChange?.(next);
    onCityChange("");
    onTimeZoneSuggestion?.("");
    setTimezoneError("");
  }

  async function changeCity(next:string){
    const requestId=++timezoneRequest.current;
    onCityChange(next);
    onTimeZoneSuggestion?.("");
    setTimezoneError("");
    if(!next.trim())return;
    try{
      const zone=await resolveTimeZone(country,state,next);
      if(requestId!==timezoneRequest.current)return;
      if(zone)onTimeZoneSuggestion?.(zone);
      else{
        const fallback=suggestedTimeZoneForCountry(country);
        if(fallback)onTimeZoneSuggestion?.(fallback);
        else setTimezoneError("Timezone could not be detected automatically. Use Change manually.");
      }
    }catch{
      if(requestId!==timezoneRequest.current)return;
      const fallback=suggestedTimeZoneForCountry(country);
      if(fallback)onTimeZoneSuggestion?.(fallback);
      else setTimezoneError("Timezone could not be detected automatically. Use Change manually.");
    }
  }

  return <>
    <div className="formGroup">
      <label>Country *</label>
      <SearchableSelect items={countryOptions} value={country} placeholder="Search your country…" onChange={changeCountry}/>
      <small className="fieldHint">Choose the standard country name used for this family.</small>
      {countryError&&<div className="fieldError">{countryError}</div>}
    </div>

    {onStateChange&&<div className="formGroup">
      <label>State / Province / Region</label>
      <SearchableSelect items={stateItems} value={state} disabled={!country||statesLoading||Boolean(stateError)} placeholder={statesLoading?"Loading states…":country?"Search state / province…":"Choose a country first"} onChange={changeState}/>
      {stateError?<small className="fieldHint">Location service unavailable. <button type="button" className="linkButton" onClick={()=>setStateReload(x=>x+1)}>Retry</button></small>:<small className="fieldHint">{statesLoading?"Loading standardized regions…":"Select from the standardized list."}</small>}
    </div>}

    <div className="formGroup">
      <label>City *</label>
      <SearchableSelect items={cityItems} value={city} disabled={!country||!state||citiesLoading||Boolean(cityLoadError)} placeholder={citiesLoading?"Loading cities…":state?"Search city…":"Choose a state / region first"} onChange={changeCity}/>
      {cityLoadError?<small className="fieldHint">Location service unavailable. <button type="button" className="linkButton" onClick={()=>setCityReload(x=>x+1)}>Retry</button></small>:<small className="fieldHint">{citiesLoading?"Loading standardized cities…":state?`Cities in ${state}, ${country}`:"Choose a state / region first."}</small>}
      {timezoneError&&<small className="fieldHint timezoneDetectionWarning">{timezoneError}</small>}
      {cityError&&<div className="fieldError">{cityError}</div>}
    </div>
  </>;
}
