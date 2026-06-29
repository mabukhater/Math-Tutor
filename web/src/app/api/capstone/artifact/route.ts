import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
// POST /api/capstone/artifact
// Add an artifact to a milestone (url | text | file).
//
// JSON body (text/url):
//   { studentId, level: 7|8, slug, kind: "url"|"text", value: string }
//
// Multipart form (file):
//   studentId, level, slug, file (binary)
//
// Security-critical: student_id for the Storage path comes from resolveStudent,
// NOT from client input — prevents cross-student path injection (OQ-4).
//
// Enforces: 10 MB max, MIME allow-list (AC-7.4, OQ-4).
// No AI analysis of artifact content (AC-5.4, AC-8.4).
//
// Auth: parent or linked kid (resolveStudent → 404 if not owned).

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let studentId: string | undefined;
  let level: number | undefined;
  let slug: string | undefined;
  let kind: "url" | "text" | "file" | undefined;
  let value: string | undefined;
  let fileBytes: Uint8Array | undefined;
  let fileName: string | undefined;
  let fileMime: string | undefined;

  if (isMultipart) {
    // File upload path.
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "bad request" }, { status: 400 });
    studentId = (form.get("studentId") as string | null) ?? undefined;
    level = parseInt((form.get("level") as string | null) ?? "", 10);
    slug = (form.get("slug") as string | null) ?? undefined;
    kind = "file";
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "bad request" }, { status: 400 });
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
    fileMime = file.type;
    if (!ALLOWED_MIME.has(fileMime))
      return NextResponse.json({ error: "bad_type" }, { status: 415 });
    fileBytes = new Uint8Array(await file.arrayBuffer());
    fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  } else {
    // JSON path (text or url).
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "bad request" }, { status: 400 });
    studentId = body.studentId;
    level = body.level;
    slug = body.slug;
    kind = body.kind;
    value = body.value;
    if (kind !== "url" && kind !== "text")
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    if (!value || typeof value !== "string" || value.trim().length === 0)
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    if (kind === "url") {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "bad request" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "bad request" }, { status: 400 });
      }
    }
  }

  if (!studentId || (level !== 7 && level !== 8) || !slug || !kind)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const VALID_SLUGS = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  if (!VALID_SLUGS.includes(slug))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();

  // resolveStudent — CRITICAL: student_id for the storage path comes from here,
  // not from the client. Prevents a caller from writing into another student's
  // Storage folder (OQ-4 security requirement).
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const resolvedStudentId = access.student.id; // authoritative

  // Look up the capstone + milestone.
  const { data: capstone } = await admin
    .from("capstones")
    .select("id")
    .eq("student_id", resolvedStudentId)
    .eq("level", level)
    .maybeSingle();
  if (!capstone) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: milestone } = await admin
    .from("capstone_milestones")
    .select("id")
    .eq("capstone_id", capstone.id)
    .eq("slug", slug)
    .maybeSingle();
  if (!milestone) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Insert the artifact row.
  if (kind === "file" && fileBytes && fileName && fileMime) {
    // OQ-4 path: {student_id}/{capstone_id}/{milestone_id}/{uuid}-{filename}
    const objectPath = `${resolvedStudentId}/${capstone.id}/${milestone.id}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } = await admin.storage
      .from("capstone-artifacts")
      .upload(objectPath, fileBytes, {
        contentType: fileMime,
        upsert: false,
      });
    if (uploadError)
      return NextResponse.json({ error: "upload_failed", detail: uploadError.message }, { status: 500 });

    const { data: inserted, error: insertError } = await admin
      .from("capstone_artifacts")
      .insert({
        milestone_id: milestone.id,
        kind: "file",
        storage_path: objectPath,
        mime: fileMime,
      })
      .select("id, kind, storage_path, mime")
      .single();
    if (insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Mint a short-TTL signed URL for the response (AC-7.4).
    const { data: signed } = await admin.storage
      .from("capstone-artifacts")
      .createSignedUrl(objectPath, 3600);

    return NextResponse.json({
      artifact: {
        id: inserted.id,
        kind: "file",
        signedUrl: signed?.signedUrl ?? null,
        mime: fileMime,
      },
    });
  }

  // text or url path.
  const insertPayload: Record<string, unknown> = {
    milestone_id: milestone.id,
    kind,
  };
  if (kind === "url") insertPayload.url = value;
  if (kind === "text") insertPayload.body_text = value;

  const { data: inserted, error: insertError } = await admin
    .from("capstone_artifacts")
    .insert(insertPayload)
    .select("id, kind, url, body_text")
    .single();
  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    artifact: {
      id: inserted.id,
      kind: inserted.kind,
      url: (inserted.url as string | null) ?? undefined,
      bodyText: (inserted.body_text as string | null) ?? undefined,
    },
  });
}
