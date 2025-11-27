import pool from './database';
import fs from 'fs';
import path from 'path';

export async function initializeDatabase() {
  try {
    console.log('正在初始化数据库...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../../supabase/migrations/20240115000001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 执行SQL脚本
    await pool.query(sql);
    
    console.log('数据库初始化完成！');
    
    // 验证表是否创建成功
    const tables = [
      'users', 'task_groups', 'tasks', 'task_executions', 
      'system_configs', 'notification_configs', 'system_logs'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'demo1' 
          AND table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ 表 ${table} 创建成功`);
      } else {
        console.log(`❌ 表 ${table} 创建失败`);
      }
    }
    
    // 检查默认用户
    const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`📊 用户表中有 ${userResult.rows[0].count} 个用户`);
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

export default pool;