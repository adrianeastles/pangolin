import { InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable("domains", {
    domainId: text("domainId").primaryKey(),
    baseDomain: text("baseDomain").notNull(),
    configManaged: integer("configManaged", { mode: "boolean" })
        .notNull()
        .default(false),
    type: text("type"), // "ns", "cname", "wildcard"
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    failed: integer("failed", { mode: "boolean" }).notNull().default(false),
    tries: integer("tries").notNull().default(0)
});

export const orgs = sqliteTable("orgs", {
    orgId: text("orgId").primaryKey(),
    name: text("name").notNull(),
    subnet: text("subnet")
});

export const userDomains = sqliteTable("userDomains", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    domainId: text("domainId")
        .notNull()
        .references(() => domains.domainId, { onDelete: "cascade" })
});

export const orgDomains = sqliteTable("orgDomains", {
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    domainId: text("domainId")
        .notNull()
        .references(() => domains.domainId, { onDelete: "cascade" })
});

export const sites = sqliteTable("sites", {
    siteId: integer("siteId").primaryKey({ autoIncrement: true }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    niceId: text("niceId").notNull(),
    exitNodeId: integer("exitNode").references(() => exitNodes.exitNodeId, {
        onDelete: "set null"
    }),
    name: text("name").notNull(),
    pubKey: text("pubKey"),
    subnet: text("subnet"),
    megabytesIn: integer("bytesIn").default(0),
    megabytesOut: integer("bytesOut").default(0),
    lastBandwidthUpdate: text("lastBandwidthUpdate"),
    type: text("type").notNull(), // "newt" or "wireguard"
    online: integer("online", { mode: "boolean" }).notNull().default(false),

    // exit node stuff that is how to connect to the site when it has a wg server
    address: text("address"), // this is the address of the wireguard interface in newt
    endpoint: text("endpoint"), // this is how to reach gerbil externally - gets put into the wireguard config
    publicKey: text("publicKey"), // TODO: Fix typo in publicKey
    lastHolePunch: integer("lastHolePunch"),
    listenPort: integer("listenPort"),
    dockerSocketEnabled: integer("dockerSocketEnabled", { mode: "boolean" })
        .notNull()
        .default(true)
});

export const resources = sqliteTable("resources", {
    resourceId: integer("resourceId").primaryKey({ autoIncrement: true }),
    siteId: integer("siteId")
        .references(() => sites.siteId, {
            onDelete: "cascade"
        })
        .notNull(),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    name: text("name").notNull(),
    subdomain: text("subdomain"),
    fullDomain: text("fullDomain"),
    domainId: text("domainId").references(() => domains.domainId, {
        onDelete: "set null"
    }),
    ssl: integer("ssl", { mode: "boolean" }).notNull().default(false),
    blockAccess: integer("blockAccess", { mode: "boolean" })
        .notNull()
        .default(false),
    sso: integer("sso", { mode: "boolean" }).notNull().default(true),
    http: integer("http", { mode: "boolean" }).notNull().default(true),
    protocol: text("protocol").notNull(),
    proxyPort: integer("proxyPort"),
    emailWhitelistEnabled: integer("emailWhitelistEnabled", { mode: "boolean" })
        .notNull()
        .default(false),
    applyRules: integer("applyRules", { mode: "boolean" })
        .notNull()
        .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    stickySession: integer("stickySession", { mode: "boolean" })
        .notNull()
        .default(false),
    tlsServerName: text("tlsServerName"),
    setHostHeader: text("setHostHeader")
});

export const targets = sqliteTable("targets", {
    targetId: integer("targetId").primaryKey({ autoIncrement: true }),
    resourceId: integer("resourceId")
        .references(() => resources.resourceId, {
            onDelete: "cascade"
        })
        .notNull(),
    ip: text("ip").notNull(),
    method: text("method"),
    port: integer("port").notNull(),
    internalPort: integer("internalPort"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true)
});

export const exitNodes = sqliteTable("exitNodes", {
    exitNodeId: integer("exitNodeId").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    address: text("address").notNull(), // this is the address of the wireguard interface in gerbil
    endpoint: text("endpoint").notNull(), // this is how to reach gerbil externally - gets put into the wireguard config
    publicKey: text("publicKey").notNull(),
    listenPort: integer("listenPort").notNull(),
    reachableAt: text("reachableAt"), // this is the internal address of the gerbil http server for command control
    maxConnections: integer("maxConnections")
});

export const users = sqliteTable("user", {
    userId: text("id").primaryKey(),
    email: text("email"),
    username: text("username").notNull(),
    name: text("name"),
    type: text("type").notNull(), // "internal", "oidc"
    idpId: integer("idpId").references(() => idp.idpId, {
        onDelete: "cascade"
    }),
    passwordHash: text("passwordHash"),
    twoFactorEnabled: integer("twoFactorEnabled", { mode: "boolean" })
        .notNull()
        .default(false),
    twoFactorSetupRequested: integer("twoFactorSetupRequested", {
        mode: "boolean"
    }).default(false),
    twoFactorSecret: text("twoFactorSecret"),
    emailVerified: integer("emailVerified", { mode: "boolean" })
        .notNull()
        .default(false),
    dateCreated: text("dateCreated").notNull(),
    serverAdmin: integer("serverAdmin", { mode: "boolean" })
        .notNull()
        .default(false)
});

export const securityKeys = sqliteTable("webauthnCredentials", {
    credentialId: text("credentialId").primaryKey(),
    userId: text("userId").notNull().references(() => users.userId, {
        onDelete: "cascade"
    }),
    publicKey: text("publicKey").notNull(),
    signCount: integer("signCount").notNull(),
    transports: text("transports"),
    name: text("name"),
    lastUsed: text("lastUsed").notNull(),
    dateCreated: text("dateCreated").notNull()
});

export const webauthnChallenge = sqliteTable("webauthnChallenge", {
    sessionId: text("sessionId").primaryKey(),
    challenge: text("challenge").notNull(),
    securityKeyName: text("securityKeyName"),
    userId: text("userId").references(() => users.userId, {
        onDelete: "cascade"
    }),
    expiresAt: integer("expiresAt").notNull() // Unix timestamp
});

export const newts = sqliteTable("newt", {
    newtId: text("id").primaryKey(),
    secretHash: text("secretHash").notNull(),
    dateCreated: text("dateCreated").notNull(),
    version: text("version"),
    siteId: integer("siteId").references(() => sites.siteId, {
        onDelete: "cascade"
    })
});

export const clients = sqliteTable("clients", {
    clientId: integer("id").primaryKey({ autoIncrement: true }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    exitNodeId: integer("exitNode").references(() => exitNodes.exitNodeId, {
        onDelete: "set null"
    }),
    name: text("name").notNull(),
    pubKey: text("pubKey"),
    subnet: text("subnet").notNull(),
    megabytesIn: integer("bytesIn"),
    megabytesOut: integer("bytesOut"),
    lastBandwidthUpdate: text("lastBandwidthUpdate"),
    lastPing: text("lastPing"),
    type: text("type").notNull(), // "olm"
    online: integer("online", { mode: "boolean" }).notNull().default(false),
    endpoint: text("endpoint"),
    lastHolePunch: integer("lastHolePunch")
});

export const clientSites = sqliteTable("clientSites", {
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" }),
    isRelayed: integer("isRelayed", { mode: "boolean" }).notNull().default(false)
});

export const olms = sqliteTable("olms", {
    olmId: text("id").primaryKey(),
    secretHash: text("secretHash").notNull(),
    dateCreated: text("dateCreated").notNull(),
    clientId: integer("clientId").references(() => clients.clientId, {
        onDelete: "cascade"
    })
});

export const twoFactorBackupCodes = sqliteTable("twoFactorBackupCodes", {
    codeId: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    codeHash: text("codeHash").notNull()
});

export const sessions = sqliteTable("session", {
    sessionId: text("id").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    expiresAt: integer("expiresAt").notNull()
});

export const newtSessions = sqliteTable("newtSession", {
    sessionId: text("id").primaryKey(),
    newtId: text("newtId")
        .notNull()
        .references(() => newts.newtId, { onDelete: "cascade" }),
    expiresAt: integer("expiresAt").notNull()
});

export const olmSessions = sqliteTable("clientSession", {
    sessionId: text("id").primaryKey(),
    olmId: text("olmId")
        .notNull()
        .references(() => olms.olmId, { onDelete: "cascade" }),
    expiresAt: integer("expiresAt").notNull()
});

export const userOrgs = sqliteTable("userOrgs", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId),
    isOwner: integer("isOwner", { mode: "boolean" }).notNull().default(false)
});

