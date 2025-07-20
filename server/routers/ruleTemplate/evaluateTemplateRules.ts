import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { templateRules, ruleTemplates, orgs } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { evaluateRules, type Rule } from "@server/lib/ruleTemplateLogic";

const evaluateTemplateRulesSchema = z
    .object({
        type: z.enum(["IP", "CIDR", "PATH"]),
        value: z.string().min(1)
    })
    .strict();

const evaluateTemplateRulesParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/org/{orgId}/rule-templates/{templateId}/evaluate",
    description: "Evaluate template rules against a test value.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: evaluateTemplateRulesParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: evaluateTemplateRulesSchema
                }
            }
        }
    },
    responses: {}
});

export async function evaluateTemplateRules(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = evaluateTemplateRulesSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { type, value } = parsedBody.data;

        const parsedParams = evaluateTemplateRulesParamsSchema.safeParse(
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

        // Get all rules for this template
        const rulesData = await db
            .select()
            .from(templateRules)
            .where(eq(templateRules.templateId, templateId))
            .orderBy(templateRules.priority);

        // Convert to Rule interface with proper types
        const rules: Rule[] = rulesData.map(rule => ({
            ruleId: rule.ruleId,
            templateId: rule.templateId,
            action: rule.action as "ACCEPT" | "DROP",
            match: rule.match as "CIDR" | "IP" | "PATH",
            value: rule.value,
            priority: rule.priority,
            enabled: rule.enabled
        }));

        // Prepare request object based on type
        const request = type === "PATH" ? { path: value } : { ip: value };

        // Evaluate rules
        const matchingRule = evaluateRules(rules, request);

        // Prepare evaluation results for all rules
        const evaluatedRules = rules.map(rule => {
            let matched = false;
            
            if (rule.enabled) {
                if (type === "PATH" && rule.match === "PATH") {
                    // Simple path matching - could be enhanced with glob patterns
                    matched = value.startsWith(rule.value) || rule.value === value;
                } else if ((type === "IP" || type === "CIDR") && (rule.match === "IP" || rule.match === "CIDR")) {
                    // IP/CIDR matching logic
                    if (rule.match === "IP") {
                        matched = value === rule.value;
                    } else if (rule.match === "CIDR") {
                        // Simple CIDR matching - could be enhanced
                        matched = value === rule.value || rule.value.includes(value);
                    }
                }
            }

            return {
                ruleId: rule.ruleId,
                match: rule.match,
                value: rule.value,
                priority: rule.priority,
                matched,
                action: rule.action
            };
        });

        // Find the highest priority matched rule
        const finalMatchedRule = evaluatedRules
            .filter(r => r.matched)
            .sort((a, b) => a.priority - b.priority)[0];

        return response(res, {
            data: {
                matched: !!finalMatchedRule,
                action: finalMatchedRule?.action || "ACCEPT",
                matchedRule: finalMatchedRule ? {
                    ruleId: finalMatchedRule.ruleId,
                    match: finalMatchedRule.match,
                    value: finalMatchedRule.value,
                    priority: finalMatchedRule.priority
                } : undefined,
                evaluatedRules
            },
            success: true,
            error: false,
            message: finalMatchedRule 
                ? `Request ${finalMatchedRule.action}ed by rule ${finalMatchedRule.ruleId}` 
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