export type ArticleStatus = "brouillon" | "valide" | "publie" | "rejete";
export type UserRole = "admin" | "editeur";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  titre: string;
  description: string | null;
  link: string | null;
  url: string | null;
  secteur: string | null;
  date_source: string | null;
  status: ArticleStatus;
  wordpress_post_id: number | null;
  wordpress_url: string | null;
  created_at: string;
  updated_at: string;
  validated_by: string | null;
  published_by: string | null;
}
