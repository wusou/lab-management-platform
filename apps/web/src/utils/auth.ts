import type { Actor } from "../types";

const TOKEN_KEY = "lab_token";
const ACTOR_KEY = "lab_actor";

export function getStoredToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

export function getStoredActor(): Actor | null {
  const raw = sessionStorage.getItem(ACTOR_KEY);
  return raw ? (JSON.parse(raw) as Actor) : null;
}

export function saveAuth(token: string, actor: Actor) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ACTOR_KEY, JSON.stringify(actor));
}

export function clearAuth() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ACTOR_KEY);
}
