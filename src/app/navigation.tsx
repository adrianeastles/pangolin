import { SidebarNavItem } from "@app/components/SidebarNav";
import { build } from "@server/build";
import {
    Home,
    Settings,
    Users,
    Link as LinkIcon,
    Waypoints,
    Combine,
    Fingerprint,
    Workflow,
    KeyRound,
    TicketCheck,
    User,
    Globe,
    MonitorUp,
    Shield
} from "lucide-react";

export type SidebarNavSection = {
    heading: string;
    items: SidebarNavItem[];
};

export const orgNavSections = (
    enableClients: boolean = true
): SidebarNavSection[] => [
    {
        heading: "General",
        items: [
            {
                title: "sidebarSites",
                href: "/{orgId}/settings/sites",
                icon: <Combine className="h-4 w-4" />
            },
            {
                title: "sidebarResources",
                href: "/{orgId}/settings/resources",
                icon: <Waypoints className="h-4 w-4" />
            },
            ...(enableClients
                ? [
                      {
                          title: "sidebarClients",
                          href: "/{orgId}/settings/clients",
                          icon: <MonitorUp className="h-4 w-4" />
                      }
                  ]
                : []),
            {
                title: "sidebarDomains",
                href: "/{orgId}/settings/domains",
                icon: <Globe className="h-4 w-4" />
            }
        ]
    },
    {
        heading: "Access Control",
        items: [
            {
                title: "sidebarUsers",
                href: "/{orgId}/settings/access/users",
                icon: <User className="h-4 w-4" />
            },
            {
                title: "sidebarRoles",
                href: "/{orgId}/settings/access/roles",
                icon: <Users className="h-4 w-4" />
            },
            {
                title: "sidebarRuleTemplates",
                href: "/{orgId}/settings/rule-templates",
                icon: <Shield className="h-4 w-4" />
            },
            {
                title: "sidebarInvitations",
                href: "/{orgId}/settings/access/invitations",
                icon: <TicketCheck className="h-4 w-4" />
            },
            {
                title: "sidebarShareableLinks",
                href: "/{orgId}/settings/share-links",
                icon: <LinkIcon className="h-4 w-4" />
            }
        ]
    },
    {
        heading: "Organization",
        items: [
            {
                title: "sidebarApiKeys",
                href: "/{orgId}/settings/api-keys",
                icon: <KeyRound className="h-4 w-4" />
            },
            {
                title: "sidebarSettings",
                href: "/{orgId}/settings/general",
                icon: <Settings className="h-4 w-4" />
            }
        ]
    }
];

export const adminNavSections: SidebarNavSection[] = [
    {
        heading: "Admin",
        items: [
            {
                title: "sidebarAllUsers",
                href: "/admin/users",
                icon: <Users className="h-4 w-4" />
            },
            {
                title: "sidebarApiKeys",
                href: "/admin/api-keys",
                icon: <KeyRound className="h-4 w-4" />
            },
            {
                title: "sidebarIdentityProviders",
                href: "/admin/idp",
                icon: <Fingerprint className="h-4 w-4" />
            },
            ...(build == "enterprise"
                ? [
                      {
                          title: "sidebarLicense",
                          href: "/admin/license",
                          icon: <TicketCheck className="h-4 w-4" />
                      }
                  ]
                : [])
        ]
    }
];
