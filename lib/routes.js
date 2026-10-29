/**
 * Loopback HTTP routes for the settings card.
 *
 * Three endpoints, all POST-only and all behind {@link isLoopbackRequest}:
 *   describe — the current namespace view, with the auth code replaced by a
 *              "is it set" flag, so the browser never receives the secret;
 *   mutate   — apply one or more `set`/`unset` operations;
 *   test     — send one mail with the stored configuration and report the result.
 *
 * The card cannot talk to the settings service directly (that surface is owned
 * by the harness and does not expose third-party namespaces), so it goes through
 * here.
 */
import { NAMESPACE, findNamespace, readConfig } from './config.js'
import { isLoopbackRequest } from './loopback.js'
import { missingFields, sanitize, sendMail } from './mailer.js'

/** Endpoint paths, kept in one place so the card and the host cannot drift. */
export const API = {
  describe: '/api/dsh-tianshan-email/settings/describe',
  mutate: '/api/dsh-tianshan-email/settings/mutate',
  test: '/api/dsh-tianshan-email/test',
}

const MAX_BODY_BYTES = 64 * 1024

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} response - the response.
 * @param {number} status - HTTP status.
 * @param {unknown} body - JSON-serializable payload.
 * @returns {void}
 */
function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  response.end(JSON.stringify(body))
}

/**
 * Read a bounded JSON body.
 * @param {import('node:http').IncomingMessage} request - the request.
 * @returns {Promise<unknown>} parsed body, or undefined when unreadable.
 */
async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

/**
 * Project a namespace descriptor into the shape the card expects, with the
 * secret replaced by a presence flag.
 * @param {object} descriptor - settings namespace descriptor.
 * @returns {object} browser-safe view.
 */
function toView(descriptor) {
  const view = {
    ns: String(descriptor.ns),
    revision: descriptor.revision,
  }
  if (descriptor.schema !== undefined) view.schema = descriptor.schema
  if (descriptor.value !== undefined) view.value = descriptor.value
  if (descriptor.secrets !== undefined) {
    view.secrets = descriptor.secrets.map((secret) => ({ path: [...secret.path], set: secret.set }))
  }
  return view
}

/**
 * Build the route list.
 * @param {{ settings: object, getConfig: () => Record<string, unknown> }} deps - settings service and config reader.
 * @returns {Array<object>} route definitions for `webServer.register`.
 */
export function makeRoutes(deps) {
  const { settings, getConfig } = deps

  const describe = {
    kind: 'exact',
    path: API.describe,
    handler: async (request, response) => {
      if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(request)) return json(response, 403, { ok: false, error: 'forbidden' })
      const descriptor = findNamespace(settings, { redactSecrets: true })
      return json(response, 200, {
        ok: true,
        value: {
          namespaces: descriptor === undefined ? [] : [toView(descriptor)],
          writable: settings.writable !== false,
        },
      })
    },
  }

  const mutate = {
    kind: 'exact',
    path: API.mutate,
    handler: async (request, response) => {
      if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(request)) return json(response, 403, { ok: false, error: 'forbidden' })
      const body = await readJsonBody(request)
      if (body === undefined || typeof body !== 'object' || body === null) {
        return json(response, 400, { ok: false, code: 'settings-rejected', message: 'unreadable JSON body' })
      }
      const record = body
      if (record.ns !== NAMESPACE || !Array.isArray(record.ops)) {
        return json(response, 400, { ok: false, code: 'settings-rejected', message: 'malformed settings request' })
      }
      const ops = record.ops
      const wellFormed = ops.every((op) => (op.op === 'set' || op.op === 'unset')
        && Array.isArray(op.path)
        && op.path.every((part) => typeof part === 'string'))
      if (!wellFormed) {
        return json(response, 400, { ok: false, code: 'settings-rejected', message: 'malformed settings operation' })
      }
      if (typeof settings.mutate !== 'function') {
        return json(response, 200, { ok: false, code: 'internal', message: 'settings service is read-only' })
      }
      const expectedRevision = typeof record.expectedRevision === 'number' ? record.expectedRevision : undefined
      try {
        await settings.mutate(NAMESPACE, ops, expectedRevision)
      } catch (error) {
        const code = error?.code === 'SETTINGS_CONFLICT' ? 'settings-conflict' : 'settings-rejected'
        const message = error instanceof Error ? error.message : String(error)
        return json(response, 200, { ok: false, code, message })
      }
      const descriptor = findNamespace(settings, { redactSecrets: true })
      if (descriptor === undefined) {
        return json(response, 200, { ok: false, code: 'internal', message: 'settings namespace is gone' })
      }
      return json(response, 200, { ok: true, value: toView(descriptor) })
    },
  }

  const test = {
    kind: 'exact',
    path: API.test,
    handler: async (request, response) => {
      if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'method-not-allowed' })
      if (!isLoopbackRequest(request)) return json(response, 403, { ok: false, error: 'forbidden' })
      const config = getConfig()
      const missing = missingFields(config)
      if (missing.length > 0) {
        return json(response, 200, { ok: false, error: `配置不完整：缺少 ${missing.join('、')}` })
      }
      try {
        const { recipients } = await sendMail(config, {
          subject: '【DSH】tianshan邮件 测试邮件',
          text: `这是一封由 dsh-tianshan-email 设置页「发送测试邮件」按钮发出的测试邮件。\n\n发送时间：${new Date().toLocaleString('zh-CN')}`,
        })
        return json(response, 200, { ok: true, recipients })
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error)
        return json(response, 200, { ok: false, error: sanitize(raw, config) })
      }
    },
  }

  return [describe, mutate, test]
}
