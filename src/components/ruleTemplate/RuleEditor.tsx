"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@app/hooks/useToast";
import { Plus, Edit, Trash2, CheckCircle, XCircle, ArrowUpRight } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";

interface Rule {
    ruleId: string;
    templateId: string;
    match: "IP" | "CIDR" | "PATH";
    value: string;
    priority: number;
    action: "ACCEPT" | "DROP";
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

interface RuleTemplate {
    templateId: string;
    name: string;
    description: string;
    orgId: string;
    createdAt: string;
    updatedAt: string;
}

const createRuleSchema = z.object({
    match: z.enum(["IP", "CIDR", "PATH"]),
    value: z.string().min(1, "Value is required"),
    priority: z.number().int().min(1, "Priority must be at least 1"),
    action: z.enum(["ACCEPT", "DROP"]),
    enabled: z.boolean().optional()
});

export function RuleEditor({ template }: { template: RuleTemplate }) {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [deletingRule, setDeletingRule] = useState<Rule | null>(null);
    const { toast } = useToast();
    const { env } = useEnvContext();
    const api = createApiClient({ env });

    const form = useForm<z.infer<typeof createRuleSchema>>({
        resolver: zodResolver(createRuleSchema),
        defaultValues: {
            match: "IP",
            value: "",
            priority: 1,
            action: "ACCEPT",
            enabled: true
        }
    });

    useEffect(() => {
        fetchRules();
    }, [template.templateId]);

    const fetchRules = async () => {
        try {
            const response = await api.get(`/org/${template.orgId}/rule-templates/${template.templateId}/rules`);
            if (response.status === 200) {
                setRules(response.data.data.rules || []);
            } else {
                toast({
                    title: "Error",
                    description: "Failed to fetch rules",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to fetch rules"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRule = async (values: z.infer<typeof createRuleSchema>) => {
        try {
            const response = await api.put(`/org/${template.orgId}/rule-templates/${template.templateId}/rules`, values);

            if (response.status === 200 || response.status === 201) {
                // Refresh all rules to get updated priorities
                await fetchRules();
                
                setIsCreateDialogOpen(false);
                form.reset({
                    match: "IP",
                    value: "",
                    priority: 1,
                    action: "ACCEPT",
                    enabled: true
                });
                toast({
                    title: "Success",
                    description: "Rule created successfully and propagated to all assigned resources. Manual rules are preserved."
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to create rule",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to create rule"),
                variant: "destructive"
            });
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        try {
            const response = await api.delete(`/org/${template.orgId}/rule-templates/${template.templateId}/rules/${ruleId}`);

            if (response.status === 200) {
                setRules(prev => prev.filter(r => r.ruleId !== ruleId));
                toast({
                    title: "Success",
                    description: "Rule deleted successfully and propagated to all assigned resources. Manual rules are preserved."
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to delete rule",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to delete rule"),
                variant: "destructive"
            });
        }
    };

    const handleEditRule = async (values: z.infer<typeof createRuleSchema>) => {
        if (!editingRule) return;

        try {
            const response = await api.post(`/org/${template.orgId}/rule-templates/${template.templateId}/rules/${editingRule.ruleId}`, values);

            if (response.status === 200) {
                setRules(prev => prev.map(r => 
                    r.ruleId === editingRule.ruleId ? response.data.data : r
                ));
                setEditingRule(null);
                form.reset();
                toast({
                    title: "Success",
                    description: "Rule updated successfully and propagated to all assigned resources. Manual rules are preserved."
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to update rule",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to update rule"),
                variant: "destructive"
            });
        }
    };

    const getValidationStatus = (rule: Rule) => {
        if (rule.match === "CIDR") {
            const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
            if (!cidrRegex.test(rule.value)) {
                return { valid: false, error: "Invalid CIDR format (e.g., 192.168.1.0/24)" };
            }
        } else if (rule.match === "IP") {
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(rule.value)) {
                return { valid: false, error: "Invalid IP format (e.g., 192.168.1.1)" };
            }
        } else if (rule.match === "PATH") {
            // Basic path validation - should start with / and not contain invalid characters
            if (!rule.value.startsWith('/') || rule.value.includes('..')) {
                return { valid: false, error: "Invalid path format (e.g., /api/users)" };
            }
        }
        return { valid: true, error: null };
    };

    if (loading) {
        return <div>Loading rules...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-medium">Template Rules</h3>
                    <p className="text-sm text-muted-foreground">
                        Define rules that will be applied to all resources using this template.
                    </p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                </Button>
            </div>

            <div className="space-y-4">
                {rules.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-center">
                            <p className="text-muted-foreground">
                                No rules found. Create your first rule to get started.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    rules.map((rule) => {
                        const validation = getValidationStatus(rule);
                        return (
                            <Card
                                key={rule.ruleId}
                                className="hover:shadow-md transition-shadow"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"}>
                                                    {rule.action === "ACCEPT" ? "Allow" : "Deny"}
                                                </Badge>
                                                <Badge variant="outline">
                                                    {rule.match}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    Priority {rule.priority}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-mono text-muted-foreground">
                                                {rule.value}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingRule(rule);
                                                    form.reset({
                                                        match: rule.match,
                                                        value: rule.value,
                                                        priority: rule.priority,
                                                        action: rule.action,
                                                        enabled: rule.enabled
                                                    });
                                                }}
                                            >
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setDeletingRule(rule)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Create Rule Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Rule</DialogTitle>
                        <DialogDescription>
                            Add a new rule to this template
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleCreateRule)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="match"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Match Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select match type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="IP">IP Address</SelectItem>
                                                <SelectItem value="CIDR">IP Range</SelectItem>
                                                <SelectItem value="PATH">Path Pattern</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="value"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Value</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                placeholder={
                                                    form.watch("match") === "IP" ? "192.168.1.1" :
                                                    form.watch("match") === "CIDR" ? "192.168.1.0/24" :
                                                    "/api/*"
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === "" ? undefined : parseInt(value));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="action"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Action</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select action" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ACCEPT">Allow</SelectItem>
                                                <SelectItem value="DROP">Deny</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Create Rule</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Edit Rule Dialog */}
            <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Rule</DialogTitle>
                        <DialogDescription>
                            Update the rule settings for this template.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleEditRule)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="match"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Match Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select match type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="IP">IP Address</SelectItem>
                                                <SelectItem value="CIDR">IP Range</SelectItem>
                                                <SelectItem value="PATH">Path Pattern</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="value"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Value</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    field.onChange(value === "" ? undefined : parseInt(value));
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="action"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Action</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select action" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ACCEPT">Allow</SelectItem>
                                                <SelectItem value="DROP">Deny</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setEditingRule(null)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Update Rule</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Delete Rule Confirmation Dialog */}
            {deletingRule && (
                <ConfirmDeleteDialog
                    open={!!deletingRule}
                    setOpen={(open) => !open && setDeletingRule(null)}
                    onConfirm={async () => {
                        if (deletingRule) {
                            await handleDeleteRule(deletingRule.ruleId);
                            setDeletingRule(null);
                        }
                    }}
                    title="Delete Rule"
                    dialog={
                        <div>
                            <p className="mb-2">
                                Are you sure you want to delete this rule?
                            </p>
                            <p className="mb-2">This action cannot be undone.</p>
                            <p className="mb-2">Rule: {deletingRule.action === "ACCEPT" ? "Allow" : "Deny"} {deletingRule.match} - {deletingRule.value}</p>
                            <p className="text-sm text-muted-foreground">
                                To confirm, please type <span className="font-mono font-medium">{deletingRule.value}</span> below.
                            </p>
                        </div>
                    }
                    buttonText="Delete Rule"
                    string={deletingRule.value}
                />
            )}
        </div>
    );
} 