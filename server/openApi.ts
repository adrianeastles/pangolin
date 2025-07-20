import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();

export enum OpenAPITags {
    Site = "Site",
    Org = "Organization",
    Resource = "Resource",
    Role = "Role",
    User = "User",
    Invitation = "Invitation",
    Target = "Target",
    Rule = "Rule",
    RuleTemplate = "Rule Template",
    AccessToken = "Access Token",
    Idp = "Identity Provider",
    Client = "Client",
    ApiKey = "API Key",
    Domain = "Domain"
}
