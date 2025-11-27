import { Router, type Request, type Response } from 'express'
import pool from '../config/database'
import { getSchedulerStatus } from '../services/scheduler'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const start = Date.now()
  let dbOk = 0
  let dbLatency = 0
  try {
    await pool.query('SELECT 1')
    dbOk = 1
    dbLatency = Date.now() - start
  } catch (e) {
    dbOk = 0
    dbLatency = Date.now() - start
  }

  // 近24小时执行计数
  const counts = await pool.query(`
    SELECT status, COUNT(*)::int AS c
    FROM demo1.task_executions
    WHERE created_at >= NOW() - interval '24 hours'
    GROUP BY status
  `)
  const map: Record<string, number> = {}
  for (const r of counts.rows) map[r.status] = r.c

  const mem = process.memoryUsage()
  const scheduler = getSchedulerStatus()
  const lines = [
    `# HELP app_up Application up (1) or down (0)`,
    `# TYPE app_up gauge`,
    `app_up 1`,

    `# HELP db_up Database connectivity`,
    `# TYPE db_up gauge`,
    `db_up ${dbOk}`,

    `# HELP db_latency_ms Database ping latency in milliseconds`,
    `# TYPE db_latency_ms gauge`,
    `db_latency_ms ${dbLatency}`,

    `# HELP scheduler_running Scheduler status (1 running, 0 stopped)`,
    `# TYPE scheduler_running gauge`,
    `scheduler_running ${scheduler === 'running' ? 1 : 0}`,

    `# HELP executions_success_24h Number of successful executions in last 24h`,
    `# TYPE executions_success_24h counter`,
    `executions_success_24h ${map['success'] || 0}`,

    `# HELP executions_failed_24h Number of failed executions in last 24h`,
    `# TYPE executions_failed_24h counter`,
    `executions_failed_24h ${map['failed'] || 0}`,

    `# HELP exec_duration_bucket_seconds Buckets of execution durations in last 24h`,
    `# TYPE exec_duration_bucket_seconds counter`,
    `exec_duration_bucket_seconds{le="1"} ${b.d_lt_1s}`,
    `exec_duration_bucket_seconds{le="10"} ${b.d_1_10s}`,
    `exec_duration_bucket_seconds{le="60"} ${b.d_10_60s}`,
    `exec_duration_bucket_seconds{le="+Inf"} ${b.d_ge_60s}`,

    `# HELP process_rss_bytes Resident set size`,
    `# TYPE process_rss_bytes gauge`,
    `process_rss_bytes ${mem.rss}`,
  ]
  res.setHeader('Content-Type', 'text/plain; version=0.0.4')
  res.send(lines.join('\n'))
})

export default router
  const buckets = await pool.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN duration < 1 THEN 1 ELSE 0 END),0)::int AS d_lt_1s,
      COALESCE(SUM(CASE WHEN duration >=1 AND duration < 10 THEN 1 ELSE 0 END),0)::int AS d_1_10s,
      COALESCE(SUM(CASE WHEN duration >=10 AND duration < 60 THEN 1 ELSE 0 END),0)::int AS d_10_60s,
      COALESCE(SUM(CASE WHEN duration >=60 THEN 1 ELSE 0 END),0)::int AS d_ge_60s
    FROM demo1.task_executions
    WHERE created_at >= NOW() - interval '24 hours'
  `)
  const b = buckets.rows[0] || { d_lt_1s: 0, d_1_10s: 0, d_10_60s: 0, d_ge_60s: 0 }
