"use client";

import { openDB, type IDBPDatabase } from "idb";

export interface SimSession {
  id: string;
  name: string;
  createdAt: number;
  hexData: ArrayBuffer;
  hexFilename: string;
  breakpoints: number[];
  speed: string;
  selectedMemAddr: number;
  switchStates: boolean[];
}

const DB_NAME = "loki-sim";
const STORE = "sessions";
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSession(session: SimSession): Promise<void> {
  const db = await getDB();
  await db.put(STORE, session);
}

export async function loadSession(id: string): Promise<SimSession | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function listSessions(): Promise<SimSession[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export function exportSession(session: SimSession): void {
  const blob = new Blob([JSON.stringify({ ...session, hexData: Array.from(new Uint8Array(session.hexData)) })], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.name}.loki-sim`;
  a.click();
  URL.revokeObjectURL(url);
}
