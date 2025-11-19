import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { dbPoolConnections, dbConnectionPoolUtilization } from '../metrics';

/**
 * Database Service with proper connection pool configuration (Issue #12)
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  async onModuleInit() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      
      // Connection pool configuration (Issue #12)
      max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Max 20 connections
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),  // Keep 5 idle
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Fail fast if no connection available
      maxUses: 7500, // Recycle connection after 7500 uses (prevent memory leaks)
      allowExitOnIdle: true,
    });
    
    // Monitor pool health
    this.pool.on('connect', () => {
      console.log('New database connection established');
      this.updatePoolMetrics();
    });

    this.pool.on('acquire', () => {
      const stats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };
      
      if (stats.waiting > 5) {
        console.warn('High connection wait queue:', stats);
      }
      
      this.updatePoolMetrics();
    });

    this.pool.on('remove', () => {
      this.updatePoolMetrics();
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
    
    // Periodic metrics update
    setInterval(() => {
      this.updatePoolMetrics();
    }, 10000); // Every 10 seconds
    
    try {
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully');
      this.updatePoolMetrics();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Update Prometheus metrics for connection pool
   */
  private updatePoolMetrics() {
    const total = this.pool.totalCount;
    const idle = this.pool.idleCount;
    const waiting = this.pool.waitingCount;
    
    dbPoolConnections.labels({ state: 'total' }).set(total);
    dbPoolConnections.labels({ state: 'idle' }).set(idle);
    dbPoolConnections.labels({ state: 'waiting' }).set(waiting);
    
    // Calculate utilization percentage
    const maxConnections = parseInt(process.env.DB_POOL_MAX || '20', 10);
    const utilization = (total / maxConnections) * 100;
    dbConnectionPoolUtilization.set(utilization);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }

  getPool(): Pool {
    return this.pool;
  }
}
