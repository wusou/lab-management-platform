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
