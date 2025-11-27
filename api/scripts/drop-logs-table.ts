import pool from '../config/database.js'

async function dropLogs() {
  try {
    console.log('Dropping demo1.system_logs ...')
    await pool.query(`DROP TABLE IF EXISTS demo1.system_logs CASCADE;`)
    console.log('Done.')
  } catch (e) {
    console.error('Drop logs table failed:', e)
  }
}

dropLogs().then(() => process.exit(0))
