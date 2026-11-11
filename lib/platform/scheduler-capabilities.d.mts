export function schedulerCapabilityEnabled(
  capability:"portal"|"crm"|"tasks"|"crmPortal"|"crmTasks"|"portalTasks",
  env?:Record<string,string|undefined>
):boolean;
