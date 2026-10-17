import {NextResponse} from "next/server";

const API_BASE = process.env.COUNTRIES_NOW_API_BASE || "https://countriesnow.space/api/v0.1/countries";

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const country = searchParams.get("country")?.trim();
  const state = searchParams.get("state")?.trim();
  if (!country || !state) return NextResponse.json({error:"Country and state are required."},{status:400});

  try {
    const response = await fetch(`${API_BASE}/state/cities`, {
      method: "POST",
      headers: {"content-type":"application/json","accept":"application/json"},
      body: JSON.stringify({country,state}),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok || payload?.error) {
      return NextResponse.json({error: payload?.msg || "Unable to load cities."},{status:502});
    }
    const cities = Array.isArray(payload?.data) ? payload.data.filter((x:any)=>typeof x === "string") : [];
    return NextResponse.json({items: cities});
  } catch {
    return NextResponse.json({error:"Location service is temporarily unavailable."},{status:503});
  }
}
