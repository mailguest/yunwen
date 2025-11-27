/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'

const router = Router()

// Mock user database
const mockUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    email: 'user@example.com',
    username: 'user',
    password: 'user123',
    role: 'user',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    email: 'demo@example.com',
    username: 'demo',
    password: 'demo123',
    role: 'user',
    is_active: true,
    created_at: new Date().toISOString()
  }
]

// Mock token storage (in production, use JWT or similar)
const mockTokens = new Map()

/**
 * User Login
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  // TODO: Implement register logic
  res.status(501).json({ success: false, message: '注册功能暂未实现' })
})

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: '邮箱和密码不能为空' 
      })
      return
    }
    
    // Find user by email or username
    const user = mockUsers.find(u => u.email === email || u.username === email)
    
    if (!user || user.password !== password) {
      res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      })
      return
    }
    
    if (!user.is_active) {
      res.status(403).json({ 
        success: false, 
        message: '用户账户已被禁用' 
      })
      return
    }
    
    // Generate mock token
    const access_token = 'mock-jwt-token-' + Date.now()
    mockTokens.set(access_token, user)
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user
    
    res.json({
      success: true,
      access_token,
      token_type: 'bearer',
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ 
      success: false, 
      message: '登录失败，请稍后重试' 
    })
  }
})

/**
 * Get current user info
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        success: false, 
        message: '未提供有效的认证令牌' 
      })
      return
    }
    
    const token = authHeader.substring(7)
    const user = mockTokens.get(token)
    
    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: '令牌无效或已过期' 
      })
      return
    }
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user
    
    res.json({
      success: true,
      user: userWithoutPassword
    })
    
  } catch (error) {
    console.error('Get user info error:', error)
    res.status(500).json({ 
      success: false, 
      message: '获取用户信息失败' 
    })
  }
})

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      mockTokens.delete(token)
    }
    
    res.json({
      success: true,
      message: '登出成功'
    })
    
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ 
      success: false, 
      message: '登出失败' 
    })
  }
})

export default router
