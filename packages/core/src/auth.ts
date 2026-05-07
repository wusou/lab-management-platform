import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import type { Actor, AuthPort, Permission, Role } from "./contracts.js";

const rolePermissions: Record<Role, Permission[]> = {
  super_admin: [
    "user:read",
    "user:write",
    "inventory:read",
    "inventory:write",
    "file:read",
    "file:write",
    "project:read",
    "project:write",
    "meeting:read",
    "meeting:write",
    "ai:use"
  ],
  admin: [
    "user:read",
    "inventory:read",
    "inventory:write",
    "file:read",
    "file:write",
    "project:read",
    "project:write",
    "meeting:read",
    "meeting:write",
    "ai:use"
  ],
  member: ["inventory:read", "file:read", "project:read", "meeting:read", "ai:use"]
};

const demoUsers = [
  {
    id: "u-admin",
    username: "admin",
    displayName: "实验室管理员",
    role: "admin" as const,
    password: "Admin@123456"
  },
  {
    id: "u-student001",
    username: "student001",
    displayName: "学生一号",
    role: "member" as const,
    password: "Student@123456"
  }
];

function toActor(user: {
  id: string;
  username?: string;
  displayName?: string;
  display_name?: string;
  role: Role;
}): Actor {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? user.display_name,
    role: user.role,
    permissions: rolePermissions[user.role]
  };
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export class DemoAuthAdapter implements AuthPort {
  private readonly sessions = new Map<string, Actor>();

  async login(username: string, password: string): Promise<{ token: string; actor: Actor } | null> {
    const user = demoUsers.find((item) => item.username === username && item.password === password);
    if (!user) {
      return null;
    }

    const token = `demo-session-${randomUUID()}`;
    const actor = toActor(user);
    this.sessions.set(token, actor);
    return { token, actor };
  }

  async authenticate(token: string): Promise<Actor | null> {
    const rawToken = token.replace("Bearer ", "");
    const session = this.sessions.get(rawToken);
    if (session) {
      return session;
    }

    const role = rawToken as Role;
    if (!["super_admin", "admin", "member"].includes(role)) {
      return null;
    }

    return {
      id: `demo-${role}`,
      username: role,
      displayName: `演示${role}`,
      role,
      permissions: rolePermissions[role]
    };
  }

  assertPermission(actor: Actor, permission: Permission): void {
    if (!actor.permissions.includes(permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }
}

export class PostgresAuthAdapter implements AuthPort {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS core;

      CREATE TABLE IF NOT EXISTS core.app_user (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'member')),
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS core.session (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES core.app_user(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `);

    for (const user of demoUsers) {
      await this.pool.query(
        `INSERT INTO core.app_user (id, username, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO NOTHING`,
        [user.id, user.username, hashPassword(user.password), user.displayName, user.role]
      );
    }
  }

  async login(username: string, password: string): Promise<{ token: string; actor: Actor } | null> {
    const userResult = await this.pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: Role;
      password_hash: string;
    }>(
      `SELECT id, username, display_name, role, password_hash
       FROM core.app_user
       WHERE username = $1 AND active = true`,
      [username]
    );
    const user = userResult.rows[0];
    if (!user || user.password_hash !== hashPassword(password)) {
      return null;
    }

    const token = randomUUID();
    await this.pool.query(
      `INSERT INTO core.session (token, user_id, expires_at)
       VALUES ($1, $2, now() + interval '8 hours')`,
      [token, user.id]
    );

    return { token, actor: toActor(user) };
  }

  async authenticate(token: string): Promise<Actor | null> {
    const rawToken = token.replace("Bearer ", "");
    const result = await this.pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: Role;
    }>(
      `SELECT u.id, u.username, u.display_name, u.role
       FROM core.session s
       JOIN core.app_user u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > now() AND u.active = true`,
      [rawToken]
    );

    const user = result.rows[0];
    return user ? toActor(user) : null;
  }

  assertPermission(actor: Actor, permission: Permission): void {
    if (!actor.permissions.includes(permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  }
}

export function createAuthAdapter(databaseUrl?: string): AuthPort {
  if (!databaseUrl) {
    return new DemoAuthAdapter();
  }
  return new PostgresAuthAdapter(databaseUrl);
}
