"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {AppShell} from "@/components/AppShell";
import {RoleGuard} from "@/components/RoleGuard";
import {getParentLearnerExperiences} from "@/lib/repository";
import type {LearnerExperienceSnapshot} from "@/lib/types";
export default function LearnerChooser(){const[rows,setRows]=useState<LearnerExperienceSnapshot[]|undefined>();useEffect(()=>{getParentLearnerExperiences().then(setRows)},[]);return <RoleGuard allow={["parent"]}><AppShell role="parent"><section className="simpleExperienceHeader"><span className="experienceLabel">LEARNER VIEW</span><h1>Choose a learner</h1><p>Open the student-friendly learning space without requiring a separate student email.</p></section>{rows===undefined?<div className="experienceLoading">Loading linked learners…</div>:rows.length?<div className="linkedLearnerGrid">{rows.map(row=><Link className="linkedLearnerCard" href={`/parent/learner/${row.learner.id}`} key={row.learner.id}><span className="childAvatar large">{row.learner.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</span><div><h3>{row.learner.name}</h3><p>{row.learner.grade} · {row.courseTitle}</p><b>{row.learner.progress}% progress</b></div><span className="cardArrow">→</span></Link>)}</div>:<div className="experienceEmpty"><h2>No learner is linked yet</h2><p>Learner view becomes available after onboarding and activation.</p></div>}</AppShell></RoleGuard>}
