// 用户字典预设:账户类型 / 支出分类 / 收入分类
// code 是迁移与预设识别的稳定键;name 按注册时的语言写入,之后由用户自行维护
const DICTIONARY_ITEMS = [
  { kind: 'ACCOUNT_KIND', code: 'CASH', icon: 'CASH', name: { zh_CN: '现金', en_US: 'Cash' } },
  { kind: 'ACCOUNT_KIND', code: 'WECHAT', icon: 'WECHAT', name: { zh_CN: '微信零钱', en_US: 'WeChat' } },
  { kind: 'ACCOUNT_KIND', code: 'ALIPAY', icon: 'ALIPAY', name: { zh_CN: '支付宝余额', en_US: 'Alipay' } },
  { kind: 'ACCOUNT_KIND', code: 'DEBIT_CARD', icon: 'DEBIT_CARD', name: { zh_CN: '储蓄卡', en_US: 'Debit card' } },
  { kind: 'ACCOUNT_KIND', code: 'CREDIT_CARD', icon: 'CREDIT_CARD', name: { zh_CN: '信用卡', en_US: 'Credit card' } },
  { kind: 'ACCOUNT_KIND', code: 'INVESTMENT', icon: 'INVESTMENT', name: { zh_CN: '理财账户', en_US: 'Investment' } },
  { kind: 'ACCOUNT_KIND', code: 'LIABILITY', icon: 'LIABILITY', name: { zh_CN: '负债账户', en_US: 'Liability' } },
  { kind: 'ACCOUNT_KIND', code: 'OTHER', icon: 'OTHER', name: { zh_CN: '其他', en_US: 'Other' } },

  { kind: 'INCOME_CATEGORY', code: 'SALARY', name: { zh_CN: '工资薪金', en_US: 'Salary' } },
  { kind: 'INCOME_CATEGORY', code: 'PART_TIME', name: { zh_CN: '兼职劳务', en_US: 'Part-time' } },
  { kind: 'INCOME_CATEGORY', code: 'INVESTMENT', name: { zh_CN: '投资收益', en_US: 'Investment income' } },
  { kind: 'INCOME_CATEGORY', code: 'RENT', name: { zh_CN: '租金收入', en_US: 'Rent' } },
  { kind: 'INCOME_CATEGORY', code: 'GIFT', name: { zh_CN: '红包礼金', en_US: 'Gifts' } },
  { kind: 'INCOME_CATEGORY', code: 'SUBSIDY', name: { zh_CN: '补贴返还', en_US: 'Subsidies' } },
  { kind: 'INCOME_CATEGORY', code: 'OTHER_INCOME', name: { zh_CN: '其他收入', en_US: 'Other income' } },

  { kind: 'EXPENSE_CATEGORY', code: 'FOOD', name: { zh_CN: '餐饮', en_US: 'Food' } },
  { kind: 'EXPENSE_CATEGORY', code: 'TRANSPORT', name: { zh_CN: '交通', en_US: 'Transport' } },
  { kind: 'EXPENSE_CATEGORY', code: 'HOUSING', name: { zh_CN: '住房', en_US: 'Housing' } },
  { kind: 'EXPENSE_CATEGORY', code: 'SHOPPING', name: { zh_CN: '购物', en_US: 'Shopping' } },
  { kind: 'EXPENSE_CATEGORY', code: 'MEDICAL', name: { zh_CN: '医疗', en_US: 'Medical' } },
  { kind: 'EXPENSE_CATEGORY', code: 'ENTERTAINMENT', name: { zh_CN: '娱乐', en_US: 'Entertainment' } },
  { kind: 'EXPENSE_CATEGORY', code: 'SOCIAL', name: { zh_CN: '人情', en_US: 'Social' } },
  { kind: 'EXPENSE_CATEGORY', code: 'EDUCATION', name: { zh_CN: '教育', en_US: 'Education' } },
  { kind: 'EXPENSE_CATEGORY', code: 'COMMUNICATION', name: { zh_CN: '通讯', en_US: 'Communication' } },
  { kind: 'EXPENSE_CATEGORY', code: 'INSURANCE', name: { zh_CN: '保险', en_US: 'Insurance' } },
  { kind: 'EXPENSE_CATEGORY', code: 'REPAYMENT', name: { zh_CN: '还款', en_US: 'Repayment' } },
  { kind: 'EXPENSE_CATEGORY', code: 'OTHER_EXPENSE', name: { zh_CN: '其他支出', en_US: 'Other expense' } }
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
      icon: item.icon || null,
      sortOrder
    }
  })
}

module.exports = {
  buildDefaultDictionaryItems
}
