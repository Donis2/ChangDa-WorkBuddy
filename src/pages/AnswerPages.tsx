import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Images,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  answerImageUrl,
  loadAnswerPages,
  type AnswerPages as AnswerPagesData,
} from '@/lib/answerData'

export function AnswerPages() {
  const [searchParams] = useSearchParams()
  // 题目卡的「查看整卷扫描答案」会带 ?year=<年份>，作为初始选中年份
  const yearParam = searchParams.get('year')
  const [data, setData] = React.useState<AnswerPagesData | null>(null)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState<number>(0)

  const [version, setVersion] = React.useState<string>('')
  const [year, setYear] = React.useState<string>('')
  const [lightbox, setLightbox] = React.useState<number | null>(null)

  // 运行时按需加载清单（不进 bundle），并在重试时重新触发
  React.useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    loadAnswerPages()
      .then((res) => {
        if (!alive) return
        setData(res)
        setVersion((prev) => (prev || res.manifest.default))
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  // 版本列表（保持 manifest.versions 的键顺序）
  const versionKeys = React.useMemo<string[]>(
    () => (data ? Object.keys(data.manifest.versions) : []),
    [data],
  )

  const currentVersionInfo = React.useMemo(
    () => (data && version ? data.manifest.versions[version] : undefined),
    [data, version],
  )

  // 当前版本年份列表（data.years 已按 year 降序），用于渲染与查找
  const yearEntries = React.useMemo(
    () => (data ? data.years.filter((e) => e.version === version) : []),
    [data, version],
  )

  // 切换版本后，把年份重置为该版本第一个有图的年份；
  // 若 URL 带了 year 且该版本确有此年份，则优先选中它（供题目卡跳转使用）
  React.useEffect(() => {
    if (!data || !version) return
    const entries = data.years.filter((e) => e.version === version && e.files.length > 0)
    const preferred =
      yearParam && entries.some((e) => e.year === yearParam) ? yearParam : undefined
    setYear(preferred ?? (entries.length > 0 ? entries[0].year : ''))
    setLightbox(null)
  }, [data, version, yearParam])

  // 当前选中年份的文件（按 manifest 文件名顺序）
  const currentFiles = React.useMemo<string[]>(() => {
    const hit = yearEntries.find((e) => e.year === year)
    return hit ? hit.files : []
  }, [yearEntries, year])

  const currentLabel = currentVersionInfo?.label ?? version
  const totalPages = React.useMemo<number>(
    () => (data ? data.years.reduce((sum, e) => sum + e.files.length, 0) : 0),
    [data],
  )

  const closeLightbox = React.useCallback(() => setLightbox(null), [])
  const prevPage = React.useCallback(
    () => setLightbox((i) => (i === null ? null : Math.max(0, i - 1))),
    [],
  )
  const nextPage = React.useCallback(
    () => setLightbox((i) => (i === null ? null : Math.min(currentFiles.length - 1, i + 1))),
    [currentFiles.length],
  )

  // 灯箱键盘监听：Esc 关闭、左右方向键翻页
  React.useEffect(() => {
    if (lightbox === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeLightbox()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevPage()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nextPage()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox, closeLightbox, prevPage, nextPage])

  function selectVersion(v: string) {
    setVersion(v)
    setLightbox(null)
  }

  function selectYear(y: string) {
    setYear(y)
    setLightbox(null)
  }

  // 加载中 / 错误态
  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">历年整卷答案（扫描版）</h1>
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Images className="h-4 w-4 animate-pulse" aria-hidden="true" />
            加载答案清单…
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">历年整卷答案（扫描版）</h1>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-destructive">
              答案清单加载失败：{error ?? '未获取到数据'}
            </p>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 标题与说明 */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">历年整卷答案（扫描版）</h1>
          <Badge variant="secondary">共 {totalPages} 页</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          老魏版与考研群资料版为两套独立扫描答案，内容有差异时两版原样各存、不自动取舍，请人工核对。
        </p>
      </div>

      {/* 版本切换 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            选择答案版本
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {versionKeys.map((v) => {
              const info = data.manifest.versions[v]
              const active = v === version
              return (
                <Button
                  key={v}
                  variant={active ? 'default' : 'outline'}
                  onClick={() => selectVersion(v)}
                >
                  {info?.label ?? data.manifest.labels[v] ?? v}
                </Button>
              )
            })}
          </div>
          {currentVersionInfo && (
            <p className="mt-3 text-xs text-muted-foreground">
              当前版本：{currentVersionInfo.label}（年份范围 {currentVersionInfo.range}，共{' '}
              {yearEntries.length} 个年份）
            </p>
          )}
        </CardContent>
      </Card>

      {/* 年份选择 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileImage className="h-4 w-4" aria-hidden="true" />
            选择年份
          </CardTitle>
        </CardHeader>
        <CardContent>
          {yearEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              该版本暂无年份数据。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {yearEntries.map((e) => {
                const active = e.year === year
                return (
                  <Button
                    key={e.year}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => selectYear(e.year)}
                    aria-pressed={active}
                  >
                    {e.year} 年 · {e.files.length} 页
                  </Button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图片网格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Images className="h-4 w-4" aria-hidden="true" />
            {currentLabel} {year ? `${year} 年` : ''}
            {currentFiles.length > 0 && (
              <Badge variant="info">{currentFiles.length} 页</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <FileImage className="h-8 w-8 opacity-50" aria-hidden="true" />
              <p>该版本 {year ? `${year} 年` : ''}暂无扫描答案图片。</p>
              <p className="text-xs">可切换上方其他年份或版本查看。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
              {currentFiles.map((file, i) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="group overflow-hidden rounded-lg border bg-card shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  aria-label={`查看 ${currentLabel} ${year}年 第${i + 1}页 大图`}
                >
                  <img
                    src={answerImageUrl(version, file)}
                    alt={`${currentLabel} ${year}年 第${i + 1}页`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[3/4] w-full rounded-t-md bg-muted object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部说明 */}
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        两版同名页面内容不同属正常，差异明细见{' '}
        <code className="rounded bg-muted px-1 py-0.5">docs/合并差异核对报告.md</code>
        ；老魏版缺 2023 年、无 2025/2026。
      </p>

      {/* 灯箱 */}
      {lightbox !== null && currentFiles[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${currentLabel} ${year}年 答案大图`}
          onClick={closeLightbox}
        >
          {/* 顶部工具条 */}
          <div
            className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-sm text-white sm:px-5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="tabular-nums">
              第 {lightbox + 1} / {currentFiles.length} 页
            </span>
            <span className="hidden text-white/70 sm:inline">
              {currentLabel} · {year} 年
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeLightbox}
              aria-label="关闭"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          {/* 大图区 */}
          <div
            className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2 pb-4 sm:gap-4 sm:px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={prevPage}
              disabled={lightbox === 0}
              aria-label="上一页"
              className="shrink-0 text-white hover:bg-white/20 hover:text-white"
            >
              <ChevronLeft className="h-8 w-8" aria-hidden="true" />
            </Button>
            <img
              src={answerImageUrl(version, currentFiles[lightbox])}
              alt={`${currentLabel} ${year}年 第${lightbox + 1}页`}
              className="max-h-[86vh] max-w-[88vw] rounded-md bg-white object-contain sm:max-h-[90vh] sm:max-w-[92vw]"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={nextPage}
              disabled={lightbox === currentFiles.length - 1}
              aria-label="下一页"
              className="shrink-0 text-white hover:bg-white/20 hover:text-white"
            >
              <ChevronRight className="h-8 w-8" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
