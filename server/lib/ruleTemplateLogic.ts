import { db } from "@server/db";
import { resourceRules, templateRules, resourceTemplates } from "@server/db";
import { eq, and, gte, lte, sql, count, max, inArray } from "drizzle-orm";
import logger from "@server/logger";

export interface Rule {
    ruleId?: number;
    resourceId?: number;
    templateId?: string;
    action: "ACCEPT" | "DROP";
    match: "CIDR" | "IP" | "PATH";
    value: string;
    priority: number;
    enabled: boolean;
}

/**
 * Resolve priority conflicts when adding a new rule
 * Shifts existing rules with equal or higher priority up by 1
 */
export async function resolvePriorityConflicts(
    rules: Rule[],
    newPriority: number,
    resourceId?: number,
    templateId?: string
): Promise<Rule[]> {
    try {
        // Find rules that need to be shifted
        const rulesToShift = rules.filter(rule => rule.priority >= newPriority);
        
        if (rulesToShift.length === 0) {
            return rules;
        }

        // Update priorities in database
        if (resourceId) {
            // For resource rules
            await db
                .update(resourceRules)
                .set({
                    priority: sql`priority + 1`
                })
                .where(
                    and(
                        eq(resourceRules.resourceId, resourceId),
                        gte(resourceRules.priority, newPriority)
                    )
                );
        } else if (templateId) {
            // For template rules
            await db
                .update(templateRules)
                .set({
                    priority: sql`priority + 1`
                })
                .where(
                    and(
                        eq(templateRules.templateId, templateId),
                        gte(templateRules.priority, newPriority)
                    )
                );
        }

        // Update the local rules array
        return rules.map(rule => {
            if (rule.priority >= newPriority) {
                return { ...rule, priority: rule.priority + 1 };
            }
            return rule;
        });
    } catch (error) {
        logger.error("Error resolving priority conflicts:", error);
        throw error;
    }
}

/**
 * Reorder priorities after deleting a rule
 * Shifts down rules with higher priority by 1
 */
export async function reorderPriorities(
    rules: Rule[],
    deletedPriority: number,
    resourceId?: number,
    templateId?: string
): Promise<Rule[]> {
    try {
        // Find rules that need to be shifted down
        const rulesToShift = rules.filter(rule => rule.priority > deletedPriority);
        
        if (rulesToShift.length === 0) {
            return rules;
        }

        // Update priorities in database
        if (resourceId) {
            // For resource rules
            await db
                .update(resourceRules)
                .set({
                    priority: sql`priority - 1`
                })
                .where(
                    and(
                        eq(resourceRules.resourceId, resourceId),
                        gte(resourceRules.priority, deletedPriority + 1)
                    )
                );
        } else if (templateId) {
            // For template rules
            await db
                .update(templateRules)
                .set({
                    priority: sql`priority - 1`
                })
                .where(
                    and(
                        eq(templateRules.templateId, templateId),
                        gte(templateRules.priority, deletedPriority + 1)
                    )
                );
        }

        // Update the local rules array
        return rules.map(rule => {
            if (rule.priority > deletedPriority) {
                return { ...rule, priority: rule.priority - 1 };
            }
            return rule;
        });
    } catch (error) {
        logger.error("Error reordering priorities:", error);
        throw error;
    }
}

/**
 * Get the next available priority for a new rule
 */
export async function getNextPriority(
    resourceId?: number,
    templateId?: string
): Promise<number> {
    try {
        let maxPriority = 0;

        if (resourceId) {
            // For resource rules
            const result = await db
                .select({ maxPriority: max(resourceRules.priority) })
                .from(resourceRules)
                .where(eq(resourceRules.resourceId, resourceId));
            
            maxPriority = Number(result[0]?.maxPriority || 0);
        } else if (templateId) {
            // For template rules
            const result = await db
                .select({ maxPriority: max(templateRules.priority) })
                .from(templateRules)
                .where(eq(templateRules.templateId, templateId));
            
            maxPriority = Number(result[0]?.maxPriority || 0);
        }

        return maxPriority + 1;
    } catch (error) {
        logger.error("Error getting next priority:", error);
        throw error;
    }
}

/**
 * Propagate template changes to all assigned resources
 * This function preserves manual rules and only updates template rules
 */
export async function propagateTemplateToResources(templateId: string): Promise<void> {
    try {
        // Get all resources assigned to this template
        const assignedResources = await db
            .select({ resourceId: resourceTemplates.resourceId })
            .from(resourceTemplates)
            .where(eq(resourceTemplates.templateId, templateId));

        // Get all rules from the template
        const templateRulesList = await db
            .select()
            .from(templateRules)
            .where(eq(templateRules.templateId, templateId))
            .orderBy(templateRules.priority);

        // Update each assigned resource
        for (const { resourceId } of assignedResources) {
            await updateResourceWithTemplateRules(resourceId, templateId, templateRulesList);
        }

        logger.info(`Propagated template ${templateId} to ${assignedResources.length} resources`);
    } catch (error) {
        logger.error("Error propagating template to resources:", error);
        throw error;
    }
}

