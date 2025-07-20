import { db } from "@server/db";
import { resourceRules, resources, resourceTemplates, templateRules, ruleTemplates } from "@server/db";
import HttpCode from "@server/types/HttpCode";
import response from "@server/lib/response";
import { eq, sql, and } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import logger from "@server/logger";
import { OpenAPITags, registry } from "@server/openApi";

const listResourceRulesParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

const listResourceRulesSchema = z.object({
    limit: z
        .string()
        .optional()
        .default("1000")
        .transform(Number)
        .pipe(z.number().int().positive()),
    offset: z
        .string()
        .optional()
        .default("0")
        .transform(Number)
        .pipe(z.number().int().nonnegative())
});

function queryResourceRules(resourceId: number) {
    let baseQuery = db
        .select({
            ruleId: resourceRules.ruleId,
            resourceId: resourceRules.resourceId,
            action: resourceRules.action,
            match: resourceRules.match,
            value: resourceRules.value,
            priority: resourceRules.priority,
            enabled: resourceRules.enabled
        })
        .from(resourceRules)
        .leftJoin(resources, eq(resourceRules.resourceId, resources.resourceId))
        .where(eq(resourceRules.resourceId, resourceId));

    return baseQuery;
}

/**
 * Determine the source of each rule (manual vs template)
 * This uses heuristics since we don't have templateId in the resourceRules table
 */
async function determineRuleSources(resourceId: number, rules: any[]) {
    try {
        // Get all templates assigned to this resource
        const assignedTemplates = await db
            .select({
                templateId: resourceTemplates.templateId,
                name: ruleTemplates.name
            })
            .from(resourceTemplates)
            .leftJoin(ruleTemplates, eq(resourceTemplates.templateId, ruleTemplates.templateId))
            .where(eq(resourceTemplates.resourceId, resourceId));

        // Get all template rules for assigned templates
        const templateRulesList = await db
            .select({
                templateId: templateRules.templateId,
                action: templateRules.action,
                match: templateRules.match,
                value: templateRules.value,
                priority: templateRules.priority,
                enabled: templateRules.enabled
            })
            .from(templateRules)
            .where(
                sql`${templateRules.templateId} IN (${assignedTemplates.map(t => t.templateId).join(',')})`
            );

        // Group template rules by template
        const templateRulesByTemplate = new Map();
        for (const templateRule of templateRulesList) {
            if (!templateRulesByTemplate.has(templateRule.templateId)) {
                templateRulesByTemplate.set(templateRule.templateId, []);
            }
            templateRulesByTemplate.get(templateRule.templateId).push(templateRule);
        }

        // For each resource rule, try to find a matching template rule
        const rulesWithSource = rules.map(rule => {
            let source: { type: 'manual' | 'template'; templateId: string | null; templateName: string | null } = { 
                type: 'manual', 
                templateId: null, 
                templateName: null 
            };
            
            // Check each template for matches
            for (const [templateId, templateRules] of templateRulesByTemplate) {
                const matchingTemplateRule = templateRules.find((templateRule: any) => 
                    templateRule.action === rule.action &&
                    templateRule.match === rule.match &&
                    templateRule.value === rule.value
                );
                
                if (matchingTemplateRule) {
                    const templateInfo = assignedTemplates.find(t => t.templateId === templateId);
                    source = {
                        type: 'template',
                        templateId: templateId,
                        templateName: templateInfo?.name || 'Unknown Template'
                    };
                    break;
                }
            }
            
            return {
                ...rule,
                source
            };
        });

        return rulesWithSource;
    } catch (error) {
        logger.error(`Error determining rule sources for resource ${resourceId}:`, error);
        // Fallback: mark all rules as manual
        return rules.map(rule => ({
            ...rule,
            source: { type: 'manual' as const, templateId: null, templateName: null }
        }));
    }
}

export type ListResourceRulesResponse = {
    rules: Awaited<ReturnType<typeof queryResourceRules>>;
    pagination: { total: number; limit: number; offset: number };
};

registry.registerPath({
    method: "get",
    path: "/resource/{resourceId}/rules",
    description: "List rules for a resource.",
    tags: [OpenAPITags.Resource, OpenAPITags.Rule],
    request: {
        params: listResourceRulesParamsSchema,
        query: listResourceRulesSchema
    },
    responses: {}
});

export async function listResourceRules(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedQuery = listResourceRulesSchema.safeParse(req.query);
        if (!parsedQuery.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedQuery.error)
                )
            );
        }
        const { limit, offset } = parsedQuery.data;

        const parsedParams = listResourceRulesParamsSchema.safeParse(
            req.params
        );
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error)
                )
            );
        }
        const { resourceId } = parsedParams.data;

        // Verify the resource exists
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

        const baseQuery = queryResourceRules(resourceId);

        let countQuery = db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(resourceRules)
            .where(eq(resourceRules.resourceId, resourceId));

        let rulesList = await baseQuery.limit(limit).offset(offset);
        const totalCountResult = await countQuery;
        const totalCount = totalCountResult[0].count;

        // sort rules list by the priority in ascending order
        rulesList = rulesList.sort((a, b) => a.priority - b.priority);

        // Determine the source of each rule (manual vs template)
        const rulesWithSource = await determineRuleSources(resourceId, rulesList);

        return response<ListResourceRulesResponse>(res, {
            data: {
                rules: rulesWithSource,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            },
            success: true,
            error: false,
            message: "Resource rules retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
