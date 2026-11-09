import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { FnosSettings } from '../../src/contracts/theme-contract.ts'
import { FnosWebRestartAction } from '../../src/components/FnosWebRestartAction.tsx'

// 只替换视觉组件，保留 React 的真实渲染与设置快照读取。
vi.mock('@tnnevol/dsh-semi-ui', () => ({
  DshButton: 'button',
  DshButtonGroup: 'div',
  DshIconButton: 'button',
  DshIconRefresh2: () => null,
  DshIconSync: () => null,
}))

function form(value: FnosSettings | undefined): ConfigForm<FnosSettings> {
  // 与真实 ConfigFormController 一样用原型方法，验证传给 React 时保留 this。
  return new class implements ConfigForm<FnosSettings> {
    snapshot: ConfigFormSnapshot<FnosSettings> = {
      status: value === undefined ? 'loading' : 'ready', value,
      base: undefined, user: undefined, revision: 1, writable: true,
    }

    listeners = new Set<() => void>()
    getSnapshot() { return this.snapshot }
    subscribe(listener: () => void) {
      this.listeners.add(listener)
      return () => { this.listeners.delete(listener) }
    }

    async set(field: string, next: unknown) {
      this.snapshot = { ...this.snapshot, status: 'ready', value: { ...this.snapshot.value, [field]: next } }
      for (const listener of this.listeners) listener()
      return true
    }

    unset = vi.fn()
    mutate = vi.fn()
  }()
}

function render(settings: ConfigForm<FnosSettings>, wide = true): string {
  return renderToStaticMarkup(createElement(FnosWebRestartAction, { wide, settings, t: key => key }))
}

function carrier(embedded: boolean): void {
  const frame: { parent?: unknown } = {}
  frame.parent = embedded ? {} : frame
  vi.stubGlobal('window', frame)
}

describe('独立窗口刷新与重启入口', () => {
  for (const wide of [true, false]) {
    for (const enabled of [undefined, false, true]) {
      it(`iframe 内保持显示：wide=${wide}, setting=${enabled}`, () => {
        carrier(true)
        const html = render(form(enabled === undefined ? {} : { showWebActionsOutsideIframe: enabled }), wide)
        expect(html).toContain('dsh-fnos-web-actions')
        expect(html).toContain('webRestart')
        expect(html).toContain('refresh')
      })
      it(`iframe 外只在显式开启时显示：wide=${wide}, setting=${enabled}`, () => {
        carrier(false)
        const html = render(form(enabled === undefined ? {} : { showWebActionsOutsideIframe: enabled }), wide)
        expect(html.includes('dsh-fnos-web-actions')).toBe(enabled === true)
        if (enabled !== true) expect(html).toBe('')
      })
    }
  }

  it('设置仍在加载时，独立窗口保持隐藏', () => {
    carrier(false)
    expect(render(form(undefined))).toBe('')
  })

  it('读取保存后的最新值，包括反向关闭和重新打开页面', async () => {
    carrier(false)
    const settings = form({})
    expect(render(settings)).toBe('')
    await settings.set('showWebActionsOutsideIframe', true)
    expect(render(settings)).toContain('dsh-fnos-web-actions')
    const reopened = form(settings.getSnapshot().value)
    expect(render(reopened, false)).toContain('dsh-fnos-web-actions--collapsed')
    await settings.set('showWebActionsOutsideIframe', false)
    expect(render(settings)).toBe('')
  })
})
