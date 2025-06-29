import { db } from "@server/db";
import { accountLockouts } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { desc, eq, gte } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";

const listAccountLockoutsQuerySchema = z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 50),
    includeExpired: z.string().optional().transform((val) => val === 'true')
}).strict();

export type ListAccountLockoutsResponse = {
    lockouts: {
        lockoutId: number;
        email: string;
        ipAddress: string | null;
        failedAttempts: number;
        lockedAt: number | null;
        lockoutExpiresAt: number | null;
        isLocked: boolean;
        isExpired: boolean;
        remainingTime: number | null;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

export async function listAccountLockouts(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedQuery = listAccountLockoutsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedQuery.error).toString()
            )
        );
    }

    const { page, limit, includeExpired } = parsedQuery.data;

    try {
        const now = Date.now();
        let whereConditions = [];

        // If not including expired, only show active lockouts
        if (!includeExpired) {
            whereConditions.push(eq(accountLockouts.isLocked, true));
            whereConditions.push(gte(accountLockouts.lockoutExpiresAt, now));
        }

        // Count total lockouts
        const totalQuery = await db
            .select({ count: accountLockouts.lockoutId })
            .from(accountLockouts);

        const total = totalQuery.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;

        // Fetch lockouts with pagination
        const lockouts = await db
            .select()
            .from(accountLockouts)
            .orderBy(desc(accountLockouts.lockedAt))
            .limit(limit)
            .offset(offset);

        const processedLockouts = lockouts.map(lockout => {
            const isExpired = lockout.lockoutExpiresAt ? now > lockout.lockoutExpiresAt : false;
            const remainingTime = lockout.lockoutExpiresAt && !isExpired ? 
                lockout.lockoutExpiresAt - now : null;

            return {
                lockoutId: lockout.lockoutId,
                email: lockout.email,
                ipAddress: lockout.ipAddress,
                failedAttempts: lockout.failedAttempts,
                lockedAt: lockout.lockedAt,
                lockoutExpiresAt: lockout.lockoutExpiresAt,
                isLocked: lockout.isLocked,
                isExpired,
                remainingTime
            };
        });

        return response<ListAccountLockoutsResponse>(res, {
            data: {
                lockouts: processedLockouts,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            },
            success: true,
            error: false,
            message: "Account lockouts retrieved successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error fetching account lockouts", e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to fetch account lockouts"
            )
        );
    }
} 