-- Élargit la whitelist MIME du bucket `media` pour autoriser les documents
-- (PDF, Word, ODT, RTF, TXT) en plus des images.
--
-- Contexte : le bucket avait été créé avec un allowed_mime_types limité aux
-- images seulement. Cela bloque les uploads de pièces jointes des demandes
-- de contribution (/api/contribution-requests). La validation MIME est déjà
-- faite côté API route, donc la restriction bucket-level est redondante —
-- on peut soit la retirer complètement (NULL = aucune limite), soit lister
-- explicitement les types acceptés.
--
-- À lancer dans Supabase Studio → SQL Editor.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  -- Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/tiff',
  -- Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  -- Fallback générique (au cas où un navigateur n'envoie pas de Content-Type
  -- précis — l'extension est validée côté code de toute façon)
  'application/octet-stream'
]
WHERE id = 'media';

-- Pour vérifier le résultat :
-- SELECT id, name, public, allowed_mime_types FROM storage.buckets WHERE id = 'media';
