import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceRules, resources } from "@server/db";
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { evaluateRules, type Rule } from "@server/lib/ruleTemplateLogic";

const evaluateRulesSchema = z
    .object({
        ip: z.string().optional(),
        path: z.string().optional()
    })
    .strict();

const evaluateRulesParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/resource/{resourceId}/evaluate-rules",
    description: "Evaluate rules for a resource against a request.",
    tags: [OpenAPITags.Resource, OpenAPITags.RuleTemplate],
    request: {
        params: evaluateRulesParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: evaluateRulesSchema
                }
            }
        }
    },
    responses: {}
});

export async function evaluateRulesForResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = evaluateRulesSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { ip, path } = parsedBody.data;

        const parsedParams = evaluateRulesParamsSchema.safeParse(
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

        // Get all rules for this resource
        const rulesData = await db
            .select()
            .from(resourceRules)
            .where(eq(resourceRules.resourceId, resourceId))
            .orderBy(resourceRules.priority);

        // Convert to Rule interface with proper types
        const rules: Rule[] = rulesData.map(rule => ({
            ruleId: rule.ruleId,
            resourceId: rule.resourceId,
            action: rule.action as "ACCEPT" | "DROP",
            match: rule.match as "CIDR" | "IP" | "PATH",
            value: rule.value,
            priority: rule.priority,
            enabled: rule.enabled
        }));

        // Evaluate rules
        const matchingRule = evaluateRules(rules, { ip, path });

        return response(res, {
            data: {
                request: { ip, path },
                matchingRule,
                totalRules: rules.length,
                enabledRules: rules.filter(r => r.enabled).length
            },
            success: true,
            error: false,
            message: matchingRule 
                ? `Request ${matchingRule.action}ed by rule ${matchingRule.ruleId}` 
                : "No matching rules found",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 