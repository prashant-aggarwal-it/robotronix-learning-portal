import {redirect} from "next/navigation";
export default async function TasksLegacyView({params,searchParams}:{params:Promise<{view:string}>;searchParams:Promise<{task?:string}>}){
 const {view}=await params;
 const {task}=await searchParams;
 if((view==="all"||view==="inbox")&&task&&/^[a-f0-9-]{36}$/i.test(task))redirect("/tasks/connected?task="+encodeURIComponent(task));
 if(view==="all"||view==="inbox")redirect("/tasks?view="+view);
 const routes:Record<string,string>={board:"/tasks/board",calendar:"/tasks/planner",review:"/tasks/planner",settings:"/tasks/focus",team:"/tasks/connected?view=teams",assigned:"/tasks/connected?view=assigned",delegated:"/tasks/connected?view=delegated",focus:"/tasks/focus",planner:"/tasks/planner",connected:"/tasks/connected"};
 redirect(routes[view]||"/tasks");
}
