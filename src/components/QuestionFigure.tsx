import * as React from 'react'
import { ImageIcon, Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

/**
 * 同一道题常常有两套各自独立裁切的插图：
 *  - bank  题库版：Workbuddy 原有裁切，文件名就是题目 id（如 `2004-计算-01.png`）
 *  - paper 原卷版：合并时从 Trae 项目迁移过来的原卷裁切，文件名是卷面号（如 `2004-二-1.png`）
 * 两套内容不同、合并时按「不取舍」全部保留。默认只显示一套，需要时点按钮切换。
 */
type FigureVariant = 'bank' | 'paper'

const VARIANT_LABEL: Record<FigureVariant, string> = {
  bank: '题库版',
  paper: '原卷版',
}

/** 记住上一次的选择，连续翻题时不用每题重新点 */
let lastPicked: FigureVariant | null = null

function variantOf(src: string, id: string): FigureVariant {
  const base = src.split('/').pop() ?? ''
  return base === `${id}.png` ? 'bank' : 'paper'
}

export function QuestionFigure({
  sources,
  id,
  kind = 'question',
}: {
  sources: string[]
  id: string
  kind?: 'question' | 'answer'
}) {
  const bank = React.useMemo(
    () => sources.filter((s) => variantOf(s, id) === 'bank'),
    [sources, id],
  )
  const paper = React.useMemo(
    () => sources.filter((s) => variantOf(s, id) === 'paper'),
    [sources, id],
  )
  const hasBoth = bank.length > 0 && paper.length > 0
  const [picked, setPicked] = React.useState<FigureVariant | null>(lastPicked)

  const active: FigureVariant = hasBoth
    ? picked === 'paper' && paper.length > 0
      ? 'paper'
      : 'bank'
    : bank.length > 0
      ? 'bank'
      : 'paper'
  const shown = active === 'bank' ? bank : paper

  const [zoom, setZoom] = React.useState<number | null>(null)

  const choose = (v: FigureVariant) => {
    lastPicked = v
    setPicked(v)
  }

  const label = kind === 'answer' ? '答案图' : '题图'
  /** 答案图只有一组时不显示「（原卷版）」，避免让人误以为还有另一版 */
  const variantText =
    hasBoth || kind === 'question'
      ? `（${VARIANT_LABEL[active]}${hasBoth ? '，可切换' : ''}）`
      : ''

  return (
    <div className="space-y-2">
      {hasBoth && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div
            role="group"
            aria-label="切换图片版本"
            className="inline-flex overflow-hidden rounded-md border bg-card shadow-card"
          >
            {(['bank', 'paper'] as FigureVariant[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => choose(v)}
                aria-pressed={active === v}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  active === v
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {VARIANT_LABEL[v]}
                <span className="ml-1 opacity-70">
                  {v === 'bank' ? bank.length : paper.length}
                </span>
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            同一题有两套独立裁切，点上面切换
          </span>
        </div>
      )}

      {shown.map((src, i) => (
        <figure key={src} className="overflow-hidden rounded-md border bg-white p-1.5">
          <button
            type="button"
            onClick={() => setZoom(i)}
            title="点击放大查看（可切换原始尺寸）"
            aria-label={`放大查看${id} ${label}（${VARIANT_LABEL[active]}）`}
            className="group relative mx-auto block max-w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <img
              src={imgUrl(src)}
              alt={`${id} ${label}（${VARIANT_LABEL[active]}）`}
              loading="lazy"
              decoding="async"
              className="mx-auto block h-auto max-h-[50vh] w-auto max-w-full object-contain sm:max-h-[420px]"
            />
            <span className="pointer-events-none absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-slate-900/65 px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Maximize2 className="h-3 w-3" />
              放大
            </span>
          </button>
        </figure>
      ))}

      <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <ImageIcon className="h-3 w-3" />
        {label}
        {variantText}
        <span>· 原始扫描件裁切 · 点图放大</span>
        {shown.length > 1 && <span>·共 {shown.length} 张</span>}
      </p>

      {zoom !== null && shown[zoom] && (
        <FigureLightbox
          sources={shown}
          index={zoom}
          onIndex={setZoom}
          onClose={() => setZoom(null)}
          caption={`${id} ${label}${variantText}`}
        />
      )}
    </div>
  )
}

/** 看图灯箱：默认铺满一屏，可切「原始尺寸」，长条图可横向滚动 */
function FigureLightbox({
  sources,
  index,
  onIndex,
  onClose,
  caption,
}: {
  sources: string[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  caption: string
}) {
  const [actual, setActual] = React.useState(false)
  const many = sources.length > 1

  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (many && e.key === 'ArrowRight') onIndex((index + 1) % sources.length)
      if (many && e.key === 'ArrowLeft') onIndex((index - 1 + sources.length) % sources.length)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [index, many, onClose, onIndex, sources.length])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${caption}大图`}
      onClick={onClose}
    >
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm text-white sm:px-5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 truncate">{caption}</span>
        {many && (
          <span className="tabular-nums text-white/70">
            {index + 1} / {sources.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActual((v) => !v)}
            aria-pressed={actual}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              actual
                ? 'border-white bg-white font-medium text-slate-900'
                : 'border-white/40 text-white/80 hover:bg-white/15 hover:text-white',
            )}
          >
            {actual ? '适应屏幕' : '原始尺寸'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-4 sm:gap-4 sm:px-4',
          actual ? 'overflow-auto' : 'overflow-hidden',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {many && (
          <button
            type="button"
            onClick={() => onIndex((index - 1 + sources.length) % sources.length)}
            aria-label="上一张"
            className="shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
        )}
        <img
          src={imgUrl(sources[index])}
          alt={`${caption} 第${index + 1}张`}
          className={cn(
            'rounded-md bg-white',
            actual
              ? 'max-w-none'
              : 'max-h-[86vh] max-w-[92vw] object-contain sm:max-h-[90vh]',
          )}
        />
        {many && (
          <button
            type="button"
            onClick={() => onIndex((index + 1) % sources.length)}
            aria-label="下一张"
            className="shrink-0 rounded-full p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        )}
      </div>

      <p className="shrink-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-xs text-white/50 sm:px-5">
        点空白处或按 Esc 关闭
        {many ? '；← → 切换图片' : ''}
      </p>
    </div>
  )
}
