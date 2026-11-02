import {
  scryptSync,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { Store } from "./store";
import type { User } from "./types";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, digest] = hash.split(":");
  if (!salt || !digest) return false;
  const stored = Buffer.from(digest, "hex");
  const test = scryptSync(password, salt, 64);
  return stored.length === test.length && timingSafeEqual(stored, test);
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser(s: Store): Promise<User | null> {
  const token = (await cookies()).get("bagdar_session")?.value;
  if (!token) return null;
  const session = await s.get("sessions", tokenHash(token));
  if (!session || session.expires < Date.now()) return null;
  const user = await s.get("users", session.userId);
  if (!user || user.blocked) return null;
  if (user.org) {
    const org = await s.get("organizations", user.org);
    if (!org || org.status === "archived") return null;
  }
  return user;
}
export async function createSession(s: Store, userId: string) {
  const token = randomBytes(32).toString("hex");
  await s.put("sessions", {
    id: tokenHash(token),
    userId,
    expires: Date.now() + 7 * 86400000,
  });
  return token;
}
export const safeUser = (u: User) => {
  const { hash: _, ...rest } = u;
  void _;
  return rest;
};
