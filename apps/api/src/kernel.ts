import { DemoAuthAdapter, Kernel } from "@lab/core";
import { helloWorldPlugin } from "@lab/plugin-hello-world";
import { inventoryPlugin } from "@lab/plugin-inventory";
import { ConsoleAuditAdapter, ConsoleLogger } from "./adapters.js";

export async function createKernel(): Promise<Kernel> {
  const kernel = new Kernel({
    auth: new DemoAuthAdapter(),
    audit: new ConsoleAuditAdapter(),
    logger: new ConsoleLogger()
  });

  await kernel.register(helloWorldPlugin);
  await kernel.register(inventoryPlugin);

  return kernel;
}
