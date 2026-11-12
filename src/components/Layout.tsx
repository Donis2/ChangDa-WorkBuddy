import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { GraduationCap, Home, PenSquare, BarChart3, Images, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageError } from '@/lib/storage'

const NAV = [
  // end: 根路径必须用精确匹配，否则 NavLink 默认会命中所有子路径，首页永远高亮
  { to: '/', label: '首页', icon: Home, end: true, preload: undefined },
  {
    to: '/practice',
    label: '刷题',
    icon: PenSquare,
    end: false,
    preload: () => import('@/pages/Practice'),
  },
  {
    to: '/knowledge',
    label: '知识点',
    icon: BookOpen,
    end: false,
    preload: () => import('@/pages/Knowledge'),
  },
  {
    to: '/stats',
    label: '统计',
    icon: BarChart3,
    end: false,
    preload: () => import('@/pages/Stats'),
  },
  {
    to: '/answers',
    label: '整卷答案',
    icon: Images,
    end: false,
    preload: () => import('@/pages/AnswerPages'),
  },
]

export function Layout() {
  const { pathname } = useLocation()
  const storageError = useStorageError()
  return (
    <div className="min-h-screen bg-background">
      {storageError && (
        <div role="alert" className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
          本地存储不可用（隐私模式或存储空间已满），本次答题进度与筛选条件不会被保存。
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sky-500 text-primary-foreground shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>
            {/* 手机只留 Logo 图标，把横向空间让给 5 个导航项；sm+ 才显示标题 */}
            <div className="hidden min-w-0 leading-tight sm:block">
              <div className="truncate text-sm font-semibold">常大 855 机械设计基础</div>
              <div className="text-[11px] text-muted-foreground">考研真题刷题平台</div>
            </div>
          </div>

          <nav aria-label="主导航" className="ml-auto flex items-center gap-0.5 sm:ml-4 sm:gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                aria-label={n.label}
                onMouseEnter={n.preload}
                className={({ isActive }) =>
                  cn(
                    // 手机：图标在上、文字在下（拇指更易点，且不必靠猜图标含义）；sm+ 恢复横向排列
                    'flex min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] transition-colors duration-150 sm:min-w-0 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm',
                    isActive ||
                      (n.to === '/practice' && pathname.startsWith('/practice'))
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <n.icon className="h-4 w-4" aria-hidden="true" />
                <span className="sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 pb-8 pt-4 sm:px-4 sm:pt-6">
        {/* key 让路由切换时重播一次极轻的淡入；纯 CSS 动画，无额外 JS 常驻开销 */}
        <div key={pathname} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border/70 bg-card/40 px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
        题库由历年真题 PDF 逐页解析整理，题目版权归常州大学所有，仅供个人学习使用。
      </footer>
    </div>
  )
}
