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

const updateRuleTemplateSchema = z
    .object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional()
    })
    .strict();

const updateRuleTemplateParamsSchema = z
    .object({
        orgId: z.string().min(1),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/org/{orgId}/rule-templates/{templateId}",
    description: "Update a rule template.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: updateRuleTemplateParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: updateRuleTemplateSchema
                }
            }
        }
    },
    responses: {}
});

export async function updateRuleTemplate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = updateRuleTemplateSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { name, description } = parsedBody.data;

        const parsedParams = updateRuleTemplateParamsSchema.safeParse(
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

        // If name is being updated, check for conflicts
        if (name && name !== existingTemplate.name) {
            const [conflictingTemplate] = await db
                .select()
                .from(ruleTemplates)
                .where(and(eq(ruleTemplates.orgId, orgId), eq(ruleTemplates.name, name)))
                .limit(1);

            if (conflictingTemplate) {
                return next(
                    createHttpError(
                        HttpCode.CONFLICT,
                        `A rule template with the name "${name}" already exists in this organization`
                    )
                );
            }
        }

        // Prepare update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        // Update the rule template
        const [updatedTemplate] = await db
            .update(ruleTemplates)
            .set(updateData)
            .where(and(eq(ruleTemplates.templateId, templateId), eq(ruleTemplates.orgId, orgId)))
            .returning();

        return response(res, {
            data: updatedTemplate,
            success: true,
            error: false,
            message: "Rule template updated successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 