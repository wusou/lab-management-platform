# 项目进程文档

更新时间：2026-05-07

## 当前阶段

项目已经从“种子工程”进入“可用 MVP”阶段。当前可以本机 Docker 启动，完成账号、库存、审批、库存流水、文件资料链接登记等基本流程。

## 已完成

### 工程基础

- Monorepo：pnpm workspace
- TypeScript 全栈
- ESLint / Prettier
- Husky / Commitlint
- Docker Compose 开发环境
- GitHub Actions CI
- 生产 Docker Compose
- Nginx 生产反向代理
- HTTPS 示例配置
- 数据库迁移工具

### 架构

- 微内核 + 插件化
- 插件 manifest 生命周期
- 核心认证/权限/审计/事件接口
- 插件与核心解耦
- OpenAPI 契约
- PostgreSQL schema 按模块隔离

### 账号与权限

- 本地账号登录
- 支持账号、学号/工号、手机号登录
- 管理员创建账号
- 学员修改密码
- 学员绑定手机号
- 管理员重置学员密码
- 管理员停用学员
- 默认只显示启用账号
- 显示停用账号开关
- 管理员调整成员/管理员角色
- 角色权限矩阵页面

### 耗材与审批

- 耗材库存列表
- 低库存统计
- 成员提交领用申请
- 管理员批准/拒绝
- 批准后扣减库存
- 管理员入库
- 审批记录持久化
- 库存流水查询
- SSE 实时刷新

### 文件资料

- 文件资料插件 `plugins/files`
- Synology Drive 共享链接登记
- 文件资料搜索
- 打开共享链接
- 文件登记审计
- Synology Drive 后续适配文档

### 审计与测试

- 审计日志入库 `core.audit_log`
- API 集成测试
- 插件加载测试
- CI 通过：格式、lint、类型、测试、构建

## 暂未完成

- 厦门大学统一身份认证 `ids.xmu.edu.cn` CAS 正式接入
- Synology Drive 真实 API 上传/目录同步
- 项目管理模块
- 会议预约模块
- AI 问答模块
- 更细粒度权限管理，例如自定义角色
- 分页式 API 查询
- 更完整的前端路由拆分
- 自动化端到端测试

## 下一步建议

1. 拆分前端页面组件，降低 `apps/web/src/main.tsx` 体积。
2. 做项目管理插件 `plugins/projects`。
3. 做会议预约插件 `plugins/meetings`。
4. 拿到 NAS 服务账号后，实现 `SynologyDriveRepository`。
5. 拿到 CAS 申请材料后，实现统一认证回调。
6. 增加 Playwright 端到端测试。

## 关键风险

- 当前默认密码只适合开发测试，部署前必须修改。
- 当前文件模块只保存共享链接，不保存文件二进制。
- 统一认证接入依赖学校审批和正式域名。
- Synology Drive API 接入依赖 NAS 管理员提供专用账号和权限。
- 当前前端单文件较大，继续扩展前建议组件化。
