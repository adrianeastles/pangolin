import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { getSecurityConfig, updateSecurityConfig, SecurityConfig } from "@server/lib/configManager";
import logger from "@server/logger";

const updateSecurityConfigSchema = z.object({
    lockoutEnabled: z.boolean().optional(),
    maxFailedAttempts: z.number().min(1).max(50).optional(),
    lockoutDurationMinutes: z.number().min(1).max(1440).optional(), // Max 24 hours
    logFailedAttempts: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
    sessionTimeoutMinutes: z.number().min(5).max(43200).optional() // Min 5 minutes, max 30 days
}).strict();

export async function getAdminSecurityConfig(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const config = await getSecurityConfig();

        return response<SecurityConfig>(res, {
            data: config,
            success: true,
            error: false,
            message: "Security configuration retrieved successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error getting security config", e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to retrieve security configuration"
            )
        );
    }
}

export async function updateAdminSecurityConfig(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = updateSecurityConfigSchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    try {
        const updatedConfig = await updateSecurityConfig(parsedBody.data, req.user?.userId);

        logger.info("Security configuration updated", {
            updates: parsedBody.data,
            updatedBy: req.user?.userId || 'unknown'
        });

        return response<SecurityConfig>(res, {
            data: updatedConfig,
            success: true,
            error: false,
            message: "Security configuration updated successfully",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error updating security config", { error: e, updates: parsedBody.data });
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to update security configuration"
            )
        );
    }
}

export async function resetSecurityConfigToDefaults(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const { DEFAULT_SECURITY_CONFIG } = await import("@server/lib/configManager");
        const resetConfig = await updateSecurityConfig(DEFAULT_SECURITY_CONFIG, req.user?.userId);

        logger.warn("Security configuration reset to defaults", {
            resetBy: req.user?.userId || 'unknown'
        });

        return response<SecurityConfig>(res, {
            data: resetConfig,
            success: true,
            error: false,
            message: "Security configuration reset to defaults",
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error resetting security config", e);
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to reset security configuration"
            )
        );
    }
} 