import { NextRequest, NextResponse } from "next/server";

function clean(value: unknown, max = 180) {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.error("[portal-client-error]", {
      name: clean(body?.name, 80),
      digest: clean(body?.digest, 120),
      path: clean(body?.path, 180),
    });
  } catch {
    console.error("[portal-client-error] malformed client error report");
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
