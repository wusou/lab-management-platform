import type { PluginManifest } from "@lab/core";
import { randomUUID } from "node:crypto";
import pg from "pg";

// ── Types ──────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  reply: string;
  sources?: KnowledgeSource[];
}

interface KnowledgeSource {
  id: string;
  title: string;
  snippet: string;
}

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeCreateRequest {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

interface KnowledgeUpdateRequest {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

interface ChatHistoryRecord {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface FaqTemplate {
  id: string;
  question: string;
  category: string;
  sortOrder: number;
}

// ── AI Provider Interface ──────────────────────────────

interface ChatProvider {
  chat(messages: ChatMessage[]): Promise<string>;
}

// ── Ollama Provider ────────────────────────────────────

class OllamaChatProvider implements ChatProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: { temperature: 0.7, num_predict: 2048 }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? "（未收到回复）";
  }
}

// ── OpenAI Compatible Provider ─────────────────────────

class OpenAICompatibleChatProvider implements ChatProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "（未收到回复）";
  }
}

// ── Provider Factory ───────────────────────────────────

function createChatProvider(): ChatProvider {
  const provider = (process.env.AI_PROVIDER ?? "ollama").toLowerCase();

  if (provider === "openai") {
    return new OpenAICompatibleChatProvider(
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      process.env.OPENAI_API_KEY ?? "",
      process.env.OPENAI_MODEL ?? "gpt-4o-mini"
    );
  }

  // Default: Ollama (open-source, self-hosted)
  return new OllamaChatProvider(
    process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    process.env.OLLAMA_MODEL ?? "qwen2.5:7b"
  );
}

// ── Knowledge Base Repository ──────────────────────────

interface KnowledgeRepository {
  initialize(): Promise<void>;
  search(query: string, limit?: number): Promise<KnowledgeSource[]>;
  listAll(): Promise<KnowledgeDocument[]>;
  create(input: KnowledgeCreateRequest & { createdBy: string }): Promise<KnowledgeDocument>;
  update(
    id: string,
    input: KnowledgeUpdateRequest
  ): Promise<KnowledgeDocument | { error: string; status: number }>;
  delete(id: string): Promise<{ error?: string; status?: number }>;
}

interface ChatHistoryRepository {
  initialize(): Promise<void>;
  getHistory(userId: string, limit?: number): Promise<ChatHistoryRecord[]>;
  addMessage(
    userId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatHistoryRecord>;
  clearHistory(userId: string): Promise<void>;
}

interface FaqTemplateRepository {
  initialize(): Promise<void>;
  listAll(): Promise<FaqTemplate[]>;
}

class PostgresKnowledgeRepository implements KnowledgeRepository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS ai;

      CREATE TABLE IF NOT EXISTS ai.knowledge_document (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ai.chat_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_history_user_id
        ON ai.chat_history(user_id, created_at);

      CREATE TABLE IF NOT EXISTS ai.faq_template (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);

    await this.seedFaqTemplates();
  }

  private async seedFaqTemplates(): Promise<void> {
    const count = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM ai.faq_template"
    );
    if (Number(count.rows[0]?.count ?? 0) > 0) return;

    const templates: Omit<FaqTemplate, "id">[] = [
      { question: "实验室的开放时间是？", category: "规章制度", sortOrder: 1 },
      { question: "如何申请实验耗材？", category: "耗材管理", sortOrder: 2 },
      { question: "会议室如何预约？", category: "会议管理", sortOrder: 3 },
      { question: "如何上传实验数据？", category: "文件管理", sortOrder: 4 },
      { question: "忘记密码怎么办？", category: "账号管理", sortOrder: 5 },
      { question: "设备使用规范有哪些？", category: "规章制度", sortOrder: 6 },
      { question: "实验室安全培训要求？", category: "安全培训", sortOrder: 7 },
      { question: "如何加入课题组？", category: "项目管理", sortOrder: 8 }
    ];

