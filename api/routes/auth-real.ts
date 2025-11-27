import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { AuthService } from '../services/authService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const failMap = new Map<string, { count: number; until: number }>();
const MAX_FAILS = parseInt(process.env.LOGIN_FAIL_MAX || '5', 10);
const COOLDOWN_MS = parseInt(process.env.LOGIN_FAIL_COOLDOWN_MS || '600000', 10);

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password } = req.body as any;
    const identifier = (username ?? email ?? '').trim();
    
    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        message: '账号和密码不能为空'
      });
      return;
    }

    const key = `${req.ip}|${identifier}`
    const now = Date.now()
    const fs = failMap.get(key)
    if (fs && fs.until > now) {
      res.status(429).json({ success: false, message: '登录失败次数过多，请稍后再试' })
      return
    }

    const result = await AuthService.login({ email: identifier, password });
    
    res.json({
      success: true,
      ...result
    });
    failMap.delete(key)
  } catch (error: any) {
    console.error('登录错误:', error);
    const { email, username } = req.body as any
    const identifier = (username ?? email ?? '').trim()
    const key = `${req.ip}|${identifier}`
    const fs = failMap.get(key) || { count: 0, until: 0 }
    fs.count += 1
    if (fs.count >= MAX_FAILS) {
      fs.until = Date.now() + COOLDOWN_MS
    }
    failMap.set(key, fs)
    res.status(401).json({
      success: false,
      message: error.message || '登录失败'
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: '未提供有效的认证令牌'
      });
      return;
    }

    const user = await AuthService.getUserById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: '用户不存在'
      });
      return;
    }

    res.json({
      success: true,
      user
    });
  } catch (error: any) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

/**
 * 更新用户资料
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: '未提供有效的认证令牌'
      });
      return;
    }

    const allowedFields = ['email', 'username', 'full_name', 'phone', 'department', 'avatar_url', 'position'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await AuthService.updateProfile(userId, updateData);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: '用户不存在'
      });
      return;
    }

    res.json({
      success: true,
      user
    });
  } catch (error: any) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户资料失败'
    });
  }
});

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { current_password, new_password } = req.body;
    
    if (!userId || !current_password || !new_password) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
      return;
    }

    await AuthService.changePassword(userId, current_password, new_password);
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error: any) {
    console.error('修改密码错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '修改密码失败'
    });
  }
});

/**
 * 上传头像
 * POST /api/auth/upload-avatar
 */
router.post('/upload-avatar', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: 实现头像上传功能
    res.status(501).json({
      success: false,
      message: '头像上传功能暂未实现'
    });
  } catch (error: any) {
    console.error('上传头像错误:', error);
    res.status(500).json({
      success: false,
      message: '上传头像失败'
    });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: 实现令牌失效逻辑（如使用Redis存储黑名单）
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error: any) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
});

/**
 * 重置默认管理员密码（开发环境专用）
 * POST /api/auth/reset-admin-password
 * Headers: x-reset-token: <ADMIN_RESET_TOKEN>
 * Body: { new_password: string }
 */
router.post('/reset-admin-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production'
    if (isProd) {
      res.status(403).json({ success: false, message: '生产环境不允许重置管理员密码' })
      return
    }
    const token = req.headers['x-reset-token']
    if (!process.env.ADMIN_RESET_TOKEN || token !== process.env.ADMIN_RESET_TOKEN) {
      res.status(401).json({ success: false, message: '未授权的重置请求' })
      return
    }
    const { new_password } = req.body as any
    if (!new_password || String(new_password).length < 6) {
      res.status(400).json({ success: false, message: '新密码长度至少6位' })
      return
    }
    const hash = await bcrypt.hash(String(new_password), 10)
    const findRes = await pool.query('SELECT id FROM demo1.users WHERE username = $1 OR email = $2 LIMIT 1', ['admin', 'admin@example.com'])
    if (findRes.rows.length) {
      await pool.query('UPDATE demo1.users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, findRes.rows[0].id])
    } else {
      await pool.query(
        `INSERT INTO demo1.users (email, username, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ['admin@example.com', 'admin', hash]
      )
    }
    res.json({ success: true, message: '管理员密码已重置' })
  } catch (error: any) {
    console.error('重置管理员密码错误:', error)
    res.status(500).json({ success: false, message: '重置管理员密码失败' })
  }
})

export default router;
