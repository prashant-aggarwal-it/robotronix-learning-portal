import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,apiFailure} from "@/lib/server/admin-api";

const SUPPORTED=new Set(["USD","AED","GBP","EUR","SGD","HKD","MYR","AUD","NZD","CAD","SAR","QAR","OMR","KWD","BHD"]);

export async function GET(request:NextRequest){
  const ctx=await requireAdmin(request);if(ctx.error)return ctx.error;
  const currency=(request.nextUrl.searchParams.get("currency")||"").toUpperCase();
  if(!SUPPORTED.has(currency))return apiFailure("Choose a supported international invoice currency.");
  try{
    const response=await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(currency)}`,{cache:"no-store",headers:{accept:"application/json"}});
    const data=await response.json() as any;
    const rate=Number(data?.rates?.INR);
    if(!response.ok||data?.result!=="success"||!Number.isFinite(rate)||rate<=0)throw new Error("Exchange rate unavailable.");
    return NextResponse.json({ok:true,currency,rate,source:"ExchangeRate-API open endpoint",provider:"open.er-api.com",fetchedAt:new Date().toISOString(),providerUpdatedAt:data.time_last_update_utc||null},{headers:{"Cache-Control":"no-store"}});
  }catch(e){return apiFailure(e instanceof Error?e.message:"Unable to fetch exchange rate.",502)}
}
