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

const deleteTemplateRuleParamsSchema = z
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
    method: "delete",
    path: "/org/{orgId}/rule-templates/{templateId}/rules/{ruleId}",
    description: "Delete a template rule.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: deleteTemplateRuleParamsSchema
    },
    responses: {}
});

export async function deleteTemplateRule(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteTemplateRuleParamsSchema.safeParse(
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

        // Delete the template rule
        await db
            .delete(templateRules)
            .where(eq(templateRules.ruleId, ruleId));

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Template rule deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 