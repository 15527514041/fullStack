// 新用户注册时自带的两套标签
const TAGS = [
  { scope: 'TODO', name: { zh_CN: '工作', en_US: 'Work' }, color: '#0bb06d' },
  { scope: 'TODO', name: { zh_CN: '学习', en_US: 'Study' }, color: '#67c23a' },
  { scope: 'TODO', name: { zh_CN: '生活', en_US: 'Life' }, color: '#e6a23c' },
  { scope: 'TODO', name: { zh_CN: '健康', en_US: 'Health' }, color: '#909399' },
  { scope: 'TODO', name: { zh_CN: '紧急', en_US: 'Urgent' }, color: '#f56c6c' },
  { scope: 'ACCOUNTING', name: { zh_CN: '固定支出', en_US: 'Fixed expense' }, color: '#909399' },
  { scope: 'ACCOUNTING', name: { zh_CN: '可报销', en_US: 'Reimbursable' }, color: '#0bb06d' },
  { scope: 'ACCOUNTING', name: { zh_CN: '大额', en_US: 'Large expense' }, color: '#e6a23c' },
  { scope: 'ACCOUNTING', name: { zh_CN: '待核对', en_US: 'Pending review' }, color: '#f56c6c' }
]

function buildDefaultTags(locale = 'zh_CN') {
  const language = locale === 'en_US' ? 'en_US' : 'zh_CN'
  const counters = new Map()
  return TAGS.map((tag) => {
    const sortOrder = counters.get(tag.scope) || 0
    counters.set(tag.scope, sortOrder + 1)
    return {
      scope: tag.scope,
      name: tag.name[language],
      color: tag.color,
      sortOrder,
      enabled: true
    }
  })
}

module.exports = {
  buildDefaultTags
}
