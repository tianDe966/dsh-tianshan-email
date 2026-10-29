import test from 'node:test'
import assert from 'node:assert/strict'
import { missingFields, parseRecipients, sanitize } from '../lib/mailer.js'
import { Config } from '../lib/index.js'

const COMPLETE = {
  smtpHost: 'smtp.qq.com',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: 'someone@qq.com',
  smtpPassword: 'authcode',
  mailFrom: 'someone@qq.com',
  mailTo: 'someone@qq.com',
}

test('recipients split on ASCII and full-width separators', () => {
  assert.deepEqual(parseRecipients('a@x.com, b@x.com；c@x.com\nd@x.com'), ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'])
  assert.deepEqual(parseRecipients('   '), [])
  assert.deepEqual(parseRecipients(undefined), [])
})

test('a complete config reports nothing missing', () => {
  assert.deepEqual(missingFields(COMPLETE), [])
})

test('every absent field is named', () => {
  assert.deepEqual(missingFields({}), ['SMTP 服务器', '发件邮箱', '邮箱授权码', '发件人地址', '收件人'])
})

test('a blank recipient field still counts as missing', () => {
  assert.deepEqual(missingFields({ ...COMPLETE, mailTo: ' , ; ' }), ['收件人'])
})

test('the auth code never survives sanitize', () => {
  const text = '535 Login fail: authcode rejected (authcode)'
  assert.equal(sanitize(text, COMPLETE).includes('authcode'), false)
  assert.equal(sanitize(text, COMPLETE), '535 Login fail: *** rejected (***)')
})

test('sanitize is a no-op without a secret', () => {
  assert.equal(sanitize('plain text', {}), 'plain text')
})

test('the schema declares the mail fields with defaults and marks the auth code secret', () => {
  // The serialized schema is exactly what the settings service hands to the
  // browser, so asserting on it covers both the form and the redaction contract.
  const serialized = JSON.stringify(Config)
  for (const key of ['smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'mailFrom', 'mailTo']) {
    assert.ok(serialized.includes(`"${key}"`), `${key} must be declared`)
  }
  assert.ok(serialized.includes('"role":"secret"'), 'smtpPassword must carry role=secret')
  assert.ok(serialized.includes('smtp.qq.com'), 'smtpHost default')
  assert.ok(serialized.includes('465'), 'smtpPort default')
})
