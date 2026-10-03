import { redirect } from "next/navigation";
export default async function LegacyBatchDetail({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/admin/cohorts/${id}`);}
