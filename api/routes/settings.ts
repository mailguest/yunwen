import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

// 获取通知设置（邮件）
router.get('/notification', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureNotificationConfigsTable()
    const { rows } = await pool.query(`
      SELECT id, name, notification_type, config, enabled
      FROM demo1.notification_configs
      WHERE notification_type = 'email'
      ORDER BY id ASC
      LIMIT 1
    `)
    const row = rows[0]
    res.json(row ? { success: true, config: row.config, enabled: row.enabled } : { success: true, config: null, enabled: false })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取通知设置失败' })
  }
})

// 保存通知设置（邮件）
router.put('/notification', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureNotificationConfigsTable()
    const cfg = req.body || {}
    const enabled = !!cfg.enable_email_notifications
    const name = 'email_smtp'
    await pool.query(`
      INSERT INTO demo1.notification_configs (name, notification_type, config, enabled)
      VALUES ($1, 'email', $2::jsonb, $3)
      ON CONFLICT (name)
      DO UPDATE SET config = EXCLUDED.config, enabled = EXCLUDED.enabled, updated_at = NOW()
    `, [name, JSON.stringify(cfg), enabled])
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, message: '保存通知设置失败' })
  }
})

async function ensureAppSettingsTableAndRow() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS demo1.app_settings (
      id INT PRIMARY KEY DEFAULT 1,
      site_name VARCHAR(200),
      site_description TEXT,
      timezone VARCHAR(100),
      language VARCHAR(50),
      debug BOOLEAN DEFAULT FALSE,
      current_system_code VARCHAR(100) DEFAULT 'default',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
  await pool.query(`
    ALTER TABLE demo1.app_settings ADD COLUMN IF NOT EXISTS jwt_secret_key TEXT;
    ALTER TABLE demo1.app_settings ADD COLUMN IF NOT EXISTS jwt_algorithm VARCHAR(20);
    ALTER TABLE demo1.app_settings ADD COLUMN IF NOT EXISTS jwt_expiration_minutes INT;
    ALTER TABLE demo1.app_settings ADD COLUMN IF NOT EXISTS password_min_length INT;
    ALTER TABLE demo1.app_settings ADD COLUMN IF NOT EXISTS enable_two_factor BOOLEAN;
  `)
  await pool.query(`
    INSERT INTO demo1.app_settings (id, site_name, site_description, timezone, language, debug, current_system_code)
    VALUES (1, '智能定时任务调度平台', '企业级定时任务调度系统', 'Asia/Shanghai', 'zh-CN', FALSE, 'default')
    ON CONFLICT (id) DO NOTHING;
  `)
}

// 获取应用基础设置
router.get('/app', async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureAppSettingsTableAndRow()
    const { rows } = await pool.query(`
      SELECT id, site_name, site_description, timezone, language, debug, current_system_code, updated_at
      FROM demo1.app_settings WHERE id = 1
    `)
    const row = rows[0]
    if (!row) return res.json({ success: true, data: null })
    res.json({ success: true, data: row })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取应用设置失败' })
  }
})

// 保存应用基础设置
router.put('/app', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureAppSettingsTableAndRow()
    const { site_name, site_description, timezone, language, debug, current_system_code } = req.body || {}
    let systemCode = current_system_code || null
    if (systemCode) {
      const sysRes = await pool.query(`SELECT code FROM demo1.systems WHERE code = $1`, [systemCode])
      if (!sysRes.rows.length) return res.status(400).json({ success: false, message: '系统代码不存在' })
      systemCode = sysRes.rows[0].code
    }
    const { rows } = await pool.query(`
      UPDATE demo1.app_settings SET 
        site_name = COALESCE($1, site_name),
        site_description = COALESCE($2, site_description),
        timezone = COALESCE($3, timezone),
        language = COALESCE($4, language),
        debug = COALESCE($5, debug),
        current_system_code = COALESCE($6, current_system_code),
        updated_at = NOW()
      WHERE id = 1
      RETURNING id, site_name, site_description, timezone, language, debug, current_system_code, updated_at
    `, [site_name ?? null, site_description ?? null, timezone ?? null, language ?? null, typeof debug === 'boolean' ? debug : null, systemCode ?? null])
    res.json({ success: true, data: rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, message: '保存应用设置失败' })
  }
})

// 获取安全设置
router.get('/security', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureAppSettingsTableAndRow()
    const { rows } = await pool.query(`
      SELECT jwt_secret_key, jwt_algorithm, jwt_expiration_minutes, password_min_length, enable_two_factor
      FROM demo1.app_settings WHERE id = 1
    `)
    res.json({ success: true, data: rows[0] || null })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取安全设置失败' })
  }
})

// 保存安全设置
router.put('/security', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureAppSettingsTableAndRow()
    const { jwt_secret_key, jwt_algorithm, jwt_expiration, password_min_length, enable_two_factor } = req.body || {}
    const alg = jwt_algorithm && ['HS256','HS384','HS512'].includes(jwt_algorithm) ? jwt_algorithm : null
    const expMin = Number.isFinite(jwt_expiration) ? Math.max(1, parseInt(jwt_expiration)) : null
    const pwdMin = Number.isFinite(password_min_length) ? Math.max(6, parseInt(password_min_length)) : null
    const twoFactor = typeof enable_two_factor === 'boolean' ? enable_two_factor : null
    const secret = typeof jwt_secret_key === 'string' && jwt_secret_key.length > 0 ? jwt_secret_key : null
    const { rows } = await pool.query(`
      UPDATE demo1.app_settings SET 
        jwt_secret_key = COALESCE($1, jwt_secret_key),
        jwt_algorithm = COALESCE($2, jwt_algorithm),
        jwt_expiration_minutes = COALESCE($3, jwt_expiration_minutes),
        password_min_length = COALESCE($4, password_min_length),
        enable_two_factor = COALESCE($5, enable_two_factor),
        updated_at = NOW()
      WHERE id = 1
      RETURNING jwt_secret_key, jwt_algorithm, jwt_expiration_minutes, password_min_length, enable_two_factor
    `, [secret, alg, expMin, pwdMin, twoFactor])
    res.json({ success: true, data: rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, message: '保存安全设置失败' })
  }
})

export default router
async function ensureNotificationConfigsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS demo1.notification_configs (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      notification_type VARCHAR(50) NOT NULL,
      config JSONB,
      enabled BOOLEAN DEFAULT FALSE,
      system_id INT REFERENCES demo1.systems(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `)
}
