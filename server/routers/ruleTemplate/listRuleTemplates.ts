import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { ruleTemplates, orgs, templateRules } from "@server/db";
import { eq, count, sql } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const listRuleTemplatesParamsSchema = z
    .object({
        orgId: z.string().min(1)
    })
    .strict();

const listRuleTemplatesQuerySchema = z
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
    path: "/org/{orgId}/rule-templates",
    description: "List rule templates for an organization.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: listRuleTemplatesParamsSchema,
        query: listRuleTemplatesQuerySchema
    },
    responses: {}
});

export type ListRuleTemplatesResponse = {
    templates: Awaited<ReturnType<typeof queryRuleTemplates>>;
    total: number;
};

function queryRuleTemplates(orgId: string) {
    return db
        .select({
            templateId: ruleTemplates.templateId,
            orgId: ruleTemplates.orgId,
            name: ruleTemplates.name,
            description: ruleTemplates.description,
            createdAt: ruleTemplates.createdAt,
            ruleCount: sql<number>`CAST((
                SELECT COUNT(*) 
                FROM ${templateRules} tr
                WHERE tr.templateId = ${ruleTemplates.templateId}
                AND tr.enabled = true
            ) AS INTEGER)`
        })
        .from(ruleTemplates)
        .where(eq(ruleTemplates.orgId, orgId))
        .orderBy(ruleTemplates.createdAt);
}

export async function listRuleTemplates(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listRuleTemplatesQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error).toString()
                )
            );
        }

        const { limit, offset } = parsedQuery.data;

        const parsedParams = listRuleTemplatesParamsSchema.safeParse(
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

        const { orgId } = parsedParams.data;

        // Verify that the referenced organization exists
        const [org] = await db
            .select()
            .from(orgs)
            .where(eq(orgs.orgId, orgId))
            .limit(1);

        if (!org) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Organization with ID ${orgId} not found`
                )
            );
        }

        const baseQuery = queryRuleTemplates(orgId);

        // Get total count
        const totalResult = await db
            .select({ count: count() })
            .from(ruleTemplates)
            .where(eq(ruleTemplates.orgId, orgId));

        const total = Number(totalResult[0]?.count || 0);

        // Get templates with pagination
        const templates = await baseQuery.limit(limit || 50).offset(offset || 0);

        return response<ListRuleTemplatesResponse>(res, {
            data: {
                templates,
                total
            },
            success: true,
            error: false,
            message: "Rule templates retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 