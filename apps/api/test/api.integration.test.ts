import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiApp } from "../src/main.js";

describe("api integration", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await createApiApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "admin",
        password: "Admin@123456"
      }
    });
    expect(response.statusCode).toBe(200);
    token = response.json<{ token: string }>().token;
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes health and authenticated profile endpoints", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json<{ plugins: string[] }>().plugins).toContain("inventory");

    const profile = await app.inject({
      method: "GET",
      url: "/auth/profile",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json<{ username: string }>().username).toBe("admin");
  });

  it("creates a user, updates role, and removes the user through HTTP contracts", async () => {
    const suffix = Date.now();
    const created = await app.inject({
      method: "POST",
      url: "/auth/register",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        username: `api${suffix}`,
        password: "Student@123456",
        studentId: `A${suffix}`,
        displayName: `接口测试${suffix}`,
        role: "member"
      }
    });
    expect(created.statusCode).toBe(201);
    const userId = created.json<{ id: string }>().id;

    const roleChanged = await app.inject({
      method: "PATCH",
      url: `/auth/users/${userId}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "admin" }
    });
    expect(roleChanged.statusCode).toBe(200);
    expect(roleChanged.json<{ role: string }>().role).toBe("admin");

    const roleRestored = await app.inject({
      method: "PATCH",
      url: `/auth/users/${userId}/role`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: "member" }
    });
    expect(roleRestored.statusCode).toBe(200);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/auth/users/${userId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(deleted.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: `/auth/users?search=api${suffix}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json<unknown[]>()).toHaveLength(0);
  });

  it("returns inventory stock movements after stock-in", async () => {
    const stockIn = await app.inject({
      method: "PATCH",
      url: "/inventory/materials/m-001/stock-in",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        quantity: 2,
        remark: "api integration test"
      }
    });
    expect(stockIn.statusCode).toBe(200);

    const movements = await app.inject({
      method: "GET",
      url: "/inventory/stock-movements",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(movements.statusCode).toBe(200);
    expect(movements.json<Array<{ type: string; materialId: string; quantity: number }>>()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          materialId: "m-001",
          quantity: 2,
          type: "stock_in"
        })
      ])
    );
  });

  it("registers and lists Synology Drive file links", async () => {
    const suffix = Date.now();
    const created = await app.inject({
      method: "POST",
      url: "/files",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `文件测试${suffix}`,
        category: "template",
        driveUrl: `https://drive.example.local/shared/${suffix}`,
        description: "api integration test"
      }
    });
    expect(created.statusCode).toBe(201);
    expect(created.json<{ title: string }>().title).toBe(`文件测试${suffix}`);

    const listed = await app.inject({
      method: "GET",
      url: `/files?search=${suffix}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json<Array<{ title: string; driveUrl: string }>>()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          driveUrl: `https://drive.example.local/shared/${suffix}`,
          title: `文件测试${suffix}`
        })
      ])
    );
  });
});
