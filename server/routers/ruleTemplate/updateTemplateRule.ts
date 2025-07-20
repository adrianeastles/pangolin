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

const updateTemplateRuleSchema = z
    .object({
        action: z.enum(["ACCEPT", "DROP"]).optional(),
        match: z.enum(["CIDR", "IP", "PATH"]).optional(),
        value: z.string().min(1).optional(),
        priority: z.number().int().optional(),
        enabled: z.boolean().optional()
    })
    .strict();

const updateTemplateRuleParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1),
        ruleId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/org/{orgId}/rule-templates/{templateId}/rules/{ruleId}",
    description: "Update a template rule.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: updateTemplateRuleParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: updateTemplateRuleSchema
                }
            }
        }
    },
    responses: {}
});

export async function updateTemplateRule(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = updateTemplateRuleSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { action, match, value, priority, enabled } = parsedBody.data;

        const parsedParams = updateTemplateRuleParamsSchema.safeParse(
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

        const { orgId, templateId, ruleId } = parsedParams.data;

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

        // Check if the rule exists and belongs to the template
        const [existingRule] = await db
            .select()
            .from(templateRules)
            .where(eq(templateRules.ruleId, ruleId))
            .limit(1);

        if (!existingRule || existingRule.templateId !== templateId) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Template rule with ID ${ruleId} not found in template ${templateId}`
                )
            );
        }

        // Validate the rule value if it's being updated
        if (value) {
            const matchType = match || existingRule.match;
            if (matchType === "CIDR") {
                if (!isValidCIDR(value)) {
                    return next(
                        createHttpError(
                            HttpCode.BAD_REQUEST,
                            "Invalid CIDR provided"
                        )
                    );
                }
            } else if (matchType === "IP") {
                if (!isValidIP(value)) {
                    return next(
                        createHttpError(HttpCode.BAD_REQUEST, "Invalid IP provided")
                    );
                }
            } else if (matchType === "PATH") {
                if (!isValidUrlGlobPattern(value)) {
                    return next(
                        createHttpError(
                            HttpCode.BAD_REQUEST,
                            "Invalid URL glob pattern provided"
                        )
                    );
                }
            }
        }

        // Prepare update data
        const updateData: any = {};
        if (action !== undefined) updateData.action = action;
        if (match !== undefined) updateData.match = match;
        if (value !== undefined) updateData.value = value;
        if (priority !== undefined) updateData.priority = priority;
        if (enabled !== undefined) updateData.enabled = enabled;

        // Update the template rule
        const [updatedRule] = await db
            .update(templateRules)
            .set(updateData)
            .where(eq(templateRules.ruleId, ruleId))
            .returning();

        return response(res, {
            data: updatedRule,
            success: true,
            error: false,
            message: "Template rule updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 