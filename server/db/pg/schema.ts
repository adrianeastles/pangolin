import {
    pgTable,
    serial,
    varchar,
    boolean,
    integer,
    bigint,
    real
} from "drizzle-orm/pg-core";
import { InferSelectModel } from "drizzle-orm";

export const domains = pgTable("domains", {
    domainId: varchar("domainId").primaryKey(),
    baseDomain: varchar("baseDomain").notNull(),
    configManaged: boolean("configManaged").notNull().default(false),
    type: varchar("type"), // "ns", "cname", "wildcard"
    verified: boolean("verified").notNull().default(false),
    failed: boolean("failed").notNull().default(false),
    tries: integer("tries").notNull().default(0)
});

export const orgs = pgTable("orgs", {
    orgId: varchar("orgId").primaryKey(),
    name: varchar("name").notNull(),
    subnet: varchar("subnet")
});

export const orgDomains = pgTable("orgDomains", {
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    domainId: varchar("domainId")
        .notNull()
        .references(() => domains.domainId, { onDelete: "cascade" })
});

export const sites = pgTable("sites", {
    siteId: serial("siteId").primaryKey(),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    niceId: varchar("niceId").notNull(),
    exitNodeId: integer("exitNode").references(() => exitNodes.exitNodeId, {
        onDelete: "set null"
    }),
    name: varchar("name").notNull(),
    pubKey: varchar("pubKey"),
    subnet: varchar("subnet"),
    megabytesIn: real("bytesIn").default(0),
    megabytesOut: real("bytesOut").default(0),
    lastBandwidthUpdate: varchar("lastBandwidthUpdate"),
    type: varchar("type").notNull(), // "newt" or "wireguard"
    online: boolean("online").notNull().default(false),
    address: varchar("address"),
    endpoint: varchar("endpoint"),
    publicKey: varchar("publicKey"),
    lastHolePunch: bigint("lastHolePunch", { mode: "number" }),
    listenPort: integer("listenPort"),
    dockerSocketEnabled: boolean("dockerSocketEnabled").notNull().default(true)
});

export const resources = pgTable("resources", {
    resourceId: serial("resourceId").primaryKey(),
    siteId: integer("siteId")
        .references(() => sites.siteId, {
            onDelete: "cascade"
        })
        .notNull(),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    name: varchar("name").notNull(),
    subdomain: varchar("subdomain"),
    fullDomain: varchar("fullDomain"),
    domainId: varchar("domainId").references(() => domains.domainId, {
        onDelete: "set null"
    }),
    ssl: boolean("ssl").notNull().default(false),
    blockAccess: boolean("blockAccess").notNull().default(false),
    sso: boolean("sso").notNull().default(true),
    http: boolean("http").notNull().default(true),
    protocol: varchar("protocol").notNull(),
    proxyPort: integer("proxyPort"),
    emailWhitelistEnabled: boolean("emailWhitelistEnabled")
        .notNull()
        .default(false),
    applyRules: boolean("applyRules").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    stickySession: boolean("stickySession").notNull().default(false),
    tlsServerName: varchar("tlsServerName"),
    setHostHeader: varchar("setHostHeader")
});

export const targets = pgTable("targets", {
    targetId: serial("targetId").primaryKey(),
    resourceId: integer("resourceId")
        .references(() => resources.resourceId, {
            onDelete: "cascade"
        })
        .notNull(),
    ip: varchar("ip").notNull(),
    method: varchar("method"),
    port: integer("port").notNull(),
    internalPort: integer("internalPort"),
    enabled: boolean("enabled").notNull().default(true)
});

export const exitNodes = pgTable("exitNodes", {
    exitNodeId: serial("exitNodeId").primaryKey(),
    name: varchar("name").notNull(),
    address: varchar("address").notNull(),
    endpoint: varchar("endpoint").notNull(),
    publicKey: varchar("publicKey").notNull(),
    listenPort: integer("listenPort").notNull(),
    reachableAt: varchar("reachableAt"),
    maxConnections: integer("maxConnections")
});

