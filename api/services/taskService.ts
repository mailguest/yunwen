import pool from '../config/database';
import nodemailer from 'nodemailer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const later = require('later');
later.date.localTime();

function computeNextRun(expr: string, from: Date = new Date()): Date | null {
  try {
    const hasSeconds = expr.trim().split(/\s+/).length === 6;
    const sched = later.parse.cron(expr, hasSeconds);
    const next = later.schedule(sched).next(1, from);
    return next || null;
  } catch {
    return null;
  }
}

type BreakerState = { fails: number; openUntil: number }
const breaker = new Map<string, BreakerState>()
const BREAKER_THRESHOLD = parseInt(process.env.CB_FAIL_THRESHOLD || '3', 10)
const BREAKER_OPEN_MS = parseInt(process.env.CB_OPEN_MS || '60000', 10)

function isCircuitOpen(key: string, now: number): boolean {
  const s = breaker.get(key)
  return !!s && s.openUntil > now
}

function recordFailure(key: string, now: number) {
  const s = breaker.get(key) || { fails: 0, openUntil: 0 }
  s.fails += 1
  if (s.fails >= BREAKER_THRESHOLD) {
    s.openUntil = now + BREAKER_OPEN_MS
  }
  breaker.set(key, s)
}

function recordSuccess(key: string) {
  breaker.delete(key)
}

export interface Task {
  id: number;
  name: string;
  description?: string;
  group_id?: number;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: any;
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  last_execution_at?: Date;
  next_execution_at?: Date;
  parameters: any[];
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TaskCreate {
  name: string;
  description?: string;
  group_id?: number;
  cron_expression: string;
  task_type: 'http' | 'rpc';
  task_config: any;
  concurrent_control: boolean;
  timeout: number;
  retry_count: number;
  enabled: boolean;
  parameters: any[];
}

export interface TaskUpdate {
  name?: string;
  description?: string;
  group_id?: number;
  cron_expression?: string;
  task_type?: 'http' | 'rpc';
  task_config?: any;
  concurrent_control?: boolean;
  timeout?: number;
  retry_count?: number;
  enabled?: boolean;
  parameters?: any[];
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  skip: number;
  limit: number;
}

export class TaskService {
  // 获取任务列表
  static async getTasks(params: {
    skip?: number;
    limit?: number;
    enabled?: boolean;
    group_id?: number;
    keyword?: string;
  } = {}): Promise<TaskListResponse> {
    try {
      const { skip = 0, limit = 20, enabled, group_id, keyword } = params;
      
      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let paramCount = 1;

      if (enabled !== undefined) {
        whereClause += ` AND enabled = $${paramCount}`;
        values.push(enabled);
        paramCount++;
      }

      if (group_id !== undefined) {
        whereClause += ` AND group_id = $${paramCount}`;
        values.push(group_id);
        paramCount++;
      }

      if (keyword) {
        whereClause += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        values.push(`%${keyword}%`);
        paramCount++;
      }

      // 获取总数
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].total);

      // 获取任务列表
      const tasksResult = await pool.query(
        `SELECT t.*, tg.name AS group_name
         FROM tasks t
         LEFT JOIN task_groups tg ON tg.id = t.group_id
         ${whereClause}
         ORDER BY t.id ASC
         LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...values, limit, skip]
      );

      const items = tasksResult.rows.map((t: any) => {
        if (t.cron_expression) {
          const next = computeNextRun(t.cron_expression, new Date());
          if (next) t.next_execution_at = next;
        }
        if (t.group_id) {
          t.group = { id: t.group_id, name: t.group_name };
        }
        delete t.group_name;
        return t;
      });

      return {
        items,
        total,
        skip,
        limit
      };
    } catch (error) {
      console.error('获取任务列表失败:', error);
      throw error;
    }
  }

  // 获取单个任务
  static async getTaskById(id: number): Promise<Task | null> {
    try {
      const result = await pool.query(
        `SELECT t.*, tg.name AS group_name
         FROM tasks t
         LEFT JOIN task_groups tg ON tg.id = t.group_id
         WHERE t.id = $1`,
        [id]
      );

      const t = result.rows[0] || null;
      if (t && t.cron_expression) {
        const next = computeNextRun(t.cron_expression, new Date());
        if (next) t.next_execution_at = next;
      }
      if (t && t.group_id) {
        t.group = { id: t.group_id, name: t.group_name };
        delete t.group_name;
      }
      return t;
    } catch (error) {
      console.error('获取任务失败:', error);
      throw error;
    }
  }

  // 创建任务
  static async createTask(taskData: TaskCreate): Promise<Task> {
    try {
      // 校验 cron 表达式
      if (taskData.cron_expression) {
        const hasSeconds = taskData.cron_expression.trim().split(/\s+/).length === 6
        const sched = later.parse.cron(taskData.cron_expression, hasSeconds)
        if (sched.error) throw new Error('无效的 cron 表达式')
      }
      const result = await pool.query(
        `INSERT INTO tasks (
          name, description, group_id, cron_expression, task_type, task_config,
          concurrent_control, timeout, retry_count, enabled, parameters
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          taskData.name,
          taskData.description,
          taskData.group_id,
          taskData.cron_expression,
          taskData.task_type,
          JSON.stringify(taskData.task_config),
          taskData.concurrent_control,
          taskData.timeout,
          taskData.retry_count,
          taskData.enabled,
          JSON.stringify(taskData.parameters)
        ]
      );

