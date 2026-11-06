import { SignJWT, jwtVerify } from 'jose';

export type Role = 'owner' | 'admin' | 'clerk';
export interface Session {
  tok: string; // DB session token (only its hash is stored in Postgres)
  uid: string;
  role: Role;
  name: string; // nickname
  full: string;
}

export const COOKIE = 'ws_session';

const key = () => {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SESSION_SECRET is missing or too short');
  return new TextEncoder().encode(s);
};

export async function sign(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key());
}

// Edge-safe (used by middleware as well as server code)
export async function verify(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}
