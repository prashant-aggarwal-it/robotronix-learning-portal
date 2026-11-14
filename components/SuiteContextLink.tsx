"use client";
import Link from "next/link";
import {suiteModuleById,type SuiteModuleId} from "@/lib/platform/suite-modules";
/** Consistent compact platform breadcrumb, embedded inside existing module headers.
 * It does not authorize access or make legacy data organization-scoped. */
export function SuiteContextLink({module}:{module:SuiteModuleId}){
 const definition=suiteModuleById(module);
 return <Link href="/suite" className="suiteContextLink" aria-label="Go to Education Suite home">
  <span className="suiteContextBrand">Education Suite</span>
  <span aria-hidden="true">/</span>
  <span>{definition.label}</span>
 </Link>;
}
