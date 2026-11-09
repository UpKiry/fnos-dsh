import { useCallback, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DshSwitch } from '@tnnevol/dsh-semi-ui'
import type { FnosLocaleKey } from '../client/locales.ts'
import { FNOS_WEB_ACTIONS_OUTSIDE_IFRAME_FIELD, type FnosSettings } from '../contracts/theme-contract.ts'

interface WebActionsSettingProps {
  settings: ConfigForm<FnosSettings>
  t: (key: FnosLocaleKey) => string
}

/** 当前 DSH 基线只提供 Config 契约，尚无自动表单客户端，因此在现有配置区显示开关。 */
export function WebActionsSetting({ settings, t }: WebActionsSettingProps) {
  const subscribe = useCallback((listener: () => void) => settings.subscribe(listener), [settings])
  const getSnapshot = useCallback(() => settings.getSnapshot(), [settings])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const labelId = useId()
  const descriptionId = useId()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pendingRef = useRef(false)
  const disabled = snapshot.status !== 'ready' || !snapshot.writable || busy

  const save = useCallback(async (checked: boolean): Promise<void> => {
    const current = settings.getSnapshot()
    if (pendingRef.current || current.status !== 'ready' || !current.writable) return
    pendingRef.current = true
    setBusy(true)
    setFailed(false)
    try {
      if (!await settings.set(FNOS_WEB_ACTIONS_OUTSIDE_IFRAME_FIELD, checked)) setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }, [settings])

  return (
    <div className="dsh-fnos-authorized-gateway">
      <div className="dsh-fnos-authorized-gateway-head">
        <strong id={labelId} className="dsh-fnos-authorized-gateway-title">{t('webActionsOutsideIframe')}</strong>
        <DshSwitch
          checked={snapshot.value?.showWebActionsOutsideIframe === true}
          disabled={disabled}
          loading={busy}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          onChange={checked => { void save(checked) }}
        />
      </div>
      <p id={descriptionId} className="dsh-fnos-authorized-body">{t('webActionsOutsideIframeDescription')}</p>
      {failed ? <p role="alert" className="dsh-fnos-authorized-error">{t('webActionsSaveFailed')}</p> : null}
    </div>
  )
}
