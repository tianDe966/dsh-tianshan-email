# 变更记录

本文件记录 `dsh-tianshan-email` 的对外变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.1.0] - 2026-10-29

### Added

- **设置页「邮件」**：SMTP 服务器 / 端口 / 直连 SSL / 发件邮箱 / 邮箱授权码 / 发件人地址 / 默认收件人，由 DSH 按 schema 自动渲染，无需前端构建。
- **授权码按 secret 字段处理**：`role('secret')` + `volatile()`，设置服务在把值发往浏览器前脱敏；插件侧 `sanitize()` 再从任何将要外露的文本里抹掉它。
- **工具 `send_mail`**：`subject` + `text` 必填，`to` 可覆盖默认收件人，`html` 可选；配置不完整时返回 `status=failed` 并列出缺失项，不抛异常。
- 单元测试 7 条（收件人解析、缺失项判定、脱敏、schema 声明）。

### Notes

- 不含通知触发器与自定义设置卡片，与 `dsh-email-notify` 并存而不冲突。
- 设计参考了 `dsh-email-notify`（Apache-2.0）的最佳实践，未复制其源码，详见 NOTICE。
