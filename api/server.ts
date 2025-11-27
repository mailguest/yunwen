/**
 * local server entry file, for local development
 */
import app from './app.js';
import pool from './config/database.js';
import { startScheduler } from './services/scheduler.js';
import { initOtel } from './lib/otel.js';

// 简单的数据库连接测试
async function testDatabaseConnection() {
  try {
    const result = await pool.query('SELECT 1');
    console.log('✅ 数据库连接成功');
    
    // 检查用户表是否存在
    const userCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'demo1' 
        AND table_name = 'users'
      )
    `);
    
    if (userCheck.rows[0].exists) {
      const usersResult = await pool.query(`
        SELECT id, email, username, role, is_active 
        FROM demo1.users 
        ORDER BY id
      `);
      
      console.log('👥 当前用户信息:');
      usersResult.rows.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.is_active ? '激活' : '禁用'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  }
}

initOtel().catch(() => {})
testDatabaseConnection();

async function ensureDefaultAdmin() {
  try {
    const existsRes = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )`, ['demo1', 'users']
    )
    if (!existsRes.rows[0]?.exists) return
    const adminRes = await pool.query(
      'SELECT id FROM demo1.users WHERE username = $1 OR email = $2 LIMIT 1',
      ['admin', 'admin@example.com']
    )
    if (adminRes.rows.length === 0) {
      const bcrypt = await import('bcrypt')
      const hash = await bcrypt.default.hash('admin123', 10)
      await pool.query(
        `INSERT INTO demo1.users (email, username, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'admin', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ['admin@example.com', 'admin', hash]
      )
      console.log('✅ 已创建默认管理员账号 admin / admin123')
    }
  } catch (e) {
    console.error('确保默认管理员失败:', e)
  }
}

ensureDefaultAdmin().catch(() => {})

startScheduler().catch(() => {})

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
