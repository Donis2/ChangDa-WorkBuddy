import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  fill_blank: '填空题',
  true_false: '判断题',
  short_answer: '简答题',
  calculation: '计算题',
}

export const TYPE_ORDER = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
  'calculation',
]

export function typeLabel(t: string) {
  return TYPE_LABELS[t] ?? t
}

/** 答案版本显示名（与 scripts/build_data.py 的 ANSWER_VERSION_LABELS 保持一致） */
export const ANSWER_VERSION_LABELS: Record<string, string> = {
  laowei: '老魏版',
  kaoyanqun: '考研群版',
  textbook: '教材版',
  ziliao: '拓展资料版',
}

export const ANSWER_VERSION_ORDER = ['laowei', 'kaoyanqun', 'ziliao', 'textbook']

/** 把答案数组格式化为可显示文本（判断题 true/false 转正确/错误） */
export function formatAnswerValue(
  type: string,
  answer: string[] | string | boolean[] | undefined,
): string {
  if (answer === undefined || answer === null) return ''
  if (type === 'true_false') {
    const a = Array.isArray(answer) ? answer[0] : answer
    return a ? '正确' : '错误'
  }
  if (Array.isArray(answer)) return (answer as string[]).join('\n')
  return String(answer)
}

/** 是否为客观题（点击选项即时判分） */
export function isObjective(t: string) {
  return t === 'single_choice' || t === 'multiple_choice' || t === 'true_false'
}

export function formatTs(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

/** 题库图片路径需要编码（文件名含中文） */
export function imgUrl(p: string) {
  return encodeURI(p)
}
