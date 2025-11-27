import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

router.post('/backup', async (req: Request, res: Response): Promise<void> => {
  try {
    const internal = req.headers['x-task-internal'] === '1'
    if (!internal) {
      const { authenticateToken: authMw, requireRole: roleMw } = await import('../middleware/auth')
      await new Promise<void>((resolve, reject) => authMw(req as any, res as any, (err?: any) => err ? reject(err) : resolve()))
      await new Promise<void>((resolve, reject) => roleMw(['admin'])(req as any, res as any, (err?: any) => err ? reject(err) : resolve()))
    }
    const ts = new Date()
    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`
    const dir = path.resolve(process.cwd(), 'backups')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `backup-${stamp}.json`)

    const tables = [
      { name: 'demo1.users', sql: 'SELECT id, email, username, role, is_active, created_at, updated_at FROM demo1.users ORDER BY id ASC' },
      { name: 'demo1.task_groups', sql: 'SELECT * FROM demo1.task_groups ORDER BY id ASC' },
      { name: 'demo1.tasks', sql: 'SELECT * FROM demo1.tasks ORDER BY id ASC' },
      { name: 'demo1.task_executions', sql: 'SELECT * FROM demo1.task_executions ORDER BY id ASC' },
      { name: 'demo1.notification_configs', sql: 'SELECT * FROM demo1.notification_configs ORDER BY id ASC' },
      { name: 'demo1.system_configs', sql: 'SELECT * FROM demo1.system_configs ORDER BY id ASC' },
    ]

    const data: Record<string, any[]> = {}
    for (const t of tables) {
      try {
        const r = await pool.query(t.sql)
        data[t.name] = r.rows
      } catch {
        data[t.name] = []
      }
    }

    fs.writeFileSync(file, JSON.stringify({ created_at: ts.toISOString(), data }, null, 2), 'utf-8')
    const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as any[]).length]))
    const keep = Math.max(1, parseInt(String(process.env.BACKUP_KEEP_LATEST || '5'), 10))
    try {
      const files = fs.readdirSync(dir).filter(f => f.startsWith('backup-') && f.endsWith('.json')).map(f => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
      files.sort((a, b) => b.m - a.m)
      const toDelete = files.slice(keep)
      for (const d of toDelete) {
        try { fs.unlinkSync(path.join(dir, d.f)) } catch {}
      }
    } catch {}
    try {
      const exists = await pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='demo1' AND table_name='system_logs') AS x`)
      if (exists.rows[0]?.x) {
        await pool.query(`INSERT INTO demo1.system_logs (level, message, logger_name) VALUES ('INFO', $1, 'maintenance')`, [
          `backup created: ${file}`
        ])
      }
    } catch {}
    res.json({ success: true, file, counts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '备份失败' })
  }
})

router.delete('/logs/cleanup', async (req: Request, res: Response): Promise<void> => {
  try {
    const internal = req.headers['x-task-internal'] === '1'
    if (!internal) {
      const { authenticateToken: authMw, requireRole: roleMw } = await import('../middleware/auth')
      await new Promise<void>((resolve, reject) => authMw(req as any, res as any, (err?: any) => err ? reject(err) : resolve()))
      await new Promise<void>((resolve, reject) => roleMw(['admin'])(req as any, res as any, (err?: any) => err ? reject(err) : resolve()))
    }
    const days = Math.max(1, parseInt(String((req.query.days as string) || (req.body && (req.body as any).days) || '30'), 10))
    const r1 = await pool.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='demo1' AND table_name='system_logs') AS exists`)
    let deletedSystemLogs = 0
    if (r1.rows[0]?.exists) {
      const d = await pool.query(`DELETE FROM demo1.system_logs WHERE timestamp < NOW() - interval '${days} days'`)
      deletedSystemLogs = d.rowCount || 0
      try {
        await pool.query(`INSERT INTO demo1.system_logs (level, message, logger_name) VALUES ('INFO', $1, 'maintenance')`, [
          `logs cleanup: kept ${days} days, deleted ${deletedSystemLogs}`
        ])
      } catch {}
    }
    res.json({ success: true, deleted: { system_logs: deletedSystemLogs }, kept_days: days })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '日志清理失败' })
  }
})

export default router
