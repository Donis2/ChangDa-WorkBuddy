import treeRaw from '../../data/knowledge_tree.json'
import statsRaw from '../../data/stats.json'
import type { KnowledgeTree, StatsFile } from './types'

/**
 * 轻量元数据：首页、筛选侧栏、章节归属判定用（约 90KB）。
 * **不要在这里 import 题目正文**（questions.json 888KB / extended.json 777KB），
 * 否则会被静态打进首屏 chunk。完整题库见 ./questionData.ts 与 ./extData.ts。
 */
export const knowledgeTree = treeRaw as unknown as KnowledgeTree
export const statsFile = statsRaw as unknown as StatsFile

/** 知识点 -> 章节 */
export const kpToChapter: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const ch of knowledgeTree.chapters) {
    for (const p of ch.points) m[p.name] = ch.name
  }
  return m
})()

/** 年份列表取自统计产物，避免为了拿年份把整份题库拖进首屏 */
export const years: number[] = statsFile.by_year.map((y) => y.year)
