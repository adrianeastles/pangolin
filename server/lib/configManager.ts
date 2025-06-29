import { db } from "@server/db";
import { secureConfigs } from "@server/db";
import { eq } from "drizzle-orm";
import logger from "@server/logger";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Configuration table schema
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { pgTable, varchar, serial, boolean } from "drizzle-orm/pg-core";

// In-memory cache for configuration
let configCache: Record<string, any> = {};
let cacheLastUpdated = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

export interface SecurityConfig {
    lockoutEnabled: boolean;
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    logFailedAttempts: boolean;
    requireEmailVerification: boolean;
    sessionTimeoutMinutes: number;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    lockoutEnabled: true,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 30,
    logFailedAttempts: true,
    requireEmailVerification: false,
    sessionTimeoutMinutes: 60 * 24 * 7 // 7 days
};

// Generate encryption key from environment or use default (NOT SECURE for production)
function getEncryptionKey(): Buffer {
    const envKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (envKey) {
        return Buffer.from(envKey, 'hex');
    }
    
    // WARNING: Using a hardcoded key is NOT secure for production
    // In production, this should come from a secure key management system
    logger.warn("Using default encryption key. Set CONFIG_ENCRYPTION_KEY environment variable for production!");
    return Buffer.from('4a7c8d2e9f1b5a6c3e8d4f2a7b9c1e6d8f4a2c5e7b1d9f3a6c8e2d4f7b9c1e5a', 'hex');
}

function encrypt(data: string): { encrypted: string, hash: string } {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    const result = iv.toString('hex') + encrypted + authTag.toString('hex');
    
    // Create integrity hash
    const hash = createHash('sha256').update(data).digest('hex');
    
    return { encrypted: result, hash };
}

function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();
    
    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), 'hex');
    const authTag = Buffer.from(encryptedData.slice(-TAG_LENGTH * 2), 'hex');
    const encrypted = encryptedData.slice(IV_LENGTH * 2, -TAG_LENGTH * 2);
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

function verifyIntegrity(data: string, expectedHash: string): boolean {
    const actualHash = createHash('sha256').update(data).digest('hex');
    return actualHash === expectedHash;
}

// Secure configuration storage with encryption and integrity checks
export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
    try {
        // Check cache first
        const now = Date.now();
        if (configCache[key] && (now - cacheLastUpdated) < CACHE_DURATION) {
            return configCache[key] as T;
        }

        // Get from database
        const [configRecord] = await db
            .select()
            .from(secureConfigs)
            .where(eq(secureConfigs.configKey, key))
            .limit(1);

        if (!configRecord) {
            return defaultValue;
        }

        try {
            // Decrypt the configuration
            const decryptedData = decrypt(configRecord.configValue);
            
            // Verify integrity
            if (!verifyIntegrity(decryptedData, configRecord.configHash)) {
                logger.error("Configuration integrity check failed", { key });
                return defaultValue;
            }
            
            const config = JSON.parse(decryptedData);
            
            // Update cache
            configCache[key] = config;
            cacheLastUpdated = now;
            
            return config;
        } catch (error) {
            logger.error("Failed to decrypt/parse config", { key, error });
            return defaultValue;
        }
    } catch (error) {
        logger.error("Error getting config", { key, error });
        return defaultValue;
    }
}

export async function setConfig<T>(key: string, value: T, updatedBy?: string): Promise<void> {
    try {
        const dataToEncrypt = JSON.stringify(value);
        const { encrypted, hash } = encrypt(dataToEncrypt);
        const now = Date.now();
        
        // Check if config already exists
        const [existingConfig] = await db
            .select()
            .from(secureConfigs)
            .where(eq(secureConfigs.configKey, key))
            .limit(1);

        if (existingConfig) {
            // Update existing config
            await db
                .update(secureConfigs)
                .set({
                    configValue: encrypted,
                    configHash: hash,
                    updatedAt: now,
                    updatedBy: updatedBy || null
                })
                .where(eq(secureConfigs.configKey, key));
        } else {
            // Insert new config
            await db.insert(secureConfigs).values({
                configKey: key,
                configValue: encrypted,
                configHash: hash,
                updatedAt: now,
                updatedBy: updatedBy || null
            });
        }
        
        // Update cache
        configCache[key] = value;
        cacheLastUpdated = Date.now();
        
        logger.info("Secure config updated", { key, updatedBy });
    } catch (error) {
        logger.error("Error setting secure config", { key, error });
        throw error;
    }
}

export async function getSecurityConfig(): Promise<SecurityConfig> {
    const config = await getConfig('security', DEFAULT_SECURITY_CONFIG);
    return { ...DEFAULT_SECURITY_CONFIG, ...config };
}

export async function updateSecurityConfig(updates: Partial<SecurityConfig>, updatedBy?: string): Promise<SecurityConfig> {
    const currentConfig = await getSecurityConfig();
    const newConfig = { ...currentConfig, ...updates };
    
    await setConfig('security', newConfig, updatedBy);
    
    // Clear cache to force reload
    delete configCache['security'];
    
    return newConfig;
}

// Clear cache function for testing or manual cache invalidation
export function clearConfigCache(): void {
    configCache = {};
    cacheLastUpdated = 0;
}

// Convenience functions for lockout config
export async function getLockoutConfig() {
    const securityConfig = await getSecurityConfig();
    return {
        enabled: securityConfig.lockoutEnabled,
        maxFailedAttempts: securityConfig.maxFailedAttempts,
        lockoutDurationMinutes: securityConfig.lockoutDurationMinutes
    };
} 