export const users = pgTable("user", {
    userId: varchar("id").primaryKey(),
    email: varchar("email"),
    username: varchar("username").notNull(),
    name: varchar("name"),
    type: varchar("type").notNull(), // "internal", "oidc"
    idpId: integer("idpId").references(() => idp.idpId, {
        onDelete: "cascade"
    }),
    passwordHash: varchar("passwordHash"),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    twoFactorSetupRequested: boolean("twoFactorSetupRequested").default(false),
    twoFactorSecret: varchar("twoFactorSecret"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    dateCreated: varchar("dateCreated").notNull(),
    serverAdmin: boolean("serverAdmin").notNull().default(false)
});

export const newts = pgTable("newt", {
    newtId: varchar("id").primaryKey(),
    secretHash: varchar("secretHash").notNull(),
    dateCreated: varchar("dateCreated").notNull(),
    version: varchar("version"),
    siteId: integer("siteId").references(() => sites.siteId, {
        onDelete: "cascade"
    })
});

export const twoFactorBackupCodes = pgTable("twoFactorBackupCodes", {
    codeId: serial("id").primaryKey(),
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    codeHash: varchar("codeHash").notNull()
});

export const sessions = pgTable("session", {
    sessionId: varchar("id").primaryKey(),
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull()
});

export const newtSessions = pgTable("newtSession", {
    sessionId: varchar("id").primaryKey(),
    newtId: varchar("newtId")
        .notNull()
        .references(() => newts.newtId, { onDelete: "cascade" }),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull()
});

export const userOrgs = pgTable("userOrgs", {
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId),
    isOwner: boolean("isOwner").notNull().default(false)
});

export const emailVerificationCodes = pgTable("emailVerificationCodes", {
    codeId: serial("id").primaryKey(),
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    email: varchar("email").notNull(),
    code: varchar("code").notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull()
});

export const passwordResetTokens = pgTable("passwordResetTokens", {
    tokenId: serial("id").primaryKey(),
    email: varchar("email").notNull(),
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash").notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull()
});

export const actions = pgTable("actions", {
    actionId: varchar("actionId").primaryKey(),
    name: varchar("name"),
    description: varchar("description")
});

export const roles = pgTable("roles", {
    roleId: serial("roleId").primaryKey(),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    isAdmin: boolean("isAdmin"),
    name: varchar("name").notNull(),
    description: varchar("description")
});

export const roleActions = pgTable("roleActions", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    actionId: varchar("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" }),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" })
});

export const userActions = pgTable("userActions", {
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    actionId: varchar("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" }),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" })
});

export const roleSites = pgTable("roleSites", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" })
});

export const userSites = pgTable("userSites", {
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" })
});

