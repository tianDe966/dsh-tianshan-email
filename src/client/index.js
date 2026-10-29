import SettingsCard from './SettingsCard.jsx'

/**
 * Browser half of dsh-tianshan-email.
 *
 * Registers one settings section in the Web GUI sidebar. The harness renders
 * whatever a plugin registers here; without this card a third-party namespace
 * has no page at all (2026-10-29), which is why the card exists rather than
 * relying on a schema-driven form.
 */
export const inject = ['slots']

/**
 * Register the section.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the client context.
 * @returns {void}
 */
export function apply(ctx) {
  ctx.slots.inject('settings.section', () => {
    const unregister = ctx.slots.register({
      name: 'settings.section',
      id: 'tianshan-email',
      order: 150,
      label: () => 'tianshan邮件',
    }, SettingsCard)
    return () => {
      unregister()
    }
  })
}
