/**
 * Loopback trust fence for this plugin's HTTP routes.
 *
 * The settings card and the test-mail button are the only callers, and both run
 * in the browser on this machine, so every request must prove it came from
 * localhost. Three independent checks, all of which must pass:
 *
 *   1. the socket's peer address is a loopback address (X-Forwarded-For ignored,
 *      since a proxy header is attacker-controlled);
 *   2. the Host header names a loopback host (defeats DNS-rebinding pages that
 *      resolve their own name to 127.0.0.1);
 *   3. when the browser sends an Origin (it does on same-origin POSTs), it must
 *      match the Host authority.
 */

/** @param {string} value - an IPv4 literal. @returns {boolean} whether it is 127.x.x.x. */
function isIpv4Loopback(value) {
  const parts = value.split('.')
  if (parts.length !== 4 || parts[0] !== '127') return false
  return parts.every((part) => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
}

/**
 * @param {string | undefined} address - socket peer address.
 * @returns {boolean} whether it is a loopback address.
 */
export function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIpv4Loopback(normalized.slice('::ffff:'.length))
  return isIpv4Loopback(normalized)
}

/** @param {string} hostname - a URL hostname. @returns {boolean} whether it names localhost. */
function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isIpv4Loopback(hostname)
}

/**
 * Split an authority into hostname, tolerating a port and IPv6 brackets.
 * @param {string} authority - the Host header value.
 * @returns {string | undefined} the hostname, or undefined when unparsable.
 */
function hostnameOf(authority) {
  try {
    return new URL(`http://${authority}`).hostname
  } catch {
    return undefined
  }
}

/**
 * Whether a request may use this plugin's API.
 * @param {import('node:http').IncomingMessage} request - the incoming request.
 * @returns {boolean} true for a same-origin loopback request.
 */
export function isLoopbackRequest(request) {
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false
  const authority = request.headers.host
  if (typeof authority !== 'string') return false
  if (hostnameOf(authority) === undefined) return false
  if (!isLoopbackHostname(hostnameOf(authority))) return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === new URL(`http://${authority}`).host
  } catch {
    return false
  }
}