      const created = result.rows[0];
      // 计算下一次执行时间
      if (created?.cron_expression) {
        const next = computeNextRun(created.cron_expression, new Date());
        if (next) {
          await pool.query('UPDATE tasks SET next_execution_at = $1 WHERE id = $2', [next, created.id]);
          created.next_execution_at = next;
        }
      }
      return created;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw error;
    }
  }

  // 更新任务
  static async updateTask(id: number, taskData: TaskUpdate): Promise<Task | null> {
    try {
      if (taskData.cron_expression) {
        const hasSeconds = taskData.cron_expression.trim().split(/\s+/).length === 6
        const sched = later.parse.cron(taskData.cron_expression, hasSeconds)
        if (sched.error) throw new Error('无效的 cron 表达式')
      }
      const fields = [];
      const values = [];
      let paramCount = 1;

      const allowedFields = [
        'name', 'description', 'group_id', 'cron_expression', 'task_type',
        'task_config', 'concurrent_control', 'timeout', 'retry_count', 'enabled', 'parameters'
      ];

      for (const [key, value] of Object.entries(taskData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          fields.push(`${key} = $${paramCount}`);
          values.push(key === 'task_config' || key === 'parameters' ? JSON.stringify(value) : value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        return await this.getTaskById(id);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE tasks 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      const updated = result.rows[0] || null;
      if (updated && updated.cron_expression) {
        const next = computeNextRun(updated.cron_expression, new Date());
        if (next) {
          await pool.query('UPDATE tasks SET next_execution_at = $1 WHERE id = $2', [next, updated.id]);
          updated.next_execution_at = next;
        }
      }
      return updated;
    } catch (error) {
      console.error('更新任务失败:', error);
      throw error;
    }
  }

  // 删除任务
  static async deleteTask(id: number): Promise<boolean> {
    try {
      const result = await pool.query(
        'DELETE FROM tasks WHERE id = $1',
        [id]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  }

  // 启用/禁用任务
  static async updateTaskStatus(id: number, enabled: boolean): Promise<Task | null> {
    try {
      const result = await pool.query(
        'UPDATE tasks SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [enabled, id]
      );

      const updated = result.rows[0] || null;
      if (updated && updated.enabled && updated.cron_expression) {
        const next = computeNextRun(updated.cron_expression, new Date());
        if (next) {
          await pool.query('UPDATE tasks SET next_execution_at = $1 WHERE id = $2', [next, updated.id]);
          updated.next_execution_at = next;
        }
      }
      return updated;
    } catch (error) {
      console.error('更新任务状态失败:', error);
      throw error;
    }
  }

  // 手动触发任务
  static async triggerTask(id: number, triggerType: 'manual' | 'scheduled' | 'retry' | 'api' = 'manual'): Promise<void> {
    try {
      const task = await this.getTaskById(id)
      if (!task) throw new Error('任务不存在')

      const start = new Date()
      // 创建执行记录（running）
      const createRes = await pool.query(
        `INSERT INTO task_executions (task_id, status, start_time, retry_count, trigger_type)
         VALUES ($1, 'running', $2, 0, $3)
         RETURNING id`,
        [id, start, triggerType]
      )
      const executionId = createRes.rows[0].id

      let status: 'success' | 'failed' = 'success'
      let output = ''
      let error_message: string | null = null

      try {
        if (task.task_type === 'http') {
          const cfg = typeof task.task_config === 'string' ? JSON.parse(task.task_config) : task.task_config || {}
          const url: string | undefined = cfg.url
          const method: string = (cfg.method || 'GET').toUpperCase()
          const headers: Record<string, string> = { ...(cfg.headers || {}), 'x-task-internal': '1', 'x-request-id': String(executionId) }
          const timeoutSec: number = cfg.timeout ?? task.timeout ?? 30

          if (!url) throw new Error('任务配置缺少 url')

          const nowTs = Date.now()
          if (isCircuitOpen(url, nowTs)) {
            status = 'failed'
            error_message = 'circuit-open'
          } else {
            const controller = new AbortController()
            const abortTimer = setTimeout(() => controller.abort(), Math.max(1, timeoutSec) * 1000)
            const res = await fetch(url, { method, headers, signal: controller.signal })
            clearTimeout(abortTimer)

            const text = await res.text()
            output = text.length > 4000 ? text.slice(0, 4000) + `\n...(${text.length - 4000} chars truncated)` : text
            if (!res.ok) {
              status = 'failed'
              error_message = `HTTP ${res.status}`
              recordFailure(url, nowTs)
            } else {
              recordSuccess(url)
            }
          }
        } else {
          // RPC 类型可在此扩展实现
          output = 'RPC任务暂未实现'
        }
      } catch (innerErr: any) {
        status = 'failed'
        error_message = innerErr?.message || String(innerErr)
        const urlKey = (() => { try { const cfg = typeof task.task_config === 'string' ? JSON.parse(task.task_config) : task.task_config || {}; return cfg.url as string | undefined } catch { return undefined } })()
        if (urlKey) recordFailure(urlKey, Date.now())
      }

      const end = new Date()
      const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))

      await pool.query(
        `UPDATE task_executions 
           SET status = $1, end_time = $2, duration = $3, output = $4, error_message = $5
         WHERE id = $6`,
        [status, end, duration, output, error_message, executionId]
      )

      await pool.query(
        `UPDATE tasks SET last_execution_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [end, id]
      )

      // 计算并更新下一次执行时间
      if (task.cron_expression) {
        const next = computeNextRun(task.cron_expression, end);
        if (next) {
          await pool.query('UPDATE tasks SET next_execution_at = $1 WHERE id = $2', [next, id]);
        }
      }

      // 失败重试：根据任务配置进行简单退避重试（定时触发）
      if (status === 'failed') {
        const tRes = await pool.query(`SELECT max_retries, retry_backoff_seconds FROM demo1.tasks WHERE id = $1`, [id])
        const cfg = tRes.rows[0] || { max_retries: 0, retry_backoff_seconds: 60 }
        const lastRetryRes = await pool.query(`SELECT retry_count FROM demo1.task_executions WHERE id = $1`, [executionId])
        const attempts = (lastRetryRes.rows[0]?.retry_count ?? 0) + 1
        if ((cfg.max_retries || 0) >= attempts) {
          const delay = Math.max(1, cfg.retry_backoff_seconds || 60) * 1000
          setTimeout(() => {
            TaskService.triggerTask(id, 'retry').catch(err => console.error('重试触发失败:', err))
          }, delay)
        }
      }

      // 告警规则检查：若失败，判断窗口内失败次数是否达阈值，发送通知
      if (status === 'failed') {
        const rulesRes = await pool.query(`
          SELECT id, window_minutes, failure_threshold, to_emails FROM demo1.alert_rules WHERE enabled = TRUE AND task_id = $1
        `, [id])
        for (const rule of rulesRes.rows) {
          const { window_minutes, failure_threshold, to_emails } = rule
          const cntRes = await pool.query(`
            SELECT COUNT(*)::int AS c FROM demo1.task_executions 
            WHERE task_id = $1 AND status = 'failed' AND created_at >= NOW() - interval '${window_minutes} minutes'
          `, [id])
          const c = cntRes.rows[0]?.c || 0
          if (c >= failure_threshold) {
            try {
              const cfgRes = await pool.query(`SELECT config, enabled FROM demo1.notification_configs WHERE notification_type='email' ORDER BY id ASC LIMIT 1`)
              const row = cfgRes.rows[0]
              if (row && row.enabled) {
                const cfg = row.config || {}
                const transporter = nodemailer.createTransport({
                  host: cfg.smtp_server,
                  port: cfg.smtp_port || 587,
                  secure: !!cfg.secure,
                  auth: cfg.smtp_username ? { user: cfg.smtp_username, pass: cfg.smtp_password } : undefined,
                })
                await transporter.verify()
                const recipients = (to_emails || cfg.smtp_from_email || cfg.smtp_username || '').split(',').filter((s: string) => s.trim())
                if (recipients.length) {
                  await transporter.sendMail({
                    from: cfg.smtp_from_email || cfg.smtp_username,
                    to: recipients.join(',')
                    , subject: `任务告警：${task.name}`,
                    text: `任务【${task.name}】在最近${window_minutes}分钟内发生失败次数：${c}（阈值：${failure_threshold}）。最新错误：${error_message || '无'}`,
                  })
                }
              }
            } catch (e) {
              console.error('发送告警失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('触发任务失败:', error)
      throw error
    }
  }
}
