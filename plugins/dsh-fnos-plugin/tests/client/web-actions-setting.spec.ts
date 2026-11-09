import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { FnosSettings } from '../../src/contracts/theme-contract.ts'
import { WebActionsSetting } from '../../src/components/WebActionsSetting.tsx'
import { en, zh } from '../../src/client/locales.ts'
import { de } from '../../src/client/locales.de.ts'
import { es } from '../../src/client/locales.es.ts'
import { fr } from '../../src/client/locales.fr.ts'
import { it as italian } from '../../src/client/locales.it.ts'
import { ja } from '../../src/client/locales.ja.ts'
import { ko } from '../../src/client/locales.ko.ts'
import { ru } from '../../src/client/locales.ru.ts'

// SSR 不提交后续状态；保留这两个本地状态以在模拟事件后检查实际渲染结果。
// 其余 React API 保持真实实现，包括 useSyncExternalStore 的快照读取。
const localState = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }))
vi.mock('react', async importOriginal => {
  const original = await importOriginal<typeof import('react')>()
  return {
    ...original,
    useState(initial: unknown) {
      const index = localState.index++
      if (!(index in localState.values)) localState.values[index] = initial
      return [localState.values[index], (value: unknown) => { localState.values[index] = value }]
    },
  }
})

let change: (checked: boolean) => void
vi.mock('@tnnevol/dsh-semi-ui', () => ({
  DshSwitch: (props: { checked: boolean, disabled: boolean, loading: boolean, onChange: (checked: boolean) => void }) => {
    change = props.onChange
    return createElement('button', {
      role: 'switch', 'aria-checked': props.checked, disabled: props.disabled, 'aria-busy': props.loading,
    })
  },
}))

class Form implements ConfigForm<FnosSettings> {
  snapshot: ConfigFormSnapshot<FnosSettings> = {
    status: 'ready', value: {}, writable: true, revision: 1, base: {}, user: {},
  }

  listeners = new Set<() => void>()
  write = vi.fn(async (_field: string, _value: unknown): Promise<boolean> => true)
  getSnapshot() { return this.snapshot }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async set(field: string, value: unknown) {
    const accepted = await this.write(field, value)
    if (accepted) {
      this.snapshot = { ...this.snapshot, value: { ...this.snapshot.value, [field]: value } }
      for (const listener of this.listeners) listener()
    }
    return accepted
  }

  unset = vi.fn()
  mutate = vi.fn()
}

function render(form: Form): string {
  localState.index = 0
  return renderToStaticMarkup(createElement(WebActionsSetting, { settings: form, t: key => zh[key] }))
}

async function settle(): Promise<void> {
  // 模拟的字段写入与组件的 await 各占一轮微任务。
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  localState.values = []
  localState.index = 0
})

describe('独立窗口按钮显示设置', () => {
  it('默认关闭，并显示网关限制说明', () => {
    const html = render(new Form())
    expect(html).toContain(zh.webActionsOutsideIframe)
    expect(html).toContain(zh.webActionsOutsideIframeDescription)
    expect(html).toContain('aria-checked="false"')
    expect(html).not.toContain('disabled')
  })

  it('只在 Host 接受保存后显示新值，并支持关闭', async () => {
    const form = new Form()
    let finish: (accepted: boolean) => void = () => undefined
    form.write.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(form)
    change(true)
    change(false)
    expect(form.write).toHaveBeenCalledExactlyOnceWith('showWebActionsOutsideIframe', true)
    let html = render(form)
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('disabled')
    finish(true)
    await settle()
    html = render(form)
    expect(html).toContain('aria-checked="true"')
    expect(html).not.toContain('disabled')
    change(false)
    await settle()
    expect(render(form)).toContain('aria-checked="false"')
  })

  for (const failure of ['declined', 'rejected']) {
    it(`保存${failure}后保留原值并显示本地化失败提示`, async () => {
      const form = new Form()
      if (failure === 'declined') form.write.mockResolvedValueOnce(false)
      else form.write.mockRejectedValueOnce(new Error('unavailable'))
      render(form)
      change(true)
      await settle()
      const html = render(form)
      expect(html).toContain('aria-checked="false"')
      expect(html).toContain('role="alert"')
      expect(html).toContain(zh.webActionsSaveFailed)
      change(true)
      await settle()
      expect(render(form)).not.toContain('role="alert"')
    })
  }

  for (const status of ['loading', 'unavailable', 'readonly']) {
    it(`${status}时禁用开关且不写设置`, async () => {
      const form = new Form()
      if (status === 'readonly') form.snapshot.writable = false
      else form.snapshot.status = status as 'loading' | 'unavailable'
      expect(render(form)).toContain('disabled')
      change(true)
      await settle()
      expect(form.write).not.toHaveBeenCalled()
    })
  }

  it('九种语言均提供开关、限制说明与失败提示', () => {
    for (const dictionary of [zh, en, de, es, fr, italian, ja, ko, ru]) {
      expect(dictionary.webActionsOutsideIframe).not.toBe('')
      expect(dictionary.webActionsOutsideIframeDescription).toContain('fnOS')
      expect(dictionary.webActionsSaveFailed).not.toBe('')
    }
  })
})
