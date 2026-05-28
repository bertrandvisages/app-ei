import sharp from "sharp";

export type EncodedImage = {
  buffer: Buffer;
  mime: string;
  ext: string;
};

// Mimes raster qu'on accepte de transcoder. Tout le reste (SVG, animated GIF,
// formats exotiques) est laissé tel quel — pas la peine de risquer une perte
// pour gagner quelques ko.
const TRANSCODABLE = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/tiff",
  "image/heic",
  "image/heif",
]);

// Convertit un buffer image en AVIF qualité 60.
// AVIF q=60 ≈ 5-10× plus petit qu'un PNG sans-perte pour une qualité visuelle
// proche du sans-perte sur du photoréalisme — bon compromis pour des covers
// éditoriales servies à des écrans desktop / retina.
// En cas d'erreur (sharp pas dispo, format inconnu, image corrompue), on
// retombe sur le buffer d'origine pour ne jamais bloquer un upload.
export async function toAvif(
  input: Buffer,
  inputMime: string
): Promise<EncodedImage> {
  if (!TRANSCODABLE.has(inputMime.toLowerCase())) {
    return passthrough(input, inputMime);
  }
  try {
    const buffer = await sharp(input, { failOn: "none" })
      .rotate() // applique l'orientation EXIF avant de réencoder
      .avif({ quality: 60, effort: 4 })
      .toBuffer();
    return { buffer, mime: "image/avif", ext: "avif" };
  } catch (err) {
    console.warn(
      `[image] conversion AVIF échouée (${inputMime}), fallback sur l'original :`,
      err instanceof Error ? err.message : err
    );
    return passthrough(input, inputMime);
  }
}

function passthrough(buffer: Buffer, mime: string): EncodedImage {
  const ext = mime === "image/jpeg" ? "jpg" : mime.replace(/^image\//, "") || "bin";
  return { buffer, mime, ext };
}

// Remplace l'extension d'un nom de fichier par une nouvelle.
// `photo.png` + `avif` → `photo.avif`
export function replaceExt(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.${newExt}`;
}
