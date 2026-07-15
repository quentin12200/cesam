import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { getAdminStorageBucket } from "@/lib/firebase-admin";

const EXTRACTIONS_PREFIX = "ordonnances/extractions/";
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

async function requireAuthorized(request: NextRequest) {
  return getAuthorizedEmail(request.headers.get("cookie"));
}

function extensionFor(contentType: string) {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  if (!(await requireAuthorized(request))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  try {
    const { dataUrl, contentType } = await request.json();
    if (typeof dataUrl !== "string" || typeof contentType !== "string" || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Format de document non acceptÃ©" }, { status: 400 });
    }
    if (!dataUrl.startsWith(`data:${contentType};base64,`)) {
      return NextResponse.json({ error: "Le format du document ne correspond pas Ã  son contenu" }, { status: 400 });
    }

    const separator = dataUrl.indexOf(",");
    if (separator < 0) {
      return NextResponse.json({ error: "Document invalide" }, { status: 400 });
    }

    const bytes = Buffer.from(dataUrl.slice(separator + 1), "base64");
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Document vide" }, { status: 400 });
    }
    if (bytes.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Document trop volumineux (10 Mo maximum)" }, { status: 413 });
    }

    const path = `${EXTRACTIONS_PREFIX}${Date.now()}-${randomUUID()}.${extensionFor(contentType)}`;
    await getAdminStorageBucket().file(path).save(bytes, {
      resumable: false,
      contentType,
      metadata: { cacheControl: "private, no-store" },
    });

    const documentUrl = `/api/documents/ordonnances?path=${encodeURIComponent(path)}`;
    return NextResponse.json({ documentUrl }, { status: 201 });
  } catch (error) {
    console.error("Upload ordonnance:", error);
    return NextResponse.json({ error: "Le document n'a pas pu Ãªtre enregistrÃ©" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAuthorized(request))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path.startsWith(EXTRACTIONS_PREFIX) || path.includes("..")) {
    return NextResponse.json({ error: "Document non autorisÃ©" }, { status: 403 });
  }

  try {
    const file = getAdminStorageBucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 5 * 60 * 1000,
    });
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Lecture ordonnance:", error);
    return NextResponse.json({ error: "Le document n'a pas pu Ãªtre ouvert" }, { status: 500 });
  }
}
