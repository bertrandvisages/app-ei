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

// ─── Jumeau social ────────────────────────────────────────────────────────
// LinkedIn, Facebook et X n'affichent PAS l'AVIF dans leurs apercus : ils
// acceptent JPEG, PNG et GIF. Une cover AVIF partagee sort donc sans visuel,
// ce qui est contre-productif sur un reseau ou l'image fait le taux de clic.
//
// On genere donc un second derive a chaque upload : un JPEG au format social,
// stocke a cote de l'AVIF sous le meme nom suffixe `-og`. L'AVIF reste l'image
// d'affichage du site, ou il est excellent ; le JPEG ne sert qu'aux metas
// Open Graph.
//
// Le site derive l'URL par convention (cf. socialPath) et retombe sur
// og-default.jpg quand le jumeau n'existe pas — typiquement les contenus
// publies avant la mise en place.

export const SOCIAL_SUFFIX = "-og";
export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;

/**
 * Derive le JPEG social d'une image. Renvoie `null` si le format d'entree
 * n'est pas transcodable ou si sharp echoue : l'appelant doit alors
 * simplement ne pas uploader de jumeau, jamais echouer l'upload principal.
 *
 * Recadrage `cover` centre. Les covers du projet font 1376x768 (1,79:1) et
 * la cible 1,905:1 : on rogne donc une vingtaine de pixels en haut et en bas,
 * sans consequence sur un visuel editorial.
 */
export async function toSocialJpeg(
  input: Buffer,
  inputMime: string
): Promise<Buffer | null> {
  if (!TRANSCODABLE.has(inputMime.toLowerCase())) return null;
  try {
    return await sharp(input, { failOn: "none" })
      .rotate() // orientation EXIF, comme pour l'AVIF
      .resize(SOCIAL_WIDTH, SOCIAL_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn(
      `[image] jumeau social echoue (${inputMime}) :`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** `dossiers/123.avif` → `dossiers/123-og.jpg`. Convention lue par le site. */
export function socialPath(path: string): string {
  const dot = path.lastIndexOf(".");
  const base = dot > 0 ? path.slice(0, dot) : path;
  return `${base}${SOCIAL_SUFFIX}.jpg`;
}