export const roleResources = pgTable("roleResources", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const userResources = pgTable("userResources", {
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const userInvites = pgTable("userInvites", {
    inviteId: varchar("inviteId").primaryKey(),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    email: varchar("email").notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    tokenHash: varchar("token").notNull(),
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" })
});

export const resourcePincode = pgTable("resourcePincode", {
    pincodeId: serial("pincodeId").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    pincodeHash: varchar("pincodeHash").notNull(),
    digitLength: integer("digitLength").notNull()
});

export const resourcePassword = pgTable("resourcePassword", {
    passwordId: serial("passwordId").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    passwordHash: varchar("passwordHash").notNull()
});

export const resourceAccessToken = pgTable("resourceAccessToken", {
    accessTokenId: varchar("accessTokenId").primaryKey(),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash").notNull(),
    sessionLength: bigint("sessionLength", { mode: "number" }).notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }),
    title: varchar("title"),
    description: varchar("description"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull()
});

export const resourceSessions = pgTable("resourceSessions", {
    sessionId: varchar("id").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
    sessionLength: bigint("sessionLength", { mode: "number" }).notNull(),
    doNotExtend: boolean("doNotExtend").notNull().default(false),
    isRequestToken: boolean("isRequestToken"),
    userSessionId: varchar("userSessionId").references(
        () => sessions.sessionId,
        {
            onDelete: "cascade"
        }
    ),
    passwordId: integer("passwordId").references(
        () => resourcePassword.passwordId,
        {
            onDelete: "cascade"
        }
    ),
    pincodeId: integer("pincodeId").references(
        () => resourcePincode.pincodeId,
        {
            onDelete: "cascade"
        }
    ),
    whitelistId: integer("whitelistId").references(
        () => resourceWhitelist.whitelistId,
        {
            onDelete: "cascade"
        }
    ),
    accessTokenId: varchar("accessTokenId").references(
        () => resourceAccessToken.accessTokenId,
        {
            onDelete: "cascade"
        }
    )
});

export const resourceWhitelist = pgTable("resourceWhitelist", {
    whitelistId: serial("id").primaryKey(),
    email: varchar("email").notNull(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const resourceOtp = pgTable("resourceOtp", {
    otpId: serial("otpId").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    email: varchar("email").notNull(),
    otpHash: varchar("otpHash").notNull(),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull()
});

export const versionMigrations = pgTable("versionMigrations", {
    version: varchar("version").primaryKey(),
    executedAt: bigint("executedAt", { mode: "number" }).notNull()
});

export const resourceRules = pgTable("resourceRules", {
    ruleId: serial("ruleId").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull(),
    action: varchar("action").notNull(), // ACCEPT, DROP
    match: varchar("match").notNull(), // CIDR, PATH, IP
    value: varchar("value").notNull()
});

// Rule templates (reusable rule sets)
export const ruleTemplates = pgTable("ruleTemplates", {
    templateId: varchar("templateId").primaryKey(),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    description: varchar("description"),
    createdAt: bigint("createdAt", { mode: "number" }).notNull()
});

// Rules within templates
export const templateRules = pgTable("templateRules", {
    ruleId: serial("ruleId").primaryKey(),
    templateId: varchar("templateId")
        .notNull()
        .references(() => ruleTemplates.templateId, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull(),
    action: varchar("action").notNull(), // ACCEPT, DROP
    match: varchar("match").notNull(), // CIDR, IP, PATH
    value: varchar("value").notNull()
});

// Template assignments to resources
export const resourceTemplates = pgTable("resourceTemplates", {
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    templateId: varchar("templateId")
        .notNull()
        .references(() => ruleTemplates.templateId, { onDelete: "cascade" })
});

export const supporterKey = pgTable("supporterKey", {
    keyId: serial("keyId").primaryKey(),
    key: varchar("key").notNull(),
    githubUsername: varchar("githubUsername").notNull(),
    phrase: varchar("phrase"),
    tier: varchar("tier"),
    valid: boolean("valid").notNull().default(false)
});

export const idp = pgTable("idp", {
    idpId: serial("idpId").primaryKey(),
    name: varchar("name").notNull(),
    type: varchar("type").notNull(),
    defaultRoleMapping: varchar("defaultRoleMapping"),
    defaultOrgMapping: varchar("defaultOrgMapping"),
    autoProvision: boolean("autoProvision").notNull().default(false)
});

export const idpOidcConfig = pgTable("idpOidcConfig", {
    idpOauthConfigId: serial("idpOauthConfigId").primaryKey(),
    idpId: integer("idpId")
        .notNull()
        .references(() => idp.idpId, { onDelete: "cascade" }),
    clientId: varchar("clientId").notNull(),
    clientSecret: varchar("clientSecret").notNull(),
    authUrl: varchar("authUrl").notNull(),
    tokenUrl: varchar("tokenUrl").notNull(),
    identifierPath: varchar("identifierPath").notNull(),
    emailPath: varchar("emailPath"),
    namePath: varchar("namePath"),
    scopes: varchar("scopes").notNull()
});

export const licenseKey = pgTable("licenseKey", {
    licenseKeyId: varchar("licenseKeyId").primaryKey().notNull(),
    instanceId: varchar("instanceId").notNull(),
    token: varchar("token").notNull()
});

export const hostMeta = pgTable("hostMeta", {
    hostMetaId: varchar("hostMetaId").primaryKey().notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).notNull()
});

export const apiKeys = pgTable("apiKeys", {
    apiKeyId: varchar("apiKeyId").primaryKey(),
    name: varchar("name").notNull(),
    apiKeyHash: varchar("apiKeyHash").notNull(),
    lastChars: varchar("lastChars").notNull(),
    createdAt: varchar("dateCreated").notNull(),
    isRoot: boolean("isRoot").notNull().default(false)
});

export const apiKeyActions = pgTable("apiKeyActions", {
    apiKeyId: varchar("apiKeyId")
        .notNull()
        .references(() => apiKeys.apiKeyId, { onDelete: "cascade" }),
    actionId: varchar("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" })
});

export const apiKeyOrg = pgTable("apiKeyOrg", {
    apiKeyId: varchar("apiKeyId")
        .notNull()
        .references(() => apiKeys.apiKeyId, { onDelete: "cascade" }),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull()
});

export const idpOrg = pgTable("idpOrg", {
    idpId: integer("idpId")
        .notNull()
        .references(() => idp.idpId, { onDelete: "cascade" }),
    orgId: varchar("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    roleMapping: varchar("roleMapping"),
    orgMapping: varchar("orgMapping")
});

export const clients = pgTable("clients", {
    clientId: serial("id").primaryKey(),
    orgId: varchar("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    exitNodeId: integer("exitNode").references(() => exitNodes.exitNodeId, {
        onDelete: "set null"
    }),
    name: varchar("name").notNull(),
    pubKey: varchar("pubKey"),
    subnet: varchar("subnet").notNull(),
    megabytesIn: integer("bytesIn"),
    megabytesOut: integer("bytesOut"),
    lastBandwidthUpdate: varchar("lastBandwidthUpdate"),
    lastPing: varchar("lastPing"),
    type: varchar("type").notNull(), // "olm"
    online: boolean("online").notNull().default(false),
    endpoint: varchar("endpoint"),
    lastHolePunch: integer("lastHolePunch"),
    maxConnections: integer("maxConnections")
});

export const clientSites = pgTable("clientSites", {
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" }),
    isRelayed: boolean("isRelayed").notNull().default(false)
});

export const olms = pgTable("olms", {
    olmId: varchar("id").primaryKey(),
    secretHash: varchar("secretHash").notNull(),
    dateCreated: varchar("dateCreated").notNull(),
    clientId: integer("clientId").references(() => clients.clientId, {
        onDelete: "cascade"
    })
});

export const olmSessions = pgTable("clientSession", {
    sessionId: varchar("id").primaryKey(),
    olmId: varchar("olmId")
        .notNull()
        .references(() => olms.olmId, { onDelete: "cascade" }),
    expiresAt: integer("expiresAt").notNull()
});

export const userClients = pgTable("userClients", {
    userId: varchar("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" })
});

export const roleClients = pgTable("roleClients", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" })
});

export const securityKeys = pgTable("webauthnCredentials", {
    credentialId: varchar("credentialId").primaryKey(),
    userId: varchar("userId").notNull().references(() => users.userId, {
        onDelete: "cascade"
    }),
    publicKey: varchar("publicKey").notNull(),
    signCount: integer("signCount").notNull(),
    transports: varchar("transports"),
    name: varchar("name"),
    lastUsed: varchar("lastUsed").notNull(),
    dateCreated: varchar("dateCreated").notNull(),
    securityKeyName: varchar("securityKeyName")
});

export const webauthnChallenge = pgTable("webauthnChallenge", {
    sessionId: varchar("sessionId").primaryKey(),
    challenge: varchar("challenge").notNull(),
    securityKeyName: varchar("securityKeyName"),
    userId: varchar("userId").references(() => users.userId, {
        onDelete: "cascade"
    }),
    expiresAt: bigint("expiresAt", { mode: "number" }).notNull() // Unix timestamp
});

export type Org = InferSelectModel<typeof orgs>;
export type User = InferSelectModel<typeof users>;
export type Site = InferSelectModel<typeof sites>;
export type Resource = InferSelectModel<typeof resources>;
export type ExitNode = InferSelectModel<typeof exitNodes>;
export type Target = InferSelectModel<typeof targets>;
export type Session = InferSelectModel<typeof sessions>;
export type Newt = InferSelectModel<typeof newts>;
export type NewtSession = InferSelectModel<typeof newtSessions>;
export type EmailVerificationCode = InferSelectModel<
    typeof emailVerificationCodes
>;
export type TwoFactorBackupCode = InferSelectModel<typeof twoFactorBackupCodes>;
export type PasswordResetToken = InferSelectModel<typeof passwordResetTokens>;
export type Role = InferSelectModel<typeof roles>;
export type Action = InferSelectModel<typeof actions>;
export type RoleAction = InferSelectModel<typeof roleActions>;
export type UserAction = InferSelectModel<typeof userActions>;
export type RoleSite = InferSelectModel<typeof roleSites>;
export type UserSite = InferSelectModel<typeof userSites>;
export type RoleResource = InferSelectModel<typeof roleResources>;
export type UserResource = InferSelectModel<typeof userResources>;
export type UserInvite = InferSelectModel<typeof userInvites>;
export type UserOrg = InferSelectModel<typeof userOrgs>;
export type ResourceSession = InferSelectModel<typeof resourceSessions>;
export type ResourcePincode = InferSelectModel<typeof resourcePincode>;
export type ResourcePassword = InferSelectModel<typeof resourcePassword>;
export type ResourceOtp = InferSelectModel<typeof resourceOtp>;
export type ResourceAccessToken = InferSelectModel<typeof resourceAccessToken>;
export type ResourceWhitelist = InferSelectModel<typeof resourceWhitelist>;
export type VersionMigration = InferSelectModel<typeof versionMigrations>;
export type ResourceRule = InferSelectModel<typeof resourceRules>;
export type Domain = InferSelectModel<typeof domains>;
export type SupporterKey = InferSelectModel<typeof supporterKey>;
export type Idp = InferSelectModel<typeof idp>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type ApiKeyAction = InferSelectModel<typeof apiKeyActions>;
export type ApiKeyOrg = InferSelectModel<typeof apiKeyOrg>;
export type Client = InferSelectModel<typeof clients>;
export type ClientSite = InferSelectModel<typeof clientSites>;
export type Olm = InferSelectModel<typeof olms>;
export type OlmSession = InferSelectModel<typeof olmSessions>;
export type UserClient = InferSelectModel<typeof userClients>;
export type RoleClient = InferSelectModel<typeof roleClients>;
export type OrgDomains = InferSelectModel<typeof orgDomains>;
export type RuleTemplate = InferSelectModel<typeof ruleTemplates>;
export type TemplateRule = InferSelectModel<typeof templateRules>;
export type ResourceTemplate = InferSelectModel<typeof resourceTemplates>;
