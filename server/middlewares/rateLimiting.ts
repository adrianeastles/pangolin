import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import logger from "@server/logger";

// Rate limiting for general admin endpoints
export const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logger.warn("Admin rate limit exceeded", {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.user?.email,
            path: req.path
        });
        
        res.status(429).json({
            success: false,
            error: true,
            message: "Too many admin requests. Please try again later.",
            status: 429
        });
    },
    keyGenerator: (req: Request) => {
        // Rate limit by IP and user ID combination for better security
        return `admin_${req.ip}_${req.user?.userId || 'anonymous'}`;
    }
});

// Stricter rate limiting for security configuration changes
export const securityConfigRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit to 10 config changes per hour
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logger.error("Security config rate limit exceeded", {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.user?.email,
            path: req.path
        });
        
        res.status(429).json({
            success: false,
            error: true,
            message: "Too many security configuration changes. Please wait before making more changes.",
            status: 429
        });
    },
    keyGenerator: (req: Request) => {
        return `security_config_${req.ip}_${req.user?.userId || 'anonymous'}`;
    }
});

// Rate limiting for security events clearing (very sensitive operation)
export const securityEventsClearRateLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // Only 3 clear operations per day
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logger.error("Security events clear rate limit exceeded", {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.user?.email,
            path: req.path
        });
        
        res.status(429).json({
            success: false,
            error: true,
            message: "Too many security event clear attempts. This action is limited to 3 times per day.",
            status: 429
        });
    },
    keyGenerator: (req: Request) => {
        return `clear_events_${req.ip}_${req.user?.userId || 'anonymous'}`;
    }
});

// Rate limiting for account unlocking
export const accountUnlockRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Max 20 unlock operations per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logger.warn("Account unlock rate limit exceeded", {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            email: req.user?.email,
            path: req.path
        });
        
        res.status(429).json({
            success: false,
            error: true,
            message: "Too many account unlock requests. Please try again later.",
            status: 429
        });
    },
    keyGenerator: (req: Request) => {
        return `unlock_account_${req.ip}_${req.user?.userId || 'anonymous'}`;
    }
}); 