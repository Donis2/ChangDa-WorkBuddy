import extMetaRaw from '../../data/ext_meta.json'
import extStatsRaw from '../../data/ext_stats.json'
import type { ExtStatsFile, ExtendedFile } from './types'

/**
 * 扩展题库的「轻量元数据」（几 KB），供首页入口与统计页使用。
 * 完整题目在 data/extended.json，由 src/lib/extData.ts 引入（只进刷题页 chunk）。
 */
export const extMeta = extMetaRaw as unknown as ExtendedFile['meta']
export const extStats = extStatsRaw as unknown as ExtStatsFile
