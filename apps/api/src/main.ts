import cors from "@fastify/cors";
import Fastify from "fastify";
import { createKernel } from "./kernel.js";

const port = Number(process.env.API_PORT ?? 3000);
const app = Fastify({ logger: true });
const kernel = await createKernel();

await app.register(cors, { origin: true });

app.get("/health", async () => ({
  status: "ok",
  plugins: kernel.plugins
}));

app.post("/auth/login", async (request, reply) => {
  const body = request.body as Partial<{ username: string; password: string }>;
  if (!body.username || !body.password) {
    return reply.code(400).send({ error: "username and password are required" });
  }

  const session = await kernel.login(body.username, body.password);
  if (!session) {
    return reply.code(401).send({ error: "Invalid username or password" });
  }

  return session;
});

app.get("/auth/me", async (request, reply) => {
  const authorization = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const actor = await kernel.authenticate(authorization ?? "");
  if (!actor) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  return actor;
});

app.get("/events", async (request, reply) => {
  const query = request.query as Partial<{ token: string }>;
  const authorization = Array.isArray(request.headers.authorization)
    ? request.headers.authorization[0]
    : request.headers.authorization;
  const actor = await kernel.authenticate(authorization ?? query.token ?? "");
  if (!actor) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  reply.hijack();
  const origin = Array.isArray(request.headers.origin)
    ? request.headers.origin[0]
    : request.headers.origin;
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": origin ?? "*",
    Vary: "Origin",
    "X-Accel-Buffering": "no"
  });
  reply.raw.write(
    `event: ready\ndata: ${JSON.stringify({ actorId: actor.id, connectedAt: new Date().toISOString() })}\n\n`
  );

  const unsubscribe = kernel.subscribeAllEvents((event) => {
    reply.raw.write(`event: domain-event\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => {
    reply.raw.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, 30000);

  request.raw.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    reply.raw.end();
  });
});

for (const route of kernel.routes) {
  app.route({
    method: route.method,
    url: route.path,
    handler: async (request, reply) => {
      const authorization = Array.isArray(request.headers.authorization)
        ? request.headers.authorization[0]
        : request.headers.authorization;
      const actor = await kernel.authenticate(authorization ?? "");
      if (route.permission && !actor) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      if (route.permission && actor) {
        kernel.assertPermission(actor, route.permission);
      }

      const result = await route.handler({
        actor,
        body: request.body,
        query: request.query,
        params: request.params as Record<string, string>
      });

      return reply.code(result.status ?? 200).send(result.body);
    }
  });
}

await app.listen({ host: "0.0.0.0", port });
