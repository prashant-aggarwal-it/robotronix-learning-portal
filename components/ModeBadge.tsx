"use client";
import { appMode } from "@/lib/config";
export function ModeBadge() {
  if(appMode === "live") return null;
  return <span className="pill mode amber" title="Local preview data is being used">Preview data</span>;
}
