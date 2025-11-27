import bcrypt from 'bcrypt'
import pool from '../config/database'

async function run() {
  try {
    const hash = await bcrypt.hash('123456', 10)
    const r = await pool.query(`UPDATE demo1.users SET password_hash=$1 WHERE username='admin' OR email='admin@example.com'`, [hash])
    console.log(`✅ 已重置admin密码为 123456，受影响行数: ${r.rowCount}`)
    process.exit(0)
  } catch (e: any) {
    console.error('❌ 重置失败:', e.message || e)
    process.exit(1)
  }
}

run()

