import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceTemplates, ruleTemplates, resources } from "@server/db";
import { eq, count } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const listResourceTemplatesParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

const listResourceTemplatesQuerySchema = z
    .object({
        limit: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive().max(100))
            .optional(),
        offset: z
            .string()
            .transform(Number)
            .pipe(z.number().int().nonnegative())
            .optional()
    })
    .strict();

registry.registerPath({
    method: "get",
    path: "/resource/{resourceId}/templates",
    description: "List templates assigned to a resource.",
    tags: [OpenAPITags.Resource, OpenAPITags.RuleTemplate],
    request: {
        params: listResourceTemplatesParamsSchema,
        query: listResourceTemplatesQuerySchema
    },
    responses: {}
});

export type ListResourceTemplatesResponse = {
    templates: Awaited<ReturnType<typeof queryResourceTemplates>>;
    total: number;
};

function queryResourceTemplates(resourceId: number) {
    return db
        .select({
            templateId: ruleTemplates.templateId,
            orgId: ruleTemplates.orgId,
            name: ruleTemplates.name,
            description: ruleTemplates.description,
            createdAt: ruleTemplates.createdAt
        })
        .from(resourceTemplates)
        .innerJoin(ruleTemplates, eq(resourceTemplates.templateId, ruleTemplates.templateId))
        .where(eq(resourceTemplates.resourceId, resourceId))
        .orderBy(ruleTemplates.createdAt);
}

export async function listResourceTemplates(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listResourceTemplatesQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error).toString()
                )
            );
        }

        const { limit, offset } = parsedQuery.data;

        const parsedParams = listResourceTemplatesParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { resourceId } = parsedParams.data;

        // Verify that the referenced resource exists
        const [resource] = await db
            .select()
            .from(resources)
            .where(eq(resources.resourceId, resourceId))
            .limit(1);

        if (!resource) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Resource with ID ${resourceId} not found`
                )
            );
        }

        const baseQuery = queryResourceTemplates(resourceId);

        // Get total count
        const totalResult = await db
            .select({ count: count() })
            .from(resourceTemplates)
            .where(eq(resourceTemplates.resourceId, resourceId));

        const total = Number(totalResult[0]?.count || 0);

        // Get templates with pagination
        const templates = await baseQuery.limit(limit || 50).offset(offset || 0);

        return response<ListResourceTemplatesResponse>(res, {
            data: {
                templates,
                total
            },
            success: true,
            error: false,
            message: "Resource templates retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 