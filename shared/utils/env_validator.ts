/**
 * Centralized environment variable validation utility for TypeScript services.
 * Import and call validateRequiredEnvVars() at service startup.
 */

export interface EnvValidationOptions {
  serviceName?: string;
  exitOnError?: boolean;
}

/**
 * Validate that all required environment variables are set.
 * Exits with code 1 if any are missing (unless exitOnError is false).
 */
export function validateRequiredEnvVars(
  requiredVars: string[],
  options: EnvValidationOptions = {}
): boolean {
  const { serviceName, exitOnError = true } = options;
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    const servicePrefix = serviceName ? `[${serviceName}] ` : '';
    console.error(`FATAL: ${servicePrefix}Missing required environment variables:`);
    missing.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    
    if (exitOnError) {
      process.exit(1);
    }
    return false;
  }

  return true;
}

/**
 * Get environment variable or exit if not set.
 */
export function getEnvOrExit(varName: string, serviceName?: string): string {
  const value = process.env[varName];
  if (!value) {
    const servicePrefix = serviceName ? `[${serviceName}] ` : '';
    console.error(`FATAL: ${servicePrefix}Missing required environment variable: ${varName}`);
    process.exit(1);
  }
  return value;
}
