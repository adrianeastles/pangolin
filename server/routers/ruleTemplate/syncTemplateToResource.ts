import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceTemplates, ruleTemplates, resources, templateRules, resourceRules } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";
import { propagateTemplateToResources } from "@server/lib/ruleTemplateLogic";

const syncTemplateToResourceParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive()),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "post",
    path: "/resource/{resourceId}/templates/{templateId}/sync",
    description: "Sync template rules to a resource.",
    tags: [OpenAPITags.Resource, OpenAPITags.RuleTemplate],
    request: {
        params: syncTemplateToResourceParamsSchema
    },
    responses: {}
});

export async function syncTemplateToResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = syncTemplateToResourceParamsSchema.safeParse(
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

        const { resourceId, templateId } = parsedParams.data;

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

        // Verify that the template exists
        const [template] = await db
            .select()
            .from(ruleTemplates)
            .where(eq(ruleTemplates.templateId, templateId))
            .limit(1);

        if (!template) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Rule template with ID ${templateId} not found`
                )
            );
        }

        // Verify that the template belongs to the same organization as the resource
        if (template.orgId !== resource.orgId) {
            return next(
                createHttpError(
                    HttpCode.FORBIDDEN,
                    `Template ${templateId} does not belong to the same organization as resource ${resourceId}`
                )
            );
        }

        // Check if the template is assigned to this resource
        const [existingAssignment] = await db
            .select()
            .from(resourceTemplates)
            .where(and(eq(resourceTemplates.resourceId, resourceId), eq(resourceTemplates.templateId, templateId)))
            .limit(1);

        if (!existingAssignment) {
            return next(
                createHttpError(
                    HttpCode.NOT_FOUND,
                    `Template ${templateId} is not assigned to resource ${resourceId}`
                )
            );
        }

        // Use the propagation logic to sync the template to this specific resource
        try {
            // Get all rules from the template
            const templateRulesList = await db
                .select()
                .from(templateRules)
                .where(eq(templateRules.templateId, templateId))
                .orderBy(templateRules.priority);

            if (templateRulesList.length === 0) {
                return response(res, {
                    data: { syncedRules: 0 },
                    success: true,
                    error: false,
                    message: "No rules to sync from template",
                    status: HttpCode.OK
                });
            }

            // Get existing resource rules to calculate the next priority
            const existingRules = await db
                .select()
                .from(resourceRules)
                .where(eq(resourceRules.resourceId, resourceId))
                .orderBy(resourceRules.priority);

            // Calculate the starting priority for new template rules
            // They should come after the highest existing priority
            const maxExistingPriority = existingRules.length > 0 
                ? Math.max(...existingRules.map(r => r.priority))
                : 0;

            // Create new resource rules from template rules with adjusted priorities
            const newRules = templateRulesList.map((templateRule, index) => ({
                resourceId,
                action: templateRule.action,
                match: templateRule.match,
                value: templateRule.value,
                priority: maxExistingPriority + templateRule.priority + index + 1, // Ensure they come after existing rules
                enabled: templateRule.enabled
            }));

            if (newRules.length > 0) {
                await db
                    .insert(resourceRules)
                    .values(newRules);
            }

            return response(res, {
                data: { syncedRules: newRules.length },
                success: true,
                error: false,
                message: `Successfully synced ${newRules.length} rules from template to resource`,
                status: HttpCode.OK
            });
        } catch (error) {
            logger.error("Error syncing template to resource:", error);
            return next(
                createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred while syncing template")
            );
        }
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 