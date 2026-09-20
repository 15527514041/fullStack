const prisma = require('../utils/prisma')

const todosPerUser = async () => {
  return prisma.$queryRaw`
    SELECT u.id, u.username, COUNT(t.id)::int AS "todoCount"
    FROM "User" u
    LEFT JOIN "Todo" t ON t."userId" = u.id AND t."deletedAt" IS NULL
    GROUP BY u.id, u.username
    ORDER BY "todoCount" DESC
  `
}

module.exports = {
  todosPerUser,
}