import { APP_PATH } from "@server/lib/consts";
import Database from "better-sqlite3";
import path from "path";

const version = "1.8.0";

export default async function migration() {
    console.log(`Running setup script ${version}...`);

    const location = path.join(APP_PATH, "db", "db.sqlite");
    const db = new Database(location);

    try {
        db.pragma("foreign_keys = OFF");

        db.transaction(() => {
            db.exec(`
                -- Rule templates (reusable rule sets)
                CREATE TABLE 'ruleTemplates' (
                    'templateId' text PRIMARY KEY NOT NULL,
                    'orgId' text NOT NULL,
                    'name' text NOT NULL,
                    'description' text,
                    'createdAt' integer NOT NULL,
                    FOREIGN KEY ('orgId') REFERENCES 'orgs'('orgId') ON UPDATE no action ON DELETE cascade
                );

                -- Rules within templates
                CREATE TABLE 'templateRules' (
                    'ruleId' integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                    'templateId' text NOT NULL,
                    'enabled' integer DEFAULT 1 NOT NULL,
                    'priority' integer NOT NULL,
                    'action' text NOT NULL,
                    'match' text NOT NULL,
                    'value' text NOT NULL,
                    FOREIGN KEY ('templateId') REFERENCES 'ruleTemplates'('templateId') ON UPDATE no action ON DELETE cascade
                );

                -- Template assignments to resources
                CREATE TABLE 'resourceTemplates' (
                    'resourceId' integer NOT NULL,
                    'templateId' text NOT NULL,
                    FOREIGN KEY ('resourceId') REFERENCES 'resources'('resourceId') ON UPDATE no action ON DELETE cascade,
                    FOREIGN KEY ('templateId') REFERENCES 'ruleTemplates'('templateId') ON UPDATE no action ON DELETE cascade
                );
            `);
        })();

        db.pragma("foreign_keys = ON");

        console.log(`Migrated database schema for rule templates`);
    } catch (e) {
        console.log("Unable to migrate database schema for rule templates");
        throw e;
    }

    console.log(`${version} migration complete`);
} 