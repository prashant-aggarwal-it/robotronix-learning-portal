import type {LearningStatus} from './types';

const human:Record<string,string>={
  scheduled:'Scheduled',tentative:'Tentative',conducted:'Completed',completed:'Completed',cancelled:'Cancelled',rescheduled:'Rescheduled',blocked:'Blocked',missed:'Missed',makeup:'Makeup',
  active:'Active',inactive:'Inactive',archived:'Archived',draft:'Draft',planned:'Planned',on_hold:'On Hold',setup_pending:'Setup Pending',
  in_progress:'In Progress',not_started:'Not Started',submitted:'Submitted',reviewed:'Reviewed',
  one_to_one:'1-to-1',small_group:'Cohort',online:'Online',offline:'Offline',hybrid:'Hybrid',
  recurring:'Recurring',flexible:'Flexible',ad_hoc:'Ad-hoc',rescheduled_replacement:'Rescheduled Replacement',extra:'Extra',regular:'Regular',
  waiting_for_team:'Waiting for Team',waiting_for_parent:'Waiting for Parent',follow_up:'Needs Attention',reinforce:'Review Next Class',on_track:'On Track',
  per_class:'Per Class',hourly:'Hourly',monthly:'Monthly',retainer:'Retainer',needs_update:'Needs Update',verified:'Verified',pending:'Pending',approved:'Approved',paid:'Paid',void:'Void',day:'Day',night:'Night',no_show:'No Show',bank:'Bank Transfer',upi:'UPI',demo:'Demo',school:'School Session',workshop:'Workshop',other:'Other'
};
export function displayLabel(value?:string|null){if(!value)return '—';return human[value]??value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
export function learningSignalLabel(value:LearningStatus){return value==='on_track'?'On Track':value==='reinforce'?'Review Next Class':'Needs Attention';}
export function learningSignalHelp(value:LearningStatus){return value==='on_track'?'Continue normally.':value==='reinforce'?'Revisit this concept within the next regular class.':'Give this area deliberate attention within upcoming regular sessions.';}
export function compareText(a?:string|null,b?:string|null){return (a??'').localeCompare(b??'',undefined,{numeric:true,sensitivity:'base'});}
