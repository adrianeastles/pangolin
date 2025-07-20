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

const createTemplateRuleSchema = z
    .object({
        action: z.enum(["ACCEPT", "DROP"]),
        match: z.enum(["CIDR", "IP", "PATH"]),
        value: z.string().min(1),
        priority: z.number().int(),
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

        // Create the new template rule
        const [newRule] = await db
            .insert(templateRules)
            .values({
                templateId,
                action,
                match,
                value,
                priority,
                enabled: enabled ?? true
            })
            .returning();

        return response(res, {
            data: newRule,
            success: true,
            error: false,
            message: "Template rule created successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 