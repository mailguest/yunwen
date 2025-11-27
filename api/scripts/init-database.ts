import pool from '../config/database';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  try {
    console.log('🚀 正在初始化数据库...');
    
    // 首先检查数据库是否已初始化
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'demo1' 
        AND table_name = 'users'
      )
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('ℹ️  数据库已初始化，跳过初始化步骤');

      // 修复默认用户密码为预期值
      console.log('🔧 检查并修复默认用户密码...');
      const adminHash = await bcrypt.hash('admin123', 10);
      const userHash = await bcrypt.hash('user123', 10);
      const demoHash = await bcrypt.hash('demo123', 10);

      await pool.query(
        `UPDATE demo1.users SET password_hash = $1 WHERE username = 'admin'`
        , [adminHash]
      );
      await pool.query(
        `UPDATE demo1.users SET password_hash = $1 WHERE username = 'user'`
        , [userHash]
      );
      await pool.query(
        `UPDATE demo1.users SET password_hash = $1 WHERE username = 'demo'`
        , [demoHash]
      );
      console.log('✅ 默认用户密码已修复为：admin123 / user123 / demo123');

      // 修复由于触发器导致的 updated_at 字段缺失问题
      await pool.query(`ALTER TABLE demo1.task_executions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      console.log('🔧 已确保 task_executions 存在 updated_at 字段');

      // 确保 users 表存在职位字段
      await pool.query(`ALTER TABLE demo1.users ADD COLUMN IF NOT EXISTS position VARCHAR(100)`);
      console.log('🔧 已确保 users 存在 position 字段');

      // 告警规则表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS demo1.alert_rules (
          id SERIAL PRIMARY KEY,
          task_id INT REFERENCES demo1.tasks(id) ON DELETE CASCADE,
          window_minutes INT NOT NULL DEFAULT 60,
          failure_threshold INT NOT NULL DEFAULT 1,
          to_emails TEXT,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Systems 表与为角色/资源/通知/告警增加 system_id
      await pool.query(`
        CREATE TABLE IF NOT EXISTS demo1.systems (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE demo1.roles ADD COLUMN IF NOT EXISTS system_id INT REFERENCES demo1.systems(id) ON DELETE CASCADE;
        ALTER TABLE demo1.resources ADD COLUMN IF NOT EXISTS system_id INT REFERENCES demo1.systems(id) ON DELETE CASCADE;
        ALTER TABLE demo1.notification_configs ADD COLUMN IF NOT EXISTS system_id INT REFERENCES demo1.systems(id) ON DELETE CASCADE;
        ALTER TABLE demo1.alert_rules ADD COLUMN IF NOT EXISTS system_id INT REFERENCES demo1.systems(id) ON DELETE CASCADE;
      `);

      await pool.query(`
        INSERT INTO demo1.systems (name, code, description)
        VALUES ('默认系统','default','默认主系统') ON CONFLICT (code) DO NOTHING;
        UPDATE demo1.roles SET system_id = COALESCE(system_id, (SELECT id FROM demo1.systems WHERE code='default'));
        UPDATE demo1.resources SET system_id = COALESCE(system_id, (SELECT id FROM demo1.systems WHERE code='default'));
      `);

      // 任务重试字段
      await pool.query(`
        ALTER TABLE demo1.tasks ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 0;
        ALTER TABLE demo1.tasks ADD COLUMN IF NOT EXISTS retry_backoff_seconds INT DEFAULT 60;
      `);

      // 应用基础设置表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS demo1.app_settings (
          id INT PRIMARY KEY DEFAULT 1,
          site_name VARCHAR(200),
          site_description TEXT,
          timezone VARCHAR(100),
          language VARCHAR(50),
          debug BOOLEAN DEFAULT FALSE,
          current_system_code VARCHAR(100) DEFAULT 'default',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO demo1.app_settings (id, site_name, site_description, timezone, language, debug, current_system_code)
        VALUES (1, '智能定时任务调度平台', '企业级定时任务调度系统', 'Asia/Shanghai', 'zh-CN', FALSE, 'default')
        ON CONFLICT (id) DO NOTHING;
      `);

      // RBAC 基础表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS demo1.resources (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(100) UNIQUE NOT NULL,
          path VARCHAR(255) NOT NULL,
          icon VARCHAR(64),
          parent_id INT REFERENCES demo1.resources(id) ON DELETE SET NULL,
          order_index INT DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS demo1.roles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS demo1.user_roles (
          user_id INT REFERENCES demo1.users(id) ON DELETE CASCADE,
          role_id INT REFERENCES demo1.roles(id) ON DELETE CASCADE,
          PRIMARY KEY(user_id, role_id)
        );
        CREATE TABLE IF NOT EXISTS demo1.role_resources (
          role_id INT REFERENCES demo1.roles(id) ON DELETE CASCADE,
          resource_id INT REFERENCES demo1.resources(id) ON DELETE CASCADE,
          PRIMARY KEY(role_id, resource_id)
        );
      `);

      await pool.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON demo1.resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON demo1.roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);

      // 默认资源与角色
      await pool.query(`
        INSERT INTO demo1.resources (name, code, path, icon, order_index)
        VALUES 
          ('仪表板','dashboard','/','DashboardOutlined',1),
          ('任务管理','tasks','/tasks','ProfileOutlined',2),
          ('任务分组','task-groups','/task-groups','FileTextOutlined',3),
          ('监控','monitoring','/monitoring','AreaChartOutlined',4),
          ('用户管理','users','/users','UserOutlined',5),
          ('设置','settings','/settings','SettingOutlined',6)
        ON CONFLICT (code) DO NOTHING;
        INSERT INTO demo1.roles (name, code, description, system_id) VALUES 
          ('管理员','admin','系统管理员',(SELECT id FROM demo1.systems WHERE code='default')),
          ('普通用户','user','普通用户',(SELECT id FROM demo1.systems WHERE code='default'))
        ON CONFLICT (code) DO NOTHING;
      `);

      // 将 admin 绑定全部资源
      await pool.query(`
        INSERT INTO demo1.user_roles (user_id, role_id)
        SELECT u.id, r.id FROM demo1.users u, demo1.roles r WHERE u.username = 'admin' AND r.code = 'admin'
        ON CONFLICT DO NOTHING;
        INSERT INTO demo1.role_resources (role_id, resource_id)
        SELECT r.id, res.id FROM demo1.roles r CROSS JOIN demo1.resources res WHERE r.code = 'admin'
        ON CONFLICT DO NOTHING;
      `);

      // 显示当前用户信息
      const usersResult = await pool.query(`
        SELECT id, email, username, role, is_active, created_at 
        FROM demo1.users 
        ORDER BY id
      `);
      
      console.log('👥 当前用户信息:');
      usersResult.rows.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.is_active ? '激活' : '禁用'}`);
      });
      
    return;
    }
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../../supabase/migrations/20240115000001_initial_schema.sql');
    console.log(`📄 SQL文件路径: ${sqlPath}`);
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL文件不存在: ${sqlPath}`);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`📖 读取到 ${sql.length} 字符的SQL内容`);
    
    console.log('📄 执行SQL脚本...');
    // 执行SQL脚本
    await pool.query(sql);
    
    console.log('✅ 数据库初始化完成！');
    
    // 验证表是否创建成功
    const tables = [
      'users', 'task_groups', 'tasks', 'task_executions', 
      'system_configs', 'notification_configs', 'system_logs'
    ];
    
    console.log('🔍 验证表结构...');
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
    const userResult = await pool.query('SELECT COUNT(*) as count FROM demo1.users');
    console.log(`📊 用户表中有 ${userResult.rows[0].count} 个用户`);
    
    // 显示默认用户信息
    const usersResult = await pool.query(`
      SELECT id, email, username, role, is_active, created_at 
      FROM demo1.users 
      ORDER BY id
    `);
    
    console.log('👥 默认用户信息:');
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.is_active ? '激活' : '禁用'}`);
    });
    
    console.log('\n🎉 数据库初始化全部完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    // 不要在这里关闭连接池，让应用程序继续使用
    // await pool.end();
  }
}

// 如果直接运行此脚本
console.log('开始执行数据库初始化...');
initializeDatabase().then(() => {
  console.log('数据库初始化脚本执行完成');
  process.exit(0);
}).catch(error => {
  console.error('数据库初始化脚本执行失败:', error);
  process.exit(1);
});

export { initializeDatabase };
