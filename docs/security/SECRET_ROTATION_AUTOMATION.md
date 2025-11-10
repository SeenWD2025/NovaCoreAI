# Secret Rotation Automation for NovaCoreAI

**Version:** 1.0  
**Date:** November 10, 2025  
**Prepared By:** Cloud and Cybersecurity Specialist (Security Sentinel)  
**Status:** Implementation Guide  
**Priority:** P3 - Low (Post-MVP)

---

## Executive Summary

This document provides comprehensive guidance for automating secret rotation across NovaCoreAI infrastructure. Automated rotation reduces the risk of credential compromise and ensures compliance with security best practices.

### Benefits of Automation

- **Security:** Limits exposure window for compromised secrets
- **Compliance:** Meets regulatory requirements (SOC 2, ISO 27001)
- **Operational Efficiency:** Eliminates manual coordination
- **Audit Trail:** Complete logging of all rotations
- **Reduced Human Error:** No manual copy-paste mistakes

---

## Table of Contents

1. [Database Credential Rotation](#database-credential-rotation)
2. [JWT Secret Rotation](#jwt-secret-rotation)
3. [API Key Rotation](#api-key-rotation)
4. [Audit Trail Specifications](#audit-trail-specifications)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Emergency Procedures](#emergency-procedures)
7. [Implementation Roadmap](#implementation-roadmap)

---

## Database Credential Rotation

### Overview

Automatic rotation of database credentials using HashiCorp Vault's dynamic secrets feature.

---

### Architecture

```
[Service] → [Vault] → [PostgreSQL]
              ↓
        [Auto-Renewal]
              ↓
     [Credential Lifecycle]
```

**Flow:**
1. Service requests database credentials from Vault
2. Vault generates unique credentials with TTL (24 hours)
3. Service uses credentials to connect to database
4. Service automatically renews credentials before expiration
5. Vault revokes old credentials after grace period

---

### Vault Database Secrets Engine Configuration

**Step 1: Enable Database Secrets Engine**
```bash
# Enable the database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/novacore-postgres \
    plugin_name=postgresql-database-plugin \
    allowed_roles="intelligence-service,auth-service,memory-service" \
    connection_url="postgresql://{{username}}:{{password}}@postgres.internal:5432/novacore" \
    username="vault-admin" \
    password="$VAULT_ADMIN_PASSWORD"

# Test connection
vault read database/config/novacore-postgres
```

**Step 2: Create Rotation Roles**
```bash
# Role for intelligence service (read/write access)
vault write database/roles/intelligence-service \
    db_name=novacore-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE intelligence_role;" \
    revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
    default_ttl="24h" \
    max_ttl="72h"

# Role for auth service (read/write access)
vault write database/roles/auth-service \
    db_name=novacore-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE auth_role;" \
    revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
    default_ttl="24h" \
    max_ttl="72h"

# Role for memory service (read/write access)
vault write database/roles/memory-service \
    db_name=novacore-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE memory_role;" \
    revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
    default_ttl="24h" \
    max_ttl="72h"
```

**Step 3: Create Database Roles (PostgreSQL)**
```sql
-- Create permanent roles with permissions
CREATE ROLE intelligence_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO intelligence_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO intelligence_role;

CREATE ROLE auth_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, user_progress TO auth_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO auth_role;

CREATE ROLE memory_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON memories, memory_contexts TO memory_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO memory_role;
```

---

### Service Integration

**Python (FastAPI) Implementation:**

```python
# services/intelligence/app/database/vault_db.py
import hvac
import psycopg2
from psycopg2 import pool
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class VaultDatabaseConnection:
    def __init__(self, vault_url: str, role_name: str):
        self.vault_client = hvac.Client(url=vault_url)
        self.role_name = role_name
        self.connection_pool = None
        self.credentials = None
        self.credentials_expire_at = None
        
    def authenticate_service(self, token: str):
        """Authenticate service to Vault using AppRole"""
        self.vault_client.token = token
        
    def get_database_credentials(self) -> dict:
        """Get database credentials from Vault"""
        # Check if we need new credentials
        if self._need_renewal():
            logger.info(f"Requesting new database credentials for {self.role_name}")
            
            # Request credentials from Vault
            response = self.vault_client.secrets.database.generate_credentials(
                name=self.role_name
            )
            
            self.credentials = {
                'username': response['data']['username'],
                'password': response['data']['password'],
                'lease_id': response['lease_id'],
                'lease_duration': response['lease_duration']
            }
            
            # Calculate expiration (renew at 80% of TTL)
            self.credentials_expire_at = datetime.now() + timedelta(
                seconds=int(self.credentials['lease_duration'] * 0.8)
            )
            
            logger.info(f"New credentials obtained, expires at {self.credentials_expire_at}")
            
            # Revoke old lease if exists
            if hasattr(self, 'old_lease_id'):
                try:
                    self.vault_client.sys.revoke_lease(self.old_lease_id)
                    logger.info(f"Revoked old lease: {self.old_lease_id}")
                except Exception as e:
                    logger.error(f"Failed to revoke old lease: {e}")
            
            # Store for next rotation
            self.old_lease_id = self.credentials['lease_id']
            
        return self.credentials
    
    def _need_renewal(self) -> bool:
        """Check if credentials need renewal"""
        if not self.credentials:
            return True
        if not self.credentials_expire_at:
            return True
        if datetime.now() >= self.credentials_expire_at:
            return True
        return False
    
    def get_connection_pool(self) -> pool.SimpleConnectionPool:
        """Get database connection pool with auto-renewal"""
        credentials = self.get_database_credentials()
        
        # Create new pool if needed
        if not self.connection_pool or self._need_renewal():
            if self.connection_pool:
                self.connection_pool.closeall()
            
            self.connection_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                user=credentials['username'],
                password=credentials['password'],
                host=os.getenv('DB_HOST', 'postgres.internal'),
                port=os.getenv('DB_PORT', '5432'),
                database=os.getenv('DB_NAME', 'novacore')
            )
            
            logger.info("Created new connection pool with refreshed credentials")
        
        return self.connection_pool
    
    async def renew_credentials(self):
        """Background task to renew credentials"""
        while True:
            try:
                # Sleep until 5 minutes before expiration
                if self.credentials_expire_at:
                    sleep_time = (self.credentials_expire_at - datetime.now()).total_seconds() - 300
                    if sleep_time > 0:
                        await asyncio.sleep(sleep_time)
                
                # Renew credentials
                logger.info("Auto-renewing database credentials")
                self.get_database_credentials()
                
            except Exception as e:
                logger.error(f"Failed to auto-renew credentials: {e}")
                await asyncio.sleep(60)  # Retry in 1 minute

# Usage in FastAPI app
@app.on_event("startup")
async def startup_event():
    # Initialize Vault database connection
    vault_db = VaultDatabaseConnection(
        vault_url=os.getenv('VAULT_URL'),
        role_name='intelligence-service'
    )
    
    # Authenticate to Vault
    vault_db.authenticate_service(os.getenv('VAULT_TOKEN'))
    
    # Start background renewal task
    asyncio.create_task(vault_db.renew_credentials())
    
    # Store in app state
    app.state.vault_db = vault_db

# Use in endpoints
@app.get("/api/data")
async def get_data():
    pool = app.state.vault_db.get_connection_pool()
    conn = pool.getconn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM data")
        result = cursor.fetchall()
        return result
    finally:
        pool.putconn(conn)
```

---

### Node.js (NestJS) Implementation

```typescript
// services/auth-billing/src/database/vault-database.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as vault from 'node-vault';
import { Pool } from 'pg';

@Injectable()
export class VaultDatabaseService {
  private readonly logger = new Logger(VaultDatabaseService.name);
  private vaultClient: any;
  private credentials: any;
  private credentialsExpireAt: Date;
  private pool: Pool;
  private roleName: string;
  
  constructor() {
    this.roleName = 'auth-service';
    this.vaultClient = vault({
      apiVersion: 'v1',
      endpoint: process.env.VAULT_URL,
      token: process.env.VAULT_TOKEN,
    });
  }
  
  async getDatabaseCredentials(): Promise<any> {
    if (this.needRenewal()) {
      this.logger.log(`Requesting new database credentials for ${this.roleName}`);
      
      const response = await this.vaultClient.read(
        `database/creds/${this.roleName}`
      );
      
      this.credentials = {
        username: response.data.username,
        password: response.data.password,
        leaseId: response.lease_id,
        leaseDuration: response.lease_duration,
      };
      
      // Calculate expiration (80% of TTL)
      const renewAt = this.credentials.leaseDuration * 0.8 * 1000;
      this.credentialsExpireAt = new Date(Date.now() + renewAt);
      
      this.logger.log(`New credentials obtained, expires at ${this.credentialsExpireAt}`);
      
      // Create new connection pool
      await this.recreatePool();
    }
    
    return this.credentials;
  }
  
  private needRenewal(): boolean {
    if (!this.credentials) return true;
    if (!this.credentialsExpireAt) return true;
    if (new Date() >= this.credentialsExpireAt) return true;
    return false;
  }
  
  private async recreatePool() {
    // Close old pool
    if (this.pool) {
      await this.pool.end();
    }
    
    // Create new pool with fresh credentials
    this.pool = new Pool({
      user: this.credentials.username,
      password: this.credentials.password,
      host: process.env.DB_HOST || 'postgres.internal',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'novacore',
      max: 10,
      idleTimeoutMillis: 30000,
    });
    
    this.logger.log('Created new connection pool with refreshed credentials');
  }
  
  async getPool(): Promise<Pool> {
    await this.getDatabaseCredentials();
    return this.pool;
  }
  
  // Background renewal task
  startAutoRenewal() {
    setInterval(async () => {
      try {
        if (this.needRenewal()) {
          this.logger.log('Auto-renewing database credentials');
          await this.getDatabaseCredentials();
        }
      } catch (error) {
        this.logger.error('Failed to auto-renew credentials', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
}
```

---

## JWT Secret Rotation

### Overview

Quarterly rotation of JWT signing secrets with zero-downtime dual-key support.

---

### Rotation Strategy: Dual-Key Validation

**Concept:** Support both old and new keys during transition period.

```typescript
// services/auth-billing/src/auth/jwt-rotation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

interface JWTKeyVersion {
  version: number;
  secret: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'rotating' | 'deprecated';
}

@Injectable()
export class JwtRotationService {
  private readonly logger = new Logger(JwtRotationService.name);
  private keys: Map<number, JWTKeyVersion> = new Map();
  private currentVersion: number;
  
  constructor(private readonly jwtService: JwtService) {
    this.loadKeys();
  }
  
  private loadKeys() {
    // Load keys from Vault
    const currentKey: JWTKeyVersion = {
      version: 1,
      secret: process.env.JWT_SECRET,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      status: 'active',
    };
    
    this.keys.set(1, currentKey);
    this.currentVersion = 1;
  }
  
  /**
   * Generate new JWT secret
   */
  generateNewSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }
  
  /**
   * Initiate rotation (Step 1: Generate new key)
   */
  async initiateRotation(): Promise<JWTKeyVersion> {
    this.logger.log('Initiating JWT secret rotation');
    
    const newVersion = this.currentVersion + 1;
    const newSecret = this.generateNewSecret();
    
    const newKey: JWTKeyVersion = {
      version: newVersion,
      secret: newSecret,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: 'rotating',
    };
    
    // Store new key in Vault
    await this.storeKeyInVault(newKey);
    
    // Add to local map
    this.keys.set(newVersion, newKey);
    
    // Mark old key as rotating
    const oldKey = this.keys.get(this.currentVersion);
    oldKey.status = 'rotating';
    this.keys.set(this.currentVersion, oldKey);
    
    this.logger.log(`New JWT key version ${newVersion} generated`);
    
    return newKey;
  }
  
  /**
   * Sign token with current key (Step 2: Start using new key)
   */
  signToken(payload: any): string {
    const activeKey = this.getActiveKey();
    
    return this.jwtService.sign(payload, {
      secret: activeKey.secret,
      expiresIn: '15m',
    });
  }
  
  /**
   * Verify token with any valid key (Supports old and new during rotation)
   */
  verifyToken(token: string): any {
    const errors: Error[] = [];
    
    // Try each key, newest first
    const sortedKeys = Array.from(this.keys.values())
      .sort((a, b) => b.version - a.version);
    
    for (const key of sortedKeys) {
      try {
        const decoded = this.jwtService.verify(token, {
          secret: key.secret,
        });
        
        this.logger.debug(`Token verified with key version ${key.version}`);
        return decoded;
      } catch (error) {
        errors.push(error);
        continue;
      }
    }
    
    // All keys failed
    this.logger.error('Token verification failed with all keys', errors);
    throw new Error('Invalid token');
  }
  
  /**
   * Complete rotation (Step 3: Remove old key after grace period)
   */
  async completeRotation() {
    this.logger.log('Completing JWT secret rotation');
    
    // Set new key as active
    const newKey = Array.from(this.keys.values())
      .find(k => k.status === 'rotating' && k.version > this.currentVersion);
    
    if (!newKey) {
      throw new Error('No rotating key found');
    }
    
    newKey.status = 'active';
    this.keys.set(newKey.version, newKey);
    this.currentVersion = newKey.version;
    
    // Mark old keys as deprecated
    for (const [version, key] of this.keys.entries()) {
      if (version < this.currentVersion) {
        key.status = 'deprecated';
        this.keys.set(version, key);
      }
    }
    
    this.logger.log(`JWT key version ${this.currentVersion} is now active`);
  }
  
  /**
   * Remove deprecated keys (Step 4: Clean up after grace period)
   */
  async removeDeprecatedKeys() {
    const deprecatedKeys = Array.from(this.keys.entries())
      .filter(([_, key]) => key.status === 'deprecated');
    
    for (const [version, key] of deprecatedKeys) {
      // Only remove if grace period passed (24 hours)
      const gracePeriodEnd = new Date(key.expiresAt.getTime() + 24 * 60 * 60 * 1000);
      
      if (new Date() > gracePeriodEnd) {
        this.logger.log(`Removing deprecated JWT key version ${version}`);
        this.keys.delete(version);
        await this.deleteKeyFromVault(version);
      }
    }
  }
  
  private getActiveKey(): JWTKeyVersion {
    return this.keys.get(this.currentVersion);
  }
  
  private async storeKeyInVault(key: JWTKeyVersion) {
    // Store in Vault
    await this.vaultClient.write(`secret/jwt/version-${key.version}`, {
      data: {
        secret: key.secret,
        version: key.version,
        created_at: key.createdAt.toISOString(),
        expires_at: key.expiresAt.toISOString(),
        status: key.status,
      },
    });
  }
  
  private async deleteKeyFromVault(version: number) {
    await this.vaultClient.delete(`secret/jwt/version-${version}`);
  }
}
```

---

### JWT Rotation Procedure

**Step-by-Step Process:**

```bash
# Day 0: Initiate rotation
curl -X POST https://api.novacore.ai/admin/jwt/rotate/initiate \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: New key version created
{
  "version": 2,
  "status": "rotating",
  "expires_at": "2026-02-10T00:00:00Z"
}

# Day 0-1: Grace period (both keys valid)
# - New tokens signed with version 2
# - Old tokens (version 1) still accepted
# - Monitor for errors

# Day 1: Complete rotation
curl -X POST https://api.novacore.ai/admin/jwt/rotate/complete \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: Rotation completed
{
  "current_version": 2,
  "status": "active",
  "old_version_deprecated": 1
}

# Day 2: Remove old key
curl -X DELETE https://api.novacore.ai/admin/jwt/rotate/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response: Cleanup completed
{
  "removed_versions": [1],
  "current_version": 2
}
```

---

### Automated Rotation Schedule

```typescript
// Cron job for quarterly rotation
@Cron('0 0 1 */3 *') // First day of quarter at midnight
async rotateJWTSecret() {
  try {
    this.logger.log('Starting quarterly JWT secret rotation');
    
    // Step 1: Initiate rotation (generate new key)
    await this.jwtRotationService.initiateRotation();
    
    // Step 2: Wait 24 hours (grace period)
    await this.scheduleRotationCompletion();
    
  } catch (error) {
    this.logger.error('JWT rotation failed', error);
    await this.alertSecurityTeam('JWT rotation failed', error);
  }
}

@Cron('0 0 2 */3 *') // Second day of quarter
async completeJWTRotation() {
  try {
    this.logger.log('Completing JWT secret rotation');
    
    // Step 3: Complete rotation (mark new key as active)
    await this.jwtRotationService.completeRotation();
    
    // Step 4: Wait 24 hours then cleanup
    await this.scheduleDeprecatedKeyCleanup();
    
  } catch (error) {
    this.logger.error('JWT rotation completion failed', error);
    await this.alertSecurityTeam('JWT rotation completion failed', error);
  }
}

@Cron('0 0 3 */3 *') // Third day of quarter
async cleanupDeprecatedKeys() {
  try {
    this.logger.log('Cleaning up deprecated JWT keys');
    
    // Step 5: Remove old keys
    await this.jwtRotationService.removeDeprecatedKeys();
    
    this.logger.log('JWT secret rotation completed successfully');
    
  } catch (error) {
    this.logger.error('JWT key cleanup failed', error);
    await this.alertSecurityTeam('JWT key cleanup failed', error);
  }
}
```

---

## API Key Rotation

### Overview

Semi-automated rotation of third-party API keys (SendGrid, etc.) with manual coordination.

---

### SendGrid API Key Rotation

**Procedure:**

```typescript
// scripts/rotate-sendgrid-key.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SendGridKeyRotation {
  private readonly logger = new Logger(SendGridKeyRotation.name);
  
  /**
   * Step 1: Generate new API key in SendGrid dashboard
   * (Manual step - requires SendGrid account access)
   */
  async generateNewKey(): Promise<string> {
    this.logger.log('Generate new SendGrid API key manually in dashboard');
    this.logger.log('Navigate to: Settings > API Keys > Create API Key');
    this.logger.log('Permissions: Full Access (or minimum required)');
    this.logger.log('Save the new API key securely');
    
    // Prompt for new key
    const newKey = await this.promptForNewKey();
    return newKey;
  }
  
  /**
   * Step 2: Store new key in Vault
   */
  async storeNewKey(newKey: string) {
    this.logger.log('Storing new SendGrid API key in Vault');
    
    await this.vaultClient.write('secret/sendgrid/api-key-v2', {
      data: {
        api_key: newKey,
        created_at: new Date().toISOString(),
        status: 'rotating',
      },
    });
    
    this.logger.log('New key stored in Vault');
  }
  
  /**
   * Step 3: Deploy new key to services (dual-key support)
   */
  async deployNewKey(newKey: string) {
    this.logger.log('Deploying new SendGrid API key to services');
    
    // Update environment variable
    await this.updateEnvironmentVariable('SENDGRID_API_KEY_NEW', newKey);
    
    // Deploy to staging first
    await this.deployToStaging();
    this.logger.log('New key deployed to staging - test email delivery');
    
    // Wait for confirmation
    const confirmed = await this.confirmStaging();
    if (!confirmed) {
      throw new Error('Staging verification failed');
    }
    
    // Deploy to production
    await this.deployToProduction();
    this.logger.log('New key deployed to production');
  }
  
  /**
   * Step 4: Test new key
   */
  async testNewKey() {
    this.logger.log('Testing new SendGrid API key');
    
    const sendgrid = require('@sendgrid/mail');
    sendgrid.setApiKey(process.env.SENDGRID_API_KEY_NEW);
    
    try {
      await sendgrid.send({
        to: 'test@novacore.ai',
        from: 'noreply@novacore.ai',
        subject: 'SendGrid Key Rotation Test',
        text: 'If you received this, the new API key is working!',
      });
      
      this.logger.log('Test email sent successfully with new key');
      return true;
    } catch (error) {
      this.logger.error('Test email failed with new key', error);
      return false;
    }
  }
  
  /**
   * Step 5: Complete rotation (make new key primary)
   */
  async completeRotation() {
    this.logger.log('Completing SendGrid API key rotation');
    
    // Swap keys
    const newKey = process.env.SENDGRID_API_KEY_NEW;
    await this.updateEnvironmentVariable('SENDGRID_API_KEY', newKey);
    await this.updateEnvironmentVariable('SENDGRID_API_KEY_OLD', process.env.SENDGRID_API_KEY);
    
    // Deploy
    await this.deployToProduction();
    
    this.logger.log('Rotation completed - new key is now primary');
  }
  
  /**
   * Step 6: Revoke old key (after 48 hour grace period)
   */
  async revokeOldKey() {
    this.logger.log('Revoking old SendGrid API key');
    this.logger.log('Go to SendGrid dashboard and delete the old API key');
    this.logger.log('Old key: ' + process.env.SENDGRID_API_KEY_OLD.substring(0, 10) + '...');
    
    // Confirm revocation
    const confirmed = await this.confirmRevocation();
    if (confirmed) {
      // Remove from Vault
      await this.vaultClient.delete('secret/sendgrid/api-key-old');
      this.logger.log('Old key revoked and removed from Vault');
    }
  }
}

// Automated rotation script
async function rotateSendGridKey() {
  const rotation = new SendGridKeyRotation();
  
  try {
    // Step 1: Generate new key (manual)
    console.log('=== Step 1: Generate New Key ===');
    const newKey = await rotation.generateNewKey();
    
    // Step 2: Store in Vault
    console.log('=== Step 2: Store in Vault ===');
    await rotation.storeNewKey(newKey);
    
    // Step 3: Deploy new key
    console.log('=== Step 3: Deploy New Key ===');
    await rotation.deployNewKey(newKey);
    
    // Step 4: Test new key
    console.log('=== Step 4: Test New Key ===');
    const testPassed = await rotation.testNewKey();
    if (!testPassed) {
      throw new Error('New key test failed');
    }
    
    // Step 5: Complete rotation
    console.log('=== Step 5: Complete Rotation ===');
    await rotation.completeRotation();
    
    // Wait 48 hours
    console.log('Waiting 48 hours grace period...');
    await sleep(48 * 60 * 60 * 1000);
    
    // Step 6: Revoke old key
    console.log('=== Step 6: Revoke Old Key ===');
    await rotation.revokeOldKey();
    
    console.log('✅ SendGrid API key rotation completed successfully');
    
  } catch (error) {
    console.error('❌ SendGrid API key rotation failed:', error);
    // Alert security team
    await alertSecurityTeam('SendGrid key rotation failed', error);
  }
}
```

---

## Audit Trail Specifications

### Rotation Event Logging

```typescript
interface RotationEvent {
  rotation_id: string;
  secret_type: 'database' | 'jwt' | 'api_key';
  secret_name: string;
  action: 'initiated' | 'deployed' | 'completed' | 'revoked' | 'failed';
  old_version?: string;
  new_version?: string;
  triggered_by: 'automated' | 'manual' | 'emergency';
  operator?: string;
  timestamp: Date;
  duration_seconds?: number;
  success: boolean;
  error_message?: string;
  metadata?: any;
}

// Log rotation events to audit log
async function logRotationEvent(event: RotationEvent) {
  await db.query(
    `INSERT INTO secret_rotation_audit
     (rotation_id, secret_type, secret_name, action, old_version, new_version,
      triggered_by, operator, timestamp, duration_seconds, success, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      event.rotation_id,
      event.secret_type,
      event.secret_name,
      event.action,
      event.old_version,
      event.new_version,
      event.triggered_by,
      event.operator,
      event.timestamp,
      event.duration_seconds,
      event.success,
      event.error_message,
      JSON.stringify(event.metadata),
    ]
  );
  
  // Also log to centralized audit system
  await auditLogger.log('secret_rotation', event);
}
```

---

### Audit Dashboard

**Key Metrics:**
- Rotation success rate
- Average rotation duration
- Failed rotations (requires investigation)
- Upcoming rotations (schedule)
- Last rotation date per secret
- Grace period violations

---

## Monitoring and Alerting

### Prometheus Metrics

```typescript
// Metrics for secret rotation
const secretRotationTotal = new Counter({
  name: 'secret_rotation_total',
  help: 'Total number of secret rotations',
  labelNames: ['secret_type', 'status'], // status: success|failure
});

const secretRotationDuration = new Histogram({
  name: 'secret_rotation_duration_seconds',
  help: 'Duration of secret rotation in seconds',
  labelNames: ['secret_type'],
  buckets: [60, 300, 600, 1800, 3600], // 1min, 5min, 10min, 30min, 1hour
});

const secretAgeGauge = new Gauge({
  name: 'secret_age_days',
  help: 'Age of secret in days',
  labelNames: ['secret_type', 'secret_name'],
});

const secretExpirationGauge = new Gauge({
  name: 'secret_expiration_days',
  help: 'Days until secret expiration',
  labelNames: ['secret_type', 'secret_name'],
});
```

---

### Alerts

**Critical Alerts:**
- Secret rotation failed (immediate notification)
- Secret expired without rotation (immediate notification)
- Database credential renewal failed (immediate notification)

**Warning Alerts:**
- Secret expiring in 7 days (email notification)
- Secret age > 90 days (email notification)
- Rotation duration > 1 hour (email notification)

**Alertmanager Configuration:**
```yaml
groups:
  - name: secret_rotation
    interval: 5m
    rules:
      - alert: SecretRotationFailed
        expr: increase(secret_rotation_total{status="failure"}[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Secret rotation failed: {{ $labels.secret_type }}"
          description: "Secret rotation failed for {{ $labels.secret_type }}. Investigate immediately."
      
      - alert: SecretExpiringSoon
        expr: secret_expiration_days < 7
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Secret expiring soon: {{ $labels.secret_name }}"
          description: "Secret {{ $labels.secret_name }} expires in {{ $value }} days. Schedule rotation."
      
      - alert: SecretExpired
        expr: secret_expiration_days < 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Secret expired: {{ $labels.secret_name }}"
          description: "Secret {{ $labels.secret_name }} has expired. Rotate immediately."
```

---

## Emergency Procedures

### Emergency Secret Rotation

**Scenario:** Secret compromised, needs immediate rotation

**Procedure:**
```bash
# 1. Revoke compromised secret immediately
curl -X POST https://vault.novacore.ai/v1/sys/revoke-prefix/database/creds/

# 2. Generate new credentials
curl -X POST https://vault.novacore.ai/v1/database/creds/intelligence-service

# 3. Deploy emergency update to all services
kubectl set env deployment/intelligence-service DB_PASSWORD=<new_password>
kubectl rollout restart deployment/intelligence-service

# 4. Verify services are operational
kubectl get pods
kubectl logs -f deployment/intelligence-service

# 5. Document incident
# - What was compromised?
# - How was it discovered?
# - What action was taken?
# - What prevented it?
```

**Timeline:**
- Detection to revocation: <15 minutes
- Revocation to new credentials: <15 minutes
- New credentials to deployment: <30 minutes
- **Total:** <1 hour

---

## Implementation Roadmap

### Phase 1: Foundation (Month 1)

**Week 1: Vault Setup**
- [ ] Deploy Vault cluster (2-node HA)
- [ ] Configure database secrets engine
- [ ] Create service roles
- [ ] Test credential generation

**Week 2: Database Rotation**
- [ ] Implement Python Vault integration
- [ ] Implement Node.js Vault integration
- [ ] Update services to use dynamic credentials
- [ ] Test automatic renewal

**Week 3: Testing**
- [ ] Test credential rotation
- [ ] Test grace period handling
- [ ] Test failure scenarios
- [ ] Load testing with rotation

**Week 4: Documentation**
- [ ] Document Vault setup
- [ ] Document service integration
- [ ] Create runbooks
- [ ] Train team

---

### Phase 2: JWT and API Keys (Month 2)

**Week 1: JWT Rotation**
- [ ] Implement dual-key JWT service
- [ ] Test token validation with multiple keys
- [ ] Implement rotation endpoints
- [ ] Test rotation procedure

**Week 2: API Key Rotation**
- [ ] Document API key rotation procedures
- [ ] Create rotation scripts
- [ ] Test SendGrid rotation
- [ ] Test other API providers

**Week 3: Automation**
- [ ] Implement scheduled JWT rotation
- [ ] Implement scheduled API key rotation
- [ ] Set up monitoring and alerting
- [ ] Test automated flows

**Week 4: Emergency Procedures**
- [ ] Document emergency rotation procedures
- [ ] Test emergency rotation
- [ ] Create emergency playbook
- [ ] Train on-call team

---

### Phase 3: Production (Month 3)

**Week 1: Pre-Production Testing**
- [ ] Full rotation testing in staging
- [ ] Performance testing
- [ ] Failure scenario testing
- [ ] Security audit

**Week 2: Production Deployment**
- [ ] Deploy Vault to production
- [ ] Migrate production secrets
- [ ] Enable automatic rotation
- [ ] Monitor closely

**Week 3: Stabilization**
- [ ] Fix any issues
- [ ] Optimize performance
- [ ] Update documentation
- [ ] Team retro and feedback

**Week 4: Optimization**
- [ ] Tune rotation schedules
- [ ] Optimize credential caching
- [ ] Improve monitoring
- [ ] Final documentation

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Automated rotation coverage | 100% of Tier 1 secrets | Inventory audit |
| Rotation success rate | >99.5% | Audit logs |
| Mean time to rotate | <5 minutes (database) | Prometheus metrics |
| Emergency rotation time | <1 hour | Incident logs |
| Secret age | <90 days | Monitoring dashboard |
| Rotation downtime | 0 seconds | Service monitoring |
| Failed rotation alerts | <1 per month | Alert logs |

---

## Conclusion

Automated secret rotation is a critical security practice that reduces the risk window for compromised credentials. This implementation guide provides a comprehensive framework for automated rotation across all secret types in NovaCoreAI.

**Key Takeaways:**
- Database credentials: Fully automated with Vault dynamic secrets
- JWT secrets: Automated with dual-key support for zero downtime
- API keys: Semi-automated with manual coordination steps
- Complete audit trail for compliance
- Monitoring and alerting for operational visibility

---

**Document Status:** Complete Implementation Guide  
**Implementation Priority:** P3 (Months 3-6)  
**Next Review:** Post-implementation  
**Maintained By:** Cloud and Cybersecurity Specialist + DevOps

---

**END OF SECRET ROTATION AUTOMATION GUIDE**
