import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken, requireRole } from '../middleware/auth'

const router = Router()

// resources CRUD
router.get('/resources', authenticateToken, async (req, res) => {
  const systemCode = (req.query.system_code as string) || ''
  const keyword = (req.query.keyword as string) || ''
  const conditions: string[] = []
  const params: any[] = []
  if (systemCode) { conditions.push(`s.code = $${params.length + 1}`); params.push(systemCode) }
  if (keyword) { conditions.push(`(r.name ILIKE $${params.length + 1} OR r.code ILIKE $${params.length + 1})`); params.push(`%${keyword}%`) }
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.code, r.path, r.icon, r.parent_id, r.order_index, r.is_active,
            r.system_id, s.code AS system_code, s.name AS system_name
     FROM demo1.resources r
     LEFT JOIN demo1.systems s ON s.id = r.system_id
     ${whereSql}
     ORDER BY r.order_index ASC, r.id ASC`,
    params
  )
  res.json({ success: true, items: rows })
})
router.post('/resources', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { name, code, path, icon, parent_id, order_index = 0, is_active = true, system_code } = req.body
  if (!name || !code || !path) return res.status(400).json({ success: false, message: '缺少必要参数：name, code, path' })
  const sysCode = system_code || 'default'
  const sysRes = await pool.query(`SELECT id FROM demo1.systems WHERE code = $1`, [sysCode])
  const system_id = sysRes.rows[0]?.id || null
  const { rows } = await pool.query(`
    INSERT INTO demo1.resources (name, code, path, icon, parent_id, order_index, is_active, system_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `, [name, code, path, icon ?? null, parent_id ?? null, order_index, is_active, system_id])
  res.status(201).json({ success: true, data: rows[0] })
})
router.put('/resources/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const { name, path, icon, parent_id, order_index, is_active, system_code } = req.body
  let system_id: number | null | undefined = undefined
  if (system_code !== undefined) {
    if (system_code === null) system_id = null
    else {
      const sysRes = await pool.query(`SELECT id FROM demo1.systems WHERE code = $1`, [system_code])
      system_id = sysRes.rows[0]?.id ?? null
    }
  }
  const { rows } = await pool.query(`
    UPDATE demo1.resources SET 
      name=COALESCE($1,name), 
      path=COALESCE($2,path), 
      icon=COALESCE($3,icon), 
      parent_id=$4, 
      order_index=COALESCE($5,order_index), 
      is_active=COALESCE($6,is_active),
      system_id = COALESCE($7, system_id)
    WHERE id=$8 RETURNING *
  `, [name ?? null, path ?? null, icon ?? null, parent_id ?? null, order_index ?? null, is_active ?? null, system_id ?? null, id])
  if (!rows.length) return res.status(404).json({ success: false, message: '资源不存在' })
  res.json({ success: true, data: rows[0] })
})
router.delete('/resources/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const r = await pool.query(`DELETE FROM demo1.resources WHERE id=$1`, [id])
  if (!r.rowCount) return res.status(404).json({ success: false, message: '资源不存在' })
  res.json({ success: true, message: '删除成功' })
})

// roles CRUD
router.get('/roles', authenticateToken, async (req, res) => {
  const { rows } = await pool.query(`SELECT id, name, code, description FROM demo1.roles ORDER BY id ASC`)
  res.json({ success: true, items: rows })
})
router.post('/roles', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { name, code, description } = req.body
  if (!name || !code) return res.status(400).json({ success: false, message: '缺少必要参数：name, code' })
  const { rows } = await pool.query(`INSERT INTO demo1.roles (name, code, description) VALUES ($1,$2,$3) RETURNING *`, [name, code, description ?? null])
  res.status(201).json({ success: true, data: rows[0] })
})
router.put('/roles/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const { name, description } = req.body
  const { rows } = await pool.query(`UPDATE demo1.roles SET name=COALESCE($1,name), description=COALESCE($2,description) WHERE id=$3 RETURNING *`, [name ?? null, description ?? null, id])
  if (!rows.length) return res.status(404).json({ success: false, message: '角色不存在' })
  res.json({ success: true, data: rows[0] })
})
router.delete('/roles/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const r = await pool.query(`DELETE FROM demo1.roles WHERE id=$1`, [id])
  if (!r.rowCount) return res.status(404).json({ success: false, message: '角色不存在' })
  res.json({ success: true, message: '删除成功' })
})

// role-resources
router.get('/roles/:id/resources', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  const { rows } = await pool.query(`SELECT rr.resource_id FROM demo1.role_resources rr WHERE rr.role_id=$1`, [id])
  res.json({ success: true, resource_ids: rows.map(r => r.resource_id) })
})
router.post('/roles/:id/resources', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const { resource_ids } = req.body as { resource_ids: number[] }
  await pool.query(`DELETE FROM demo1.role_resources WHERE role_id=$1`, [id])
  if (Array.isArray(resource_ids) && resource_ids.length) {
    const values = resource_ids.map((rid, i) => `($1, $${i + 2})`).join(',')
    await pool.query(`INSERT INTO demo1.role_resources (role_id, resource_id) VALUES ${values}`, [id, ...resource_ids])
  }
  res.json({ success: true })
})

// user-roles
router.get('/users/:id/roles', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id)
  const { rows } = await pool.query(`SELECT ur.role_id FROM demo1.user_roles ur WHERE ur.user_id=$1`, [id])
  res.json({ success: true, role_ids: rows.map(r => r.role_id) })
})
router.post('/users/:id/roles', authenticateToken, requireRole(['admin']), async (req, res) => {
  const id = parseInt(req.params.id)
  const { role_ids } = req.body as { role_ids: number[] }
  await pool.query(`DELETE FROM demo1.user_roles WHERE user_id=$1`, [id])
  if (Array.isArray(role_ids) && role_ids.length) {
    const values = role_ids.map((rid, i) => `($1, $${i + 2})`).join(',')
    await pool.query(`INSERT INTO demo1.user_roles (user_id, role_id) VALUES ${values}`, [id, ...role_ids])
  }
  res.json({ success: true })
})

// me resources for menu
router.get('/me/resources', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId
    const systemCodeParam = (req.query.system_code as string) || ''
    let sysCode = systemCodeParam
    if (!sysCode) {
      const r = await pool.query(`SELECT current_system_code FROM demo1.app_settings WHERE id = 1`)
      sysCode = r.rows[0]?.current_system_code || ''
    }
    const params: any[] = [userId]
    let sql = `
      SELECT DISTINCT res.id, res.name, res.code, res.path, res.icon, res.parent_id, res.order_index
      FROM demo1.user_roles ur
      JOIN demo1.role_resources rr ON rr.role_id = ur.role_id
      JOIN demo1.resources res ON res.id = rr.resource_id
      LEFT JOIN demo1.systems s ON s.id = res.system_id
      WHERE ur.user_id = $1 AND res.is_active = TRUE`
    if (sysCode) {
      sql += ` AND s.code = $2`
      params.push(sysCode)
    }
    sql += ` ORDER BY res.order_index ASC, res.id ASC`
    const { rows } = await pool.query(sql, params)
    res.json({ success: true, items: rows })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || '获取权限资源失败' })
  }
})

export default router
