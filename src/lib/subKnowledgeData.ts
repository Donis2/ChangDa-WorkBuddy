import raw from '../../data/sub_knowledge_tree.json'
import type { SubKnowledgeTree } from './types'

/**
 * Trae 版二级知识点树（约 27KB）。只在 lazy chunk 中引用：
 * Practice.tsx / Stats.tsx / FilterSidebar.tsx，严禁被首屏模块 import。
 */
export const subKnowledgeTree = raw as SubKnowledgeTree

/** 知识点码 -> 名称（如 G3 ->「齿轮传动」），覆盖全部 64 点 */
export const subCodeName: Record<string, string> = (() => {
  const m: Record<string, string> = {}
  for (const ch of subKnowledgeTree.chapters) {
    for (const p of ch.points) m[p.code] = p.name
  }
  return m
})()

/** 知识点码 -> 真题命中数（来自 Trae 版逐题标注） */
export const subPointCount: Record<string, number> = (() => {
  const m: Record<string, number> = {}
  for (const ch of subKnowledgeTree.chapters) {
    for (const p of ch.points) m[p.code] = p.questionCount
  }
  return m
})()

/** 按实际遍历长度计算，不硬编码 */
export const SUB_TOTAL_POINTS = Object.keys(subCodeName).length
export const SUB_TOTAL_CHAPTERS = subKnowledgeTree.chapters.length
