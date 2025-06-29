import { db } from "@server/db";
import { securityEvents } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { logSecurityEvent } from "@server/lib/securityEventLogger";

export async function clearSecurityEvents(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        // Get count of events before deletion for logging
        const eventCountResult = await db
            .select({ count: securityEvents.eventId })
            .from(securityEvents);
        
        const eventCount = eventCountResult.length;

        // Delete all security events
        await db.delete(securityEvents);

        // Log this admin action as a security event
        await logSecurityEvent({
            type: "ADMIN_ACCESS",
            message: `Admin cleared ${eventCount} security events`,
            email: req.user?.email || undefined,
            ipAddress: req.ip || req.socket?.remoteAddress || undefined,
            userAgent: req.headers['user-agent'] || undefined,
            severity: "medium",
            metadata: {
                action: "clear_security_events",
                deletedCount: eventCount,
                adminUserId: req.user?.userId || null
            }
        });

        logger.info("Security events cleared by admin", {
            adminEmail: req.user?.email,
            deletedCount: eventCount,
            ipAddress: req.ip
        });

        return response(res, {
            data: {
                deletedCount: eventCount,
                message: `Successfully cleared ${eventCount} security events`
            },
            success: true,
            error: false,
            message: "Security events cleared successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error clearing security events", {
            error: e,
            adminEmail: req.user?.email,
            ipAddress: req.ip
        });
        
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to clear security events"
            )
        );
    }
} 