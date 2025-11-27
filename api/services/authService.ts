import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import fs from 'fs';
import path from 'path';

let cachedSecurity: { secret?: string; algorithm?: jwt.Algorithm; expiresMinutes?: number; passwordMin?: number; twoFactor?: boolean } | null = null;

async function loadSecuritySettings() {
  try {
    const { rows } = await pool.query(`SELECT jwt_secret_key, jwt_algorithm, jwt_expiration_minutes, password_min_length, enable_two_factor FROM demo1.app_settings WHERE id = 1`)
    const row = rows[0] || {}
    let secret = row.jwt_secret_key || process.env.JWT_SECRET
    if (!secret) {
      const candidates = [
        '/run/secrets/jwt_secret',
        path.resolve(process.cwd(), '.secrets/jwt_secret'),
      ]
      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) {
            const s = fs.readFileSync(p, 'utf-8').trim()
            if (s) { secret = s; break }
          }
        } catch {}
      }
    }
    if (!secret) {
      throw new Error('JWT 密钥未配置')
    }
    cachedSecurity = {
      secret,
      algorithm: (row.jwt_algorithm || 'HS256') as jwt.Algorithm,
      expiresMinutes: row.jwt_expiration_minutes || 60 * 24,
      passwordMin: row.password_min_length || 8,
      twoFactor: !!row.enable_two_factor,
    }
  } catch {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      throw new Error('JWT 密钥未配置')
    }
    cachedSecurity = {
      secret,
      algorithm: 'HS256',
      expiresMinutes: 60 * 24,
      passwordMin: 8,
      twoFactor: false,
    }
  }
}

function getSecurity() {
  return cachedSecurity as { secret: string; algorithm: jwt.Algorithm; expiresMinutes: number; passwordMin: number; twoFactor: boolean }
}

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  is_active: boolean;
  avatar_url?: string;
  full_name?: string;
  phone?: string;
  department?: string;
  position?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: Omit<User, 'password_hash'>;
}

export class AuthService {
  // 用户登录
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      if (!cachedSecurity) await loadSecuritySettings()
      const sec = getSecurity()
      // 查询用户
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 OR username = $1',
        [credentials.email]
      );

      if (result.rows.length === 0) {
        throw new Error('用户名或密码错误');
      }

      const user = result.rows[0];

      // 检查用户是否激活
      if (!user.is_active) {
        throw new Error('用户账户已被禁用');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('用户名或密码错误');
      }

      // 更新最后登录时间
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // 生成JWT令牌
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        sec.secret,
        { expiresIn: `${sec.expiresMinutes}m`, algorithm: sec.algorithm }
      );

      // 返回用户数据（不包含密码）
      const { password_hash, ...userWithoutPassword } = user;

      return {
        access_token: token,
        token_type: 'bearer',
        user: userWithoutPassword as Omit<User, 'password_hash'>
      };
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  // 验证令牌
  static async validateToken(token: string): Promise<User | null> {
    try {
      if (!cachedSecurity) await loadSecuritySettings()
      const sec = getSecurity()
      const decoded = jwt.verify(token, sec.secret, { algorithms: [sec.algorithm] }) as any;
      
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      const { password_hash, ...userWithoutPassword } = user;
      
      return userWithoutPassword as User;
    } catch (error) {
      console.error('令牌验证失败:', error);
      return null;
    }
  }

  // 获取用户信息
  static async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      const { password_hash, ...userWithoutPassword } = user;
      
      return userWithoutPassword as User;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  }

  // 更新用户资料
  static async updateProfile(userId: number, data: Partial<User>): Promise<User | null> {
    try {
      const allowedFields = ['email', 'username', 'full_name', 'phone', 'department', 'avatar_url', 'position'];
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.email) {
        const email = String(data.email).trim()
        const exists = await pool.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [email, userId])
        if (exists.rows.length) throw new Error('邮箱已被占用')
      }
      if (data.username) {
        const username = String(data.username).trim()
        const exists = await pool.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [username, userId])
        if (exists.rows.length) throw new Error('用户名已被占用')
      }

      for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        return await this.getUserById(userId);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      const { password_hash, ...userWithoutPassword } = user;
      
      return userWithoutPassword as User;
    } catch (error) {
      console.error('更新用户资料失败:', error);
      throw error;
    }
  }

  // 修改密码
  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // 获取当前用户
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('用户不存在');
      }

      const currentPasswordHash = result.rows[0].password_hash;

      // 验证当前密码
      const isValidPassword = await bcrypt.compare(currentPassword, currentPasswordHash);
      if (!isValidPassword) {
        throw new Error('当前密码错误');
      }

      const np = String(newPassword)
      const strong = np.length >= 8 && /[A-Za-z]/.test(np) && /\d/.test(np)
      if (!strong) throw new Error('新密码需至少8位，包含字母与数字')
      const newPasswordHash = await bcrypt.hash(np, 10);

      // 更新密码
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, userId]
      );

      return true;
    } catch (error) {
      console.error('修改密码失败:', error);
      throw error;
    }
  }
}
