const AppError = require('../../errors/AppError')

const prisma = require('../../utils/prisma')
const { assertOwnedTagIds, TAG_SCOPE } = require('../tag/tag.service')
const { DICTIONARY_KIND } = require('../dictionary/dictionary.service')

const PERIOD_LABELS = {
  manual_day: '该日期',
  manual_week: '该周',
  manual_month: '该月'
}

function toDateValue(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function toDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

// 根据 source 补全周期结束日期。接口只收 periodStart,避免前端传错 periodEnd。
function computePeriodEnd(source, periodStart) {
  const start = toDateValue(periodStart)

  if (source === 'manual_day') {
    return start
  }

  if (source === 'manual_week') {
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 6)
    return end
  }

  // 月账单:下个月的第 0 天就是当月最后一天
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
}

function periodExistsMessage(source) {
  return `${PERIOD_LABELS[source] || '该周期'}已有账单记录`
}

function isUniqueViolation(error) {
  return error?.code === 'P2002'
}

function normalizeRemark(value) {
  if (value === undefined) return undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

async function assertPeriodAvailable(userId, source, periodStart, excludeId) {
  const existing = await prisma.ledgerRecord.findFirst({
    where: {
      userId,
      source,
      periodStart: toDateValue(periodStart),
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { id: true }
  })

  if (existing) {
    throw new AppError(periodExistsMessage(source), 409)
  }
}

// 明细入参 → 可直接嵌套写入的数据。
// 账户和标签先统一校验,避免事务里写了一半才发现归属不对。
async function prepareItems(userId, items) {
  const accountIds = [...new Set(items.map((item) => item.accountId))]
  const ownedAccounts = await prisma.ledgerAccount.findMany({
    where: { id: { in: accountIds }, userId },
    select: { id: true }
  })
  if (ownedAccounts.length !== accountIds.length) {
    throw new AppError('账户不存在', 400)
  }

  const allTagIds = [...new Set(items.flatMap((item) => item.tagIds || []))]
  await assertOwnedTagIds(userId, allTagIds, TAG_SCOPE.ACCOUNTING)

  const categoryIds = [...new Set(items.map((item) => item.categoryId))]
  const ownedCategories = await prisma.dictionaryItem.findMany({
    where: { id: { in: categoryIds }, userId },
    select: { id: true, kind: true }
  })
  const categoryKinds = new Map(ownedCategories.map((item) => [item.id, item.kind]))

  return items.map((item, index) => {
    const tagIds = [...new Set(item.tagIds || [])]
    const categoryKind = categoryKinds.get(item.categoryId)
    if (!categoryKind) {
      throw new AppError('分类不存在', 400)
    }
    const expectedKind =
      item.type === 'INCOME'
        ? DICTIONARY_KIND.INCOME_CATEGORY
        : DICTIONARY_KIND.EXPENSE_CATEGORY
    if (categoryKind !== expectedKind) {
      throw new AppError('分类与收支类型不匹配', 400)
    }

    return {
      type: item.type,
      categoryId: item.categoryId,
      accountId: item.accountId,
      amountCents: item.amountCents,
      remark: normalizeRemark(item.remark),
      sortOrder: index,
      ...(tagIds.length ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {})
    }
  })
}

const recordSummarySelect = {
  id: true,
  source: true,
  periodStart: true,
  periodEnd: true,
  createdAt: true,
  updatedAt: true,
  items: { select: { type: true, amountCents: true } }
}

const recordDetailInclude = {
  items: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      account: {
        select: {
          id: true,
          name: true,
          kind: { select: { id: true, name: true, color: true } },
          enabled: true
        }
      },
      category: { select: { id: true, name: true, color: true } },
      tags: { select: { id: true, name: true, color: true, enabled: true } }
    }
  }
}

function toRecordSummary(record) {
  let incomeCents = 0
  let expenseCents = 0

  for (const item of record.items) {
    if (item.type === 'INCOME') incomeCents += item.amountCents
    else expenseCents += item.amountCents
  }

  return {
    id: record.id,
    source: record.source,
    periodStart: toDateString(record.periodStart),
    periodEnd: toDateString(record.periodEnd),
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    itemCount: record.items.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function toRecordDetail(record) {
  if (!record) return record
  const { items = [], ...rest } = record

  return {
    ...toRecordSummary({ ...rest, items }),
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      amountCents: item.amountCents,
      categoryId: item.categoryId,
      category: item.category,
      accountId: item.accountId,
      remark: item.remark ?? null,
      sortOrder: item.sortOrder,
      account: item.account,
      tags: item.tags,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  }
}

async function listRecords(userId, query) {
  const { source, page = 1, pageSize = 10, from, to } = query

  const where = { userId, source }
  if (from || to) {
    where.periodStart = {
      ...(from ? { gte: toDateValue(from) } : {}),
      ...(to ? { lte: toDateValue(to) } : {})
    }
  }

  const [list, total] = await Promise.all([
    prisma.ledgerRecord.findMany({
      where,
      select: recordSummarySelect,
      orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.ledgerRecord.count({ where })
  ])

  return {
    list: list.map(toRecordSummary),
    total,
    page,
    pageSize
  }
}

async function getRecordById(id, userId) {
  const record = await prisma.ledgerRecord.findFirst({
    where: { id, userId },
    include: recordDetailInclude
  })
  return toRecordDetail(record)
}

async function createRecord(userId, data) {
  const { source, periodStart } = data
  await assertPeriodAvailable(userId, source, periodStart)
  const items = await prepareItems(userId, data.items)

  try {
    const record = await prisma.ledgerRecord.create({
      data: {
        userId,
        source,
        periodStart: toDateValue(periodStart),
        periodEnd: computePeriodEnd(source, periodStart),
        items: { create: items }
      },
      include: recordDetailInclude
    })
    return toRecordDetail(record)
  } catch (error) {
    // 并发创建时唯一索引是最后一道防线
    if (isUniqueViolation(error)) {
      throw new AppError(periodExistsMessage(source), 409)
    }
    throw error
  }
}

async function updateRecord(userId, recordId, data) {
  const existing = await prisma.ledgerRecord.findFirst({
    where: { id: recordId, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('账单记录不存在', 404)
  }

  const items = await prepareItems(userId, data.items)

  const record = await prisma.$transaction(async (tx) => {
    // 记录的周期是身份:编辑只整体替换明细,不动 source / periodStart / periodEnd
    await tx.ledgerItem.deleteMany({ where: { recordId } })
    return tx.ledgerRecord.update({
      where: { id: recordId },
      data: { items: { create: items } },
      include: recordDetailInclude
    })
  })

  return toRecordDetail(record)
}

async function deleteRecord(userId, recordId) {
  const existing = await prisma.ledgerRecord.findFirst({
    where: { id: recordId, userId },
    select: { id: true }
  })
  if (!existing) {
    throw new AppError('账单记录不存在', 404)
  }

  await prisma.ledgerRecord.delete({ where: { id: recordId } })
  return { id: recordId }
}

module.exports = {
  listRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord
}
