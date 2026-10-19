const accountService = require('./account.service')

async function getAccounts(req, res) {
  const { enabled } = req.validated.query
  const accounts = await accountService.listAccounts(req.user.id, { enabled })
  res.json(accounts)
}

async function createAccount(req, res) {
  const account = await accountService.createAccount(req.user.id, req.validated.body)
  res.status(201).json(account)
}

async function updateAccount(req, res) {
  const account = await accountService.updateAccount(req.user.id, req.validated.params.id, req.validated.body)
  res.json(account)
}

async function updateBalance(req, res) {
  const { balanceCents } = req.validated.body
  const account = await accountService.updateBalance(req.user.id, req.validated.params.id, balanceCents)
  res.json(account)
}

async function deleteAccount(req, res) {
  await accountService.deleteAccount(req.user.id, req.validated.params.id)
  res.status(204).end()
}

module.exports = {
  getAccounts,
  createAccount,
  updateAccount,
  updateBalance,
  deleteAccount
}
