/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
// removed duplicate path import
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth-real.js'
import taskRoutes from './routes/tasks.js'
import monitoringRoutes from './routes/monitoring.js'
import taskGroupsRoutes from './routes/task-groups.js'
import iamRoutes from './routes/iam.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import notificationsRoutes from './routes/notifications.js'
import systemsRoutes from './routes/systems.js'
import metricsRoutes from './routes/metrics.js'
import maintenanceRoutes from './routes/maintenance.js'
import logger from './lib/logger.js'
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './docs.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envLocal = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal })
} else {
  dotenv.config()
}

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/monitoring', monitoringRoutes)
app.use('/api/task-groups', taskGroupsRoutes)
app.use('/api/iam', iamRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/systems', systemsRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api', maintenanceRoutes)
app.get('/api/openapi.json', (req: Request, res: Response) => { res.json(openapiSpec) })
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

// legacy health path for sample tasks
app.use(
  '/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware（统一响应结构）
 */

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
// 简单请求日志与请求ID
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).requestId = Math.random().toString(36).slice(2)
  logger.info('request', { requestId: (req as any).requestId, method: req.method, url: req.url })
  next()
})
// 统一错误处理
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500
  const requestId = (req as any).requestId
  logger.error('error', { requestId, error: err.message || String(err) })
  res.status(status).json({ success: false, code: status, message: err.message || '服务器内部错误', requestId })
})
