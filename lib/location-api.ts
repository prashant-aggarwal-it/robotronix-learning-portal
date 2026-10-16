export type LocationOption = { value: string; label: string };

const stateCache = new Map<string, string[]>();
const cityCache = new Map<string, string[]>();
const timezoneCache = new Map<string, string>();

async function getItems(url: string) {
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  const body = await response.json().catch(() => null) as { items?: string[]; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Unable to load location data.");
  return Array.from(new Set((body?.items ?? []).map((x) => String(x).trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
}

export async function loadStates(country: string) {
  const key = country.trim().toLowerCase();
  if (!key) return [];
  const cached = stateCache.get(key);
  if (cached) return cached;
  const items = await getItems(`/api/locations/states?country=${encodeURIComponent(country.trim())}`);
  stateCache.set(key, items);
  return items;
}

export async function loadCities(country: string, state: string) {
  const key = `${country.trim().toLowerCase()}::${state.trim().toLowerCase()}`;
  if (!country.trim() || !state.trim()) return [];
  const cached = cityCache.get(key);
  if (cached) return cached;
  const items = await getItems(`/api/locations/cities?country=${encodeURIComponent(country.trim())}&state=${encodeURIComponent(state.trim())}`);
  cityCache.set(key, items);
  return items;
}

const COUNTRY_TIMEZONE_DEFAULTS: Record<string, string> = {
  "india": "Asia/Kolkata",
  "united arab emirates": "Asia/Dubai",
  "saudi arabia": "Asia/Riyadh",
  "qatar": "Asia/Qatar",
  "oman": "Asia/Muscat",
  "kuwait": "Asia/Kuwait",
  "bahrain": "Asia/Bahrain",
  "singapore": "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  "malaysia": "Asia/Kuala_Lumpur",
  "united kingdom": "Europe/London",
  "japan": "Asia/Tokyo",
  "china": "Asia/Shanghai",
  "south korea": "Asia/Seoul",
  "korea, republic of": "Asia/Seoul",
  "pakistan": "Asia/Karachi",
  "bangladesh": "Asia/Dhaka",
  "nepal": "Asia/Kathmandu",
  "sri lanka": "Asia/Colombo",
  "thailand": "Asia/Bangkok",
};

export function suggestedTimeZoneForCountry(country: string) {
  return COUNTRY_TIMEZONE_DEFAULTS[country.trim().toLowerCase()] || "";
}

export async function resolveTimeZone(country:string,state:string,city:string){
  const key=`${country.trim().toLowerCase()}::${state.trim().toLowerCase()}::${city.trim().toLowerCase()}`;
  if(!country.trim()||!state.trim()||!city.trim())return "";
  const cached=timezoneCache.get(key);
  if(cached!==undefined)return cached;

  const response=await fetch(
    `/api/locations/timezone?country=${encodeURIComponent(country.trim())}&state=${encodeURIComponent(state.trim())}&city=${encodeURIComponent(city.trim())}`,
    {method:"GET",cache:"no-store"}
  );
  const body=await response.json().catch(()=>null) as {timezone?:string;error?:string}|null;
  if(!response.ok)throw new Error(body?.error||"Unable to resolve timezone.");

  const zone=String(body?.timezone||"").trim();
  timezoneCache.set(key,zone);
  return zone;
}
