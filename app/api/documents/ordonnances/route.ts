import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import { getAdminStorageBucket } from "@/lib/firebase-admin";
import {
  logOrdonnanceScanFailure,
  ordonnanceScanUserMessage,
} from "@/lib/ordonnance-scan-diagnostics";

const EXTRACTIONS_PREFIX = "ordonnances/extractions/";
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
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

    const encoded = dataUrl.slice(separator + 1);
    if (encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      return NextResponse.json({ error: "Document invalide ou trop volumineux" }, { status: 413 });
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0) {
      return NextResponse.json({ error: "Document vide" }, { status: 400 });
    }
    const header = bytes.subarray(0, 12);
    const validSignature = contentType === "application/pdf" ? header.subarray(0, 5).toString("ascii") === "%PDF-"
      : contentType === "image/jpeg" ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : contentType === "image/png" ? header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : contentType === "image/webp" ? header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP"
      : contentType === "image/heic" || contentType === "image/heif" ? header.subarray(4, 8).toString("ascii") === "ftyp"
      : false;
    if (!validSignature) return NextResponse.json({ error: "Le contenu du fichier ne correspond pas au format annoncé" }, { status: 400 });
    if (bytes.length > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Document trop volumineux (3 Mo maximum)" }, { status: 413 });
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
    logOrdonnanceScanFailure("document", error);
    return NextResponse.json(
      { error: ordonnanceScanUserMessage("document"), stage: "document" },
      { status: 500 },
    );
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
