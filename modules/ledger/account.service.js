const AppError = require('../../errors/AppError')

const prisma = require('../../utils/prisma')
const {
  DICTIONARY_KIND,
  assertOwnedDictionaryItem
} = require('../dictionary/dictionary.service')

// 对外统一这组字段:前端只认它,库里怎么存是内部事
const accountSelect = {
  id: true,
  name: true,
  kindId: true,
  kind: { select: { id: true, name: true, color: true } },
  note: true,
  balanceCents: true,
  balanceUpdatedAt: true,
  enabled: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
}

// 备注:空字符串统一存 null(和 todo 的 remark 一个处理)
function normalizeNote(value) {
  if (value === undefined) return undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

// 不传 enabled 就是全部:停用的账户只是不出现在录入选择里,列表要能看到
async function listAccounts(userId, { enabled } = {}) {
  return prisma.ledgerAccount.findMany({
    where: { userId, ...(enabled === undefined ? {} : { enabled }) },
    select: accountSelect,
    // 启用的在前,其次按用户自定义顺序,最后按创建顺序
    orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  })
}

async function createAccount(userId, data) {
  await assertOwnedDictionaryItem(userId, data.kindId, DICTIONARY_KIND.ACCOUNT_KIND)

  const existing = await prisma.ledgerAccount.findFirst({ where: { userId, name: data.name } })
  if (existing) {
    throw new AppError('账户名已存在', 409)
  }

  return prisma.ledgerAccount.create({
    data: {
      userId,
      name: data.name,
      kindId: data.kindId,
      note: normalizeNote(data.note) ?? null,
      balanceCents: data.balanceCents ?? 0,
      sortOrder: data.sortOrder ?? 0
    },
    select: accountSelect
  })
}

async function updateAccount(userId, accountId, data) {
  const account = await prisma.ledgerAccount.findFirst({ where: { id: accountId, userId } })
  if (!account) {
    throw new AppError('账户不存在', 404)
  }

  if (data.kindId !== undefined) {
    await assertOwnedDictionaryItem(userId, data.kindId, DICTIONARY_KIND.ACCOUNT_KIND)
  }

  // 改名时校验重名,排除自己
  if (data.name !== undefined && data.name !== account.name) {
    const existing = await prisma.ledgerAccount.findFirst({
      where: { userId, name: data.name, id: { not: accountId } }
    })
    if (existing) {
      throw new AppError('账户名已存在', 409)
    }
  }

  const payload = {}
  if (data.name !== undefined) payload.name = data.name
  if (data.kindId !== undefined) payload.kindId = data.kindId
  if (data.note !== undefined) payload.note = normalizeNote(data.note)
  if (data.enabled !== undefined) payload.enabled = data.enabled
  if (data.sortOrder !== undefined) payload.sortOrder = data.sortOrder

  return prisma.ledgerAccount.update({
    where: { id: accountId },
    data: payload,
    select: accountSelect
  })
}

// 余额是「手动维护的快照」:只有用户明确改余额才动它,且要刷新 balanceUpdatedAt
async function updateBalance(userId, accountId, balanceCents) {
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, balanceCents: true }
  })
  if (!account) {
    throw new AppError('账户不存在', 404)
  }

  // 金额没变就原样返回:不刷新「上次更新时间」,否则对账提醒会失真
  if (account.balanceCents === balanceCents) {
    return prisma.ledgerAccount.findUnique({ where: { id: accountId }, select: accountSelect })
  }

  return prisma.ledgerAccount.update({
    where: { id: accountId },
    data: { balanceCents, balanceUpdatedAt: new Date() },
    select: accountSelect
  })
}

async function deleteAccount(userId, accountId) {
  const account = await prisma.ledgerAccount.findFirst({ where: { id: accountId, userId } })
  if (!account) {
    throw new AppError('账户不存在', 404)
  }

  // 账户被账单引用时不能删:财务记录保留,账户改为停用
  const itemCount = await prisma.ledgerItem.count({ where: { accountId } })
  if (itemCount > 0) {
    throw new AppError('该账户下已有账单,请改为停用', 409)
  }

  await prisma.ledgerAccount.delete({ where: { id: accountId } })
  return { id: accountId }
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  updateBalance,
  deleteAccount
}
