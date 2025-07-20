import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { ruleTemplates, orgs } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const deleteRuleTemplateParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "delete",
    path: "/org/{orgId}/rule-templates/{templateId}",
    description: "Delete a rule template.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: deleteRuleTemplateParamsSchema
    },
    responses: {}
});

export async function deleteRuleTemplate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = deleteRuleTemplateParamsSchema.safeParse(
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

        // Check if the template exists
        const [existingTemplate] = await db
            .select()
            .from(ruleTemplates)
            .where(and(eq(ruleTemplates.templateId, templateId), eq(ruleTemplates.orgId, orgId)))
            .limit(1);

        if (!existingTemplate) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Rule template with ID ${templateId} not found in organization ${orgId}`
                )
            );
        }

        // Delete the rule template (cascade will handle template rules and resource templates)
        await db
            .delete(ruleTemplates)
            .where(and(eq(ruleTemplates.templateId, templateId), eq(ruleTemplates.orgId, orgId)));

        return response(res, {
            data: null,
            success: true,
            error: false,
            message: "Rule template deleted successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 