const AppError = require('../../errors/AppError')
const prisma = require('../../utils/prisma')

const snapshotSummarySelect = {
  id: true,
  snapshotDate: true,
  note: true,
  totalAssetsCents: true,
  totalDebtCents: true,
  netAssetsCents: true,
  accountCount: true,
  enabledAccountCount: true,
  createdAt: true,
  updatedAt: true
}

const snapshotItemSelect = {
  accountId: true,
  accountName: true,
  kindId: true,
  kindName: true,
  kindCode: true,
  kindColor: true,
  note: true,
  balanceCents: true,
  enabled: true,
  sortOrder: true,
  balanceUpdatedAt: true
}

const snapshotDetailSelect = {
  ...snapshotSummarySelect,
  items: {
    select: snapshotItemSelect,
    orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { accountId: 'asc' }]
  }
}

const currentAccountSelect = {
  id: true,
  name: true,
  kindId: true,
  kind: { select: { id: true, name: true, code: true, color: true } },
  note: true,
  balanceCents: true,
  balanceUpdatedAt: true,
  enabled: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
}

function parseSnapshotDate(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatSnapshotDate(value) {
  return value.toISOString().slice(0, 10)
}

function normalizeNote(value) {
  if (value === undefined) return undefined
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

// 与资产账户页保持一致:停用账户保留在快照中,但不参与汇总
function calculateStats(accounts) {
  let totalAssetsCents = 0n
  let totalDebtCents = 0n
  let enabledAccountCount = 0

  for (const account of accounts) {
    if (!account.enabled) continue

    enabledAccountCount += 1
    if (account.balanceCents >= 0) {
      totalAssetsCents += BigInt(account.balanceCents)
    } else {
      totalDebtCents += BigInt(-account.balanceCents)
    }
  }

  return {
    totalAssetsCents,
    totalDebtCents,
    netAssetsCents: totalAssetsCents - totalDebtCents,
    accountCount: accounts.length,
    enabledAccountCount
  }
}

function toSummary(snapshot) {
  return {
    ...snapshot,
    snapshotDate: formatSnapshotDate(snapshot.snapshotDate),
    totalAssetsCents: Number(snapshot.totalAssetsCents),
    totalDebtCents: Number(snapshot.totalDebtCents),
    netAssetsCents: Number(snapshot.netAssetsCents)
  }
}

function toDetail(snapshot) {
  return {
    ...toSummary(snapshot),
    items: snapshot.items.map((item) => ({ ...item }))
  }
}

async function readCurrentAccounts(client, userId) {
  return client.ledgerAccount.findMany({
    where: { userId },
    select: currentAccountSelect,
    orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }]
  })
}

async function getPreview(userId) {
  const accounts = await readCurrentAccounts(prisma, userId)
  const stats = calculateStats(accounts)

  return {
    stats: {
      totalAssetsCents: Number(stats.totalAssetsCents),
      totalDebtCents: Number(stats.totalDebtCents),
      netAssetsCents: Number(stats.netAssetsCents),
      accountCount: stats.accountCount,
      enabledAccountCount: stats.enabledAccountCount
    },
    accounts
  }
}

async function createSnapshot(userId, data) {
  const snapshotDate = parseSnapshotDate(data.snapshotDate)
  const note = normalizeNote(data.note)

  try {
    return await prisma.$transaction(async (tx) => {
      const accounts = await readCurrentAccounts(tx, userId)
      if (accounts.length === 0) {
        throw new AppError('暂无可保存的资产账户', 409)
      }

      const stats = calculateStats(accounts)
      const existing = await tx.ledgerAssetSnapshot.findUnique({
        where: { userId_snapshotDate: { userId, snapshotDate } },
        select: { id: true }
      })

      if (existing && !data.overwrite) {
        throw new AppError('该日期已有资产快照', 409)
      }

      let snapshotId
      if (existing) {
        const updated = await tx.ledgerAssetSnapshot.update({
          where: { id: existing.id },
          data: {
            ...(note === undefined ? {} : { note }),
            ...stats
          },
          select: { id: true }
        })
        snapshotId = updated.id
        await tx.ledgerAssetSnapshotItem.deleteMany({ where: { snapshotId } })
      } else {
        const created = await tx.ledgerAssetSnapshot.create({
          data: {
            userId,
            snapshotDate,
            note: note ?? null,
            ...stats
          },
          select: { id: true }
        })
        snapshotId = created.id
      }

      await tx.ledgerAssetSnapshotItem.createMany({
        data: accounts.map((account) => ({
          snapshotId,
          accountId: account.id,
          accountName: account.name,
          kindId: account.kindId,
          kindName: account.kind.name,
          kindCode: account.kind.code,
          kindColor: account.kind.color,
          note: account.note,
          balanceCents: account.balanceCents,
          enabled: account.enabled,
          sortOrder: account.sortOrder,
          balanceUpdatedAt: account.balanceUpdatedAt
        }))
      })

      const snapshot = await tx.ledgerAssetSnapshot.findUnique({
        where: { id: snapshotId },
        select: snapshotDetailSelect
      })
      return toDetail(snapshot)
    })
  } catch (error) {
    // 并发保存同一天时,唯一索引是最后一道保护
    if (error.code === 'P2002') {
      throw new AppError('该日期已有资产快照', 409)
    }
    throw error
  }
}

async function listSnapshots(userId) {
  const snapshots = await prisma.ledgerAssetSnapshot.findMany({
    where: { userId },
    select: snapshotSummarySelect,
    orderBy: [{ snapshotDate: 'desc' }, { id: 'desc' }]
  })
  return snapshots.map(toSummary)
}

async function getSnapshot(userId, snapshotId) {
  const snapshot = await prisma.ledgerAssetSnapshot.findFirst({
    where: { id: snapshotId, userId },
    select: snapshotDetailSelect
  })
  if (!snapshot) {
    throw new AppError('资产快照不存在', 404)
  }
  return toDetail(snapshot)
}

async function compareSnapshots(userId, fromId, toId) {
  const snapshots = await prisma.ledgerAssetSnapshot.findMany({
    where: { userId, id: { in: [fromId, toId] } },
    select: snapshotSummarySelect
  })

  const from = snapshots.find((snapshot) => snapshot.id === fromId)
  const to = snapshots.find((snapshot) => snapshot.id === toId)
  if (!from || !to) {
    throw new AppError('资产快照不存在', 404)
  }

  const fromSummary = toSummary(from)
  const toSummaryValue = toSummary(to)
  return {
    from: fromSummary,
    to: toSummaryValue,
    delta: {
      totalAssetsCents: toSummaryValue.totalAssetsCents - fromSummary.totalAssetsCents,
      totalDebtCents: toSummaryValue.totalDebtCents - fromSummary.totalDebtCents,
      netAssetsCents: toSummaryValue.netAssetsCents - fromSummary.netAssetsCents,
      accountCount: toSummaryValue.accountCount - fromSummary.accountCount,
      enabledAccountCount:
        toSummaryValue.enabledAccountCount - fromSummary.enabledAccountCount
    }
  }
}

module.exports = {
  getPreview,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  compareSnapshots
}
