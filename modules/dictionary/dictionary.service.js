const AppError = require('../../errors/AppError')
const prisma = require('../../utils/prisma')

// 字典类型:创建后不可修改,决定这个条目供哪个业务使用
const DICTIONARY_KIND = {
  ACCOUNT_KIND: 'ACCOUNT_KIND',
  INCOME_CATEGORY: 'INCOME_CATEGORY',
  EXPENSE_CATEGORY: 'EXPENSE_CATEGORY'
}

const dictionarySelect = {
  id: true,
  kind: true,
  code: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  _count: {
    select: {
      accounts: true,
      ledgerItems: true
    }
  }
}

function kindLabel(kind) {
  if (kind === DICTIONARY_KIND.ACCOUNT_KIND) return '账户类型'
  if (kind === DICTIONARY_KIND.INCOME_CATEGORY) return '收入分类'
  return '支出分类'
}

async function listDictionaryItems(userId, kind) {
  return prisma.dictionaryItem.findMany({
    where: { userId, kind },
    select: dictionarySelect,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
  })
}

async function createDictionaryItem(userId, { kind, name }) {
  const existing = await prisma.dictionaryItem.findFirst({ where: { userId, kind, name } })
  if (existing) {
    throw new AppError(`${kindLabel(kind)}名称已存在`, 409)
  }

  const last = await prisma.dictionaryItem.findFirst({
    where: { userId, kind },
    select: { sortOrder: true },
    orderBy: { sortOrder: 'desc' }
  })

  return prisma.dictionaryItem.create({
    data: {
      userId,
      kind,
      name,
      sortOrder: (last?.sortOrder ?? -1) + 1
    },
    select: dictionarySelect
  })
}

async function updateDictionaryItem(userId, itemId, { name }) {
  const item = await prisma.dictionaryItem.findFirst({ where: { id: itemId, userId } })
  if (!item) {
    throw new AppError('字典项不存在', 404)
  }

  if (name !== undefined && name !== item.name) {
    const existing = await prisma.dictionaryItem.findFirst({
      where: { userId, kind: item.kind, name, id: { not: itemId } },
      select: { id: true }
    })
    if (existing) {
      throw new AppError(`${kindLabel(item.kind)}名称已存在`, 409)
    }
  }

  return prisma.dictionaryItem.update({
    where: { id: itemId },
    data: {
      ...(name === undefined ? {} : { name })
      // kind 故意不更新:字典类型是条目的身份,建完不能改
    },
    select: dictionarySelect
  })
}

async function deleteDictionaryItem(userId, itemId) {
  const item = await prisma.dictionaryItem.findFirst({
    where: { id: itemId, userId },
    select: {
      id: true,
      kind: true,
      _count: { select: { accounts: true, ledgerItems: true } }
    }
  })
  if (!item) {
    throw new AppError('字典项不存在', 404)
  }

  const used =
    item.kind === DICTIONARY_KIND.ACCOUNT_KIND
      ? item._count.accounts
      : item._count.ledgerItems
  if (used > 0) {
    throw new AppError(
      item.kind === DICTIONARY_KIND.ACCOUNT_KIND
        ? '该账户类型下已有账户，不能删除'
        : '该分类下已有账单，不能删除',
      409
    )
  }

  const itemCount = await prisma.dictionaryItem.count({
    where: { userId, kind: item.kind }
  })
  if (itemCount <= 1) {
    throw new AppError(`至少保留一个${kindLabel(item.kind)}`, 409)
  }

  await prisma.dictionaryItem.delete({ where: { id: itemId } })
  return { id: itemId }
}

// 账户、账单引用字典项前统一校验:必须是自己的，且类型匹配
async function assertOwnedDictionaryItem(userId, itemId, kind) {
  const item = await prisma.dictionaryItem.findFirst({
    where: { id: itemId, userId, kind },
    select: { id: true, name: true, kind: true }
  })
  if (!item) {
    throw new AppError('字典项不存在或类型不匹配', 400)
  }
  return item
}

module.exports = {
  DICTIONARY_KIND,
  listDictionaryItems,
  createDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem,
  assertOwnedDictionaryItem
}
