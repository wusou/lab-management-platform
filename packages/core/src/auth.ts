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

export class DemoAuthAdapter implements AuthPort {
  async authenticate(token: string): Promise<Actor | null> {
    const role = token.replace("Bearer ", "") as Role;
    if (!["super_admin", "admin", "member"].includes(role)) {
      return null;
    }

    return {
      id: `demo-${role}`,
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
