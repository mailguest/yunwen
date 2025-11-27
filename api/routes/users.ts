import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import bcrypt from 'bcrypt'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

router.get('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id, u.email, u.username, u.is_active, u.avatar_url, u.full_name, u.phone, u.department, u.position, u.last_login, u.created_at, u.updated_at,
        COALESCE(
          json_agg(
            json_build_object('id', r.id, 'name', r.name, 'code', r.code)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM demo1.users u
      LEFT JOIN demo1.user_roles ur ON ur.user_id = u.id
      LEFT JOIN demo1.roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)
    res.json(rows)
  } catch (error) {
    res.status(500).json({ success: false, message: '获取用户列表失败' })
  }
})

router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, role = 'user', is_active = true } = req.body
    if (!email || !username || !password) {
      res.status(400).json({ success: false, message: '缺少必要参数：email, username, password' })
      return
    }
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO demo1.users (email, username, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, username, role, is_active, created_at, updated_at`,
      [email, username, password_hash, role, is_active]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '创建用户失败' })
  }
})

router.put('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: '无效的用户ID' })
      return
    }
    const fields: string[] = []
    const params: any[] = []
    const allowed = ['email', 'username', 'role', 'is_active', 'avatar_url', 'full_name', 'phone', 'department', 'position']
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        params.push(req.body[key])
        fields.push(`${key} = $${params.length}`)
      }
    })
    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, 10)
      params.push(hash)
      fields.push(`password_hash = $${params.length}`)
    }
    if (fields.length === 0) {
      res.status(400).json({ success: false, message: '没有要更新的字段' })
      return
    }
    params.push(id)
    const sql = `UPDATE demo1.users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, email, username, role, is_active, updated_at`
    const { rows } = await pool.query(sql, params)
    if (!rows.length) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }
    res.json({ success: true, data: rows[0] })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '更新用户失败' })
  }
})

router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: '无效的用户ID' })
      return
    }
    const { rowCount } = await pool.query('DELETE FROM demo1.users WHERE id = $1', [id])
    if (!rowCount) {
      res.status(404).json({ success: false, message: '用户不存在' })
      return
    }
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    res.status(500).json({ success: false, message: '删除用户失败' })
  }
})

router.post('/:id/reset-password', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const { password } = req.body
    if (!password || isNaN(id)) { res.status(400).json({ success: false, message: '缺少必要参数：id, password' }); return }
    const hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `UPDATE demo1.users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, role, is_active, updated_at`,
      [hash, id]
    )
    if (!rows.length) { res.status(404).json({ success: false, message: '用户不存在' }); return }
    res.json({ success: true, data: rows[0] })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '重置密码失败' })
  }
})

export default router
