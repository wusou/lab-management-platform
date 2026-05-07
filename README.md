# 实验室管理平台种子工程

这是一个生产导向的 Monorepo 初始工程，采用“微内核 + 插件化”架构搭建实验室管理平台。

## 快速启动

```bash
git clone <repo-url>
cd lab-management-platform
cp .env.example .env
docker compose up --build
```

启动后：

- Web: http://localhost:5173
- API: http://localhost:3000
- Health: http://localhost:3000/health

## 本地开发

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
```

## 目录结构

```text
apps/
  api/                 API 宿主，负责 HTTP 适配与插件路由挂载
  web/                 前端宿主，后续接入各业务插件的 UI 扩展
packages/
  core/                微内核：插件契约、事件总线、认证授权、审计端口
  contracts/           跨模块共享契约：TypeScript 类型和 OpenAPI
plugins/
  hello-world/         示例插件
  inventory/           耗材/设备申请插件骨架
infra/
  postgres/            本地开发数据库初始化脚本
```

## 架构原则

- 核心只定义能力和生命周期，不包含业务规则。
- 插件通过 `PluginManifest` 接入，不直接导入其他插件。
- 插件之间通过领域事件或公开 HTTP/RPC 契约通信。
- 数据库按模块 Schema/表前缀隔离，禁止跨模块 Join。
- CI 至少执行 lint、typecheck、test、build。

> 根目录的 `ARCHITECTURE.md`、`DEVELOPMENT.md`、`MODULE_COMMUNICATION.md` 和 `BEGINNER_GUIDE.md` 是团队协作的主要入口。
