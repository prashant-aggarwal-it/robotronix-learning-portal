import { NextResponse } from "next/server";
import { hasSupabaseEnv, productionConfigurationError } from "@/lib/config";

export async function GET(){
  const healthy = hasSupabaseEnv && !productionConfigurationError;
  return NextResponse.json(
    { ok: healthy },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
