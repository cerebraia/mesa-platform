import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MiB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Magic byte signatures for image format validation.
// Checking only the declared MIME type is insufficient because a client can
// rename any file. We inspect the actual bytes to confirm the format.
function detectImageType(
  bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // WebP: RIFF????WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

// Returns: { path: string } on success, { error: string } on failure.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient();

  // Require authenticated owner — Storage RLS re-checks this, but we
  // validate here to return clear error messages before attempting upload.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const restaurantId = formData.get("restaurant_id");
  const productId = formData.get("product_id");
  // type: "product" (default), "logo", or "cover"
  const uploadType = String(formData.get("type") ?? "product");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (typeof restaurantId !== "string") {
    return NextResponse.json({ error: "Falta restaurant_id." }, { status: 400 });
  }
  if ((uploadType === "product" || uploadType === "product_thumb") && typeof productId !== "string") {
    return NextResponse.json({ error: "Falta product_id." }, { status: 400 });
  }
  if (!["product", "product_thumb", "logo", "cover"].includes(uploadType)) {
    return NextResponse.json({ error: "Tipo de upload no válido." }, { status: 400 });
  }

  // Size check
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { error: "El archivo está vacío." },
      { status: 400 },
    );
  }

  // MIME type check against allowlist
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa JPEG, PNG o WebP." },
      { status: 400 },
    );
  }

  // Magic-byte validation — reads first 12 bytes to detect real format.
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer.slice(0, 12));
  const detectedType = detectImageType(header);
  if (!detectedType) {
    return NextResponse.json(
      { error: "El archivo no es una imagen válida (JPEG, PNG o WebP)." },
      { status: 400 },
    );
  }

  // Verify the caller is owner of the restaurant before upload.
  // This server-side check comes before the Storage RLS check for cleaner errors.
  const { data: memberRow } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (memberRow?.role !== "owner") {
    return NextResponse.json(
      { error: "Solo los propietarios pueden subir imágenes." },
      { status: 403 },
    );
  }

  const ext = detectedType.split("/")[1].replace("jpeg", "jpg");
  const uuid = crypto.randomUUID();

  let bucket: string;
  let path: string;

  if (uploadType === "logo" || uploadType === "cover") {
    bucket = "restaurant-assets";
    path = `${restaurantId}/${uploadType}/${uuid}.${ext}`;
  } else if (uploadType === "product_thumb") {
    bucket = "product-images";
    path = `${restaurantId}/thumb-${productId}-${uuid}.${ext}`;
  } else {
    bucket = "product-images";
    path = `${restaurantId}/${productId}-${uuid}.${ext}`;
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: detectedType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Error al subir imagen: ${uploadError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ path, bucket });
}
