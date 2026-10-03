import type {GuardianRelationship,OnboardingSubmission,StudentAdminRecord} from "./types";

type LegacyGuardianShape=Pick<OnboardingSubmission,"motherName"|"motherMobile"|"fatherName"|"fatherMobile"|"primaryContact"> & Partial<Pick<OnboardingSubmission,"primaryGuardianName"|"primaryGuardianRelationship"|"primaryGuardianMobile"|"secondaryGuardianName"|"secondaryGuardianRelationship"|"secondaryGuardianMobile">>;

export interface GuardianContact {name:string;relationship:GuardianRelationship;mobile:string}

export const guardianRelationshipOptions:Array<{value:GuardianRelationship;label:string}>=[
 {value:"mother",label:"Mother"},{value:"father",label:"Father"},{value:"guardian",label:"Guardian"},{value:"grandparent",label:"Grandparent"},{value:"relative",label:"Relative"},{value:"other",label:"Other"}
];

export function relationshipLabel(value?:GuardianRelationship|string){return guardianRelationshipOptions.find(x=>x.value===value)?.label??(value?String(value):"Guardian")}

export function guardiansFromRecord(record:LegacyGuardianShape):{primary:GuardianContact;secondary?:GuardianContact}{
 const primaryName=record.primaryGuardianName?.trim();
 if(primaryName){
  const primary={name:primaryName,relationship:record.primaryGuardianRelationship??"guardian",mobile:record.primaryGuardianMobile??""};
  const secondary=record.secondaryGuardianName?.trim()?{name:record.secondaryGuardianName!.trim(),relationship:record.secondaryGuardianRelationship??"guardian",mobile:record.secondaryGuardianMobile??""}:undefined;
  return{primary,secondary};
 }
 if(record.primaryContact==="father"&&record.fatherName){return{primary:{name:record.fatherName,relationship:"father",mobile:record.fatherMobile??""},secondary:record.motherName?{name:record.motherName,relationship:"mother",mobile:record.motherMobile??""}:undefined}}
 if(record.primaryContact==="mother"&&record.motherName){return{primary:{name:record.motherName,relationship:"mother",mobile:record.motherMobile??""},secondary:record.fatherName?{name:record.fatherName,relationship:"father",mobile:record.fatherMobile??""}:undefined}}
 const fallbackName=record.motherName||record.fatherName||"";const fallbackMobile=record.motherMobile||record.fatherMobile||"";
 const secondaryName=record.motherName&&record.fatherName?(fallbackName===record.motherName?record.fatherName:record.motherName):"";
 const secondaryMobile=secondaryName===record.fatherName?record.fatherMobile:record.motherMobile;
 return{primary:{name:fallbackName,relationship:record.primaryContact==="guardian"?"guardian":record.motherName?"mother":"father",mobile:fallbackMobile},secondary:secondaryName?{name:secondaryName,relationship:secondaryName===record.fatherName?"father":"mother",mobile:secondaryMobile??""}:undefined};
}

export function legacyFieldsFromGuardians(primary:GuardianContact,secondary?:GuardianContact){
 let motherName="",motherMobile="",fatherName="",fatherMobile="";
 const put=(g:GuardianContact|undefined,preferred:"primary"|"secondary")=>{
  if(!g?.name.trim())return;
  if(g.relationship==="mother"&&!motherName){motherName=g.name.trim();motherMobile=g.mobile;return;}
  if(g.relationship==="father"&&!fatherName){fatherName=g.name.trim();fatherMobile=g.mobile;return;}
  if(preferred==="primary"&&!motherName){motherName=g.name.trim();motherMobile=g.mobile;return;}
  if(!fatherName){fatherName=g.name.trim();fatherMobile=g.mobile;return;}
  if(!motherName){motherName=g.name.trim();motherMobile=g.mobile;}
 };
 put(primary,"primary");put(secondary,"secondary");
 const primaryContact:LegacyGuardianShape["primaryContact"]=primary.relationship==="mother"?"mother":primary.relationship==="father"?"father":"guardian";
 return{motherName,motherMobile,fatherName,fatherMobile,primaryContact,
  primaryGuardianName:primary.name.trim(),primaryGuardianRelationship:primary.relationship,primaryGuardianMobile:primary.mobile,
  secondaryGuardianName:secondary?.name.trim()||"",secondaryGuardianRelationship:secondary?.relationship,secondaryGuardianMobile:secondary?.mobile||""};
}

export function primaryGuardianName(record:LegacyGuardianShape){return guardiansFromRecord(record).primary.name||"Parent / guardian"}
export function primaryGuardianMobile(record:LegacyGuardianShape){return guardiansFromRecord(record).primary.mobile}

export function studentGuardianView(record:StudentAdminRecord){return guardiansFromRecord(record)}
