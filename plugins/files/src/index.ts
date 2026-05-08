import type { PluginManifest } from "@lab/core";
import { randomUUID } from "node:crypto";
import pg from "pg";

interface LabFile {
  id: string;
  title: string;
  category: "sop" | "template" | "record" | "other";
  driveUrl: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

interface FileCreateRequest {
  title: string;
  category: LabFile["category"];
  driveUrl: string;
  description?: string;
}

interface FileRepository {
  initialize(): Promise<void>;
  listFiles(search?: string): Promise<LabFile[]>;
  createFile(input: Omit<LabFile, "id" | "createdAt">): Promise<LabFile>;
}

const seedFiles: LabFile[] = [
  {
    id: "f-001",
    title: "实验室安全培训材料",
    category: "sop",
    driveUrl: "https://synology-drive.example.local/safety-training",
    description: "Synology Drive 链接占位，部署后替换为真实 NAS 共享链接。",
    ownerId: "u-admin",
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  }
];

class MemoryFileRepository implements FileRepository {
  private readonly files = structuredClone(seedFiles);

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async listFiles(search = ""): Promise<LabFile[]> {
    const keyword = search.trim().toLowerCase();
    return this.files
      .filter((file) =>
        [file.title, file.category, file.description].some((value) =>
          value.toLowerCase().includes(keyword)
        )
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createFile(input: Omit<LabFile, "id" | "createdAt">): Promise<LabFile> {
    const file = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.files.unshift(file);
    return file;
  }
}

class PostgresFileRepository implements FileRepository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS files;

      CREATE TABLE IF NOT EXISTS files.lab_file (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('sop', 'template', 'record', 'other')),
        drive_url TEXT NOT NULL,
        description TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const count = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM files.lab_file"
    );
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      for (const file of seedFiles) {
        await this.pool.query(
          `INSERT INTO files.lab_file
            (id, title, category, drive_url, description, owner_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            file.id,
            file.title,
            file.category,
            file.driveUrl,
            file.description,
            file.ownerId,
            file.createdAt
          ]
        );
      }
    }
  }

  async listFiles(search = ""): Promise<LabFile[]> {
    const keyword = `%${search.trim()}%`;
    const result = await this.pool.query(
      `SELECT *
       FROM files.lab_file
       WHERE $1 = '%%'
          OR title ILIKE $1
          OR category ILIKE $1
          OR description ILIKE $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [keyword]
    );
    return result.rows.map(mapFileRow);
  }

  async createFile(input: Omit<LabFile, "id" | "createdAt">): Promise<LabFile> {
    const result = await this.pool.query(
      `INSERT INTO files.lab_file
        (id, title, category, drive_url, description, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), input.title, input.category, input.driveUrl, input.description, input.ownerId]
    );
    return mapFileRow(result.rows[0]);
  }
}

function mapFileRow(row: Record<string, unknown>): LabFile {
  return {
    id: String(row.id),
    title: String(row.title),
    category: row.category as LabFile["category"],
    driveUrl: String(row.drive_url),
    description: String(row.description),
    ownerId: String(row.owner_id),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

function createRepository(): FileRepository {
  if (!process.env.DATABASE_URL) {
    return new MemoryFileRepository();
  }
  return new PostgresFileRepository(process.env.DATABASE_URL);
}

function validateFileRequest(request: Partial<FileCreateRequest>): string | null {
  if (!request.title?.trim()) {
    return "title is required";
  }
  if (!request.driveUrl?.trim()) {
    return "driveUrl is required";
  }
  if (!["sop", "template", "record", "other"].includes(request.category ?? "")) {
    return "category must be sop, template, record or other";
  }
  try {
    const parsed = new URL(request.driveUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "driveUrl must be http or https";
    }
  } catch {
    return "driveUrl must be a valid URL";
  }
  return null;
}

export const filesPlugin: PluginManifest = {
  name: "files",
  version: "0.1.0",
  description: "文件资料模块，当前支持 Synology Drive 链接登记与查询",
  capabilities: ["files:metadata", "files:synology-drive-link"],
  routes: [
    {
      method: "GET",
      path: "/files",
      permission: "file:read",
      summary: "查询文件资料"
    },
    {
      method: "POST",
      path: "/files",
      permission: "file:write",
      summary: "登记 Synology Drive 文件资料"
    }
  ],
  eventsPublished: [],
  eventsSubscribed: [],
  async activate(context) {
    const repository = createRepository();
    await repository.initialize();

    return {
      name: "files",
      routes: [
        {
          method: "GET",
          path: "/files",
          permission: "file:read",
          summary: "查询文件资料",
          handler: async ({ query }) => {
            const params = query as Partial<{ search: string }>;
            return { body: await repository.listFiles(params.search) };
          }
        },
        {
          method: "POST",
          path: "/files",
          permission: "file:write",
          summary: "登记 Synology Drive 文件资料",
          handler: async ({ actor, body }) => {
            if (!actor) {
              return { status: 401, body: { error: "Unauthorized" } };
            }

            const request = body as Partial<FileCreateRequest>;
            const error = validateFileRequest(request);
            if (error) {
              return { status: 400, body: { error } };
            }

            const file = await repository.createFile({
              title: request.title!.trim(),
              category: request.category!,
              driveUrl: request.driveUrl!.trim(),
              description: request.description?.trim() || "未填写",
              ownerId: actor.id
            });

            await context.audit.record({
              actorId: actor.id,
              action: "files.document.registered",
              targetType: "lab_file",
              targetId: file.id,
              occurredAt: new Date().toISOString(),
              metadata: {
                category: file.category,
                title: file.title
              }
            });

            return { status: 201, body: file };
          }
        }
      ]
    };
  }
};
