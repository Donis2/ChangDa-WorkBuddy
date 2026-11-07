import { cn } from '@/lib/utils'
import type { ProgressMap } from '@/lib/storage'
import type { Question } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AnswerSheet({
  list,
  currentIndex,
  progress,
  onJump,
}: {
  list: Question[]
  currentIndex: number
  progress: ProgressMap
  onJump: (i: number) => void
}) {
  const nums = list.map((_, i) => i + 1)
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">答题卡</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {list.map((q, i) => {
            const rec = progress[q.id]
            const answered = (rec?.attempts ?? 0) > 0
            const isWrong = rec?.inWrongBook
            return (
              <button
                key={q.id}
                onClick={() => onJump(i)}
                title={`${q.id} · ${q.source_years.join('/')}年`}
                className={cn(
                  'flex h-8 items-center justify-center rounded text-xs font-medium transition-colors',
                  i === currentIndex
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/40'
                    : isWrong
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : answered
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-secondary text-muted-foreground hover:bg-accent',
                )}
              >
                {nums[i]}
              </button>
            )
          })}
          {list.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
              当前筛选下没有题目
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <Legend className="bg-emerald-100" label="已答对" />
          <Legend className="bg-rose-100" label="错题" />
          <Legend className="bg-secondary" label="未作答" />
        </div>
      </CardContent>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-2.5 w-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}
