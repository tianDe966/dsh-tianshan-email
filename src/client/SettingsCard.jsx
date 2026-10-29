import React, { useEffect, useState } from 'react'
import { createSettingsScope } from './scope.js'

const scope = createSettingsScope()

const FIELDS = [
  { key: 'smtpHost', label: 'SMTP 服务器', placeholder: 'smtp.qq.com', hint: '例如 smtp.qq.com、smtp.163.com' },
  { key: 'smtpPort', label: '端口', placeholder: '465', type: 'number', hint: '465 配 SSL；587 配 STARTTLS' },
  { key: 'smtpUser', label: '发件邮箱', placeholder: 'xxx@qq.com', hint: '登录邮箱地址' },
  { key: 'smtpPassword', label: '授权码', placeholder: '留空表示不修改', type: 'password', hint: '邮箱设置里生成的 SMTP 授权码，不是登录密码' },
  { key: 'mailFrom', label: '发件人', placeholder: 'DSH <xxx@qq.com>', hint: '可以带显示名' },
  { key: 'mailTo', label: '默认收件人', placeholder: 'xxx@qq.com', hint: '多个用逗号分隔' },
]

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr',
  gap: '8px 12px',
  alignItems: 'center',
  marginBottom: '12px',
}

const labelStyle = { fontSize: 13, opacity: 0.75 }
const hintStyle = { fontSize: 12, opacity: 0.5, gridColumn: '2', marginTop: -6 }
const inputStyle = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid rgba(128,128,128,0.35)',
  background: 'rgba(128,128,128,0.06)',
  color: 'inherit',
  boxSizing: 'border-box',
}
const buttonStyle = {
  padding: '6px 14px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid rgba(128,128,128,0.35)',
  background: 'rgba(128,128,128,0.12)',
  color: 'inherit',
  cursor: 'pointer',
}

/**
 * The「tianshan邮件」settings section.
 *
 * Reads its own namespace through the plugin's loopback bridge, writes one field
 * at a time, and can send a test mail with the stored configuration.
 * @returns {React.ReactElement} the section.
 */
export default function SettingsCard() {
  const [snapshot, setSnapshot] = useState(scope.getSnapshot())
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => scope.subscribe(() => setSnapshot(scope.getSnapshot())), [])

  useEffect(() => {
    if (snapshot.status !== 'ready') return
    const value = snapshot.value ?? {}
    const next = {}
    for (const field of FIELDS) {
      const current = value[field.key]
      next[field.key] = current === undefined || current === null ? '' : String(current)
    }
    next.enabled = value.enabled !== false
    next.smtpSecure = value.smtpSecure !== false
    setDraft((previous) => (Object.keys(previous).length === 0 ? next : previous))
  }, [snapshot.status, snapshot.value])

  if (snapshot.status === 'loading') {
    return <div style={{ padding: 16, fontSize: 13, opacity: 0.6 }}>正在读取邮件配置…</div>
  }
  if (snapshot.status === 'unavailable') {
    return <div style={{ padding: 16, fontSize: 13, color: '#c0392b' }}>读取配置失败：插件的本地桥接没有响应。</div>
  }

  const update = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }))

  const onSave = async () => {
    setBusy('save')
    setMessage(null)
    try {
      const payload = { ...draft }
      if (payload.smtpPort !== '') payload.smtpPort = Number(payload.smtpPort)
      await scope.save(payload)
      setMessage({ kind: 'ok', text: '已保存，立即生效。' })
    } catch (error) {
      setMessage({ kind: 'err', text: '保存失败：' + (error?.message ?? String(error)) })
    } finally {
      setBusy('')
    }
  }

  const onTest = async () => {
    setBusy('test')
    setMessage(null)
    try {
      const recipients = await scope.sendTest()
      setMessage({ kind: 'ok', text: `测试邮件已发送给 ${recipients.join('、') || '默认收件人'}，请查收。` })
    } catch (error) {
      setMessage({ kind: 'err', text: '测试发送失败：' + (error?.message ?? String(error)) })
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <p style={{ fontSize: 13, opacity: 0.65, margin: '0 0 16px' }}>
        本插件的 SMTP 账户，供 AI 主动发信（<code>send_mail</code>）。与「邮件通知」插件的配置互不影响。
      </p>

      <div style={rowStyle}>
        <span style={labelStyle}>启用插件</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={draft.enabled !== false}
            onChange={(event) => update('enabled', event.target.checked)}
          />
          {draft.enabled !== false ? '已启用' : '已停用'}
        </label>
      </div>

      {FIELDS.map((field) => (
        <React.Fragment key={field.key}>
          <div style={rowStyle}>
            <span style={labelStyle}>{field.label}</span>
            <input
              style={inputStyle}
              type={field.type ?? 'text'}
              value={draft[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(event) => update(field.key, event.target.value)}
              autoComplete={field.type === 'password' ? 'new-password' : undefined}
            />
            {field.hint ? <span style={hintStyle}>{field.hint}</span> : null}
          </div>
        </React.Fragment>
      ))}

      <div style={rowStyle}>
        <span style={labelStyle}>直连 SSL</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={draft.smtpSecure !== false}
            onChange={(event) => update('smtpSecure', event.target.checked)}
          />
          {draft.smtpSecure !== false ? '开启（465 端口）' : '关闭（587 端口用 STARTTLS）'}
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
        <button type="button" style={buttonStyle} disabled={busy !== ''} onClick={onSave}>
          {busy === 'save' ? '保存中…' : '保存'}
        </button>
        <button type="button" style={buttonStyle} disabled={busy !== ''} onClick={onTest}>
          {busy === 'test' ? '发送中…' : '发送测试邮件'}
        </button>
      </div>

      {message ? (
        <div style={{ marginTop: 12, fontSize: 13, color: message.kind === 'ok' ? '#1e8e5a' : '#c0392b' }}>
          {message.text}
        </div>
      ) : null}
    </div>
  )
}