export const emailVerificationCodes = sqliteTable("emailVerificationCodes", {
    codeId: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: integer("expiresAt").notNull()
});

export const passwordResetTokens = sqliteTable("passwordResetTokens", {
    tokenId: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: integer("expiresAt").notNull()
});

export const actions = sqliteTable("actions", {
    actionId: text("actionId").primaryKey(),
    name: text("name"),
    description: text("description")
});

export const roles = sqliteTable("roles", {
    roleId: integer("roleId").primaryKey({ autoIncrement: true }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    isAdmin: integer("isAdmin", { mode: "boolean" }),
    name: text("name").notNull(),
    description: text("description")
});

export const roleActions = sqliteTable("roleActions", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    actionId: text("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" }),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" })
});

export const userActions = sqliteTable("userActions", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    actionId: text("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" }),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" })
});

export const roleSites = sqliteTable("roleSites", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" })
});

export const userSites = sqliteTable("userSites", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    siteId: integer("siteId")
        .notNull()
        .references(() => sites.siteId, { onDelete: "cascade" })
});

export const userClients = sqliteTable("userClients", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" })
});

export const roleClients = sqliteTable("roleClients", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    clientId: integer("clientId")
        .notNull()
        .references(() => clients.clientId, { onDelete: "cascade" })
});

