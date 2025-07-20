import { internal } from "@app/lib/api";
import { authCookieHeader } from "@app/lib/api/cookies";
import { AxiosResponse } from "axios";
import { cache } from "react";
import { GetOrgResponse } from "@server/routers/org";
import { redirect } from "next/navigation";
import OrgProvider from "@app/providers/OrgProvider";
import SettingsSectionTitle from "@app/components/SettingsSectionTitle";
import { getTranslations } from "next-intl/server";
import { RuleTemplatesTable } from "./RuleTemplatesTable";

type RuleTemplatesPageProps = {
    params: Promise<{ orgId: string }>;
};

export const dynamic = "force-dynamic";

export default async function RuleTemplatesPage(props: RuleTemplatesPageProps) {
    const params = await props.params;
    const t = await getTranslations();

    let templates: any[] = [];
    try {
        const res = await internal.get<AxiosResponse<any>>(
            `/org/${params.orgId}/rule-templates`,
            await authCookieHeader()
        );
        templates = res.data.data.templates || [];
    } catch (e) {
        console.error("Failed to fetch rule templates:", e);
    }

    let org = null;
    try {
        const getOrg = cache(async () =>
            internal.get<AxiosResponse<GetOrgResponse>>(
                `/org/${params.orgId}`,
                await authCookieHeader()
            )
        );
        const res = await getOrg();
        org = res.data.data;
    } catch {
        redirect(`/${params.orgId}/settings/rule-templates`);
    }

    if (!org) {
        redirect(`/${params.orgId}/settings/rule-templates`);
    }

    const templateRows = templates.map((template) => {
        return {
            id: template.templateId,
            name: template.name,
            description: template.description || "",
            orgId: params.orgId
        };
    });

    return (
        <>
            <SettingsSectionTitle
                title="Rule Templates"
                description="Create and manage rule templates for consistent access control across your resources"
            />

            <OrgProvider org={org}>
                <RuleTemplatesTable templates={templateRows} orgId={params.orgId} />
            </OrgProvider>
        </>
    );
} 