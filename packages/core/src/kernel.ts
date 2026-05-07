import type {
  Actor,
  ActivatedPlugin,
  AuditPort,
  AuthPort,
  LoggerPort,
  PluginManifest,
  RegisteredRoute
} from "./contracts.js";
import { InMemoryEventBus } from "./event-bus.js";

export interface KernelOptions {
  auth: AuthPort;
  audit: AuditPort;
  logger: LoggerPort;
}

export class Kernel {
  private readonly activatedPlugins: ActivatedPlugin[] = [];
  private readonly eventBus: InMemoryEventBus;

  constructor(private readonly options: KernelOptions) {
    this.eventBus = new InMemoryEventBus(options.logger);
  }

  async register(plugin: PluginManifest): Promise<void> {
    const activated = await plugin.activate({
      eventBus: this.eventBus,
      auth: this.options.auth,
      audit: this.options.audit,
      logger: this.options.logger
    });

    this.activatedPlugins.push(activated);
    this.options.logger.info("plugin.activated", {
      name: plugin.name,
      routes: activated.routes.length
    });
  }

  get routes(): RegisteredRoute[] {
    return this.activatedPlugins.flatMap((plugin) => plugin.routes);
  }

  get plugins(): string[] {
    return this.activatedPlugins.map((plugin) => plugin.name);
  }

  async authenticate(token: string): Promise<Actor | null> {
    return this.options.auth.authenticate(token);
  }

  assertPermission(actor: Actor, permission: RegisteredRoute["permission"]): void {
    if (permission) {
      this.options.auth.assertPermission(actor, permission);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.activatedPlugins.map((plugin) => plugin.dispose?.()));
  }
}
