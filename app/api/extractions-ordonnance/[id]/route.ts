import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import {
  ExtractionDeleteError,
  supprimerExtractionAVerifier,
  type ExtractionDeleteStore,
} from "@/lib/ordonnance-extraction-delete";
import { prisma } from "@/lib/prisma";

function createStore(): ExtractionDeleteStore {
  return {
    findExtraction: (id) => prisma.extractionOrdonnance.findUnique({
      where: { id },
      select: {
        id: true,
        statut: true,
        ordonnanceId: true,
        documentUrl: true,
        documentUrls: true,
      },
    }),
    deletePendingExtraction: async (id) => {
      const result = await prisma.extractionOrdonnance.deleteMany({
        where: { id, statut: "A_VERIFIER", ordonnanceId: null },
      });
      return result.count;
    },
    listRemainingExtractionDocuments: () => prisma.extractionOrdonnance.findMany({
      select: { documentUrl: true, documentUrls: true },
    }),
    listOrdonnanceDocuments: () => prisma.ordonnance.findMany({
      select: { photoUrl: true, photoUrls: true },
    }),
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthorizedEmail(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await supprimerExtractionAVerifier({
      id,
      store: createStore(),
      deleteDocument: async (path) => {
        await getAdminStorageBucket().file(path).delete({ ignoreNotFound: true });
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ExtractionDeleteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    console.error("Suppression extraction ordonnance:", error);
    return NextResponse.json({ error: "La suppression a échoué" }, { status: 500 });
  }
}
