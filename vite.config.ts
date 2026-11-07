import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    // 启动时即预热转换首屏与刷题页，浏览器打开时无需再等逐模块编译
    warmup: {
      clientFiles: [
        './index.html',
        './src/main.tsx',
        './src/App.tsx',
        './src/pages/Home.tsx',
        './src/pages/Practice.tsx',
        './src/lib/data.ts',
        './src/lib/questionData.ts',
      ],
    },
  },
  // 提前把大依赖纳入预构建，避免开发模式首次访问统计页时才触发二次优化（页面卡顿甚至自动刷新）
  optimizeDeps: {
    include: ['recharts', 'katex', 'react', 'react-dom', 'react-router-dom'],
  },
  build: {
    // 题库正文（questions.json 888KB / extended.json 777KB）是业务数据，已隔离在
    // Practice / Stats 的 lazy chunk 与按需加载的 extData chunk，首屏不含这两份数据。
    // 阈值按「数据 chunk」体积设定，不再为了掩盖首屏膨胀而调高。
    chunkSizeWarningLimit: 1000,
    // 不再手工 manualChunks：统计页/练习页已是动态导入，Rollup 会自动把
    // recharts、katex 拆成按需加载的 chunk；手工分组反而会把共享小工具
    // （clsx 等）错划进大 chunk，导致首屏多下载数百 KB
  },
})
