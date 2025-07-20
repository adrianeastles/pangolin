import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { resourceTemplates, ruleTemplates, resources, orgs } from "@server/db";
import { eq, and } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";
import { OpenAPITags, registry } from "@server/openApi";

const assignTemplateToResourceParamsSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive()),
        templateId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "put",
    path: "/resource/{resourceId}/templates/{templateId}",
    description: "Assign a template to a resource.",
    tags: [OpenAPITags.Resource, OpenAPITags.RuleTemplate],
    request: {
        params: assignTemplateToResourceParamsSchema
    },
    responses: {}
});

export async function assignTemplateToResource(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = assignTemplateToResourceParamsSchema.safeParse(
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

        // Check if the template is already assigned to this resource
        const [existingAssignment] = await db
            .select()
            .from(resourceTemplates)
            .where(and(eq(resourceTemplates.resourceId, resourceId), eq(resourceTemplates.templateId, templateId)))
            .limit(1);

        if (existingAssignment) {
            return next(
                createHttpError(
                    HttpCode.CONFLICT,
                    `Template ${templateId} is already assigned to resource ${resourceId}`
                )
            );
        }

        // Assign the template to the resource
        await db
            .insert(resourceTemplates)
            .values({
                resourceId,
                templateId
            });

        return response(res, {
            data: { resourceId, templateId },
            success: true,
            error: false,
            message: "Template assigned to resource successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 