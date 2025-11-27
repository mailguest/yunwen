import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, code, description, created_at, updated_at FROM demo1.systems ORDER BY id ASC`)
  res.json({ success: true, items: rows })
})

router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { name, code, description } = req.body
  if (!name || !code) return res.status(400).json({ success: false, message: '缺少必要参数：name, code' })
  const { rows } = await pool.query(`INSERT INTO demo1.systems (name, code, description) VALUES ($1,$2,$3) RETURNING *`, [name, code, description ?? null])
  res.json({ success: true, data: rows[0] })
})

router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const { name, description } = req.body
  const { rows } = await pool.query(`UPDATE demo1.systems SET name=COALESCE($1,name), description=COALESCE($2,description), updated_at=NOW() WHERE id=$3 RETURNING *`, [name ?? null, description ?? null, id])
  if (!rows.length) return res.status(404).json({ success: false, message: '系统不存在' })
  res.json({ success: true, data: rows[0] })
})

router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const r = await pool.query(`DELETE FROM demo1.systems WHERE id=$1`, [id])
  if (!r.rowCount) return res.status(404).json({ success: false, message: '系统不存在' })
  res.json({ success: true })
})

export default router

