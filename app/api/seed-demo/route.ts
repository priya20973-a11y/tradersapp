import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo-data";

export async function GET() {
  return NextResponse.json({ ok: true, data: seedDemoData() });
}

export async function POST() {
  return NextResponse.json({ ok: true, data: seedDemoData() });
}
