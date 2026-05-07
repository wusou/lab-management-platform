import { createAuthAdapter, Kernel } from "@lab/core";
import { helloWorldPlugin } from "@lab/plugin-hello-world";
import { inventoryPlugin } from "@lab/plugin-inventory";
import { ConsoleAuditAdapter, ConsoleLogger } from "./adapters.js";

export async function createKernel(): Promise<Kernel> {
  const auth = createAuthAdapter(process.env.DATABASE_URL);
  if ("initialize" in auth && typeof auth.initialize === "function") {
    await auth.initialize();
  }

  const kernel = new Kernel({
    auth,
    audit: new ConsoleAuditAdapter(),
    logger: new ConsoleLogger()
  });

  await kernel.register(helloWorldPlugin);
  await kernel.register(inventoryPlugin);

  return kernel;
}
