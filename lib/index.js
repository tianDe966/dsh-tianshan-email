/**
 * dsh-tianshan-email — a self-hosted SMTP plugin for DeepSeek Harness.
 *
 * Two halves, both small on purpose:
 *   1. the SMTP configuration is declared as this plugin's settings namespace,
 *      so DSH renders the form straight from the schema. The auth code is a
 *      `role('secret')` field: the settings service keeps it out of the value it
 *      sends to the browser and out of every response it serializes.
 *   2. the `send_mail` tool, so the agent can actually send a message.
 *
 * Deliberately absent: notification triggers (turn completion, approvals, the
 * task board) and a hand-written settings card. `dsh-email-notify` already owns
 * the first, and the schema-driven page is enough for the second.
 */
import z from '@deepseek-ai/schemastery'
import { missingFields, parseRecipients, sanitize, sendMail } from './mailer.js'

/**
 * The configuration schema, which doubles as the settings page.
 *
 * Every field is `volatile()`, meaning the loader re-applies the plugin on a
 * committed change instead of requiring a restart, so the tool always sees the
 * values the user just saved.
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
  '通过本机配置的 SMTP 账户发一封邮件。默认收件人取自设置页的「默认收件人」，'
  + '调用时可用 to 覆盖。配置不完整时返回 status=failed 并说明缺哪几项，不会抛异常。'
  + '授权码永远不会出现在返回值里。'

const PARAMETERS = {
  type: 'object',
  properties: {
    subject: {
      type: 'string',
      description: '邮件主题，一行。',
    },
    text: {
      type: 'string',
      description: '邮件正文，纯文本；换行用 \\n。',
    },
    to: {
      type: 'string',
      description: '可选：收件人，覆盖设置页里的默认收件人；多个用逗号分隔。',
    },
    html: {
      type: 'string',
      description: '可选：HTML 正文；给了它邮件客户端会优先显示 HTML 版本。',
    },
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
 * Mount the settings page and the tool.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the plugin context.
 * @param {Record<string, unknown>} [config] - resolved configuration for this apply.
 * @returns {void}
 */
export function apply(ctx, config = {}) {
  // Let DSH render the settings page from `Config`. On a harness whose settings
  // service predates `configure()` there is nothing to switch on: the page is
  // generated anyway, and the tool still reads the same resolved config.
  ctx.inject(['settings'], (scoped) => {
    const settings = scoped.settings
    if (settings && typeof settings.configure === 'function') {
      ctx.effect(() => settings.configure({ auto: true }), 'tianshan-email: settings page policy')
    }
  })

  ctx.tools.register({
    name: 'send_mail',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: OUTPUT,
    async execute(args) {
      const enable = config.enabled !== false
      if (!enable) return { status: 'failed', message: '插件已停用（设置页里关闭了「启用本插件」）' }

      const missing = missingFields(config)
      if (missing.length > 0) {
        return { status: 'failed', message: `配置不完整：缺少 ${missing.join('、')}。请在设置页「邮件」里补全。` }
      }

      const subject = typeof args?.subject === 'string' ? args.subject.trim() : ''
      const text = typeof args?.text === 'string' ? args.text : ''
      if (subject === '') return { status: 'failed', message: '主题为空' }
      if (text.trim() === '') return { status: 'failed', message: '正文为空' }

      try {
        const { recipients } = await sendMail(config, {
          subject,
          text,
          ...(typeof args?.html === 'string' && args.html.length > 0 ? { html: args.html } : {}),
          ...(typeof args?.to === 'string' && args.to.trim() !== '' ? { to: args.to } : {}),
        })
        return { status: 'sent', recipients, message: `已发送给 ${recipients.join('、')}` }
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error)
        return { status: 'failed', message: sanitize(raw, config) }
      }
    },
  })
}

/** Re-exported for tests and for callers that want the same parsing rules. */
export { missingFields, parseRecipients, sanitize, sendMail }
