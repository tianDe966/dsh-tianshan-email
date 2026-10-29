/**
 * dsh-tianshan-email — SMTP delivery layer.
 *
 * Everything here is deliberately free of any settings or DSH knowledge: it
 * takes a plain config object and either sends a message or reports what is
 * still missing, so it can be unit-tested without a running harness.
 *
 * The auth code never leaves this module: `sanitize()` scrubs it out of any
 * error text before that text can reach a tool result, a log line or an HTTP
 * response. A misconfigured SMTP server likes to echo credentials back in its
 * banner, which is exactly how a secret ends up in a chat transcript.
 */
import nodemailer from 'nodemailer'

/** Fields that must be present before a message can be sent. */
const REQUIRED = [
  ['smtpHost', 'SMTP 服务器'],
  ['smtpUser', '发件邮箱'],
  ['smtpPassword', '邮箱授权码'],
  ['mailFrom', '发件人地址'],
  ['mailTo', '收件人'],
]

/**
 * Split a recipient field on ASCII or full-width commas, semicolons and newlines.
 * @param {string} value - raw recipient field.
 * @returns {string[]} trimmed, non-empty addresses.
 */
export function parseRecipients(value) {
  if (typeof value !== 'string') return []
  return value
    .split(/[,;，；\n]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * List the configuration fields that still need a value.
 * @param {Record<string, unknown>} config - plugin configuration.
 * @returns {string[]} human-readable labels, empty when the config is complete.
 */
export function missingFields(config) {
  const missing = []
  for (const [key, label] of REQUIRED) {
    const value = config?.[key]
    if (typeof value !== 'string' || value.trim() === '') missing.push(label)
  }
  if (missing.length === 0 && parseRecipients(config?.mailTo).length === 0) missing.push('收件人')
  return missing
}

/**
 * Remove the auth code from any text that is about to be shown or logged.
 * @param {string} text - candidate message.
 * @param {Record<string, unknown>} config - plugin configuration.
 * @returns {string} the message with the secret masked.
 */
export function sanitize(text, config) {
  const secret = config?.smtpPassword
  if (typeof secret !== 'string' || secret.length === 0) return text
  return text.split(secret).join('***')
}

/**
 * Send one message through the configured SMTP account.
 * @param {Record<string, unknown>} config - plugin configuration.
 * @param {{ subject: string, text: string, html?: string, to?: string }} message - the message.
 * @returns {Promise<{ recipients: string[] }>} addresses the server accepted.
 */
export async function sendMail(config, message) {
  const recipients = parseRecipients(message.to ?? config.mailTo)
  if (recipients.length === 0) throw new Error('收件人为空')

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort ?? 465),
    secure: config.smtpSecure !== false,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  try {
    await transporter.sendMail({
      from: config.mailFrom,
      to: recipients.join(', '),
      subject: message.subject,
      text: message.text,
      ...(typeof message.html === 'string' && message.html.length > 0 ? { html: message.html } : {}),
    })
    return { recipients }
  } finally {
    transporter.close()
  }
}
