// 新用户注册时自带的两套标签
const TAGS = [
  { scope: 'TODO', name: { zh_CN: '工作', en_US: 'Work' }, type: 'primary' },
  { scope: 'TODO', name: { zh_CN: '学习', en_US: 'Study' }, type: 'success' },
  { scope: 'TODO', name: { zh_CN: '生活', en_US: 'Life' }, type: 'warning' },
  { scope: 'TODO', name: { zh_CN: '健康', en_US: 'Health' }, type: 'info' },
  { scope: 'TODO', name: { zh_CN: '紧急', en_US: 'Urgent' }, type: 'danger' },
  { scope: 'ACCOUNTING', name: { zh_CN: '固定支出', en_US: 'Fixed expense' }, type: 'info' },
  { scope: 'ACCOUNTING', name: { zh_CN: '可报销', en_US: 'Reimbursable' }, type: 'primary' },
  { scope: 'ACCOUNTING', name: { zh_CN: '大额', en_US: 'Large expense' }, type: 'warning' },
  { scope: 'ACCOUNTING', name: { zh_CN: '待核对', en_US: 'Pending review' }, type: 'danger' }
]

function buildDefaultTags(locale = 'zh_CN') {
  const language = locale === 'en_US' ? 'en_US' : 'zh_CN'
  return TAGS.map((tag) => ({
    scope: tag.scope,
    name: tag.name[language],
    type: tag.type
  }))
}

module.exports = {
  buildDefaultTags
}
