export type ArticleStatus = "draft" | "valide" | "publie" | "rejete";
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
  title: string;
  content: string | null;
  source_url: string | null;
  source_name: string | null;
  categories: string[];
  tags: string[];
  date_source: string | null;
  status: ArticleStatus;
  wordpress_post_id: number | null;
  wordpress_url: string | null;
  created_at: string;
  updated_at: string;
  validated_by: string | null;
  published_by: string | null;
}
