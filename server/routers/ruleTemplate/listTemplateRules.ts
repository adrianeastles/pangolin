import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { templateRules, ruleTemplates, orgs } from "@server/db";
import { eq, and, count } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const listTemplateRulesParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1)
    })
    .strict();

const listTemplateRulesQuerySchema = z
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
    path: "/org/{orgId}/rule-templates/{templateId}/rules",
    description: "List rules in a template.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: listTemplateRulesParamsSchema,
        query: listTemplateRulesQuerySchema
    },
    responses: {}
});

export type ListTemplateRulesResponse = {
    rules: Awaited<ReturnType<typeof queryTemplateRules>>;
    total: number;
};

function queryTemplateRules(templateId: string) {
    return db
        .select({
            ruleId: templateRules.ruleId,
            templateId: templateRules.templateId,
            action: templateRules.action,
            match: templateRules.match,
            value: templateRules.value,
            priority: templateRules.priority,
            enabled: templateRules.enabled
        })
        .from(templateRules)
        .where(eq(templateRules.templateId, templateId))
        .orderBy(templateRules.priority);
}

export async function listTemplateRules(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listTemplateRulesQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error).toString()
                )
            );
        }

        const { limit, offset } = parsedQuery.data;

        const parsedParams = listTemplateRulesParamsSchema.safeParse(
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

        const { orgId, templateId } = parsedParams.data;

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

        // Verify that the template exists and belongs to the organization
        const [template] = await db
            .select()
            .from(ruleTemplates)
            .where(and(eq(ruleTemplates.templateId, templateId), eq(ruleTemplates.orgId, orgId)))
            .limit(1);

        if (!template) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Rule template with ID ${templateId} not found in organization ${orgId}`
                )
            );
        }

        const baseQuery = queryTemplateRules(templateId);

        // Get total count
        const totalResult = await db
            .select({ count: count() })
            .from(templateRules)
            .where(eq(templateRules.templateId, templateId));

        const total = Number(totalResult[0]?.count || 0);

        // Get rules with pagination
        const rules = await baseQuery.limit(limit || 50).offset(offset || 0);

        return response<ListTemplateRulesResponse>(res, {
            data: {
                rules,
                total
            },
            success: true,
            error: false,
            message: "Template rules retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 