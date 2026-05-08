# 实验室管理平台

实验室管理平台用于管理实验室成员账号、耗材库存、领用审批、库存流水、文件资料和后续统一认证/NAS 适配。项目采用 Monorepo、TypeScript、React、Fastify、PostgreSQL、Docker Compose，架构上遵循“微内核 + 插件化”。

## 当前能力

- 登录：支持账号、学号/工号、手机号 + 密码登录
- 账号管理：管理员创建账号、搜索账号、显示停用账号、重置密码、停用学员、调整角色
- 角色权限：成员、管理员、超级管理员权限矩阵
- 耗材库存：库存列表、低库存提醒、入库登记
- 申请审批：成员提交耗材申请，管理员批准/拒绝
- 实时刷新：通过 SSE 接收申请和审批变化
- 库存流水：查询入库和审批出库记录
- 文件资料：文件夹、标签、权限、小文件直传、版本记录、Synology Drive 链接兼容
- 会议通知：会议预约、会议完成标记、站内通知、全局公告
- 审计日志：关键动作写入 PostgreSQL
- 生产部署：Nginx、生产 Compose、环境变量、数据库迁移脚本

## 快速启动

前置条件：

- 已安装并启动 Docker Desktop。
- Windows 推荐启用 WSL 2 后端。
- 本仓库开发环境默认使用 Docker Compose，首次体验不需要单独安装 PostgreSQL。

首次启动：

```powershell
git clone https://github.com/wusou/lab-management-platform.git
cd lab-management-platform
docker compose up --build -d
```

如果是已有仓库拉取新代码，或刚新增依赖/插件，建议刷新匿名依赖卷：

```powershell
git pull
docker compose up --build -d -V api web
```

如果数据库结构有更新，执行一次迁移：

```powershell
docker compose exec api pnpm --filter @lab/api db:migrate
```

访问地址：

- 前端：`http://localhost:5173`
- API：`http://localhost:3000`
- 健康检查：`http://localhost:3000/health`

开发环境种子账号：

```text
管理员：admin / Admin@123456
成员：student001 / Student@123456
```

这两个账号只在 `NODE_ENV=development` 且 `LAB_SEED_DEMO_ACCOUNTS` 未设置为 `false` 时自动初始化，方便本地演示和测试。登录页不会展示或自动填充默认账号；生产环境应设置 `LAB_SEED_DEMO_ACCOUNTS=false`，并通过初始化管理员、统一认证或管理员后台创建正式账号。

## 常用命令

```powershell
corepack pnpm install
corepack pnpm dev
corepack pnpm run ci
corepack pnpm db:migrate
docker compose up --build -d
docker compose logs -f api
docker compose ps
```

Windows 上如果 `docker` 命令找不到，说明 Docker Desktop 没有正确加入系统 PATH，或终端启动早于 Docker 安装。优先重启终端/电脑；仍不行时，在 Docker Desktop 安装目录中找到 `resources\bin`，把它加入 Windows 系统环境变量 `Path`，不要把个人电脑的绝对路径写入项目文件。

项目文档和配置必须保持跨机器可用，不能提交个人电脑上的绝对安装路径。

## 项目结构

```text
apps/
  api/                 Fastify API 宿主，注册核心能力和插件路由
  web/                 React + Vite 前端应用
packages/
  core/                微内核：认证、权限、审计、事件、插件契约
  contracts/           OpenAPI 和跨模块共享契约
plugins/
  inventory/           耗材库存、申请审批、库存流水插件
  files/               文件资料、权限、标签、版本与 NAS 链接兼容插件
  collaboration/       会议、公告、站内通知插件
  hello-world/         示例插件
infra/
  postgres/            数据库初始化和迁移 SQL
  nginx/               生产 Nginx 配置
```

## 文档入口

- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)：开发环境、分工、如何新增模块
- [docs/API.md](./docs/API.md)：API 使用说明、认证方式、常用接口示例
- [docs/FILE_STRUCTURE.md](./docs/FILE_STRUCTURE.md)：文件和目录作用说明
- [docs/PROJECT_PROGRESS.md](./docs/PROJECT_PROGRESS.md)：已完成、未完成、下一步计划
- [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)：协作规范、提交规范、PR 模板
- [docs/plugin-template.md](./docs/plugin-template.md)：新增插件模板
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)：生产部署、Nginx、HTTPS、迁移
- [docs/SYNOLOGY_DRIVE_ADAPTER.md](./docs/SYNOLOGY_DRIVE_ADAPTER.md)：Synology Drive 后续适配说明

## 架构原则

- 核心只提供认证、权限、审计、事件、插件生命周期，不写业务规则。
- 业务能力放在 `plugins/*`，插件之间不直接导入对方代码。
- 模块通信通过 HTTP API、TypeScript 契约或事件，不直接共享数据库表。
- 数据库按 schema 隔离，例如 `core`、`inventory`、`files`。
- 合并代码前必须跑 `corepack pnpm run ci`。
