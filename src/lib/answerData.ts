/**
 * 整卷双版本答案扫描图的数据层。
 *
 * 关键约束：manifest.json 位于 public/answers/ 下，**必须在运行时用 fetch 取**，
 * 严禁静态 import 到模块里 —— 否则会被打进首屏 chunk（有体积硬约束）。
 * 本文件不依赖 src/lib/types.ts，供答案浏览页独立使用。
 */

/** 线上答案图根目录（Vite public 目录，base 为根） */
export const ANSWER_BASE = '/answers'

/** 某个版本下按年份归组的扫描图文件名 */
export type AnswerYearMap = Record<string, string[]>

/** manifest.json 的完整结构（含与 Trae 原版兼容的扁平 laowei / kaoyanqun） */
export interface AnswerPagesManifest {
  default: string
  labels: Record<string, string>
  versions: Record<
    string,
    {
      label: string
      range: string
      years: AnswerYearMap
    }
  >
  laowei: AnswerYearMap
  kaoyanqun: AnswerYearMap
}

/** loadAnswerPages 的返回值 */
export interface AnswerPages {
  manifest: AnswerPagesManifest
  /** 把 manifest.versions 展开后的列表：按 version 分组，组内 year 降序 */
  years: { version: string; year: string; files: string[] }[]
}

/** 拼出图片线上 URL：/answers/<version>/<file> */
export function answerImageUrl(version: string, file: string): string {
  return `${ANSWER_BASE}/${version}/${file}`
}

/**
 * 运行时加载答案清单并展开成按版本分组、年份降序的列表。
 * 失败时抛出带中文说明的 Error，便于页面直接展示。
 */
export async function loadAnswerPages(): Promise<AnswerPages> {
  let res: Response
  try {
    res = await fetch(`${ANSWER_BASE}/manifest.json`)
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`无法加载答案清单（网络请求失败）：${reason}`)
  }
  if (!res.ok) {
    throw new Error(`加载答案清单失败：服务器返回 ${res.status} ${res.statusText}`)
  }

  let manifest: AnswerPagesManifest
  try {
    manifest = (await res.json()) as AnswerPagesManifest
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`答案清单格式错误，无法解析：${reason}`)
  }
  if (!manifest || typeof manifest !== 'object' || !manifest.versions) {
    throw new Error('答案清单内容异常：缺少 versions 字段，请检查 public/answers/manifest.json')
  }

  // 展开 versions：按 version 分组，组内年份按数值降序
  const years: AnswerPages['years'] = []
  for (const version of Object.keys(manifest.versions)) {
    const info = manifest.versions[version]
    if (!info || !info.years) continue
    const sortedYears = Object.keys(info.years).sort((a, b) => Number(b) - Number(a))
    for (const year of sortedYears) {
      years.push({ version, year, files: info.years[year] })
    }
  }
  return { manifest, years }
}
