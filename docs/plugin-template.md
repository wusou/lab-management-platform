# 插件模板清单

新插件必须包含：

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- 导出的 `PluginManifest`
- 在 `eventsPublished` / `eventsSubscribed` 中声明事件
- 在 `routes` 中声明公开 HTTP 能力

插件禁止：

- 直接导入其他插件的源代码
- 直接访问其他模块的数据表
- 在未声明契约的情况下发布事件
- 在核心层写业务规则
