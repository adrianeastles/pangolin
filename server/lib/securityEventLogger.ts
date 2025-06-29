import { db } from "@server/db";
import { securityEvents } from "@server/db";
import logger from "@server/logger";

// Input sanitization to prevent log injection attacks
function sanitizeLogInput(input: string | null | undefined): string {
    if (!input) return "";
    
    return input
        // Remove/escape newlines and carriage returns to prevent log injection
        .replace(/\r?\n/g, "\\n")
        .replace(/\r/g, "\\r")
        // Remove null bytes
        .replace(/\0/g, "")
        // Remove control characters except tab
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Limit length to prevent log flooding
        .substring(0, 1000)
        // Trim whitespace
        .trim();
}

function sanitizeEmail(email: string | null | undefined): string {
    const sanitized = sanitizeLogInput(email);
    // Additional email validation - only allow valid email characters
    return sanitized.replace(/[^a-zA-Z0-9@._+-]/g, "");
}

function sanitizeIpAddress(ip: string | null | undefined): string {
    const sanitized = sanitizeLogInput(ip);
    // Only allow valid IP address characters (IPv4 and IPv6)
    return sanitized.replace(/[^0-9.:a-fA-F]/g, "");
}

function sanitizeUserAgent(userAgent: string | null | undefined): string {
    const sanitized = sanitizeLogInput(userAgent);
    // Allow common user agent characters but remove potentially malicious ones
    return sanitized.replace(/[<>'"\\]/g, "");
}

function sanitizeMessage(message: string | null | undefined): string {
    return sanitizeLogInput(message);
}

function sanitizeUserId(userId: string | null | undefined): string {
    const sanitized = sanitizeLogInput(userId);
    // Only allow alphanumeric characters, hyphens, and underscores for user IDs
    return sanitized.replace(/[^a-zA-Z0-9_-]/g, "");
}

export type SecurityEventType = 
    | "FAILED_LOGIN"
    | "SUCCESSFUL_LOGIN" 
    | "PASSWORD_CHANGE"
    | "API_KEY_USED"
    | "ADMIN_ACCESS"
    | "TWO_FACTOR_ENABLED"
    | "TWO_FACTOR_DISABLED"
    | "PASSWORD_RESET_REQUESTED"
    | "PASSWORD_RESET_COMPLETED"
    | "ACCOUNT_CREATED"
    | "ACCOUNT_DELETED"
    | "SESSION_EXPIRED"
    | "SUSPICIOUS_ACTIVITY"
    | "ACCOUNT_LOCKED"
    | "ACCOUNT_UNLOCKED"
    | "LOGIN_BLOCKED_LOCKED_ACCOUNT";

export type SecurityEventSeverity = "low" | "medium" | "high";

export interface SecurityEventData {
    type: SecurityEventType;
    message: string;
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    severity?: SecurityEventSeverity;
    metadata?: Record<string, any>;
}

export async function logSecurityEvent(data: SecurityEventData): Promise<void> {
    try {
        // Sanitize all input data to prevent log injection
        const event = {
            type: data.type, // Type is from enum, no sanitization needed
            message: sanitizeMessage(data.message),
            userId: sanitizeUserId(data.userId) || null,
            email: sanitizeEmail(data.email) || null,
            ipAddress: sanitizeIpAddress(data.ipAddress) || null,
            userAgent: sanitizeUserAgent(data.userAgent) || null,
            severity: data.severity || "low", // Severity is from enum, no sanitization needed
            metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            timestamp: Date.now()
        };

        await db.insert(securityEvents).values(event);
        
        // Also log to application logger for immediate visibility (sanitized data)
        logger.info("Security Event", {
            type: data.type,
            message: event.message,
            email: event.email,
            ipAddress: event.ipAddress,
            severity: data.severity
        });
    } catch (error) {
        // Don't let security logging failures break the application
        logger.error("Failed to log security event", { error: error instanceof Error ? error.message : String(error) });
    }
}

// Helper functions for common security events
export const SecurityEvents = {
    failedLogin: (email: string, ipAddress: string, userAgent?: string) => 
        logSecurityEvent({
            type: "FAILED_LOGIN",
            message: "Failed login attempt",
            email,
            ipAddress,
            userAgent,
            severity: "high"
        }),

    successfulLogin: (userId: string, email: string, ipAddress: string, userAgent?: string) =>
        logSecurityEvent({
            type: "SUCCESSFUL_LOGIN", 
            message: "User logged in successfully",
            userId,
            email,
            ipAddress,
            userAgent,
            severity: "low"
        }),

    adminAccess: (userId: string, email: string, ipAddress: string, userAgent?: string) =>
        logSecurityEvent({
            type: "ADMIN_ACCESS",
            message: "Admin panel accessed", 
            userId,
            email,
            ipAddress,
            userAgent,
            severity: "medium"
        }),

    passwordChange: (userId: string, email: string, ipAddress: string, userAgent?: string) =>
        logSecurityEvent({
            type: "PASSWORD_CHANGE",
            message: "User changed password",
            userId, 
            email,
            ipAddress,
            userAgent,
            severity: "medium"
        }),

    apiKeyUsed: (email: string, ipAddress: string, userAgent?: string, apiKeyName?: string) =>
        logSecurityEvent({
            type: "API_KEY_USED",
            message: "API key authentication",
            email,
            ipAddress,
            userAgent,
            severity: "low",
            metadata: { apiKeyName }
        })
}; 