# dsh-tianshan-email

> 自建 SMTP 邮件插件：给 DeepSeek Harness 加一个 `send_mail` 工具，配置走设置页（schema 自动生成），授权码按 secret 字段处理、浏览器侧脱敏。

## 装什么

- **设置页「tianshan邮件」**：SMTP 服务器 / 端口 / 直连 SSL / 发件邮箱 / **邮箱授权码（secret）** / 发件人地址 / 默认收件人，外加一个「发送测试邮件」按钮，点一下就知道配置通不通。
  这张卡片属于插件自己（`src/client/`，esbuild 打成 `lib/client.js`），因为 DSH 目前不会给第三方 namespace 自动生成设置页。
- **工具 `send_mail`**：`subject` + `text` 必填，`to` 可覆盖默认收件人，`html` 可选。
  配置不全时返回 `status=failed` 并说明缺哪几项，不抛异常；授权码不会出现在任何返回值里。

## 安装

```sh
npm install dsh-tianshan-email
# 或本地目录
dsh plugin --profile web add link:D:/path/to/dsh-tianshan-email
```

装完重启 DSH，设置侧边栏会出现「tianshan邮件」页。

## 配置

| 字段 | 说明 |
| --- | --- |
| SMTP 服务器 | 例如 `smtp.qq.com`、`smtp.163.com` |
| 端口 | 465 配 SSL；587 一般配 STARTTLS |
| 直连 SSL/TLS | 465 选开，587 选关 |
| 发件邮箱 | 账号本身，例如 `xxx@qq.com` |
| 邮箱授权码 | **不是登录密码**，是邮箱设置里生成的 SMTP 授权码；留空则不发信 |
| 发件人地址 | 一般与发件邮箱相同 |
| 默认收件人 | 多个用逗号、分号或换行分隔 |

安全边界：授权码声明为 secret 字段，DSH 的设置服务在把值发往浏览器前就会脱敏；插件自身也不会把它写进日志、错误信息或工具返回值（`sanitize()` 会把它从任何将要外露的文本里抹掉）。

## 用法

配置完成后直接让 AI 发：

> 用 send_mail 给我的邮箱发一封测试邮件，主题「测试」，正文「hello」。

## 不做的事

- 不做通知触发器（对话完成、审批、提问、任务看板）——那是 `dsh-email-notify` 的领域，两者可以并存。
- 不做自定义设置卡片：schema 驱动的页面已经够用，少一层构建、少一个前端产物。
- 不缓存授权码到磁盘以外的任何地方。

## 致谢

本插件的设置页交互与凭据存储方案，参考了社区优秀插件 [dsh-email-notify](https://github.com/MCviseron/dsh-email-notify) 的最佳实践（Apache-2.0，作者 MCviseron）。本插件为独立实现，未复制其源码，详见 [NOTICE](NOTICE)。

## License

MIT
