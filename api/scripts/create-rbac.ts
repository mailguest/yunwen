import pool from '../config/database.js'

async function ensureRbac() {
  try {
    console.log('Ensuring RBAC tables...')
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
    `)

    console.log('Insert default resources & roles...')
    await pool.query(`
      INSERT INTO demo1.resources (name, code, path, icon, order_index)
      VALUES 
        ('仪表板','dashboard','/','DashboardOutlined',1),
        ('任务管理','tasks','/tasks','ProfileOutlined',2),
        ('任务分组','task-groups','/task-groups','FileTextOutlined',3),
        ('监控','monitoring','/monitoring','AreaChartOutlined',4),
        ('设置','settings','/settings','SettingOutlined',98),
        ('安全管理','security','/security','SafetyOutlined',99),
        ('告警设置','alerts','/alerts','AlertOutlined',100)
      ON CONFLICT (code) DO NOTHING;
      -- 子资源：安全管理 → 用户/角色/资源
      DO $$
      DECLARE sec_id INT;
      BEGIN
        SELECT id INTO sec_id FROM demo1.resources WHERE code = 'security';
        IF sec_id IS NOT NULL THEN
          INSERT INTO demo1.resources (name, code, path, icon, parent_id, order_index)
          VALUES 
            ('用户管理','security_users','/security/users','UserOutlined', sec_id, 1),
            ('角色管理','security_roles','/security/roles','TeamOutlined', sec_id, 2),
            ('资源管理','security_resources','/security/resources','DatabaseOutlined', sec_id, 3),
            ('系统管理','security_systems','/systems','SettingOutlined', sec_id, 4),
            ('告警设置','security_alerts','/alerts','AlertOutlined', sec_id, 4)
          ON CONFLICT (code) DO NOTHING;
        END IF;
        -- 旧的顶级“用户管理”资源设为不可见
        UPDATE demo1.resources SET is_active = FALSE WHERE code = 'users';
      END $$;
      INSERT INTO demo1.roles (name, code, description) VALUES 
        ('管理员','admin','系统管理员'),
        ('普通用户','user','普通用户')
      ON CONFLICT (code) DO NOTHING;
    `)

    console.log('Bind admin user to admin role & all resources...')
    await pool.query(`
      INSERT INTO demo1.user_roles (user_id, role_id)
      SELECT u.id, r.id FROM demo1.users u, demo1.roles r WHERE u.username = 'admin' AND r.code = 'admin'
      ON CONFLICT DO NOTHING;
      INSERT INTO demo1.role_resources (role_id, resource_id)
      SELECT r.id, res.id FROM demo1.roles r CROSS JOIN demo1.resources res WHERE r.code = 'admin'
      ON CONFLICT DO NOTHING;
    `)

    console.log('RBAC ensured.')
  } catch (e) {
    console.error('Ensure RBAC failed:', e)
    process.exit(1)
  }
}

ensureRbac().then(() => process.exit(0))
