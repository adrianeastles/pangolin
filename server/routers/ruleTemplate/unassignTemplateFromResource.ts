import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceTemplates, ruleTemplates, resources, resourceRules, templateRules } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const unassignTemplateFromResourceParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive()),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "delete",
    path: "/resource/{resourceId}/templates/{templateId}",
    description: "Unassign a template from a resource.",
    tags: [OpenAPITags.Resource, OpenAPITags.RuleTemplate],
    request: {
        params: unassignTemplateFromResourceParamsSchema
    },
    responses: {}
});

export async function unassignTemplateFromResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = unassignTemplateFromResourceParamsSchema.safeParse(
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

        // Get the template rules to identify which resource rules to remove
        const templateRulesList = await db
            .select()
            .from(templateRules)
            .where(eq(templateRules.templateId, templateId));

        // Get all resource rules
        const resourceRulesList = await db
            .select()
            .from(resourceRules)
            .where(eq(resourceRules.resourceId, resourceId));

        // Create a map of template rules for faster lookup
        const templateRuleMap = new Map(
            templateRulesList.map(rule => [
                `${rule.action}:${rule.match}:${rule.value}`,
                rule
            ])
        );

        // Find rules that exactly match template rules
        const rulesToRemove = resourceRulesList.filter(resourceRule => {
            const key = `${resourceRule.action}:${resourceRule.match}:${resourceRule.value}`;
            return templateRuleMap.has(key);
        });

        // Unassign the template from the resource
        await db
            .delete(resourceTemplates)
            .where(and(eq(resourceTemplates.resourceId, resourceId), eq(resourceTemplates.templateId, templateId)));

        // Remove only the rules that exactly match template rules
        for (const rule of rulesToRemove) {
            await db
                .delete(resourceRules)
                .where(eq(resourceRules.ruleId, rule.ruleId));
        }

        return response(res, {
            data: {
                removedRules: rulesToRemove.length,
                totalRules: resourceRulesList.length
            },
            success: true,
            error: false,
            message: `Template unassigned successfully. Removed ${rulesToRemove.length} template rules, kept ${resourceRulesList.length - rulesToRemove.length} manual rules.`,
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 