export const roleResources = sqliteTable("roleResources", {
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const userResources = sqliteTable("userResources", {
    userId: text("userId")
        .notNull()
        .references(() => users.userId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const limitsTable = sqliteTable("limits", {
    limitId: integer("limitId").primaryKey({ autoIncrement: true }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull(),
    name: text("name").notNull(),
    value: integer("value").notNull(),
    description: text("description")
});

export const userInvites = sqliteTable("userInvites", {
    inviteId: text("inviteId").primaryKey(),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    email: text("email").notNull(),
    expiresAt: integer("expiresAt").notNull(),
    tokenHash: text("token").notNull(),
    roleId: integer("roleId")
        .notNull()
        .references(() => roles.roleId, { onDelete: "cascade" })
});

export const resourcePincode = sqliteTable("resourcePincode", {
    pincodeId: integer("pincodeId").primaryKey({
        autoIncrement: true
    }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    pincodeHash: text("pincodeHash").notNull(),
    digitLength: integer("digitLength").notNull()
});

export const resourcePassword = sqliteTable("resourcePassword", {
    passwordId: integer("passwordId").primaryKey({
        autoIncrement: true
    }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    passwordHash: text("passwordHash").notNull()
});

export const resourceAccessToken = sqliteTable("resourceAccessToken", {
    accessTokenId: text("accessTokenId").primaryKey(),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    sessionLength: integer("sessionLength").notNull(),
    expiresAt: integer("expiresAt"),
    title: text("title"),
    description: text("description"),
    createdAt: integer("createdAt").notNull()
});

export const resourceSessions = sqliteTable("resourceSessions", {
    sessionId: text("id").primaryKey(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    expiresAt: integer("expiresAt").notNull(),
    sessionLength: integer("sessionLength").notNull(),
    doNotExtend: integer("doNotExtend", { mode: "boolean" })
        .notNull()
        .default(false),
    isRequestToken: integer("isRequestToken", { mode: "boolean" }),
    userSessionId: text("userSessionId").references(() => sessions.sessionId, {
        onDelete: "cascade"
    }),
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
    accessTokenId: text("accessTokenId").references(
        () => resourceAccessToken.accessTokenId,
        {
            onDelete: "cascade"
        }
    )
});

export const resourceWhitelist = sqliteTable("resourceWhitelist", {
    whitelistId: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" })
});

export const resourceOtp = sqliteTable("resourceOtp", {
    otpId: integer("otpId").primaryKey({
        autoIncrement: true
    }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    email: text("email").notNull(),
    otpHash: text("otpHash").notNull(),
    expiresAt: integer("expiresAt").notNull()
});

export const versionMigrations = sqliteTable("versionMigrations", {
    version: text("version").primaryKey(),
    executedAt: integer("executedAt").notNull()
});

export const resourceRules = sqliteTable("resourceRules", {
    ruleId: integer("ruleId").primaryKey({ autoIncrement: true }),
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority").notNull(),
    action: text("action").notNull(), // ACCEPT, DROP
    match: text("match").notNull(), // CIDR, PATH, IP
    value: text("value").notNull()
});

// Rule templates (reusable rule sets)
export const ruleTemplates = sqliteTable("ruleTemplates", {
    templateId: text("templateId").primaryKey(),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("createdAt").notNull()
});

// Rules within templates
export const templateRules = sqliteTable("templateRules", {
    ruleId: integer("ruleId").primaryKey({ autoIncrement: true }),
    templateId: text("templateId")
        .notNull()
        .references(() => ruleTemplates.templateId, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    priority: integer("priority").notNull(),
    action: text("action").notNull(), // ACCEPT, DROP
    match: text("match").notNull(), // CIDR, IP, PATH
    value: text("value").notNull()
});

// Template assignments to resources
export const resourceTemplates = sqliteTable("resourceTemplates", {
    resourceId: integer("resourceId")
        .notNull()
        .references(() => resources.resourceId, { onDelete: "cascade" }),
    templateId: text("templateId")
        .notNull()
        .references(() => ruleTemplates.templateId, { onDelete: "cascade" })
});

export const supporterKey = sqliteTable("supporterKey", {
    keyId: integer("keyId").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    githubUsername: text("githubUsername").notNull(),
    phrase: text("phrase"),
    tier: text("tier"),
    valid: integer("valid", { mode: "boolean" }).notNull().default(false)
});

// Identity Providers
export const idp = sqliteTable("idp", {
    idpId: integer("idpId").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    defaultRoleMapping: text("defaultRoleMapping"),
    defaultOrgMapping: text("defaultOrgMapping"),
    autoProvision: integer("autoProvision", {
        mode: "boolean"
    })
        .notNull()
        .default(false)
});

// Identity Provider OAuth Configuration
export const idpOidcConfig = sqliteTable("idpOidcConfig", {
    idpOauthConfigId: integer("idpOauthConfigId").primaryKey({
        autoIncrement: true
    }),
    idpId: integer("idpId")
        .notNull()
        .references(() => idp.idpId, { onDelete: "cascade" }),
    clientId: text("clientId").notNull(),
    clientSecret: text("clientSecret").notNull(),
    authUrl: text("authUrl").notNull(),
    tokenUrl: text("tokenUrl").notNull(),
    identifierPath: text("identifierPath").notNull(),
    emailPath: text("emailPath"),
    namePath: text("namePath"),
    scopes: text("scopes").notNull()
});

export const licenseKey = sqliteTable("licenseKey", {
    licenseKeyId: text("licenseKeyId").primaryKey().notNull(),
    instanceId: text("instanceId").notNull(),
    token: text("token").notNull()
});

export const hostMeta = sqliteTable("hostMeta", {
    hostMetaId: text("hostMetaId").primaryKey().notNull(),
    createdAt: integer("createdAt").notNull()
});

export const apiKeys = sqliteTable("apiKeys", {
    apiKeyId: text("apiKeyId").primaryKey(),
    name: text("name").notNull(),
    apiKeyHash: text("apiKeyHash").notNull(),
    lastChars: text("lastChars").notNull(),
    createdAt: text("dateCreated").notNull(),
    isRoot: integer("isRoot", { mode: "boolean" }).notNull().default(false)
});

export const apiKeyActions = sqliteTable("apiKeyActions", {
    apiKeyId: text("apiKeyId")
        .notNull()
        .references(() => apiKeys.apiKeyId, { onDelete: "cascade" }),
    actionId: text("actionId")
        .notNull()
        .references(() => actions.actionId, { onDelete: "cascade" })
});

export const apiKeyOrg = sqliteTable("apiKeyOrg", {
    apiKeyId: text("apiKeyId")
        .notNull()
        .references(() => apiKeys.apiKeyId, { onDelete: "cascade" }),
    orgId: text("orgId")
        .references(() => orgs.orgId, {
            onDelete: "cascade"
        })
        .notNull()
});

export const idpOrg = sqliteTable("idpOrg", {
    idpId: integer("idpId")
        .notNull()
        .references(() => idp.idpId, { onDelete: "cascade" }),
    orgId: text("orgId")
        .notNull()
        .references(() => orgs.orgId, { onDelete: "cascade" }),
    roleMapping: text("roleMapping"),
    orgMapping: text("orgMapping")
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
export type Olm = InferSelectModel<typeof olms>;
export type OlmSession = InferSelectModel<typeof olmSessions>;
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
export type Limit = InferSelectModel<typeof limitsTable>;
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
export type Client = InferSelectModel<typeof clients>;
export type ClientSite = InferSelectModel<typeof clientSites>;
export type RoleClient = InferSelectModel<typeof roleClients>;
export type UserClient = InferSelectModel<typeof userClients>;
export type SupporterKey = InferSelectModel<typeof supporterKey>;
export type Idp = InferSelectModel<typeof idp>;
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type ApiKeyAction = InferSelectModel<typeof apiKeyActions>;
export type ApiKeyOrg = InferSelectModel<typeof apiKeyOrg>;
export type OrgDomains = InferSelectModel<typeof orgDomains>;
export type RuleTemplate = InferSelectModel<typeof ruleTemplates>;
export type TemplateRule = InferSelectModel<typeof templateRules>;
export type ResourceTemplate = InferSelectModel<typeof resourceTemplates>;
