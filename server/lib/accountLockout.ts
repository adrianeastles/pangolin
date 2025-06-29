import { db } from "@server/db";
import { accountLockouts } from "@server/db";
import { eq, and } from "drizzle-orm";
import { logSecurityEvent } from "./securityEventLogger";
import { getLockoutConfig } from "./configManager";
import logger from "@server/logger";

export interface LockoutStatus {
    isLocked: boolean;
    failedAttempts: number;
    lockedAt?: number;
    lockoutExpiresAt?: number;
    remainingLockoutTime?: number;
}

export async function checkAccountLockout(email: string, ipAddress: string): Promise<LockoutStatus> {
    const config = await getLockoutConfig();
    
    if (!config.enabled) {
        return { isLocked: false, failedAttempts: 0 };
    }

    try {
        const lockoutRecord = await db
            .select()
            .from(accountLockouts)
            .where(eq(accountLockouts.email, email))
            .limit(1);

        if (!lockoutRecord.length) {
            return { isLocked: false, failedAttempts: 0 };
        }

        const record = lockoutRecord[0];
        const now = Date.now();

        // Check if lockout has expired
        if (record.isLocked && record.lockoutExpiresAt && now > record.lockoutExpiresAt) {
            // Unlock the account
            await unlockAccount(email);
            return { isLocked: false, failedAttempts: 0 };
        }

        const remainingTime = record.lockoutExpiresAt ? Math.max(0, record.lockoutExpiresAt - now) : 0;

        return {
            isLocked: record.isLocked,
            failedAttempts: record.failedAttempts,
            lockedAt: record.lockedAt || undefined,
            lockoutExpiresAt: record.lockoutExpiresAt || undefined,
            remainingLockoutTime: remainingTime
        };
    } catch (error) {
        logger.error("Error checking account lockout", { error, email });
        return { isLocked: false, failedAttempts: 0 };
    }
}

export async function recordFailedAttempt(email: string, ipAddress: string): Promise<LockoutStatus> {
    const config = await getLockoutConfig();

    if (!config.enabled) {
        return { isLocked: false, failedAttempts: 0 };
    }

    try {
        const existingRecord = await db
            .select()
            .from(accountLockouts)
            .where(eq(accountLockouts.email, email))
            .limit(1);

        const now = Date.now();
        let newFailedAttempts = 1;

        if (existingRecord.length > 0) {
            const record = existingRecord[0];
            
            // If account is already locked and hasn't expired, keep it locked
            if (record.isLocked && record.lockoutExpiresAt && now < record.lockoutExpiresAt) {
                return {
                    isLocked: true,
                    failedAttempts: record.failedAttempts,
                    lockedAt: record.lockedAt || undefined,
                    lockoutExpiresAt: record.lockoutExpiresAt || undefined,
                    remainingLockoutTime: record.lockoutExpiresAt - now
                };
            }

            // If lockout expired, reset failed attempts
            if (record.isLocked && record.lockoutExpiresAt && now >= record.lockoutExpiresAt) {
                newFailedAttempts = 1;
            } else {
                newFailedAttempts = record.failedAttempts + 1;
            }

            // Check if we should lock the account
            const shouldLock = newFailedAttempts >= config.maxFailedAttempts;
            const lockoutExpiresAt = shouldLock ? now + (config.lockoutDurationMinutes * 60 * 1000) : null;

            // Update existing record
            await db
                .update(accountLockouts)
                .set({
                    failedAttempts: newFailedAttempts,
                    isLocked: shouldLock,
                    lockedAt: shouldLock ? now : null,
                    lockoutExpiresAt: lockoutExpiresAt,
                    ipAddress: ipAddress
                })
                .where(eq(accountLockouts.email, email));

            if (shouldLock) {
                await logSecurityEvent({
                    type: "ACCOUNT_LOCKED",
                    message: `Account locked after ${newFailedAttempts} failed login attempts`,
                    email,
                    ipAddress,
                    severity: "high",
                    metadata: {
                        failedAttempts: newFailedAttempts,
                        lockoutDurationMinutes: config.lockoutDurationMinutes
                    }
                });
            }

            return {
                isLocked: shouldLock,
                failedAttempts: newFailedAttempts,
                lockedAt: shouldLock ? now : undefined,
                lockoutExpiresAt: lockoutExpiresAt || undefined,
                remainingLockoutTime: lockoutExpiresAt ? lockoutExpiresAt - now : undefined
            };
        } else {
            // Create new record
            const shouldLock = newFailedAttempts >= config.maxFailedAttempts;
            const lockoutExpiresAt = shouldLock ? now + (config.lockoutDurationMinutes * 60 * 1000) : null;

            await db.insert(accountLockouts).values({
                email,
                ipAddress,
                failedAttempts: newFailedAttempts,
                isLocked: shouldLock,
                lockedAt: shouldLock ? now : null,
                lockoutExpiresAt: lockoutExpiresAt
            });

            if (shouldLock) {
                await logSecurityEvent({
                    type: "ACCOUNT_LOCKED",
                    message: `Account locked after ${newFailedAttempts} failed login attempts`,
                    email,
                    ipAddress,
                    severity: "high",
                    metadata: {
                        failedAttempts: newFailedAttempts,
                        lockoutDurationMinutes: config.lockoutDurationMinutes
                    }
                });
            }

            return {
                isLocked: shouldLock,
                failedAttempts: newFailedAttempts,
                lockedAt: shouldLock ? now : undefined,
                lockoutExpiresAt: lockoutExpiresAt || undefined,
                remainingLockoutTime: lockoutExpiresAt ? lockoutExpiresAt - now : undefined
            };
        }
    } catch (error) {
        logger.error("Error recording failed attempt", { error, email });
        return { isLocked: false, failedAttempts: 0 };
    }
}

export async function clearFailedAttempts(email: string): Promise<void> {
    const config = await getLockoutConfig();

    if (!config.enabled) {
        return;
    }

    try {
        await db
            .update(accountLockouts)
            .set({
                failedAttempts: 0,
                isLocked: false,
                lockedAt: null,
                lockoutExpiresAt: null
            })
            .where(eq(accountLockouts.email, email));
    } catch (error) {
        logger.error("Error clearing failed attempts", { error, email });
    }
}

export async function unlockAccount(email: string): Promise<void> {
    const config = await getLockoutConfig();

    try {
        await db
            .update(accountLockouts)
            .set({
                failedAttempts: 0,
                isLocked: false,
                lockedAt: null,
                lockoutExpiresAt: null
            })
            .where(eq(accountLockouts.email, email));

        await logSecurityEvent({
            type: "ACCOUNT_UNLOCKED",
            message: "Account unlocked (lockout expired or manually unlocked)",
            email,
            severity: "medium"
        });
    } catch (error) {
        logger.error("Error unlocking account", { error, email });
    }
}

export function formatLockoutMessage(lockoutStatus: LockoutStatus): string {
    if (!lockoutStatus.isLocked) {
        return "";
    }

    const remainingMinutes = Math.ceil((lockoutStatus.remainingLockoutTime || 0) / (1000 * 60));
    return `Account is locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minutes.`;
} 