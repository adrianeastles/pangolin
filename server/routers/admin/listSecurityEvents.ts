import { db } from "@server/db";
import { securityEvents } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { desc, and, like, eq, gte, lte } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { SecurityEventType, SecurityEventSeverity } from "@server/lib/securityEventLogger";

const listSecurityEventsQuerySchema = z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 50),
    type: z.string().optional(),
    severity: z.string().optional(),
    search: z.string().optional(),
    from: z.string().optional().transform((val) => val ? new Date(val).getTime() : undefined),
    to: z.string().optional().transform((val) => val ? new Date(val).getTime() : undefined)
}).strict();

export type ListSecurityEventsResponse = {
    events: {
        eventId: number;
        type: SecurityEventType;
        message: string;
        userId: string | null;
        email: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        severity: SecurityEventSeverity;
        metadata: string | null;
        timestamp: number;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

export async function listSecurityEvents(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedQuery = listSecurityEventsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedQuery.error).toString()
            )
        );
    }

    const { page, limit, type, severity, search, from, to } = parsedQuery.data;

    try {
        // Build where conditions
        const whereConditions = [];

        if (type && type !== "all") {
            whereConditions.push(eq(securityEvents.type, type));
        }

        if (severity && severity !== "all") {
            whereConditions.push(eq(securityEvents.severity, severity));
        }

        if (search) {
            // Search in email, ipAddress, and message fields
            whereConditions.push(
                // For SQLite/PostgreSQL compatibility, we'll use LIKE
                like(securityEvents.email, `%${search}%`)
            );
        }

        if (from) {
            whereConditions.push(gte(securityEvents.timestamp, from));
        }

        if (to) {
            whereConditions.push(lte(securityEvents.timestamp, to));
        }

        // Count total events for pagination
        const totalQuery = await db
            .select({ count: securityEvents.eventId })
            .from(securityEvents)
            .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

        const total = totalQuery.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;

        // Fetch events with pagination
        const events = await db
            .select()
            .from(securityEvents)
            .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
            .orderBy(desc(securityEvents.timestamp))
            .limit(limit)
            .offset(offset);

        return response<ListSecurityEventsResponse>(res, {
            data: {
                events: events.map(event => ({
                    eventId: event.eventId,
                    type: event.type as SecurityEventType,
                    message: event.message,
                    userId: event.userId,
                    email: event.email,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    severity: event.severity as SecurityEventSeverity,
                    metadata: event.metadata,
                    timestamp: event.timestamp
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            },
            success: true,
            error: false,
            message: "Security events retrieved successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error fetching security events", e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to fetch security events"
            )
        );
    }
} 