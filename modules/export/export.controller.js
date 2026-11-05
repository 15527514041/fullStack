const exportService = require('./export.service')
const { contentDisposition } = require('../../utils/csv')

function handleExport(resource) {
  return async (req, res) => {
    const result = await exportService.createExport(
      resource,
      req.user.id,
      req.validated.query
    )

    if (result.empty) {
      return res.status(204).end()
    }

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(result.fileName),
      'Cache-Control': 'no-store',
      'X-Export-Count': String(result.count)
    })
    res.send(result.body)
  }
}

module.exports = {
  todos: handleExport('todos'),
  plans: handleExport('plans'),
  reflections: handleExport('reflections')
}
