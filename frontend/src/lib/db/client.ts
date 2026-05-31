import { Pool, PoolClient } from 'pg';

// Database configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'iitdeveloper',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

    // Log pool events in development
    if (process.env.NODE_ENV === 'development') {
      pool.on('connect', () => {
        console.log('✅ Database client connected');
      });
      
      pool.on('remove', () => {
        console.log('🔌 Database client removed');
      });
    }
  }

  return pool;
}

// Query helper with automatic client release
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    
    // Log slow queries in development
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Get a client from the pool for transactions
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

// Transaction helper
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Close pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔒 Database pool closed');
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
  });
}
