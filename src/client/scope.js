/**
 * Browser-side settings scope for this plugin's card.
 *
 * The harness does not expose third-party settings namespaces to the browser, so
 * the card talks to the plugin's own loopback routes instead:
 *   describe → the current values plus which secrets are set
 *   mutate   → set / unset one field at a time
 *
 * `smtpPassword` is a secret: the server never returns it, only whether it is
 * set. An empty value in a save therefore means "keep what is stored".
 */
const API = {
  describe: '/api/dsh-tianshan-email/settings/describe',
  mutate: '/api/dsh-tianshan-email/settings/mutate',
  test: '/api/dsh-tianshan-email/test',
}

const NS = 'tianshan-email'

/**
 * Create a scope bound to this plugin's namespace.
 * @returns {object} scope with snapshot, subscription and write helpers.
 */
export function createSettingsScope() {
  let snapshot = {
    status: 'loading',
    value: undefined,
    revision: undefined,
    writable: false,
  }
  const listeners = new Set()
  let tail = Promise.resolve()

  const emit = () => {
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // A broken listener must not break the others.
      }
    }
  }

  const post = async (path, body) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    return await response.json()
  }

  const accept = (view) => {
    snapshot = {
      status: 'ready',
      value: view?.value ?? {},
      revision: view?.revision,
      writable: true,
    }
    emit()
  }

  const read = async () => {
    try {
      const body = await post(API.describe, {})
      const view = body?.value?.namespaces?.find((entry) => entry.ns === NS)
      if (body?.ok !== true || view === undefined) throw new Error('settings bridge unavailable')
      accept(view)
    } catch {
      snapshot = { ...snapshot, status: 'unavailable' }
      emit()
    }
  }

  const write = async (ops, expectedRevision) => {
    const revision = expectedRevision ?? snapshot.revision
    const body = await post(API.mutate, {
      ns: NS,
      ops,
      ...(revision === undefined ? {} : { expectedRevision: revision }),
    })
    if (body?.ok !== true) throw new Error(body?.message ?? body?.code ?? '保存失败')
    if (body.value !== undefined) accept(body.value)
  }

  const enqueue = (operation) => {
    const task = tail.then(operation, operation)
    tail = task.catch(() => {})
    return task
  }

  void read()

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set: (field, value) => enqueue(() => write([{ op: 'set', path: [field], value }])),
    unset: (field) => enqueue(() => write([{ op: 'unset', path: [field] }])),
    /**
     * Save a whole draft: empty values clear the field, except the secret,
     * where empty means "leave the stored auth code alone".
     * @param {Record<string, unknown>} draft - field values.
     * @returns {Promise<void>} resolves when every field was written.
     */
    save: (draft) => enqueue(async () => {
      for (const [field, value] of Object.entries(draft)) {
        if (field === 'smtpPassword' && (value === '' || value === undefined)) continue
        if (value === undefined || value === null || value === '') await write([{ op: 'unset', path: [field] }])
        else await write([{ op: 'set', path: [field], value }])
      }
    }),
    /** Ask the host to send one test mail with the stored configuration. */
    sendTest: async () => {
      const body = await post(API.test, {})
      if (body?.ok !== true) throw new Error(body?.error ?? '发送失败')
      return body.recipients ?? []
    },
    refresh: read,
  }
}
