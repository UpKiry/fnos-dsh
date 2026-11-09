/**
 * Host-only runtime schema for the fnOS settings entry.
 *
 * This module exists as a separate file — rather than living beside the shared
 * contract — because it imports `@deepseek-ai/schemastery` and the **client**
 * half of this plugin imports the shared contract. Keeping the schema here
 * means the browser bundle never pulls a host dependency: the client only needs
 * field names and the volatility unwrapper, both of which stay in
 * `theme-contract.ts`.
 *
 * @module dsh-fnos/schema
 */

import z from '@deepseek-ai/schemastery'
import { FNOS_AUTHORIZED_DIRECTORIES_FIELD, FNOS_GATEWAY_PROXY_PATHS_FIELD, FNOS_SYSTEM_THEME_FIELD, FNOS_WEB_ACTIONS_OUTSIDE_IFRAME_FIELD } from './theme-contract.ts'

/**
 * Runtime schema for the `dsh-fnos` settings entry.
 *
 * DSH resolves a settings namespace through `entry.fiber.runtime.Config`, i.e.
 * a **runtime** schema exported (as a value named `Config`) by the plugin
 * module — an `interface Config` alone erases at build time and leaves every
 * `settings.update('dsh-fnos', …)` failing with `No configurable plugin entry
 * "dsh-fnos"`. Cordis only populates `runtime.Config` from an export literally
 * named `Config`, which is why the host entry re-exports this as `Config`.
 *
 * Every field is `.volatile()`: a live edit must reach the running plugin
 * without remounting it, and only volatile fields are editable through the
 * settings forms. Cordis therefore hands `apply` a stable reference per field
 * instead of a plain value, so reads go through `volatileValue()`.
 */
export const FnosSettingsSchema = z.object({
  [FNOS_WEB_ACTIONS_OUTSIDE_IFRAME_FIELD]: z.boolean().default(false).volatile().i18n({
    zh: '在 iframe 外显示刷新与重启按钮（重启需要通过 fnOS 网关访问）',
    en: 'Show refresh and restart buttons outside iframes (restart requires the fnOS gateway)',
    ja: 'iframe 外で更新・再起動ボタンを表示（再起動には fnOS ゲートウェイが必要）',
    ko: 'iframe 외부에 새로고침 및 재시작 버튼 표시 (재시작에는 fnOS 게이트웨이 필요)',
    de: 'Aktualisieren und Neustarten außerhalb von iframes anzeigen (Neustart erfordert das fnOS-Gateway)',
    fr: 'Afficher Actualiser et Redémarrer hors des iframes (redémarrage via la passerelle fnOS)',
    es: 'Mostrar Actualizar y Reiniciar fuera de iframes (reiniciar requiere la puerta de enlace fnOS)',
    it: 'Mostra Aggiorna e Riavvia fuori dagli iframe (il riavvio richiede il gateway fnOS)',
    ru: 'Показывать обновление и перезапуск вне iframe (перезапуск требует шлюз fnOS)',
  }),
  [FNOS_SYSTEM_THEME_FIELD]: z.union(['light', 'dark']).volatile(),
  [FNOS_GATEWAY_PROXY_PATHS_FIELD]: z.array(z.string()).default([]).volatile(),
  // 默认空数组：老用户升级时该字段缺失，读取方必须能安全拿到空列表。
  [FNOS_AUTHORIZED_DIRECTORIES_FIELD]: z.array(z.string()).default([]).volatile(),
})
