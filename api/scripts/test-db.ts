import pool from '../config/database';

async function testConnection() {
  try {
    console.log('正在测试PostgreSQL数据库连接...');
    console.log(`连接信息: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    const client = await pool.connect();
    console.log('✅ 数据库连接成功！');
    
    // 测试查询
    const result = await client.query('SELECT current_database(), current_schema(), version()');
    console.log('数据库信息:');
    console.log(`- 当前数据库: ${result.rows[0].current_database}`);
    console.log(`- 当前模式: ${result.rows[0].current_schema}`);
    console.log(`- PostgreSQL版本: ${result.rows[0].version.split(' ')[0]}`);
    
    // 检查表是否存在
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'demo1' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('✅ 已存在的表:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('ℹ️  demo1模式下暂无表，需要初始化');
    }
    
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

// 如果直接运行此脚本
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
  testConnection().then(success => {
    if (success) {
      console.log('数据库连接测试通过！');
      process.exit(0);
    } else {
      console.log('数据库连接测试失败！');
      process.exit(1);
    }
  });
}

export { testConnection };