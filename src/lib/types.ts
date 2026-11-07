export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'fill_blank'
  | 'true_false'
  | 'short_answer'
  | 'calculation'

export interface Option {
  key: string
  text: string
}

/** 答案版本：老魏版 / 考研群资料版 / 教材补写版 / 拓展资料版 */
export type AnswerVersionKey = 'laowei' | 'kaoyanqun' | 'textbook' | 'ziliao'

export interface AnswerVersion {
  /** 该版本的答案正文，格式与 Question.answer 一致 */
  answer: string[] | string | boolean[]
  explanation?: string
  /** 来源说明，如「老魏机械团队 2019 年参考答案」 */
  source?: string
  /** 原文转录 | 整理 | 补写 */
  quality?: string
  /** 该版本独有的答案图 */
  answer_images?: string[]
}

export interface Question {
  id: string
  source_years: number[]
  source: string
  type: QuestionType
  stem: string
  options: Option[]
  /** 选择/多选：["A"]；判断：[true]；填空：["a","b"]；简答：字符串；计算：步骤数组 */
  answer: string[] | string | boolean[]
  explanation?: string
  knowledge_points: string[]
  chapter?: string
  difficulty?: string
  score?: number
  images: string[]
  answer_images: string[]
  original_numbers: Record<string, string>
  tags: string[]
  merge_key?: string
  /** 多版本答案；缺省时只显示顶层 answer */
  answer_versions?: Partial<Record<AnswerVersionKey, AnswerVersion>>
  /** 默认展示哪个版本；缺省显示顶层 answer */
  answer_version_default?: AnswerVersionKey
  /** Trae 版二级知识点码（如 G3）；扩展题无此字段 */
  sub_knowledge?: string[]
  /** Trae 版 A–O 章码 */
  trae_chapters?: string[]
  /** Trae 卷面题 id（如 2004-一-1） */
  trae_exam_ids?: string[]
}

/** 扩展题命中真题的记录（同一题可能多年考过） */
export interface RealExamRef {
  year: number
  /** 卷面题号，如「一、选择题 第7题」 */
  number: string
  /** 对应真题库中的题目 id，便于跳转/比对 */
  question_id?: string
  score?: number
}

/** 扩展题：非真题资料中提取的题目，独立存放于 data/extended.json */
export interface ExtendedQuestion extends Question {
  is_extended: true
  /** 该题若是考过的真题，这里列出所有年份与题号；纯补充题为空数组 */
  real_exam_refs: RealExamRef[]
  /** 原始资料文件（相对路径） */
  source_file?: string
  /** 来自哪一本资料的短名，如「青蛙弟弟选择题题库」 */
  source_book?: string
}

export interface ExtendedFile {
  meta: {
    generated_at: string
    total_questions: number
    by_source: { source: string; count: number }[]
    by_type: { type: string; label: string; count: number }[]
    tagged_real_exam: number
    type_labels: Record<string, string>
  }
  questions: ExtendedQuestion[]
}

/** data/ext_stats.json —— 扩展题统计，与真题 stats.json 口径隔离 */
export interface ExtStatsFile {
  generated_at: string
  total_questions: number
  tagged_real_exam: number
  pure_supplement: number
  by_source: { source: string; count: number }[]
  by_type: { type: string; label: string; count: number }[]
  by_chapter: { chapter: string; count: number }[]
  knowledge_point_ranking: { name: string; chapter: string; count: number }[]
  real_exam_year_distribution: { year: number; count: number }[]
  issue_counts: Record<string, number>
}

export interface QuestionsFile {
  meta: {
    subject: string
    school: string
    generated_at: string
    total_questions: number
    type_labels: Record<string, string>
    years: {
      year: number
      source: string
      paper_file: string
      answer_file: string
      note: string
      count: number
    }[]
  }
  questions: Question[]
}

export interface KnowledgePoint {
  id: string
  name: string
  questionCount: number
  questionIds: string[]
}

export interface Chapter {
  id: string
  name: string
  points: KnowledgePoint[]
  questionCount: number
}

export interface KnowledgeTree {
  subject: string
  school: string
  outline_source: string
  exam: {
    duration_minutes: number
    total_score: number
    question_types: string[]
    calculator_allowed: boolean
    references: string[]
  }
  chapters: Chapter[]
  total_questions: number
}

/** Trae 版二级知识点体系（data/sub_knowledge_tree.json） */
export interface SubKnowledgePoint {
  code: string
  name: string
  questionCount: number
  questionIds: string[]
}

export interface SubKnowledgeChapter {
  code: string
  name: string
  questionCount: number
  points: SubKnowledgePoint[]
}

export interface SubKnowledgeTree {
  subject: string
  school: string
  note: string
  total_questions: number
  chapters: SubKnowledgeChapter[]
}

export interface StatsFile {
  generated_at: string
  subject: string
  total_questions: number
  total_score: number
  by_year: { year: number; count: number; types: Record<string, number> }[]
  by_type: { type: string; label: string; count: number; score: number }[]
  by_difficulty: { difficulty: string; count: number }[]
  by_chapter: { chapter: string; count: number }[]
  knowledge_point_ranking: { name: string; chapter: string; count: number }[]
  calculation_analysis: {
    total: number
    score: number
    by_knowledge_point: { name: string; chapter: string; count: number }[]
    by_type_shape: { shape: string; count: number }[]
  }
  accuracy_stats: { note: string }
}

/** 本地答题记录 */
export interface ProgressRecord {
  questionId: string
  attempts: number
  correctCount: number
  wrongCount: number
  /** 是否在错题本中 */
  inWrongBook: boolean
  favorite: boolean
  lastCorrect: boolean | null
  lastUserAnswer: unknown
  lastTs: number
}
