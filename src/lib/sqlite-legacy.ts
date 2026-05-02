import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

let db: Database.Database | null = null;

export interface LegacyConversationRow {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface LegacyMessageRow {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface LegacyOutboxRow {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

export interface LegacyConnectionStateRow {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface LegacyBusinessProfileRow {
  id: 1;
  name: string;
  description: string;
  products: string;
  extra: string;
  updated_at: number;
}

export function getLegacyDb(): Database.Database {
  if (db) return db;

  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Legacy SQLite directory not found: ${dataDir}`);
  }

  const dbPath = path.join(dataDir, "messages.db");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Legacy SQLite file not found: ${dbPath}`);
  }

  db = new Database(dbPath, { readonly: true, timeout: 10000 });
  return db;
}

