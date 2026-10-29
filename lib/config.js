/**
 * Reading this plugin's own configuration out of the settings service.
 *
 * The harness does not always hand a plugin the plain values from the profile
 * patch: the config passed to `apply()` can carry every field as a boxed object
 * (observed 2026-10-29 — `JSON.stringify` yields `{}`, `typeof` is `object`).
 * Reading through the settings service returns the stored values, and re-reading
 * on each use also picks up a form save without a re-apply.
 */

/** This plugin's settings namespace, i.e. the `id` of its profile-patch entry. */
export const NAMESPACE = 'tianshan-email'

/**
 * Unwrap one configuration value.
 * @param {unknown} value - a configuration value, possibly boxed.
 * @returns {unknown} the plain value when it was boxed.
 */
export function plain(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value
  if ('value' in value) return value.value
  if ('raw' in value) return value.raw
  if (typeof value.valueOf === 'function') {
    try {
      const unwrapped = value.valueOf()
      if (unwrapped !== value) return unwrapped
    } catch {
      // Fall through to the value as-is.
    }
  }
  return value
}

/**
 * Find this plugin's namespace descriptor.
 * @param {unknown} settings - the settings service.
 * @param {{ redactSecrets?: boolean }} [options] - redaction policy.
 * @returns {object | undefined} the descriptor, when the service exposes one.
 */
export function findNamespace(settings, options = {}) {
  if (!settings || typeof settings.describe !== 'function') return undefined
  try {
    const views = settings.describe(options)
    if (!Array.isArray(views)) return undefined
    return views.find((entry) => String(entry?.ns) === NAMESPACE)
  } catch {
    return undefined
  }
}

/**
 * The configuration to act on: stored values when available, `apply`'s argument
 * otherwise, every field unwrapped.
 * @param {unknown} settings - the settings service.
 * @param {Record<string, unknown>} fallback - the config passed to `apply`.
 * @returns {Record<string, unknown>} plain configuration values.
 */
export function readConfig(settings, fallback) {
  const stored = findNamespace(settings, { redactSecrets: false })
  const source = stored?.value && typeof stored.value === 'object' ? stored.value : fallback
  const result = {}
  for (const [key, value] of Object.entries(source ?? {})) result[key] = plain(value)
  return result
}
