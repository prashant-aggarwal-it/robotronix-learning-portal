import {NextResponse} from "next/server";

const GEO_BASE = process.env.OPEN_METEO_GEOCODING_BASE || "https://geocoding-api.open-meteo.com/v1/search";

function scoreMatch(row:any,country:string,state:string,city:string){
  let score=0;
  const rc=String(row?.country||"").trim().toLowerCase();
  const rs=String(row?.admin1||"").trim().toLowerCase();
  const rn=String(row?.name||"").trim().toLowerCase();
  if(rc===country.toLowerCase())score+=5;
  if(rs===state.toLowerCase())score+=4;
  if(rn===city.toLowerCase())score+=6;
  else if(rn.includes(city.toLowerCase())||city.toLowerCase().includes(rn))score+=2;
  return score;
}

export async function GET(request:Request){
  const {searchParams}=new URL(request.url);
  const country=searchParams.get("country")?.trim();
  const state=searchParams.get("state")?.trim();
  const city=searchParams.get("city")?.trim();

  if(!country||!state||!city){
    return NextResponse.json({error:"Country, state and city are required."},{status:400});
  }

  try{
    const url=new URL(GEO_BASE);
    url.searchParams.set("name",city);
    url.searchParams.set("count","20");
    url.searchParams.set("language","en");
    url.searchParams.set("format","json");

    const response=await fetch(url,{cache:"no-store",headers:{accept:"application/json"}});
    const payload=await response.json().catch(()=>null) as any;

    if(!response.ok){
      return NextResponse.json({error:"Unable to resolve timezone."},{status:502});
    }

    const rows=Array.isArray(payload?.results)?payload.results:[];
    const ranked=rows
      .filter((row:any)=>typeof row?.timezone==="string"&&row.timezone.includes("/"))
      .map((row:any)=>({row,score:scoreMatch(row,country,state,city)}))
      .sort((a:any,b:any)=>b.score-a.score);

    const best=ranked[0]?.row;
    if(!best){
      return NextResponse.json({timezone:"",matched:false});
    }

    return NextResponse.json({
      timezone:String(best.timezone),
      matched:true,
      matchedCity:String(best.name||city),
      matchedState:String(best.admin1||state),
      matchedCountry:String(best.country||country),
    });
  }catch{
    return NextResponse.json({error:"Timezone service is temporarily unavailable."},{status:503});
  }
}