/**
 * Update a specific resource with template rules while preserving manual rules
 * This function uses a sophisticated approach to identify and update template rules
 */
async function updateResourceWithTemplateRules(
    resourceId: number, 
    templateId: string, 
    templateRulesList: any[]
): Promise<void> {
    try {
        // Get all existing resource rules
        const existingRules = await db
            .select()
            .from(resourceRules)
            .where(eq(resourceRules.resourceId, resourceId))
            .orderBy(resourceRules.priority);

        if (existingRules.length === 0) {
            // No existing rules, just insert template rules
            if (templateRulesList.length > 0) {
                const newRules = templateRulesList.map((templateRule, index) => ({
                    resourceId,
                    action: templateRule.action,
                    match: templateRule.match,
                    value: templateRule.value,
                    priority: index + 1, // Start from priority 1
                    enabled: templateRule.enabled
                }));

                await db
                    .insert(resourceRules)
                    .values(newRules);
            }
            return;
        }

        // Get all templates assigned to this resource
        const assignedTemplates = await db
            .select()
            .from(resourceTemplates)
            .where(eq(resourceTemplates.resourceId, resourceId))
            .orderBy(resourceTemplates.templateId);

        // If this is the only template assigned, we can be more aggressive
        if (assignedTemplates.length === 1) {
            // Single template: replace all rules with template rules
            await db
                .delete(resourceRules)
                .where(eq(resourceRules.resourceId, resourceId));

            if (templateRulesList.length > 0) {
                const newRules = templateRulesList.map((templateRule, index) => ({
                    resourceId,
                    action: templateRule.action,
                    match: templateRule.match,
                    value: templateRule.value,
                    priority: index + 1,
                    enabled: templateRule.enabled
                }));

                await db
                    .insert(resourceRules)
                    .values(newRules);
            }
            return;
        }

        // Multiple templates: use sophisticated matching
        const templateRulesToUpdate = await identifyTemplateRulesInResource(
            resourceId, 
            templateId, 
            existingRules, 
            templateRulesList
        );

        logger.info(`Resource ${resourceId}: Found ${templateRulesToUpdate.length} template rules to update out of ${existingRules.length} total rules`);

        // Safety check: Only proceed if we found template rules to update
        if (templateRulesToUpdate.length === 0) {
            logger.info(`Resource ${resourceId}: No template rules found to update, appending new template rules only`);
        } else {
            // Remove the identified template rules
            const ruleIdsToRemove = templateRulesToUpdate.map(r => r.ruleId);
            await db
                .delete(resourceRules)
                .where(
                    and(
                        eq(resourceRules.resourceId, resourceId),
                        inArray(resourceRules.ruleId, ruleIdsToRemove)
                    )
                );
            
            logger.info(`Resource ${resourceId}: Removed ${ruleIdsToRemove.length} template rules`);
        }

        // Insert new template rules at the end
        if (templateRulesList.length > 0) {
            // Get the current max priority after removing template rules
            const remainingRules = existingRules.filter(rule => 
                !templateRulesToUpdate.some(templateRule => templateRule.ruleId === rule.ruleId)
            );
            const maxPriority = remainingRules.length > 0 ? Math.max(...remainingRules.map(r => r.priority)) : 0;
            
            const newRules = templateRulesList.map((templateRule, index) => ({
                resourceId,
                action: templateRule.action,
                match: templateRule.match,
                value: templateRule.value,
                priority: maxPriority + index + 1,
                enabled: templateRule.enabled
            }));

            await db
                .insert(resourceRules)
                .values(newRules);
        }

        // Reorder priorities to be continuous
        await reorderResourceRules(resourceId);

    } catch (error) {
        logger.error(`Error updating resource ${resourceId} with template ${templateId} rules:`, error);
        throw error;
    }
}

/**
 * Identify which existing rules likely belong to a specific template
 * This uses pattern matching and heuristics to identify template rules
 */
