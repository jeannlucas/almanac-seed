import type { Anchor } from "@/lib/pins/anchor";

export type ProjectStatus = "active" | "archived" | "published";

export type Project = {
  id: string;
  owner_id?: string;
  name: string;
  status: ProjectStatus;
  share_token: string;
  created_at: string;
};

export type Page = {
  id: string;
  project_id: string;
  html: string;
  version: number;
  created_at: string;
};

export type Pin = {
  id: string;
  page_id: string;
  author_id: string | null;
  anchor: Anchor;
  resolved: boolean;
  created_at: string;
};

export type Comment = {
  id: string;
  pin_id: string;
  author_id: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type ShareBundle = {
  project: Pick<Project, "id" | "name" | "status" | "share_token" | "created_at">;
  pages: Page[];
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
};
