import { NextResponse } from "next/server";
import { getAccount } from "@/lib/topicloops";
import { requireUser } from "@/lib/keyword-map/server";

/** Verbleibende TopicLoops-Credits, damit vor dem Start einer Analyse sichtbar ist, was übrig ist. */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const account = await getAccount();
    return NextResponse.json({ credits: account.credits });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "TopicLoops nicht erreichbar" }, { status: 502 });
  }
}
