/**
 * Human-readable presentation for backend status codes and enum labels.
 * Never use the output in API payloads, authorization, or status comparisons.
 */
export function formatPlatformLabel(value:string|null|undefined):string {
 if(!value)return "Unknown";
 return value.trim().replaceAll("_"," ").replaceAll("-"," ")
  .split(" ").filter(Boolean)
  .map(part=>part[0].toUpperCase()+part.slice(1)).join(" ");
}
