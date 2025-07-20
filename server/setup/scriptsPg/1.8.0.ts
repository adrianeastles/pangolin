import { db } from "@server/db/pg/driver";
import { sql } from "drizzle-orm";

const version = "1.8.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    try {
        await db.execute(sql`
            BEGIN;
            
            -- Rule templates (reusable rule sets)
            CREATE TABLE "ruleTemplates" (
                "templateId" varchar PRIMARY KEY NOT NULL,
                "orgId" varchar NOT NULL,
                "name" varchar NOT NULL,
                "description" varchar,
                "createdAt" bigint NOT NULL
            );
            
            -- Rules within templates
            CREATE TABLE "templateRules" (
                "ruleId" serial PRIMARY KEY NOT NULL,
                "templateId" varchar NOT NULL,
                "enabled" boolean DEFAULT true NOT NULL,
                "priority" integer NOT NULL,
                "action" varchar NOT NULL,
                "match" varchar NOT NULL,
                "value" varchar NOT NULL
            );
            
            -- Template assignments to resources
            CREATE TABLE "resourceTemplates" (
                "resourceId" integer NOT NULL,
                "templateId" varchar NOT NULL
            );
            
            -- Add foreign key constraints
            ALTER TABLE "ruleTemplates" ADD CONSTRAINT "ruleTemplates_orgId_orgs_orgId_fk" FOREIGN KEY ("orgId") REFERENCES "public"."orgs"("orgId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "templateRules" ADD CONSTRAINT "templateRules_templateId_ruleTemplates_templateId_fk" FOREIGN KEY ("templateId") REFERENCES "public"."ruleTemplates"("templateId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "resourceTemplates" ADD CONSTRAINT "resourceTemplates_resourceId_resources_resourceId_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resources"("resourceId") ON DELETE cascade ON UPDATE no action;
            ALTER TABLE "resourceTemplates" ADD CONSTRAINT "resourceTemplates_templateId_ruleTemplates_templateId_fk" FOREIGN KEY ("templateId") REFERENCES "public"."ruleTemplates"("templateId") ON DELETE cascade ON UPDATE no action;
            
            COMMIT;
        `);
        
        console.log(`Migrated database schema for rule templates`);
    } catch (e) {
        console.log("Unable to migrate database schema for rule templates");
        throw e;
    }

    console.log(`${version} migration complete`);
} 