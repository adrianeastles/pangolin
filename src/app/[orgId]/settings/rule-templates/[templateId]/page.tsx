"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { RuleEditor } from "@/components/ruleTemplate/RuleEditor";
import { RuleEvaluator } from "@/components/ruleTemplate/RuleEvaluator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@app/hooks/useToast";
import { ArrowLeft, Settings, Play, Info, Calendar, Hash, ArrowUpRight, Shield } from "lucide-react";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionHeader,
    SettingsSectionTitle,
    SettingsSectionDescription,
    SettingsSectionBody
} from "@app/components/Settings";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";

interface RuleTemplate {
    templateId: string;
    name: string;
    description: string;
    orgId: string;
    createdAt: string;
    updatedAt: string;
}

export default function TemplateEditorPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { env } = useEnvContext();
    const api = createApiClient({ env });
    const [template, setTemplate] = useState<RuleTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const orgId = params.orgId as string;
    const templateId = params.templateId as string;

    useEffect(() => {
        fetchTemplate();
    }, [templateId, orgId]);

    const fetchTemplate = async () => {
        try {
            const response = await api.get(`/org/${orgId}/rule-templates/${templateId}`);

            if (response.status === 200) {
                setTemplate(response.data.data);
            } else {
                toast({
                    title: "Error",
                    description: "Template not found",
                    variant: "destructive"
                });
                router.push(`/${orgId}/settings/rule-templates`);
                return;
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to fetch template data"),
                variant: "destructive"
            });
            router.push(`/${orgId}/settings/rule-templates`);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: string | number | null | undefined) => {
        if (!timestamp) return "Never";
        
        try {
            const date = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
            if (isNaN(date)) return "Never";
            
            return new Date(date).toLocaleDateString();
        } catch (error) {
            return "Never";
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="animate-pulse">
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (!template) {
        return <div>Template not found</div>;
    }

    return (
        <SettingsContainer>
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/${params.orgId}/settings/rule-templates`)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">{template?.name}</h1>
                    <p className="text-muted-foreground">{template?.description}</p>
                </div>
            </div>

            {/* General Information */}
            <Card className="mb-8">
                <SettingsSection>
                    <SettingsSectionHeader>
                        <SettingsSectionTitle>General Information</SettingsSectionTitle>
                        <SettingsSectionDescription>
                            Details about this rule template
                        </SettingsSectionDescription>
                    </SettingsSectionHeader>

                    <SettingsSectionBody>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Template ID</p>
                                    <p className="text-xs text-muted-foreground font-mono">{template.templateId}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Organization</p>
                                    <p className="text-xs text-muted-foreground">{template.orgId}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Created</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(template.createdAt)}</p>
                                </div>
                            </div>
                        </div>
                    </SettingsSectionBody>
                </SettingsSection>
            </Card>

            {/* About Bypass Rules */}
            <Alert className="mb-8">
                <Shield className="h-4 w-4" />
                <AlertTitle>About Bypass Rules</AlertTitle>
                <AlertDescription>
                    <p className="mt-2 mb-4">
                        Rules allow you to either "allow" and bypass the Pangolin auth system (no pin, login, password), or "deny" and fully reject the request.
                    </p>
                    <a 
                        href="https://docs.fossorial.io/Pangolin/bypass-rules"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                    >
                        Learn more about bypass rules
                        <ArrowUpRight className="h-4 w-4" />
                    </a>
                </AlertDescription>
            </Alert>

            {/* Rule Management */}
            <SettingsSection>
                <SettingsSectionHeader>
                    <SettingsSectionTitle>Rule Management</SettingsSectionTitle>
                    <SettingsSectionDescription>
                        Create and manage rules for this template, and test how they evaluate against different requests.
                    </SettingsSectionDescription>
                </SettingsSectionHeader>

                <SettingsSectionBody>
                    <Tabs defaultValue="editor" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="editor" className="flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Rule Editor
                            </TabsTrigger>
                            <TabsTrigger value="evaluator" className="flex items-center gap-2">
                                <Play className="h-4 w-4" />
                                Rule Evaluator
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="editor" className="space-y-6">
                            <RuleEditor template={template} />
                        </TabsContent>

                        <TabsContent value="evaluator" className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-medium">Rule Evaluator</h3>
                                <p className="text-sm text-muted-foreground">
                                    Test how your rules would evaluate against different values.
                                </p>
                                
                                <div className="p-4 border rounded-lg bg-muted/50">
                                    <p className="text-sm text-muted-foreground">
                                        Rule evaluation functionality will be available soon. This will allow you to test IP Address, IP Address ranges, and path patterns against your current rules.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </SettingsSectionBody>
            </SettingsSection>
        </SettingsContainer>
    );
} 