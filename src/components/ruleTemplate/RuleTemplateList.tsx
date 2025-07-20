"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@app/hooks/useToast";
import { Plus, Edit, Trash2, Copy, Search, Filter } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";

interface RuleTemplate {
    templateId: string;
    name: string;
    description: string;
    orgId: string;
    createdAt: string;
    updatedAt: string;
    ruleCount: number;
}

const createTemplateSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional()
});

export function RuleTemplateList({ orgId }: { orgId: string }) {
    const [templates, setTemplates] = useState<RuleTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<RuleTemplate | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<RuleTemplate | null>(null);
    const { toast } = useToast();
    const router = useRouter();
    const { env } = useEnvContext();
    const api = createApiClient({ env });

    const form = useForm<z.infer<typeof createTemplateSchema>>({
        resolver: zodResolver(createTemplateSchema),
        defaultValues: {
            name: "",
            description: ""
        }
    });

    useEffect(() => {
        fetchTemplates();
    }, [orgId]);

    const fetchTemplates = async () => {
        try {
            const response = await api.get(`/org/${orgId}/rule-templates`);
            if (response.status === 200) {
                setTemplates(response.data.data.templates || []);
            } else {
                toast({
                    title: "Error",
                    description: "Failed to fetch rule templates",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to fetch rule templates"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTemplate = async (values: z.infer<typeof createTemplateSchema>) => {
        try {
            const response = await api.post(`/org/${orgId}/rule-templates`, values);

            if (response.status === 201) {
                setTemplates(prev => [...prev, response.data.data]);
                setIsCreateDialogOpen(false);
                form.reset();
                toast({
                    title: "Success",
                    description: "Rule template created successfully"
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to create rule template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to create rule template"),
                variant: "destructive"
            });
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        try {
            const response = await api.delete(`/org/${orgId}/rule-templates/${templateId}`);

            if (response.status === 200) {
                setTemplates(prev => prev.filter(t => t.templateId !== templateId));
                setIsDeleteDialogOpen(false);
                setTemplateToDelete(null);
                toast({
                    title: "Success",
                    description: "Rule template deleted successfully"
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to delete rule template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to delete rule template"),
                variant: "destructive"
            });
        }
    };

    const handleEditTemplate = async (values: z.infer<typeof createTemplateSchema>) => {
        if (!editingTemplate) return;

        try {
            const response = await api.post(`/org/${orgId}/rule-templates/${editingTemplate.templateId}`, values);

            if (response.status === 200) {
                setTemplates(prev => prev.map(t => 
                    t.templateId === editingTemplate.templateId ? response.data.data : t
                ));
                setEditingTemplate(null);
                form.reset();
                toast({
                    title: "Success",
                    description: "Rule template updated successfully"
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to update rule template",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to update rule template"),
                variant: "destructive"
            });
        }
    };

    const openQuickEdit = (template: RuleTemplate) => {
        setEditingTemplate(template);
        form.reset({
            name: template.name,
            description: template.description || ""
        });
    };

    const openDeleteDialog = (template: RuleTemplate) => {
        setTemplateToDelete(template);
        setIsDeleteDialogOpen(true);
    };

    const formatDate = (timestamp: string | number) => {
        const date = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
        return new Date(date).toLocaleDateString();
    };

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader>
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </CardHeader>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Rule Templates</h2>
                    <p className="text-muted-foreground">
                        Manage rule templates for consistent access control across resources
                    </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Rule Template</DialogTitle>
                            <DialogDescription>
                                Create a new rule template to define access control rules
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleCreateTemplate)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Enter template name" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Enter template description (optional)" 
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">Create Template</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="grid gap-4">
                {filteredTemplates.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-8">
                            <p className="text-muted-foreground mb-4">No rule templates found</p>
                            <Button onClick={() => setIsCreateDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create your first template
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    filteredTemplates.map((template) => (
                        <Card key={template.templateId} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <CardTitle className="flex items-center gap-2">
                                            {template.name}
                                            <Badge variant="secondary">
                                                {template.ruleCount} rules
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="mt-2">
                                            {template.description || "No description provided"}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`/${orgId}/settings/rule-templates/${template.templateId}`)}
                                        >
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                        </Button>
                                        <Dialog open={!!editingTemplate && editingTemplate.templateId === template.templateId} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                                            <DialogTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => openQuickEdit(template)}
                                                >
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Quick Edit
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Edit Rule Template</DialogTitle>
                                                    <DialogDescription>
                                                        Update the template details
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <Form {...form}>
                                                    <form onSubmit={form.handleSubmit(handleEditTemplate)} className="space-y-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="name"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Name</FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="description"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Description</FormLabel>
                                                                    <FormControl>
                                                                        <Textarea {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <DialogFooter>
                                                            <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>
                                                                Cancel
                                                            </Button>
                                                            <Button type="submit">Update Template</Button>
                                                        </DialogFooter>
                                                    </form>
                                                </Form>
                                            </DialogContent>
                                        </Dialog>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openDeleteDialog(template)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <span>Created: {formatDate(template.createdAt)}</span>
                                    <span>Updated: {formatDate(template.updatedAt)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={isDeleteDialogOpen}
                setOpen={setIsDeleteDialogOpen}
                dialog={
                    <div>
                        <p className="mb-2">
                            Are you sure you want to delete the template "{templateToDelete?.name}"?
                        </p>
                        <p className="mb-2">This action cannot be undone and will remove all rules associated with this template.</p>
                        <p className="mb-2">This will also unassign the template from any resources that are using it.</p>
                        <p className="text-sm text-muted-foreground">
                            To confirm, please type <span className="font-mono font-medium">{templateToDelete?.name}</span> below.
                        </p>
                    </div>
                }
                buttonText="Delete Template"
                onConfirm={() => {
                    if (templateToDelete) {
                        return handleDeleteTemplate(templateToDelete.templateId);
                    }
                    return Promise.resolve();
                }}
                string={templateToDelete?.name || ""}
                title="Delete Rule Template"
            />
        </div>
    );
} 