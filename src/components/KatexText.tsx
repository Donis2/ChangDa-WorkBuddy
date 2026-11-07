import * as React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 全局 LRU 缓存：按「公式 + 行内/块级」复用编译结果。
 * 组件内的 useMemo 只在同一个实例内有效，单题模式每题销毁重建、
 * 全显示模式筛选变化时都会重新解析，几百次同步 renderToString 会卡主线程。
 */
const KATEX_CACHE_MAX = 800
const katexCache = new Map<string, string>()

function renderKatex(tex: string, displayMode: boolean) {
  const key = `${displayMode ? 'b' : 'i'}:${tex}`
  const hit = katexCache.get(key)
  if (hit !== undefined) {
    // 命中后移到末尾，维持真正的 LRU 顺序
    katexCache.delete(key)
    katexCache.set(key, hit)
    return hit
  }
  let html: string
  try {
    html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
    })
  } catch {
    html = escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`)
  }
  if (katexCache.size >= KATEX_CACHE_MAX) {
    const oldest = katexCache.keys().next().value
    if (oldest !== undefined) katexCache.delete(oldest)
  }
  katexCache.set(key, html)
  return html
}

/**
 * 渲染带 $...$ / $$...$$ 公式的文本（KaTeX），其余部分按纯文本（含换行）显示。
 */
export function KatexText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const html = React.useMemo(() => {
    const parts = String(text ?? '').split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
    return parts
      .filter((p) => p !== '')
      .map((part) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          return renderKatex(part.slice(2, -2), true)
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          // 包一层横向滚动容器：窄屏长公式不撑破布局
          return `<span class="katex-inline-scroll">${renderKatex(part.slice(1, -1), false)}</span>`
        }
        return escapeHtml(part).replace(/\n/g, '<br/>')
      })
      .join('')
  }, [text])

  return <span className={cn('break-words', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

/** 多行内容（解析 / 答案步骤）渲染 */
export function KatexBlock({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const lines = String(text ?? '').split('\n').filter((l) => l.trim() !== '')
  return (
    <div className={cn('space-y-1.5 leading-relaxed', className)}>
      {lines.map((l, i) => (
        <div key={i}>
          <KatexText text={l} />
        </div>
      ))}
    </div>
  )
}