    for (const tmpl of templates) {
      await this.pool.query(
        `INSERT INTO ai.faq_template (id, question, category, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), tmpl.question, tmpl.category, tmpl.sortOrder]
      );
    }
  }

  async search(query: string, limit = 3): Promise<KnowledgeSource[]> {
    const result = await this.pool.query<{
      id: string;
      title: string;
      content: string;
    }>(
      `SELECT id, title, content FROM ai.knowledge_document
       WHERE title ILIKE $1 OR content ILIKE $1
       ORDER BY
         CASE WHEN title ILIKE $1 THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.content.slice(0, 300) + (row.content.length > 300 ? "..." : "")
    }));
  }

  async listAll(): Promise<KnowledgeDocument[]> {
    const result = await this.pool.query(
      "SELECT * FROM ai.knowledge_document ORDER BY updated_at DESC"
    );
    return result.rows.map(mapKnowledgeRow);
  }

  async create(
    input: KnowledgeCreateRequest & { createdBy: string }
  ): Promise<KnowledgeDocument> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO ai.knowledge_document (id, title, content, category, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.title, input.content, input.category ?? "general", input.tags ?? [], input.createdBy]
    );
    return mapKnowledgeRow(result.rows[0]);
  }

  async update(
    id: string,
    input: KnowledgeUpdateRequest
  ): Promise<KnowledgeDocument | { error: string; status: number }> {
    const existing = await this.pool.query(
      "SELECT * FROM ai.knowledge_document WHERE id = $1",
      [id]
    );
    if (!existing.rows[0]) {
      return { error: "Knowledge document not found", status: 404 };
    }

    const title = input.title ?? existing.rows[0].title;
    const content = input.content ?? existing.rows[0].content;
    const category = input.category ?? existing.rows[0].category;
    const tags = input.tags ?? existing.rows[0].tags;

    const result = await this.pool.query(
      `UPDATE ai.knowledge_document
       SET title = $2, content = $3, category = $4, tags = $5, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, title, content, category, tags]
    );
    return mapKnowledgeRow(result.rows[0]);
  }

  async delete(id: string): Promise<{ error?: string; status?: number }> {
    const result = await this.pool.query(
      "DELETE FROM ai.knowledge_document WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) {
      return { error: "Knowledge document not found", status: 404 };
    }
    return {};
  }
}

class PostgresChatHistoryRepository implements ChatHistoryRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    // Table created by KnowledgeRepository.initialize()
  }

  async getHistory(userId: string, limit = 20): Promise<ChatHistoryRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM ai.chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows
      .map(mapChatHistoryRow)
      .reverse(); // Return in chronological order
  }

  async addMessage(
    userId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatHistoryRecord> {
    const id = randomUUID();
    const result = await this.pool.query(
      `INSERT INTO ai.chat_history (id, user_id, role, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, role, content]
    );
    return mapChatHistoryRow(result.rows[0]);
  }

  async clearHistory(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM ai.chat_history WHERE user_id = $1", [userId]);
  }
}

class PostgresFaqTemplateRepository implements FaqTemplateRepository {
  private readonly pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async initialize(): Promise<void> {
    // Table created by KnowledgeRepository.initialize()
  }

  async listAll(): Promise<FaqTemplate[]> {
    const result = await this.pool.query(
      "SELECT * FROM ai.faq_template ORDER BY sort_order"
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      question: String(row.question),
      category: String(row.category),
      sortOrder: Number(row.sort_order)
    }));
  }
}

// ── Row Mappers ────────────────────────────────────────

function mapKnowledgeRow(row: Record<string, unknown>): KnowledgeDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    category: String(row.category),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    createdBy: String(row.created_by),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function mapChatHistoryRow(row: Record<string, unknown>): ChatHistoryRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    role: row.role as "user" | "assistant",
    content: String(row.content),
    createdAt: new Date(String(row.created_at)).toISOString()
  };
}

// ── RAG Engine ─────────────────────────────────────────

const SYSTEM_PROMPT = `你是实验室智能助手，专门为实验室成员提供帮助。请根据以下规则回答：

1. 使用中文回答，语气友好、专业。
2. 如果提供了知识库参考文档，优先基于参考文档的内容回答。
3. 如果知识库中没有相关信息，可以基于你的知识回答，但要明确说明信息来源。
4. 对于不确定的问题，建议用户咨询实验室管理员。
5. 拒绝回答与实验室工作无关的敏感话题。
6. 回答简洁明了，重点突出。`;

