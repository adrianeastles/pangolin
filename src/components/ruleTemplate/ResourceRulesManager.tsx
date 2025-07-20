"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@app/hooks/useToast";
import { RefreshCw, Trash2 } from "lucide-react";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";

interface RuleTemplate {
    templateId: string;
    name: string;
    description: string;
    orgId: string;
    createdAt: string;
    updatedAt: string;
}

interface ResourceTemplate {
    templateId: string;
    name: string;
    description: string;
    orgId: string;
    createdAt: string;
}

export function ResourceRulesManager({ 
    resourceId, 
    orgId,
    onUpdate
}: { 
    resourceId: string; 
    orgId: string;
    onUpdate?: () => Promise<void>;
}) {
    const [templates, setTemplates] = useState<RuleTemplate[]>([]);
    const [resourceTemplates, setResourceTemplates] = useState<ResourceTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const { toast } = useToast();
    const { env } = useEnvContext();
    const api = createApiClient({ env });

    useEffect(() => {
        fetchData();
    }, [resourceId, orgId]);

    const fetchData = async () => {
        try {
            console.log("Fetching data for resource:", resourceId, "org:", orgId);
            const [templatesRes, resourceTemplatesRes] = await Promise.all([
                api.get(`/org/${orgId}/rule-templates`),
                api.get(`/resource/${resourceId}/templates`)
            ]);

            console.log("Templates response:", templatesRes.status, templatesRes.data);
            console.log("Resource templates response:", resourceTemplatesRes.status, resourceTemplatesRes.data);

            if (templatesRes.status === 200 || templatesRes.status === 201) {
                setTemplates(templatesRes.data.data.templates || []);
            }
            if (resourceTemplatesRes.status === 200 || resourceTemplatesRes.status === 201) {
                setResourceTemplates(resourceTemplatesRes.data.data.templates || []);
            }
        } catch (error) {
            console.error("Error in fetchData:", error);
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to fetch data"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTemplate = async (templateId: string) => {
        if (!templateId) return;
        
        console.log("Assigning template:", templateId, "to resource:", resourceId);
        
        try {
            const response = await api.put(`/resource/${resourceId}/templates/${templateId}`);

            console.log("Assign template response:", response.status, response.data);

            if (response.status === 200 || response.status === 201) {
                toast({
                    title: "Success",
                    description: "Template assigned successfully. Rules have been automatically applied."
                });
                
                // Clear the selection
                setSelectedTemplate("");
                
                // Refresh data without showing error if it fails
                try {
                    console.log("Refreshing data after successful assignment");
                    await fetchData();
                    // Call the onUpdate callback if provided
                    if (onUpdate) {
                        await onUpdate();
                    }
                    console.log("Data refresh completed successfully");
                } catch (fetchError) {
                    console.error("Failed to refresh data after template assignment:", fetchError);
                    // Don't show error toast for refresh failure
                }
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to assign template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error("Error in handleAssignTemplate:", error);
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to assign template"),
                variant: "destructive"
            });
        }
    };

    const handleUnassignTemplate = async (templateId: string) => {
        if (!confirm("Are you sure you want to unassign this template? This will remove all rules from this template.")) {
            return;
        }

        try {
            const response = await api.delete(`/resource/${resourceId}/templates/${templateId}`);

            if (response.status === 200 || response.status === 201) {
                toast({
                    title: "Success",
                    description: "Template unassigned successfully. All rules have been removed."
                });
                
                // Refresh data without showing error if it fails
                try {
                    await fetchData();
                    // Call the onUpdate callback if provided
                    if (onUpdate) {
                        await onUpdate();
                    }
                } catch (fetchError) {
                    console.error("Failed to refresh data after template unassignment:", fetchError);
                    // Don't show error toast for refresh failure
                }
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to unassign template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to unassign template"),
                variant: "destructive"
            });
        }
    };

    const handleSyncTemplate = async (templateId: string) => {
        setSyncing(templateId);
        try {
            const response = await api.post(`/resource/${resourceId}/templates/${templateId}/sync`);

            if (response.status === 200 || response.status === 201) {
                toast({
                    title: "Success",
                    description: "Template synced successfully"
                });
                
                // Refresh data without showing error if it fails
                try {
                    await fetchData();
                    // Call the onUpdate callback if provided
                    if (onUpdate) {
                        await onUpdate();
                    }
                } catch (fetchError) {
                    console.error("Failed to refresh data after template sync:", fetchError);
                    // Don't show error toast for refresh failure
                }
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to sync template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to sync template"),
                variant: "destructive"
            });
        } finally {
            setSyncing(null);
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Template Assignment */}
            <Card>
                <CardHeader>
                    <CardTitle>Template Assignment</CardTitle>
                    <CardDescription>
                        Assign rule templates to this resource for consistent access control
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Select 
                            value={selectedTemplate} 
                            onValueChange={(value) => {
                                setSelectedTemplate(value);
                                handleAssignTemplate(value);
                            }}
                        >
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Select a template to assign" />
                            </SelectTrigger>
                            <SelectContent>
                                {templates.map((template) => (
                                    <SelectItem key={template.templateId} value={template.templateId}>
                                        {template.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {resourceTemplates.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-medium">Assigned Templates</h4>
                            {resourceTemplates.map((template) => (
                                <div key={template.templateId} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-medium">{template.name}</span>
                                        <span className="text-sm text-muted-foreground">
                                            Last synced: {new Date(template.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSyncTemplate(template.templateId)}
                                            disabled={syncing === template.templateId}
                                        >
                                            <RefreshCw className={`mr-2 h-4 w-4 ${syncing === template.templateId ? 'animate-spin' : ''}`} />
                                            Sync
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleUnassignTemplate(template.templateId)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Unassign
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 