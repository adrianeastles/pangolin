import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../db/pg";
import semver from "semver";
import { versionMigrations } from "../db/pg";
import { __DIRNAME, APP_VERSION } from "@server/lib/consts";
import path from "path";
import m1 from "./scriptsPg/1.6.0";
import m2 from "./scriptsPg/1.7.0";
import m3 from "./scriptsPg/1.8.0";

// THIS CANNOT IMPORT ANYTHING FROM THE SERVER
// EXCEPT FOR THE DATABASE AND THE SCHEMA

// Define the migration list with versions and their corresponding functions
const migrations = [
    { version: "1.6.0", run: m1 },
    { version: "1.7.0", run: m2 },
    { version: "1.8.0", run: m3 }
    // Add new migrations here as they are created
] as {
    version: string;
    run: () => Promise<void>;
}[];

await run();

async function run() {
    // run the migrations
    await runMigrations();
}

export async function runMigrations() {
    if (process.env.DISABLE_MIGRATIONS) {
        console.log("Migrations are disabled. Skipping...");
        return;
    }
    try {
        const appVersion = APP_VERSION;

        // determine if the migrations table exists
        const exists = await db
            .select()
            .from(versionMigrations)
            .limit(1)
            .execute()
            .then((res) => res.length > 0)
            .catch(() => false);

        if (exists) {
            console.log("Migrations table exists, running scripts...");
            await executeScripts();
        } else {
            console.log("Migrations table does not exist, creating it...");
            console.log("Running migrations...");
            try {
                await migrate(db, {
                    migrationsFolder: path.join(__DIRNAME, "init") // put here during the docker build
                });
                console.log("Migrations completed successfully.");
            } catch (error) {
                console.error("Error running migrations:", error);
            }

            await db
                .insert(versionMigrations)
                .values({
                    version: appVersion,
                    executedAt: Date.now()
                })
                .execute();
        }
    } catch (e) {
        console.error("Error running migrations:", e);
        await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 60 * 60 * 24 * 1)
        );
    }
}

async function executeScripts() {
    try {
        // Get the last executed version from the database
        const lastExecuted = await db.select().from(versionMigrations);

        // Filter and sort migrations
        const pendingMigrations = lastExecuted
            .map((m) => m)
            .sort((a, b) => semver.compare(b.version, a.version));
        const startVersion = pendingMigrations[0]?.version ?? "0.0.0";
        console.log(`Starting migrations from version ${startVersion}`);

        const migrationsToRun = migrations.filter((migration) =>
            semver.gt(migration.version, startVersion)
        );

        console.log(
            "Migrations to run:",
            migrationsToRun.map((m) => m.version).join(", ")
        );

        // Run migrations in order
        for (const migration of migrationsToRun) {
            console.log(`Running migration ${migration.version}`);

            try {
                await migration.run();

                // Update version in database
                await db
                    .insert(versionMigrations)
                    .values({
                        version: migration.version,
                        executedAt: Date.now()
                    })
                    .execute();

                console.log(
                    `Successfully completed migration ${migration.version}`
                );
            } catch (e) {
                if (
                    e instanceof Error &&
                    typeof (e as any).code === "string" &&
                    (e as any).code === "23505"
                ) {
                    console.error("Migration has already run! Skipping...");
                    continue; // or return, depending on context
                }

                console.error(
                    `Failed to run migration ${migration.version}:`,
                    e
                );
                throw e;
            }
        }

        console.log("All migrations completed successfully");
    } catch (error) {
        console.error("Migration process failed:", error);
        throw error;
    }
}
