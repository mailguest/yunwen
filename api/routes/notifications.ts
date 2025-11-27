import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'
import nodemailer from 'nodemailer'

const router = Router()

router.post('/send', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { to, subject, text, html } = req.body as { to: string; subject: string; text?: string; html?: string }
    if (!to || !subject || (!text && !html)) {
      res.status(400).json({ success: false, message: '缺少必要参数：to, subject, text/html' })
      return
    }

    const { rows } = await pool.query(`
      SELECT config, enabled FROM demo1.notification_configs WHERE notification_type='email' ORDER BY id ASC LIMIT 1
    `)
    const row = rows[0]
    if (!row || !row.enabled) {
      res.status(400).json({ success: false, message: '邮件通知未启用或未配置' })
      return
    }
    const cfg = row.config || {}
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_server,
      port: cfg.smtp_port || 587,
      secure: !!cfg.secure, // true for 465, false for other ports
      auth: cfg.smtp_username ? { user: cfg.smtp_username, pass: cfg.smtp_password } : undefined,
    })

    await transporter.verify()
    const info = await transporter.sendMail({
      from: cfg.smtp_from_email || cfg.smtp_username,
      to,
      subject,
      text,
      html,
    })

    res.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '发送通知失败' })
  }
})

export default router

// 告警规则 CRUD
router.get('/rules', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.query.task_id ? parseInt(String(req.query.task_id)) : undefined
    const { rows } = await pool.query(`
      SELECT r.id, r.task_id, t.name AS task_name, r.window_minutes, r.failure_threshold, r.to_emails, r.enabled 
      FROM demo1.alert_rules r
      LEFT JOIN demo1.tasks t ON t.id = r.task_id
      ${taskId ? 'WHERE r.task_id = $1' : ''}
      ORDER BY r.id DESC
    `, taskId ? [taskId] : [])
    res.json({ success: true, items: rows })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || '获取告警规则失败' })
  }
})

router.post('/rules', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo1.alert_rules (
        id SERIAL PRIMARY KEY,
        task_id INT REFERENCES demo1.tasks(id) ON DELETE CASCADE,
        window_minutes INT NOT NULL DEFAULT 60,
        failure_threshold INT NOT NULL DEFAULT 1,
        to_emails TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    const { task_id, window_minutes, failure_threshold, to_emails, enabled = true } = req.body
    const tId = parseInt(String(task_id))
    const win = parseInt(String(window_minutes))
    const thr = parseInt(String(failure_threshold))
    if (isNaN(tId) || isNaN(win) || isNaN(thr)) {
      res.status(400).json({ success: false, message: '缺少必要参数：task_id, window_minutes, failure_threshold' })
      return
    }
    const { rows } = await pool.query(`
      INSERT INTO demo1.alert_rules (task_id, window_minutes, failure_threshold, to_emails, enabled)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [tId, win, thr, (to_emails ?? null), !!enabled])
    res.json({ success: true, id: rows[0].id })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || '创建告警规则失败' })
  }
})

router.put('/rules/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const { window_minutes, failure_threshold, to_emails, enabled } = req.body
    const { rows } = await pool.query(`
      UPDATE demo1.alert_rules SET 
        window_minutes = COALESCE($1, window_minutes),
        failure_threshold = COALESCE($2, failure_threshold),
        to_emails = COALESCE($3, to_emails),
        enabled = COALESCE($4, enabled),
        updated_at = NOW()
      WHERE id = $5
      RETURNING id
    `, [window_minutes ?? null, failure_threshold ?? null, to_emails ?? null, enabled ?? null, id])
    if (!rows.length) { res.status(404).json({ success: false, message: '规则不存在' }); return }
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || '更新告警规则失败' })
  }
})

router.delete('/rules/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const r = await pool.query(`DELETE FROM demo1.alert_rules WHERE id=$1`, [id])
    if (!r.rowCount) { res.status(404).json({ success: false, message: '规则不存在' }); return }
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || '删除告警规则失败' })
  }
})
