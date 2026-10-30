"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getParentLearnerExperiences} from "@/lib/repository";

/** Compatibility route for old bookmarks. The family dashboard is the child selector. */
export default function ParentLearnerRedirect(){
 const router=useRouter();
 useEffect(()=>{
  let cancelled=false;
  (async()=>{
   try{
    const learners=await getParentLearnerExperiences();
    if(cancelled)return;
    if(learners.length===1)router.replace(`/parent/learner/${encodeURIComponent(learners[0].learner.id)}`);
    else router.replace(learners.length>1?"/parent#my-children":"/parent");
   }catch{
    if(!cancelled)router.replace("/parent");
   }
  })();
  return()=>{cancelled=true};
 },[router]);
 return <RoleGuard allow={["parent"]}><AppShell role="parent"><div className="experienceLoading" role="status">Opening your family's learning space…</div></AppShell></RoleGuard>;
}
