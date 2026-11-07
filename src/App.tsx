import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'

// 练习页与统计页按需加载：统计页携带 recharts（约 400KB），
// 拆分后首屏只加载首页所需代码，启动明显加快
const Practice = lazy(() =>
  import('@/pages/Practice').then((m) => ({ default: m.Practice })),
)
const Stats = lazy(() => import('@/pages/Stats').then((m) => ({ default: m.Stats })))
// 知识点统计页：复用两套知识点树自带的 questionIds 算正确率，不加载题库、不带图表库
const KnowledgeLazy = lazy(() =>
  import('@/pages/Knowledge').then((m) => ({ default: m.Knowledge })),
)
// 整卷答案扫描图页：清单走运行时 fetch，页面本身也按需加载，不进首屏 chunk
const AnswerPagesLazy = lazy(() =>
  import('@/pages/AnswerPages').then((m) => ({ default: m.AnswerPages })),
)

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      加载中…
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<PageFallback />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/practice"
          element={
            <Suspense fallback={<PageFallback />}>
              <Practice />
            </Suspense>
          }
        />
        <Route
          path="/stats"
          element={
            <Suspense fallback={<PageFallback />}>
              <Stats />
            </Suspense>
          }
        />
        <Route
          path="/knowledge"
          element={
            <Suspense fallback={<PageFallback />}>
              <KnowledgeLazy />
            </Suspense>
          }
        />
        <Route
          path="/answers"
          element={
            <Suspense fallback={<PageFallback />}>
              <AnswerPagesLazy />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