async function identifyTemplateRulesInResource(
    resourceId: number,
    templateId: string,
    existingRules: any[],
    templateRulesList: any[]
): Promise<any[]> {
    try {
        // Get all templates assigned to this resource
        const assignedTemplates = await db
            .select()
            .from(resourceTemplates)
            .where(eq(resourceTemplates.resourceId, resourceId))
            .orderBy(resourceTemplates.templateId);

        // Conservative approach: Only find exact matches by value
        // This prevents accidentally identifying manual rules as template rules
        const exactMatches: any[] = [];
        const remainingTemplateRules = [...templateRulesList];
        
        logger.info(`Resource ${resourceId}: Checking ${existingRules.length} existing rules against ${templateRulesList.length} template rules`);
        
        for (const existingRule of existingRules) {
            const matchIndex = remainingTemplateRules.findIndex(templateRule => 
                templateRule.action === existingRule.action &&
                templateRule.match === existingRule.match &&
                templateRule.value === existingRule.value
            );
            
            if (matchIndex !== -1) {
                exactMatches.push(existingRule);
                remainingTemplateRules.splice(matchIndex, 1);
                logger.info(`Resource ${resourceId}: Found exact match for rule ${existingRule.ruleId} (${existingRule.action} ${existingRule.match} ${existingRule.value})`);
            } else {
                logger.info(`Resource ${resourceId}: No match for rule ${existingRule.ruleId} (${existingRule.action} ${existingRule.match} ${existingRule.value}) - keeping as manual rule`);
            }
        }

        // Only return exact matches - no structural matching to avoid false positives
        if (exactMatches.length > 0) {
            logger.info(`Resource ${resourceId}: Found ${exactMatches.length} exact matches out of ${templateRulesList.length} template rules`);
        } else {
            logger.info(`Resource ${resourceId}: No exact matches found, will append new template rules`);
        }

        return exactMatches;
    } catch (error) {
        logger.error(`Error identifying template rules for resource ${resourceId}:`, error);
        return [];
    }
}

/**
 * Reorder resource rules to ensure continuous priority numbering
 */
async function reorderResourceRules(resourceId: number): Promise<void> {
    try {
        const rules = await db
            .select()
            .from(resourceRules)
            .where(eq(resourceRules.resourceId, resourceId))
            .orderBy(resourceRules.priority);

        // Update priorities to be continuous starting from 1
        for (let i = 0; i < rules.length; i++) {
            const newPriority = i + 1;
            if (rules[i].priority !== newPriority) {
                await db
                    .update(resourceRules)
                    .set({ priority: newPriority })
                    .where(eq(resourceRules.ruleId, rules[i].ruleId));
            }
        }
    } catch (error) {
        logger.error(`Error reordering rules for resource ${resourceId}:`, error);
        throw error;
    }
}

/**
 * Evaluate rules in priority order and return the first matching rule
 */
export function evaluateRules(rules: Rule[], request: {
    ip?: string;
    path?: string;
}): Rule | null {
    // Sort rules by priority (ascending)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
        if (!rule.enabled) {
            continue;
        }

        let matches = false;

        switch (rule.match) {
            case "IP":
                if (request.ip && rule.value === request.ip) {
                    matches = true;
                }
                break;
            case "CIDR":
                if (request.ip && isIPInCIDR(request.ip, rule.value)) {
                    matches = true;
                }
                break;
            case "PATH":
                if (request.path && matchesPathPattern(request.path, rule.value)) {
                    matches = true;
                }
                break;
        }

        if (matches) {
            return rule;
        }
    }

    return null;
}

/**
 * Check if an IP address is within a CIDR range
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
    try {
        const [network, bits] = cidr.split('/');
        const mask = parseInt(bits);
        
        if (isNaN(mask) || mask < 0 || mask > 32) {
            return false;
        }

        const networkNum = ipToNumber(network);
        const ipNum = ipToNumber(ip);
        const maskNum = (0xFFFFFFFF << (32 - mask)) >>> 0;

        return (networkNum & maskNum) === (ipNum & maskNum);
    } catch (error) {
        return false;
    }
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Check if a path matches a glob pattern
 */
export function matchesPathPattern(path: string, pattern: string): boolean {
    // Simple glob pattern matching
    // Supports * for any sequence of characters
    // Supports ? for any single character
    
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
        .replace(/\*/g, '.*') // Convert * to .*
        .replace(/\?/g, '.'); // Convert ? to .
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
}

/**
 * Validate rule consistency and detect conflicts
 */
export function validateRuleConsistency(rules: Rule[]): {
    isValid: boolean;
    conflicts: string[];
} {
    const conflicts: string[] = [];
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    // Check for duplicate priorities
    const priorities = sortedRules.map(r => r.priority);
    const uniquePriorities = new Set(priorities);
    if (priorities.length !== uniquePriorities.size) {
        conflicts.push("Duplicate priorities found");
    }

    // Check for conflicting rules (same match type and value but different actions)
    const ruleMap = new Map<string, Rule>();
    for (const rule of sortedRules) {
        const key = `${rule.match}:${rule.value}`;
        if (ruleMap.has(key)) {
            const existingRule = ruleMap.get(key)!;
            if (existingRule.action !== rule.action) {
                conflicts.push(`Conflicting rules for ${rule.match}:${rule.value} - ${existingRule.action} vs ${rule.action}`);
            }
        } else {
            ruleMap.set(key, rule);
        }
    }

    return {
        isValid: conflicts.length === 0,
        conflicts
    };
} 