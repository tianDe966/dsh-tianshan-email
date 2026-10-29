# 变更记录

本文件记录 `dsh-tianshan-email` 的对外变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.2.0] - 2026-10-29

### Added

- **自有设置卡片「tianshan邮件」**：注册在设置侧边栏，含 SMTP 表单、启用开关、直连 SSL 开关、授权码密码框（留空表示不修改）与「发送测试邮件」按钮。
- 浏览器侧通过插件的 loopback 路由读写配置：`/api/dsh-tianshan-email/settings/describe`、`/settings/mutate`、`/test`，三者都要求同源 loopback（socket 地址 + Host + Origin 三重校验）。
- 卡片以 esbuild 打包为 `lib/client.js`，格式与 DSH 的 `window.__ModuleLoader__` 加载器一致；React 走宿主提供的外部依赖。

### Fixed

- `apply()` 不再依赖模块级 `inject` 导出（该加载器不认），改为 `ctx.inject(['tools','settings'])` 与 `ctx.inject(['settings','webServer'])` 两段注入，headless profile 也仍能拿到工具。
- 配置读取改为经 `settings.describe()` 现读并逐字段解包——此前 `apply` 收到的字段是包装对象，导致已填好的配置被判定为缺失。

## [0.1.0] - 2026-10-29

### Added

- **设置页「邮件」**：SMTP 服务器 / 端口 / 直连 SSL / 发件邮箱 / 邮箱授权码 / 发件人地址 / 默认收件人，由 DSH 按 schema 自动渲染，无需前端构建。
- **授权码按 secret 字段处理**：`role('secret')` + `volatile()`，设置服务在把值发往浏览器前脱敏；插件侧 `sanitize()` 再从任何将要外露的文本里抹掉它。
- **工具 `send_mail`**：`subject` + `text` 必填，`to` 可覆盖默认收件人，`html` 可选；配置不完整时返回 `status=failed` 并列出缺失项，不抛异常。
- 单元测试 7 条（收件人解析、缺失项判定、脱敏、schema 声明）。

### Notes

- 不含通知触发器与自定义设置卡片，与 `dsh-email-notify` 并存而不冲突。
- 设计参考了 `dsh-email-notify`（Apache-2.0）的最佳实践，未复制其源码，详见 NOTICE。
