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
import {
    isValidCIDR,
    isValidIP,
    isValidUrlGlobPattern
} from "@server/lib/validators";
import { 
    resolvePriorityConflicts, 
    getNextPriority, 
    validateRuleConsistency,
    type Rule 
} from "@server/lib/ruleTemplateLogic";
import { propagateTemplateToResources } from "@server/lib/ruleTemplateLogic";

const createTemplateRuleSchema = z
    .object({
        action: z.enum(["ACCEPT", "DROP"]),
        match: z.enum(["CIDR", "IP", "PATH"]),
        value: z.string().min(1),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional()
    })
    .strict();

const createTemplateRuleParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/rule-templates/{templateId}/rules",
    description: "Add a rule to a template.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: createTemplateRuleParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: createTemplateRuleSchema
                }
            }
        }
    },
    responses: {}
});

export async function createTemplateRule(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = createTemplateRuleSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { action, match, value, priority, enabled } = parsedBody.data;

        const parsedParams = createTemplateRuleParamsSchema.safeParse(
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

        // Validate the rule value based on match type
        if (match === "CIDR") {
            if (!isValidCIDR(value)) {
                return next(
                    createHttpError(
                        HttpCode.BAD_REQUEST,
                        "Invalid CIDR provided"
                    )
                );
            }
        } else if (match === "IP") {
            if (!isValidIP(value)) {
                return next(
                    createHttpError(HttpCode.BAD_REQUEST, "Invalid IP provided")
                );
            }
        } else if (match === "PATH") {
            if (!isValidUrlGlobPattern(value)) {
                return next(
                    createHttpError(
                        HttpCode.BAD_REQUEST,
                        "Invalid URL glob pattern provided"
                    )
                );
            }
        }

        // Get existing rules for priority management
        const existingRulesData = await db
            .select()
            .from(templateRules)
            .where(eq(templateRules.templateId, templateId))
            .orderBy(templateRules.priority);

        // Convert to Rule interface with proper types
        const existingRules: Rule[] = existingRulesData.map(rule => ({
            ruleId: rule.ruleId,
            templateId: rule.templateId,
            action: rule.action as "ACCEPT" | "DROP",
            match: rule.match as "CIDR" | "IP" | "PATH",
            value: rule.value,
            priority: rule.priority,
            enabled: rule.enabled
        }));

        // Determine priority
        let finalPriority = priority;
        if (finalPriority === undefined) {
            finalPriority = await getNextPriority(undefined, templateId);
        }

        // Resolve priority conflicts if needed
        let updatedRules = existingRules;
        if (finalPriority !== undefined) {
            updatedRules = await resolvePriorityConflicts(existingRules, finalPriority, undefined, templateId);
        }

        // Validate rule consistency with updated rules
        const newRule: Rule = {
            action,
            match,
            value,
            priority: finalPriority,
            enabled: enabled ?? true
        };

        const consistencyCheck = validateRuleConsistency([...updatedRules, newRule]);
        if (!consistencyCheck.isValid) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    `Rule consistency issues: ${consistencyCheck.conflicts.join(", ")}`
                )
            );
        }

        // Create the new template rule
        const [newTemplateRule] = await db
            .insert(templateRules)
            .values({
                templateId,
                action,
                match,
                value,
                priority: finalPriority,
                enabled: enabled ?? true
            })
            .returning();

        // Propagate the template changes to all assigned resources
        try {
            await propagateTemplateToResources(templateId);
            logger.info(`Propagated template ${templateId} changes to all assigned resources after rule creation`);
        } catch (propagationError) {
            logger.error("Error propagating template changes after rule creation:", propagationError);
            // Don't fail the creation if propagation fails, just log it
        }

        return response(res, {
            data: newTemplateRule,
            success: true,
            error: false,
            message: "Template rule created successfully and propagated to all assigned resources",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 