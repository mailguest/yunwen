import pool from '../config/database'

async function run() {
  console.log('🔧 建立 systems 表并为 resources 增加 system_id')
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo1.systems (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE demo1.resources ADD COLUMN IF NOT EXISTS system_id INT REFERENCES demo1.systems(id) ON DELETE CASCADE;
    `)
    await pool.query(`
      INSERT INTO demo1.systems (name, code, description)
      VALUES ('默认系统','default','默认主系统') ON CONFLICT (code) DO NOTHING;
      UPDATE demo1.resources SET system_id = COALESCE(system_id, (SELECT id FROM demo1.systems WHERE code='default'));
    `)
    console.log('✅ systems 与 resources.system_id 已就绪')
  } catch (e: any) {
    console.error('❌ 处理失败:', e.message || e)
    process.exit(1)
  }
  process.exit(0)
}

run()

