"use client";
import {gradeOptions} from "@/lib/learner-options";

export function GradeSelect({value,onChange,label="Grade / Class",required=false,error,disabled=false}:{value:string;onChange:(value:string)=>void;label?:string;required?:boolean;error?:string;disabled?:boolean}){
  const hasLegacyValue=Boolean(value)&&!gradeOptions.includes(value);
  return <div className="formGroup">
    <label>{label}{required?" *":""}</label>
    <select className={`input ${error?"invalid":""}`} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>
      <option value="">Choose grade / class</option>
      {hasLegacyValue&&<option value={value}>{value} (existing)</option>}
      {gradeOptions.map(option=><option value={option} key={option}>{option}</option>)}
    </select>
    {error&&<div className="fieldError">{error}</div>}
  </div>;
}