function buildRagPrompt(userMessage: string, sources: KnowledgeSource[]): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (sources.length > 0) {
    const context = sources
      .map((s, i) => `[参考文档${i + 1}] ${s.title}\n${s.content ?? s.snippet}`)
      .join("\n\n");
    messages.push({
      role: "system",
      content: `以下是知识库中与用户问题相关的参考文档，请优先基于这些文档回答：\n\n${context}`
    });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

// ── Plugin Manifest ────────────────────────────────────

export const aiPlugin: PluginManifest = {
  name: "ai",
  version: "0.1.0",
  description: "AI 智能问答模块：支持 LLM 对话、知识库 RAG 问答、FAQ 模板",
  capabilities: [
    "ai:chat",
    "ai:knowledge",
    "ai:templates"
  ],
  routes: [
    {
      method: "POST",
      path: "/ai/chat",
      permission: "ai:use",
      summary: "发送消息给 AI 助手，获取回复"
    },
    {
      method: "GET",
      path: "/ai/chat-history",
      permission: "ai:use",
      summary: "获取当前用户的对话历史"
    },
    {
      method: "DELETE",
      path: "/ai/chat-history",
      permission: "ai:use",
      summary: "清除当前用户的对话历史"
    },
    {
      method: "GET",
      path: "/ai/knowledge",
      permission: "ai:use",
      summary: "查询知识库文档列表"
    },
    {
      method: "POST",
      path: "/ai/knowledge",
      permission: "ai:use",
      summary: "添加知识库文档"
    },
    {
      method: "PUT",
      path: "/ai/knowledge/:id",
      permission: "ai:use",
      summary: "更新知识库文档"
    },
    {
      method: "DELETE",
      path: "/ai/knowledge/:id",
      permission: "ai:use",
      summary: "删除知识库文档"
    },
    {
      method: "GET",
      path: "/ai/templates",
      permission: "ai:use",
      summary: "获取 FAQ 问题模板"
    }
  ],
  eventsPublished: ["ai.chat.completed"],
  eventsSubscribed: [],
  async activate(context) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      context.logger.warn("ai.plugin.noDatabase", {
        message: "DATABASE_URL not set, AI plugin running without persistence"
      });
      return {
        name: "ai",
        routes: [
          {
            method: "POST",
            path: "/ai/chat",
            permission: "ai:use",
            summary: "发送消息给 AI 助手",
            handler: async ({ actor }) => {
              if (!actor) return { status: 401, body: { error: "Unauthorized" } };
              return {
                body: {
                  reply: "AI 服务未配置数据库连接，请设置 DATABASE_URL 环境变量。如需使用 AI 功能，请参考 docs/AI_MODULE.md 配置 AI 提供商。",
                  sources: []
                } as ChatResponse
              };
            }
          }
        ]
      };
    }

    const pool = new pg.Pool({ connectionString: databaseUrl });
    const knowledgeRepo = new PostgresKnowledgeRepository(databaseUrl);
    const chatHistoryRepo = new PostgresChatHistoryRepository(pool);
    const faqRepo = new PostgresFaqTemplateRepository(pool);
    const chatProvider = createChatProvider();

    await knowledgeRepo.initialize();
    await chatHistoryRepo.initialize();
    await faqRepo.initialize();

    context.logger.info("ai.plugin.ready", {
      provider: process.env.AI_PROVIDER ?? "ollama",
      model: process.env.AI_PROVIDER === "openai"
        ? (process.env.OPENAI_MODEL ?? "gpt-4o-mini")
        : (process.env.OLLAMA_MODEL ?? "qwen2.5:7b")
    });

    return {
      name: "ai",
      routes: [
        // ── Chat ──
        {
          method: "POST",
          path: "/ai/chat",
          permission: "ai:use",
          summary: "发送消息给 AI 助手",
          handler: async ({ actor, body }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };

            const request = body as Partial<ChatRequest>;
            if (!request.message?.trim()) {
              return { status: 400, body: { error: "message is required" } };
            }

            try {
              // 1. Search knowledge base
              const sources = await knowledgeRepo.search(request.message);

              // 2. Get recent chat history
              const history = await chatHistoryRepo.getHistory(actor.id, 10);
              const recentMessages: ChatMessage[] = history.map((h) => ({
                role: h.role,
                content: h.content
              }));

              // 3. Build RAG prompt with history and knowledge context
              const ragMessages = buildRagPrompt(request.message, sources);
              const allMessages = [...ragMessages.slice(0, -1), ...recentMessages.slice(-6), ragMessages[ragMessages.length - 1]!];

              // 4. Call AI
              const reply = await chatProvider.chat(allMessages);

              // 5. Save to history
              await chatHistoryRepo.addMessage(actor.id, "user", request.message);
              await chatHistoryRepo.addMessage(actor.id, "assistant", reply);

              // 6. Audit
              await context.audit.record({
                actorId: actor.id,
                action: "ai.chat.completed",
                targetType: "ai_chat",
                occurredAt: new Date().toISOString(),
                metadata: {
                  messageLength: request.message.length,
                  replyLength: reply.length,
                  sourcesCount: sources.length
                }
              });

              return {
                body: { reply, sources } as ChatResponse
              };
            } catch (error) {
              context.logger.error("ai.chat.error", {
                error: error instanceof Error ? error.message : "Unknown error"
              });
              return {
                status: 502,
                body: {
                  error: "AI 服务暂时不可用，请检查 AI 提供商配置或稍后重试。",
                  detail: error instanceof Error ? error.message : "Unknown error"
                }
              };
            }
          }
        },

        // ── Chat History ──
        {
          method: "GET",
          path: "/ai/chat-history",
          permission: "ai:use",
          summary: "获取对话历史",
          handler: async ({ actor }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };
            const history = await chatHistoryRepo.getHistory(actor.id);
            return { body: history };
          }
        },
        {
          method: "DELETE",
          path: "/ai/chat-history",
          permission: "ai:use",
          summary: "清除对话历史",
          handler: async ({ actor }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };
            await chatHistoryRepo.clearHistory(actor.id);
            return { body: { ok: true } };
          }
        },

        // ── Knowledge Base ──
        {
          method: "GET",
          path: "/ai/knowledge",
          permission: "ai:use",
          summary: "查询知识库文档",
          handler: async () => {
            const docs = await knowledgeRepo.listAll();
            return { body: docs };
          }
        },
        {
          method: "POST",
          path: "/ai/knowledge",
          permission: "ai:use",
          summary: "添加知识库文档",
          handler: async ({ actor, body }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };

            const input = body as Partial<KnowledgeCreateRequest>;
            if (!input.title?.trim() || !input.content?.trim()) {
              return { status: 400, body: { error: "title and content are required" } };
            }

            const doc = await knowledgeRepo.create({
              title: input.title,
              content: input.content,
              category: input.category,
              tags: input.tags,
              createdBy: actor.id
            });

            await context.audit.record({
              actorId: actor.id,
              action: "ai.knowledge.created",
              targetType: "ai_knowledge",
              targetId: doc.id,
              occurredAt: new Date().toISOString(),
              metadata: { title: doc.title }
            });

            return { status: 201, body: doc };
          }
        },
        {
          method: "PUT",
          path: "/ai/knowledge/:id",
          permission: "ai:use",
          summary: "更新知识库文档",
          handler: async ({ actor, params, body }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };

            const input = body as Partial<KnowledgeUpdateRequest>;
            const result = await knowledgeRepo.update(params.id, input);
            if ("error" in result) {
              return { status: result.status, body: { error: result.error } };
            }

            await context.audit.record({
              actorId: actor.id,
              action: "ai.knowledge.updated",
              targetType: "ai_knowledge",
              targetId: result.id,
              occurredAt: new Date().toISOString(),
              metadata: { title: result.title }
            });

            return { body: result };
          }
        },
        {
          method: "DELETE",
          path: "/ai/knowledge/:id",
          permission: "ai:use",
          summary: "删除知识库文档",
          handler: async ({ actor, params }) => {
            if (!actor) return { status: 401, body: { error: "Unauthorized" } };

            const result = await knowledgeRepo.delete(params.id);
            if (result.error) {
              return { status: result.status!, body: { error: result.error } };
            }

            await context.audit.record({
              actorId: actor.id,
              action: "ai.knowledge.deleted",
              targetType: "ai_knowledge",
              targetId: params.id,
              occurredAt: new Date().toISOString()
            });

            return { body: { ok: true } };
          }
        },

        // ── FAQ Templates ──
        {
          method: "GET",
          path: "/ai/templates",
          permission: "ai:use",
          summary: "获取 FAQ 问题模板",
          handler: async () => {
            const templates = await faqRepo.listAll();
            return { body: templates };
          }
        }
      ]
    };
  }
};
