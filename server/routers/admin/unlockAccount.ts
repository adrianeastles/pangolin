import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { unlockAccount } from "@server/lib/accountLockout";
import logger from "@server/logger";

const unlockAccountBodySchema = z.object({
    email: z.string().email()
}).strict();

export async function adminUnlockAccount(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    const parsedBody = unlockAccountBodySchema.safeParse(req.body);

    if (!parsedBody.success) {
        return next(
            createHttpError(
                HttpCode.BAD_REQUEST,
                fromError(parsedBody.error).toString()
            )
        );
    }

    const { email } = parsedBody.data;

    try {
        await unlockAccount(email);

        return response<null>(res, {
            data: null,
            success: true,
            error: false,
            message: `Account ${email} has been unlocked successfully`,
            status: HttpCode.OK
        });
    } catch (e) {
        logger.error("Error unlocking account", { error: e, email });
        return next(
            createHttpError(
                HttpCode.INTERNAL_SERVER_ERROR,
                "Failed to unlock account"
            )
        );
    }
} 