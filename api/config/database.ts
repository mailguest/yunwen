// 数据库配置
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocal = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal })
} else {
  dotenv.config()
}

const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production'
const host = process.env.DB_HOST || (isDev ? 'localhost' : undefined)
const portStr = process.env.DB_PORT || (isDev ? '5432' : undefined)
const db = process.env.DB_NAME || (isDev ? 'scheduler' : undefined)
const user = process.env.DB_USER || (isDev ? 'postgres' : undefined)
const password = process.env.DB_PASSWORD || (isDev ? 'postgres' : undefined)

if (!host || !portStr || !db || !user || !password) {
  const missing = [
    !host && 'DB_HOST',
    !portStr && 'DB_PORT',
    !db && 'DB_NAME',
    !user && 'DB_USER',
    !password && 'DB_PASSWORD',
  ].filter(Boolean).join(', ')
  throw new Error(`缺少必要数据库环境变量: ${missing}`)
}

const pool = new Pool({
  host,
  port: parseInt(portStr, 10),
  database: db,
  user,
  password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  options: `-c search_path=${process.env.DB_SCHEMA || 'demo1'}`
});

const stmtTimeout = parseInt(process.env.STATEMENT_TIMEOUT_MS || '0', 10);
if (stmtTimeout > 0) {
  pool.query('SET statement_timeout = $1', [stmtTimeout]).catch(() => {});
}

const idleTxTimeout = parseInt(process.env.IDLE_TX_TIMEOUT_MS || '0', 10)
if (idleTxTimeout > 0) {
  pool.query('SET idle_in_transaction_session_timeout = $1', [idleTxTimeout]).catch(() => {})
}

export default pool;
export async function queryWithRetry<T = any>(sql: string, params?: any[], attempts = 3): Promise<{ rows: T[] }>{
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await pool.query(sql, params)
    } catch (e: any) {
      lastErr = e
      if (i < attempts - 1) await new Promise(r => setTimeout(r, Math.min(1000 * (i + 1), 3000)))
    }
  }
  throw lastErr
}
