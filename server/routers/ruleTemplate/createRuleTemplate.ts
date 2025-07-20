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
import { nanoid } from "nanoid";

const createRuleTemplateSchema = z
    .object({
        name: z.string().min(1).max(255),
        description: z.string().optional()
    })
    .strict();

const createRuleTemplateParamsSchema = z
    .object({
        orgId: z.string().min(1)
    })
    .strict();

registry.registerPath({
    method: "put",
    path: "/org/{orgId}/rule-template",
    description: "Create a rule template.",
    tags: [OpenAPITags.Org, OpenAPITags.RuleTemplate],
    request: {
        params: createRuleTemplateParamsSchema,
        body: {
            content: {
                "application/json": {
                    schema: createRuleTemplateSchema
                }
            }
        }
    },
    responses: {}
});

export async function createRuleTemplate(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedBody = createRuleTemplateSchema.safeParse(req.body);
        if (!parsedBody.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedBody.error).toString()
                )
            );
        }

        const { name, description } = parsedBody.data;

        const parsedParams = createRuleTemplateParamsSchema.safeParse(
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

        const { orgId } = parsedParams.data;

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

        // Check if a template with the same name already exists in this org
        const [existingTemplate] = await db
            .select()
            .from(ruleTemplates)
            .where(and(eq(ruleTemplates.orgId, orgId), eq(ruleTemplates.name, name)))
            .limit(1);

        if (existingTemplate) {
            return next(
                createHttpError(
                    HttpCode.CONFLICT,
                    `A rule template with the name "${name}" already exists in this organization`
                )
            );
        }

        // Create the new rule template
        const [newTemplate] = await db
            .insert(ruleTemplates)
            .values({
                templateId: nanoid(),
                orgId,
                name,
                description: description || null,
                createdAt: Date.now()
            })
            .returning();

        return response(res, {
            data: newTemplate,
            success: true,
            error: false,
            message: "Rule template created successfully",
            status: HttpCode.CREATED
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
} 