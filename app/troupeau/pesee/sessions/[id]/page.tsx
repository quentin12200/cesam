import { notFound } from "next/navigation";
import { getWeighingSessionHistoryDetail } from "@/lib/weighing-session-history";
import { WeighingSessionError } from "@/lib/weighing-sessions";
import SessionDetailClient from "./SessionDetailClient";

export const dynamic = "force-dynamic";

export default async function WeighingSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getWeighingSessionHistoryDetail(id);
    return <SessionDetailClient initialSession={session} />;
  } catch (error) {
    if (error instanceof WeighingSessionError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}
