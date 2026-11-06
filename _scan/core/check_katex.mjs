// 用项目自带 katex 逐个编译题库中的所有公式，报告解析失败项
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import katex from 'katex'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

const qs = readJson('data/questions.json')
const list = Array.isArray(qs) ? qs : (qs.questions || [])
console.log('真题数:', list.length)

let ext = []
try {
  const extRaw = readJson('data/extended.json')
  ext = extRaw.questions || []
  console.log('扩展题数:', ext.length)
} catch (e) {
  console.log('（无 extended.json，只校验真题）')
}

const FIELDS = ['stem', 'answer', 'explanation', 'analysis']
let total = 0
const bad = []
const odd = []

function check(id, field, text) {
  if (typeof text !== 'string' || !text) return
  if (text.includes('**')) odd.push(`${id} ${field}: 残留 **`)
  // 抽取 $$...$$ 与 $...$
  const blocks = []
  let s = text
  // 先块级
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, body) => { blocks.push(['block', body]); return ' ' })
  s = s.replace(/\$([^$\n]+?)\$/g, (m, body) => { blocks.push(['inline', body]); return ' ' })
  if (s.includes('$')) odd.push(`${id} ${field}: 落单的 $ —— ${s.replace(/\s+/g, ' ').slice(0, 80)}`)
  for (const [kind, body] of blocks) {
    total++
    try {
      katex.renderToString(body, { displayMode: kind === 'block', throwOnError: true, strict: false })
    } catch (e) {
      bad.push(`${id} ${field} [${kind}] ${body.slice(0, 90)} → ${e.message.split('\n')[0]}`)
    }
  }
}

for (const q of [...list, ...ext]) {
  for (const f of FIELDS) check(q.id, f, q[f])
  if (Array.isArray(q.options)) {
    q.options.forEach((o, i) => check(q.id, `option[${i}]`, typeof o === 'string' ? o : o?.text || ''))
  }
}

console.log('公式总数:', total)
console.log('KaTeX 解析失败:', bad.length)
bad.forEach(b => console.log('  ✗', b))
console.log('结构性问题(奇数$/残留**):', odd.length)
odd.forEach(o => console.log('  !', o))

if (bad.length || odd.length) process.exitCode = 1
