import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    roles: string[];
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: '未提供有效的认证令牌'
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = await AuthService.validateToken(token);

    if (!user) {
      res.status(401).json({
        success: false,
        message: '令牌无效或已过期'
      });
      return;
    }

    // 加载用户的全部角色代码
    const rolesResult = await (await import('../config/database')).default.query(
      `SELECT r.code FROM demo1.user_roles ur JOIN demo1.roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [user.id]
    );
    req.user = {
      userId: user.id,
      email: user.email,
      roles: rolesResult.rows.map((r: any) => r.code)
    };

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(401).json({
      success: false,
      message: '认证失败'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '需要登录'
      });
      return;
    }

    if (!req.user.roles || !req.user.roles.some(r => roles.includes(r))) {
      res.status(403).json({
        success: false,
        message: '权限不足'
      });
      return;
    }

    next();
  };
};
