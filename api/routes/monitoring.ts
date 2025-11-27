import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { authenticateToken } from '../middleware/auth'
import { getSchedulerStatus } from '../services/scheduler'

const router = Router()

router.get('/dashboard/stats', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM demo1.tasks) as total_tasks,
        (SELECT COUNT(*) FROM demo1.tasks WHERE enabled = true) as enabled_tasks,
        (SELECT COUNT(*) FROM demo1.task_executions WHERE status = 'running' AND created_at >= NOW() - interval '1 day') as running_executions,
        (SELECT COUNT(*) FROM demo1.task_executions) as total_executions,
        COALESCE((SELECT AVG(duration) FROM demo1.task_executions WHERE status = 'success'), 0) as avg_duration,
        COALESCE((
          SELECT CASE WHEN COUNT(*) = 0 THEN 0 
          ELSE SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) END 
          FROM demo1.task_executions
        ), 0) as success_rate,
        (SELECT COUNT(*) FROM demo1.task_executions WHERE status = 'success') as total_successful_executions,
        (SELECT COUNT(*) FROM demo1.task_executions WHERE status = 'failed') as total_failed_executions,
        (SELECT COUNT(*) FROM demo1.task_executions WHERE status = 'skipped') as total_skipped_executions
    `
    const { rows } = await pool.query(sql)
    res.json({ success: true, ...rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取仪表板统计失败' })
  }
})

router.get('/executions/trends', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt((req.query.days as string) || '7')
    const sql = `
      SELECT to_char(created_at, 'YYYY-MM-DD') as date,
             COUNT(*) as total_count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
             SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
             COALESCE(AVG(duration), 0) as avg_duration,
             COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0), 0) as success_rate
      FROM demo1.task_executions
      WHERE created_at >= NOW() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY 1
    `
    const { rows } = await pool.query(sql, [days])
    res.json(rows)
  } catch (error) {
    res.status(500).json({ success: false, message: '获取执行趋势失败' })
  }
})

// 每小时执行统计（堆叠柱图数据源）
router.get('/executions/hourly', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = Math.min(Math.max(parseInt((req.query.hours as string) || '24'), 1), 168)
    const hoursMinusOne = hours - 1
    const sql = `
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('hour', NOW()) - make_interval(hours => $1),
          date_trunc('hour', NOW()),
          interval '1 hour'
        ) AS bucket
      )
      SELECT 
        to_char(b.bucket, 'YYYY-MM-DD HH24:00') AS hour_label,
        COALESCE(SUM(CASE WHEN te.status = 'success' THEN 1 ELSE 0 END), 0) AS success_count,
        COALESCE(SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
        COALESCE(SUM(CASE WHEN te.status = 'skipped' THEN 1 ELSE 0 END), 0) AS skipped_count,
        COALESCE(COUNT(te.*), 0) AS total_count
      FROM buckets b
      LEFT JOIN demo1.task_executions te
        ON date_trunc('hour', te.created_at) = b.bucket
      GROUP BY b.bucket
      ORDER BY b.bucket ASC
    `
    const { rows } = await pool.query(sql, [hoursMinusOne])
    res.json(rows)
  } catch (error) {
    res.status(500).json({ success: false, message: '获取每小时执行统计失败' })
  }
})

router.get('/system/health', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const start = Date.now()
  try {
    await pool.query('SELECT 1')
    const now = new Date().toISOString()
    const dbRt = Date.now() - start
    res.json({
      status: 'healthy',
      message: '系统运行正常',
      timestamp: now,
      database_status: { status: 'connected', response_time: dbRt, last_check: now },
      scheduler_status: { status: getSchedulerStatus(), response_time: 0, last_check: now },
      redis_status: { status: 'unknown', response_time: 0, last_check: now }
    })
  } catch (error) {
    const now = new Date().toISOString()
    res.json({
      status: 'unhealthy',
      message: '数据库连接异常',
      timestamp: now,
      database_status: { status: 'disconnected', response_time: 0, last_check: now },
      scheduler_status: { status: getSchedulerStatus(), response_time: 0, last_check: now },
      redis_status: { status: 'unknown', response_time: 0, last_check: now }
    })
  }
})

// 移除日志搜索接口

router.get('/tasks/performance', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt((req.query.limit as string) || '5')
    const sql = `
      SELECT 
        t.id AS task_id,
        t.name AS task_name,
        t.enabled AS enabled,
        COALESCE(
          SUM(CASE WHEN te.status = 'success' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(te.*), 0),
          0
        ) AS success_rate,
        COALESCE(AVG(te.duration), 0) AS avg_duration,
        COUNT(te.*) AS total_executions,
        SUM(CASE WHEN te.status = 'failed' THEN 1 ELSE 0 END) AS recent_failures,
        SUM(
          CASE 
            WHEN te.status = 'failed' AND te.created_at >= NOW() - interval '24 hours' THEN 1 
            ELSE 0 
          END
        ) AS recent_failures_24h
      FROM demo1.tasks t
      LEFT JOIN demo1.task_executions te 
        ON te.task_id = t.id AND te.created_at >= NOW() - interval '30 days'
      GROUP BY t.id, t.name
      ORDER BY success_rate DESC, total_executions DESC
      LIMIT $1
    `
    const { rows } = await pool.query(sql, [limit])
    res.json(rows)
  } catch (error) {
    res.status(500).json({ success: false, message: '获取任务性能失败' })
  }
})

export default router

// 任务执行记录列表（筛选/分页）
router.get('/executions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = req.query.task_id ? parseInt(String(req.query.task_id)) : undefined
    const status = req.query.status ? String(req.query.status) : undefined
    const start = req.query.start_time ? new Date(String(req.query.start_time)) : undefined
    const end = req.query.end_time ? new Date(String(req.query.end_time)) : undefined
    const page = parseInt(String(req.query.page || '1'))
    const limit = parseInt(String(req.query.limit || '10'))

    const where: string[] = []
    const params: any[] = []

    if (!isNaN(taskId as number) && taskId !== undefined) {
      params.push(taskId)
      where.push(`task_id = $${params.length}`)
    }
    if (status) {
      params.push(status)
      where.push(`status = $${params.length}`)
    }
    if (start) {
      params.push(start)
      where.push(`created_at >= $${params.length}`)
    }
    if (end) {
      params.push(end)
      where.push(`created_at <= $${params.length}`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*)::int AS total FROM demo1.task_executions ${whereSql}`
    const countRes = await pool.query(countSql, params)
    const total = countRes.rows[0]?.total || 0

    const offset = (page - 1) * limit
    const listSql = `
      SELECT id, task_id, status, start_time, end_time, duration, error_message, retry_count, trigger_type, created_at
      FROM demo1.task_executions
      ${whereSql}
      ORDER BY created_at DESC
      OFFSET $${params.length + 1}
      LIMIT $${params.length + 2}
    `
    const listRes = await pool.query(listSql, [...params, offset, limit])

    res.json({ success: true, items: listRes.rows, total, page, limit })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取执行记录失败' })
  }
})
