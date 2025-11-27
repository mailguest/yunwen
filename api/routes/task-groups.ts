import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

// 列表
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, description, created_by, created_at, updated_at
      FROM demo1.task_groups
      ORDER BY created_at DESC
    `)
    res.json({ success: true, items: rows })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取任务分组失败' })
  }
})

// 详情
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const { rows } = await pool.query(`
      SELECT id, name, description, created_by, created_at, updated_at
      FROM demo1.task_groups WHERE id = $1
    `, [id])
    if (!rows.length) {
      res.status(404).json({ success: false, message: '分组不存在' }); return
    }
    res.json({ success: true, data: rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取分组失败' })
  }
})

// 创建
router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body
    if (!name) { res.status(400).json({ success: false, message: '分组名称不能为空' }); return }
    const { rows } = await pool.query(`
      INSERT INTO demo1.task_groups (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, created_by, created_at, updated_at
    `, [name, description ?? null, 1])
    res.status(201).json({ success: true, data: rows[0] })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || '创建分组失败' })
  }
})

// 更新
router.put('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const { name, description } = req.body
    const { rows } = await pool.query(`
      UPDATE demo1.task_groups SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, description, created_by, created_at, updated_at
    `, [name ?? null, description ?? null, id])
    if (!rows.length) { res.status(404).json({ success: false, message: '分组不存在' }); return }
    res.json({ success: true, data: rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新分组失败' })
  }
})

// 删除
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const r = await pool.query('DELETE FROM demo1.task_groups WHERE id = $1', [id])
    if (!r.rowCount) { res.status(404).json({ success: false, message: '分组不存在' }); return }
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    res.status(500).json({ success: false, message: '删除分组失败' })
  }
})

export default router
