import {
    createSession,
    generateSessionToken,
    serializeSessionCookie
} from "@server/auth/sessions/app";
import { db } from "@server/db";
import { users } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { eq, and } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { verifyTotpCode } from "@server/auth/totp";
import config from "@server/lib/config";
import logger from "@server/logger";
import { verifyPassword } from "@server/auth/password";
import { verifySession } from "@server/auth/sessions/verifySession";
import { UserType } from "@server/types/UserTypes";
import { SecurityEvents } from "@server/lib/securityEventLogger";
import { 
    checkAccountLockout, 
    recordFailedAttempt, 
    clearFailedAttempts,
    formatLockoutMessage 
} from "@server/lib/accountLockout";
import { timingSafeEqual } from "crypto";

export const loginBodySchema = z
    .object({
        email: z
            .string()
            .toLowerCase()
            .email(),
        password: z.string(),
        code: z.string().optional()
    })
    .strict();

export type LoginBody = z.infer<typeof loginBodySchema>;

export type LoginResponse = {
    codeRequested?: boolean;
    emailVerificationRequired?: boolean;
};

export const dynamic = "force-dynamic";

// Constant-time user lookup to prevent timing-based user enumeration
async function constantTimeUserLookup(email: string): Promise<any | null> {
    const startTime = process.hrtime.bigint();
    
    try {
        const [user] = await db
            .select()
            .from(users)
            .where(and(eq(users.type, UserType.Internal), eq(users.email, email)))
            .limit(1);
        
        // Add artificial delay to make timing more consistent (minimum 5ms)
        const elapsed = process.hrtime.bigint() - startTime;
        const minDelay = BigInt(5_000_000); // 5ms in nanoseconds
        
        if (elapsed < minDelay) {
            const remainingDelay = Number(minDelay - elapsed) / 1_000_000; // Convert to milliseconds
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
        
        return user || null;
    } catch (error) {
        // Add delay even on error to maintain consistent timing
        const elapsed = process.hrtime.bigint() - startTime;
        const minDelay = BigInt(5_000_000); // 5ms
        
        if (elapsed < minDelay) {
            const remainingDelay = Number(minDelay - elapsed) / 1_000_000;
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
        
        return null;
    }
}

// Constant-time password verification to prevent timing attacks
async function constantTimePasswordVerification(password: string, storedHash: string | null): Promise<boolean> {
    // Always perform password verification, even if storedHash is null
    // Use a dummy hash when storedHash is null to maintain constant timing
    const hashToVerify = storedHash || "$2b$10$dummy.hash.to.prevent.timing.attacks.fake.hash.here.12345678901234567890";
    
    const isValid = await verifyPassword(password, hashToVerify);
    
    // Only return true if we have a real hash AND it's valid
    return storedHash !== null && isValid;
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = loginBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { email, password, code } = parsedBody.data;
    const ipAddress = req.ip || "";
    const userAgent = req.get('User-Agent') || "";

    try {
        const { session: existingSession } = await verifySession(req);
        if (existingSession) {
            return response<null>(res, {
                data: null,
                success: true,
                error: false,
                message: "Already logged in",
                status: HttpCode.OK
            });
        }

        // Check if account is locked
        const lockoutStatus = await checkAccountLockout(email, ipAddress);
        if (lockoutStatus.isLocked) {
            // Log the blocked login attempt
            await SecurityEvents.failedLogin(email, ipAddress, userAgent);
            
            const lockoutMessage = formatLockoutMessage(lockoutStatus);
            return next(
                createHttpError(
                    HttpCode.TOO_MANY_REQUESTS,
                    lockoutMessage
                )
            );
        }

        // Use constant-time user lookup to prevent timing attacks
        const existingUser = await constantTimeUserLookup(email);
        
        // Always perform password verification to maintain constant timing
        const validPassword = await constantTimePasswordVerification(
            password,
            existingUser?.passwordHash || null
        );
        
        if (!existingUser || !validPassword) {
            if (config.getRawConfig().app.log_failed_attempts) {
                logger.info(
                    `Username or password incorrect. Email: ${email}. IP: ${req.ip}.`
                );
            }
            // Record failed attempt and log security event
            await recordFailedAttempt(email, ipAddress);
            SecurityEvents.failedLogin(email, ipAddress, userAgent);
            return next(
                createHttpError(
                    HttpCode.UNAUTHORIZED,
                    "Username or password is incorrect"
                )
            );
        }

        if (existingUser.twoFactorEnabled) {
            if (!code) {
                return response<{ codeRequested: boolean }>(res, {
                    data: { codeRequested: true },
                    success: true,
                    error: false,
                    message: "Two-factor authentication required",
                    status: HttpCode.ACCEPTED
                });
            }

            const validOTP = await verifyTotpCode(
                code,
                existingUser.twoFactorSecret!,
                existingUser.userId
            );

            if (!validOTP) {
                if (config.getRawConfig().app.log_failed_attempts) {
                    logger.info(
                        `Two-factor code incorrect. Email: ${email}. IP: ${req.ip}.`
                    );
                }
                // Record failed attempt and log security event
                await recordFailedAttempt(email, ipAddress);
                SecurityEvents.failedLogin(email, ipAddress, userAgent);
                return next(
                    createHttpError(
                        HttpCode.UNAUTHORIZED,
                        "The two-factor code you entered is incorrect"
                    )
                );
            }
        }

        // Clear any existing failed attempts on successful login
        await clearFailedAttempts(email);

        const token = generateSessionToken();
        const sess = await createSession(token, existingUser.userId);
        const isSecure = req.protocol === "https";
        const cookie = serializeSessionCookie(
            token,
            isSecure,
            new Date(sess.expiresAt)
        );

        res.appendHeader("Set-Cookie", cookie);

        // Log successful login
        SecurityEvents.successfulLogin(
            existingUser.userId, 
            existingUser.email || email, 
            req.ip || "", 
            req.get('User-Agent')
        );

        if (
            !existingUser.emailVerified &&
            config.getRawConfig().flags?.require_email_verification
        ) {
            return response<LoginResponse>(res, {
                data: { emailVerificationRequired: true },
                success: true,
                error: false,
                message: "Email verification code sent",
                status: HttpCode.OK
            });
        }

        return response<null>(res, {
            data: null,
            success: true,
            error: false,
            message: "Logged in successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error(e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to authenticate user"
            )
        );
    }
}
