// 用户字典预设:账户类型 / 支出分类 / 收入分类
// code 是迁移与预设识别的稳定键;name 按注册时的语言写入,之后由用户自行维护
const DICTIONARY_ITEMS = [
  { kind: 'ACCOUNT_KIND', code: 'CASH', color: '#22c55e', name: { zh_CN: '现金', en_US: 'Cash' } },
  { kind: 'ACCOUNT_KIND', code: 'WECHAT', color: '#07c160', name: { zh_CN: '微信零钱', en_US: 'WeChat' } },
  { kind: 'ACCOUNT_KIND', code: 'ALIPAY', color: '#1677ff', name: { zh_CN: '支付宝余额', en_US: 'Alipay' } },
  { kind: 'ACCOUNT_KIND', code: 'DEBIT_CARD', color: '#5b8ff9', name: { zh_CN: '储蓄卡', en_US: 'Debit card' } },
  { kind: 'ACCOUNT_KIND', code: 'CREDIT_CARD', color: '#f0a020', name: { zh_CN: '信用卡', en_US: 'Credit card' } },
  { kind: 'ACCOUNT_KIND', code: 'INVESTMENT', color: '#9254de', name: { zh_CN: '理财账户', en_US: 'Investment' } },
  { kind: 'ACCOUNT_KIND', code: 'LIABILITY', color: '#f5222d', name: { zh_CN: '负债账户', en_US: 'Liability' } },
  { kind: 'ACCOUNT_KIND', code: 'OTHER', color: '#909399', name: { zh_CN: '其他', en_US: 'Other' } },

  { kind: 'INCOME_CATEGORY', code: 'SALARY', color: '#0bb06d', name: { zh_CN: '工资薪金', en_US: 'Salary' } },
  { kind: 'INCOME_CATEGORY', code: 'PART_TIME', color: '#36b37e', name: { zh_CN: '兼职劳务', en_US: 'Part-time' } },
  { kind: 'INCOME_CATEGORY', code: 'INVESTMENT', color: '#9254de', name: { zh_CN: '投资收益', en_US: 'Investment income' } },
  { kind: 'INCOME_CATEGORY', code: 'RENT', color: '#2f80ed', name: { zh_CN: '租金收入', en_US: 'Rent' } },
  { kind: 'INCOME_CATEGORY', code: 'GIFT', color: '#eb5757', name: { zh_CN: '红包礼金', en_US: 'Gifts' } },
  { kind: 'INCOME_CATEGORY', code: 'SUBSIDY', color: '#00a6a6', name: { zh_CN: '补贴返还', en_US: 'Subsidies' } },
  { kind: 'INCOME_CATEGORY', code: 'OTHER_INCOME', color: '#909399', name: { zh_CN: '其他收入', en_US: 'Other income' } },

  { kind: 'EXPENSE_CATEGORY', code: 'FOOD', color: '#f2994a', name: { zh_CN: '餐饮', en_US: 'Food' } },
  { kind: 'EXPENSE_CATEGORY', code: 'TRANSPORT', color: '#2d9cdb', name: { zh_CN: '交通', en_US: 'Transport' } },
  { kind: 'EXPENSE_CATEGORY', code: 'HOUSING', color: '#6fcf97', name: { zh_CN: '住房', en_US: 'Housing' } },
  { kind: 'EXPENSE_CATEGORY', code: 'SHOPPING', color: '#bb6bd9', name: { zh_CN: '购物', en_US: 'Shopping' } },
  { kind: 'EXPENSE_CATEGORY', code: 'MEDICAL', color: '#eb5757', name: { zh_CN: '医疗', en_US: 'Medical' } },
  { kind: 'EXPENSE_CATEGORY', code: 'ENTERTAINMENT', color: '#f2c94c', name: { zh_CN: '娱乐', en_US: 'Entertainment' } },
  { kind: 'EXPENSE_CATEGORY', code: 'SOCIAL', color: '#56ccf2', name: { zh_CN: '人情', en_US: 'Social' } },
  { kind: 'EXPENSE_CATEGORY', code: 'EDUCATION', color: '#27ae60', name: { zh_CN: '教育', en_US: 'Education' } },
  { kind: 'EXPENSE_CATEGORY', code: 'COMMUNICATION', color: '#2f80ed', name: { zh_CN: '通讯', en_US: 'Communication' } },
  { kind: 'EXPENSE_CATEGORY', code: 'INSURANCE', color: '#9b51e0', name: { zh_CN: '保险', en_US: 'Insurance' } },
  { kind: 'EXPENSE_CATEGORY', code: 'REPAYMENT', color: '#eb5757', name: { zh_CN: '还款', en_US: 'Repayment' } },
  { kind: 'EXPENSE_CATEGORY', code: 'OTHER_EXPENSE', color: '#909399', name: { zh_CN: '其他支出', en_US: 'Other expense' } }
]

function buildDefaultDictionaryItems(locale = 'zh_CN') {
  const language = locale === 'en_US' ? 'en_US' : 'zh_CN'
  const counters = new Map()

  return DICTIONARY_ITEMS.map((item) => {
    const sortOrder = counters.get(item.kind) || 0
    counters.set(item.kind, sortOrder + 1)
    return {
      kind: item.kind,
      code: item.code,
      name: item.name[language],
      color: item.color,
      enabled: true,
      sortOrder
    }
  })
}

module.exports = {
  buildDefaultDictionaryItems
}
