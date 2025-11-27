import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const parser = require('cron-parser')

const exps = ['0 * * * * *', '0 0 2 * * *', '0 2 * * *']
for (const exp of exps) {
  try {
    const it = parser.parseExpression(exp, { allowSeconds: true })
    console.log(exp, '->', it.next().toISOString())
  } catch (e) {
    console.log('error for', exp, e)
  }
}
