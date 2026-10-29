/**
 * dsh-tianshan-email — a self-hosted SMTP plugin for DeepSeek Harness.
 *
 * Three pieces, each small on purpose:
 *   1. the SMTP configuration is declared as this plugin's settings namespace,
 *      so the harness knows the fields and can validate them;
 *   2. the `send_mail` tool, so the agent can send a message;
 *   3. loopback HTTP routes plus a browser card, because the harness does not
 *      render a settings page for third-party namespaces by itself (2026-10-29).
 *
 * Deliberately absent: notification triggers (turn completion, approvals, the
 * task board). `dsh-email-notify` already owns those, and the two plugins are
 * meant to coexist.
 */
import z from '@deepseek-ai/schemastery'
import { appendFileSync } from 'node:fs'
import { NAMESPACE, readConfig } from './config.js'
import { missingFields, parseRecipients, sanitize, sendMail } from './mailer.js'
import { makeRoutes } from './routes.js'

/**
 * Diagnostic trail. A plugin that throws inside `apply()` is skipped by the
 * loader without a word in the browser, so the only way to tell "not loaded"
 * from "loaded but no page" is to leave a line behind on disk.
 */
const LOG_PATH = 'D:\\DSH_Project\\plugin01\\_probe\\tmp\\mail-plugin.log'

/**
 * Append one diagnostic line.
 * @param {string} line - what happened.
 * @returns {void}
 */
function note(line) {
  try {
    appendFileSync(LOG_PATH, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Diagnostics are optional.
  }
}

/**
 * The configuration schema, which also describes the form fields.
 *
 * Every field is `volatile()`, so a committed change re-applies the plugin
 * instead of requiring a restart, and the tool always sees saved values.
 */
export const Config = z.object({
  enabled: z.boolean().default(true)
    .description('启用本插件；关闭后 send_mail 直接拒绝发送')
    .volatile(),
  smtpHost: z.string().default('smtp.qq.com')
    .description('SMTP 服务器地址，例如 smtp.qq.com、smtp.163.com')
    .volatile(),
  smtpPort: z.number().min(1).max(65535).default(465)
    .description('SMTP 端口；465 通常配 SSL，587 通常配 STARTTLS')
    .volatile(),
  smtpSecure: z.boolean().default(true)
    .description('直连 SSL/TLS；465 端口选开，587 端口一般选关')
    .volatile(),
  smtpUser: z.string().default('')
    .description('发件邮箱账号，例如 xxx@qq.com')
    .volatile(),
  smtpPassword: z.string().role('secret').default('')
    .description('邮箱授权码（不是登录密码）；浏览器侧脱敏显示，留空则不发信')
    .volatile(),
  mailFrom: z.string().default('')
    .description('发件人地址；一般与发件邮箱相同')
    .volatile(),
  mailTo: z.string().default('')
    .description('默认收件人；多个地址用逗号、分号或换行分隔')
    .volatile(),
})

const DESCRIPTION =
  '通过本机配置的 SMTP 账户发一封邮件。默认收件人取自设置页「tianshan邮件」的「默认收件人」，'
  + '调用时可用 to 覆盖。配置不完整时返回 status=failed 并说明缺哪几项，不会抛异常。'
  + '授权码永远不会出现在返回值里。'

const PARAMETERS = {
  type: 'object',
  properties: {
    subject: { type: 'string', description: '邮件主题，一行。' },
    text: { type: 'string', description: '邮件正文，纯文本；换行用 \\n。' },
    to: { type: 'string', description: '可选：收件人，覆盖默认收件人；多个用逗号分隔。' },
    html: { type: 'string', description: '可选：HTML 正文；给了它邮件客户端会优先显示 HTML 版本。' },
  },
  required: ['subject', 'text'],
  additionalProperties: false,
}

const OUTPUT = {
  schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['sent', 'failed'] },
      recipients: { type: 'array', items: { type: 'string' } },
      message: { type: 'string' },
    },
    required: ['status', 'message'],
  },
  render: (_args, value) => [{
    type: 'text',
    text: value.status === 'sent'
      ? `邮件已发送给 ${(value.recipients ?? []).join('、') || '（默认收件人）'}`
      : `邮件未发送：${value.message}`,
  }],
}

/**
 * Mount the tool, the settings routes and the card's HTTP bridge.
 *
 * `tools`, `settings` and `webServer` are guarded services: touching them
 * without a declared dependency throws "cannot get property … without inject",
 * and a module-level `inject` export is not honoured by this loader generation
 * (2026-10-29), so each is requested here with `ctx.inject`.
 *
 * Split into two injections so a headless profile without a web server still
 * gets the tool.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context.
 * @param {Record<string, unknown>} [config] - configuration for this apply.
 * @returns {void}
 */
export function apply(ctx, config = {}) {
  try {
    const preview = JSON.stringify(config, (key, value) => (key === 'smtpPassword' ? '***' : value))
    note(`apply: inject=${typeof ctx?.inject} config=${String(preview).slice(0, 300)}`)
  } catch (error) {
    note(`apply: preview failed ${error?.message}`)
  }

  ctx.inject(['tools', 'settings'], (scoped) => {
    const settings = scoped.settings
    note(`tool half: tools=${typeof scoped.tools} settings=${typeof settings}`)

    if (settings && typeof settings.configure === 'function') {
      scoped.effect(() => settings.configure({ auto: true }), 'tianshan-email: settings page policy')
    }

    scoped.tools.register({
      name: 'send_mail',
      description: DESCRIPTION,
      parameters: PARAMETERS,
      output: OUTPUT,
      async execute(args) {
        const active = readConfig(settings, config)
        if (active.enabled === false) {
          return { status: 'failed', message: '插件已停用（设置页里关闭了「启用本插件」）' }
        }
        const missing = missingFields(active)
        if (missing.length > 0) {
          return { status: 'failed', message: `配置不完整：缺少 ${missing.join('、')}。请在设置页「tianshan邮件」里补全。` }
        }
        const subject = typeof args?.subject === 'string' ? args.subject.trim() : ''
        const text = typeof args?.text === 'string' ? args.text : ''
        if (subject === '') return { status: 'failed', message: '主题为空' }
        if (text.trim() === '') return { status: 'failed', message: '正文为空' }
        try {
          const { recipients } = await sendMail(active, {
            subject,
            text,
            ...(typeof args?.html === 'string' && args.html.length > 0 ? { html: args.html } : {}),
            ...(typeof args?.to === 'string' && args.to.trim() !== '' ? { to: args.to } : {}),
          })
          return { status: 'sent', recipients, message: `已发送给 ${recipients.join('、')}` }
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error)
          return { status: 'failed', message: sanitize(raw, active) }
        }
      },
    })
    note('tool half done: send_mail registered')
  })

  ctx.inject(['settings', 'webServer'], (scoped) => {
    note(`route half: settings=${typeof scoped.settings} webServer=${typeof scoped.webServer}`)
    const routes = makeRoutes({
      settings: scoped.settings,
      getConfig: () => readConfig(scoped.settings, config),
    })
    scoped.effect(() => {
      const disposers = routes.map((route) => scoped.webServer.register(route))
      return () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            // A route that is already gone is not worth reporting.
          }
        }
      }
    }, 'tianshan-email: loopback routes')
    note(`route half done: ${routes.map((route) => route.path).join(',')}`)
  })
}

/** Re-exported for tests and for callers that want the same parsing rules. */
export { NAMESPACE, missingFields, parseRecipients, sanitize, sendMail }
