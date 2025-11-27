import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const later = require('later')
later.date.localTime()

import pool from '../config/database'
import { TaskService } from './taskService'

type TaskRow = { id: number; cron_expression: string; enabled: boolean }

type JobEntry = { handle: NodeJS.Timeout; nextAt: Date; cron: string }
const jobs = new Map<number, JobEntry>()
export let schedulerStarted = false
export function getSchedulerStatus(): 'running' | 'stopped' {
  return schedulerStarted ? 'running' : 'stopped'
}

function computeNext(expr: string, from: Date): Date | null {
  try {
    const hasSeconds = expr.trim().split(/\s+/).length === 6
    const sched = later.parse.cron(expr, hasSeconds)
    const next = later.schedule(sched).next(1, from)
    return next || null
  } catch {
    return null
  }
}

async function scheduleTask(t: TaskRow): Promise<void> {
  const now = new Date()
  const next = computeNext(t.cron_expression, new Date(now.getTime() + 1))
  if (!next) return
  const delay = Math.max(0, next.getTime() - now.getTime())
  const existing = jobs.get(t.id)
  if (existing) clearTimeout(existing.handle)
  const handle = setTimeout(async () => {
    try {
      await TaskService.triggerTask(t.id, 'scheduled')
    } catch {}
    // 不在此递归重新调度，交由 refresh 统一调度，避免重复
  }, delay)
  jobs.set(t.id, { handle, nextAt: next, cron: t.cron_expression })
}

async function refresh(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, cron_expression, enabled FROM demo1.tasks WHERE enabled = true`
  )
  const activeIds = new Set<number>()
  const now = new Date()
  for (const r of rows as TaskRow[]) {
    activeIds.add(r.id)
    const job = jobs.get(r.id)
    if (!job) {
      await scheduleTask(r)
      continue
    }
    // 若 cron 发生变化，或下一次时间已过，则重新调度
    if (job.cron !== r.cron_expression || (job.nextAt && job.nextAt <= now)) {
      await scheduleTask(r)
    }
  }
  for (const [id, h] of jobs.entries()) {
    if (!activeIds.has(id)) {
      clearTimeout(h.handle)
      jobs.delete(id)
    }
  }
}

export async function startScheduler(): Promise<void> {
  schedulerStarted = true
  await refresh()
  setInterval(refresh, 60 * 1000)
}
