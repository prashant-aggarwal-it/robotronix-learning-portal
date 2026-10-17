import {NextResponse} from "next/server";

const API_BASE = process.env.COUNTRIES_NOW_API_BASE || "https://countriesnow.space/api/v0.1/countries";

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const country = searchParams.get("country")?.trim();
  if (!country) return NextResponse.json({error:"Country is required."},{status:400});

  try {
    const response = await fetch(`${API_BASE}/states`, {
      method: "POST",
      headers: {"content-type":"application/json","accept":"application/json"},
      body: JSON.stringify({country}),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok || payload?.error) {
      return NextResponse.json({error: payload?.msg || "Unable to load states."},{status:502});
    }
    const states = Array.isArray(payload?.data?.states)
      ? payload.data.states.map((x:any)=>typeof x === "string" ? x : x?.name).filter(Boolean)
      : [];
    return NextResponse.json({items: states});
  } catch {
    return NextResponse.json({error:"Location service is temporarily unavailable."},{status:503});
  }
}
