"use client";

import { useEffect, useState, use, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { AxiosResponse } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@app/components/ui/form";
import { toast } from "@app/hooks/useToast";
import { useResourceContext } from "@app/hooks/useResourceContext";
import { ArrayElement } from "@server/types/ArrayElement";
import { formatAxiosError } from "@app/lib/api/formatAxiosError";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { createApiClient } from "@app/lib/api";
import {
    SettingsContainer,
    SettingsSection,
    SettingsSectionBody
} from "@app/components/Settings";
import { ListResourceRulesResponse } from "@server/routers/resource/listResourceRules";
import { SwitchInput } from "@app/components/SwitchInput";
import { Alert, AlertDescription, AlertTitle } from "@app/components/ui/alert";
import { Plus, MoreHorizontal, ArrowUpRight, Play, Settings, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@app/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ResourceRulesManager } from "@/components/ruleTemplate/ResourceRulesManager";
import {
    isValidCIDR,
    isValidIP,
    isValidUrlGlobPattern
} from "@server/lib/validators";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@app/components/ui/dialog";
import { DataTable } from "@app/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";

interface EvaluationResult {
    matched: boolean;
    action: "ACCEPT" | "DROP";
    matchedRule?: {
        ruleId: string;
        match: string;
        value: string;
        priority: number;
    };
    evaluatedRules: Array<{
        ruleId: string;
        match: string;
        value: string;
        priority: number;
        matched: boolean;
        action: "ACCEPT" | "DROP";
    }>;
}

// Schema for rule validation
const addRuleSchema = z.object({
    action: z.enum(["ACCEPT", "DROP"]) as z.ZodEnum<["ACCEPT", "DROP"]>,
    match: z.enum(["CIDR", "IP", "PATH"]) as z.ZodEnum<["CIDR", "IP", "PATH"]>,
    value: z.string().min(1),
    priority: z.coerce.number().int().optional(),
    enabled: z.boolean().optional()
});

// Schema for editing rules
const editRuleSchema = z.object({
    action: z.enum(["ACCEPT", "DROP"]) as z.ZodEnum<["ACCEPT", "DROP"]>,
    match: z.enum(["CIDR", "IP", "PATH"]) as z.ZodEnum<["CIDR", "IP", "PATH"]>,
    value: z.string().min(1),
    priority: z.coerce.number().int().optional(),
    enabled: z.boolean().optional()
});

type LocalRule = ArrayElement<ListResourceRulesResponse["rules"]> & {
    new?: boolean;
    updated?: boolean;
    source?: {
        type: 'manual' | 'template';
        templateId: string | null;
        templateName: string | null;
    };
};

// Rules Data Table Component
function RulesDataTable({ 
    rules, 
    onEdit, 
    onDelete, 
    editingRuleId, 
    editRuleForm, 
    editRule, 
    cancelEditing,
    loading,
    RuleAction,
    RuleMatch,
    resource
}: {
    rules: LocalRule[];
    onEdit: (rule: LocalRule) => void;
    onDelete: (ruleId: number) => void;
    editingRuleId: number | null;
    editRuleForm: any;
    editRule: (data: any) => void;
    cancelEditing: () => void;
    loading: boolean;
    RuleAction: any;
    RuleMatch: any;
    resource: any;
}) {
    const t = useTranslations();

    const columns: ColumnDef<LocalRule>[] = [
        {
            accessorKey: "source",
            header: "Type",
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <div className="flex items-center space-x-2">
                        {rule.source?.type === 'template' ? (
                            <Badge variant="secondary" className="text-xs">
                                {rule.source.templateName || 'Template'}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs">
                                Manual
                            </Badge>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "action",
            header: "Action",
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"}>
                        {rule.action}
                    </Badge>
                );
            }
        },
        {
            accessorKey: "match",
            header: "Match Type",
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <Badge variant="outline">
                        {rule.match}
                    </Badge>
                );
            }
        },
        {
            accessorKey: "value",
            header: "Value",
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <span className="text-sm text-muted-foreground font-mono">
                        {rule.value}
                    </span>
                );
            }
        },
        {
            accessorKey: "priority",
            header: "Priority",
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <span className="text-sm">
                        {rule.priority}
                    </span>
                );
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const rule = row.original;
                
                if (editingRuleId === rule.ruleId) {
                    return (
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEditing}
                            >
                                Cancel
                            </Button>
                        </div>
                    );
                }

                if (rule.source?.type === 'template') {
                    return (
                        <span className="text-xs text-muted-foreground">
                            Template Rule
                        </span>
                    );
                }

                return (
                    <div className="flex items-center justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit(rule)}>
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDelete(rule.ruleId)}
                                    className="text-red-500"
                                >
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            }
        }
    ];

    return (
        <DataTable
            columns={columns}
            data={rules}
            title="Rules"
            searchPlaceholder="Search rules..."
            searchColumn="value"
        />
    );
}

export default function ResourceRules(props: {
    params: Promise<{ resourceId: number }>;
}) {
    const params = use(props.params);
    const { resource, updateResource } = useResourceContext();
    const api = createApiClient(useEnvContext());
    const [rules, setRules] = useState<LocalRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [rulesEnabled, setRulesEnabled] = useState(resource.applyRules);
    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const router = useRouter();
    const t = useTranslations();

    const RuleAction = {
        ACCEPT: t('alwaysAllow'),
        DROP: t('alwaysDeny')
    } as const;

    const RuleMatch = {
        PATH: "Path Pattern",
        IP: "IP Address",
        CIDR: "IP Range"
    } as const;

    const addRuleForm = useForm<z.infer<typeof addRuleSchema>>({
        resolver: zodResolver(addRuleSchema),
        defaultValues: {
            action: "ACCEPT",
            match: "IP",
            value: "",
            enabled: true
        }
    });

    const editRuleForm = useForm<z.infer<typeof editRuleSchema>>({
        resolver: zodResolver(editRuleSchema),
        defaultValues: {
            action: "ACCEPT",
            match: "IP",
            value: "",
            enabled: true
        }
    });

    const fetchRules = useCallback(async () => {
        try {
            const rulesRes = await api.get<AxiosResponse<ListResourceRulesResponse>>(
                `/resource/${params.resourceId}/rules`
            );
            if (rulesRes.status === 200) {
                setRules(rulesRes.data.data.rules);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
            toast({
                variant: "destructive",
                title: t('rulesErrorFetch'),
                description: formatAxiosError(error, t('rulesErrorFetchDescription'))
            });
        } finally {
            setPageLoading(false);
        }
    }, [api, params.resourceId, t]);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    async function addRule(data: z.infer<typeof addRuleSchema>) {
        try {
            setLoading(true);

            const isDuplicate = rules.some(
                (rule) =>
                    rule.action === data.action &&
                    rule.match === data.match &&
                    rule.value === data.value
            );

            if (isDuplicate) {
                toast({
                    variant: "destructive",
                    title: t('rulesErrorDuplicate'),
                    description: t('rulesErrorDuplicateDescription')
                });
                throw new Error('Duplicate rule');
            }

            if (data.match === "CIDR" && !isValidCIDR(data.value)) {
                toast({
                    variant: "destructive",
                    title: t('rulesErrorInvalidIpAddressRange'),
                    description: t('rulesErrorInvalidIpAddressRangeDescription')
                });
                throw new Error('Invalid CIDR');
            }
            if (data.match === "PATH" && !isValidUrlGlobPattern(data.value)) {
                toast({
                    variant: "destructive",
                    title: t('rulesErrorInvalidUrl'),
                    description: t('rulesErrorInvalidUrlDescription')
                });
                throw new Error('Invalid URL pattern');
            }
            if (data.match === "IP" && !isValidIP(data.value)) {
                toast({
                    variant: "destructive",
                    title: t('rulesErrorInvalidIpAddress'),
                    description: t('rulesErrorInvalidIpAddressDescription')
                });
                throw new Error('Invalid IP');
            }

            // Always calculate the new priority as highest + 1
            const highestPriority = rules.reduce(
                (acc, rule) => Math.max(acc, rule.priority),
                0
            );
            const priority = highestPriority + 1;

            const ruleData = {
                action: data.action as "ACCEPT" | "DROP",
                match: data.match as "CIDR" | "IP" | "PATH",
                value: data.value,
                priority,
                enabled: true
            };

            // Save rule to server immediately
            const res = await api.put(
                `/resource/${params.resourceId}/rule`,
                ruleData
            );

            if (res.status === 200) {
                await fetchRules();
                toast({
                    title: t('rulesSuccessCreate'),
                    description: t('rulesSuccessCreateDescription')
                });
            }
        } catch (error: unknown) {
            console.error(error);
            if (error instanceof Error) {
                if (!error.message.includes('Invalid') && !error.message.includes('Duplicate')) {
                    toast({
                        variant: "destructive",
                        title: t('rulesErrorCreate'),
                        description: formatAxiosError(
                            error,
                            t('rulesErrorCreateDescription')
                        )
                    });
                }
            } else {
                toast({
                    variant: "destructive",
                    title: t('rulesErrorCreate'),
                    description: t('rulesErrorCreateDescription')
                });
            }
            throw error;
        } finally {
            setLoading(false);
        }
    }

    const removeRule = async (ruleId: number) => {
        try {
            setLoading(true);
            await api.delete(`/resource/${params.resourceId}/rule/${ruleId}`);
            setRules(rules.filter((rule) => rule.ruleId !== ruleId));
            toast({
                title: t('rulesSuccessDelete'),
                description: t('rulesSuccessDeleteDescription')
            });
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t('rulesErrorDelete'),
                description: formatAxiosError(err, t('rulesErrorDeleteDescription'))
            });
        } finally {
            setLoading(false);
        }
    };

    async function updateRule(ruleId: number, data: Partial<LocalRule>) {
        try {
            setLoading(true);
            const ruleData = {
                action: data.action,
                match: data.match,
                value: data.value,
                priority: data.priority,
                enabled: data.enabled
            };

            await api.post(`/resource/${params.resourceId}/rule/${ruleId}`, ruleData);
            
            setRules(
                rules.map((rule) =>
                    rule.ruleId === ruleId
                        ? { ...rule, ...data }
                        : rule
                )
            );

            toast({
                title: t('rulesSuccessUpdate'),
                description: t('rulesSuccessUpdateDescription')
            });
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t('rulesErrorUpdate'),
                description: formatAxiosError(err, t('rulesErrorUpdateDescription'))
            });
        } finally {
            setLoading(false);
        }
    }

    async function editRule(data: z.infer<typeof editRuleSchema>) {
        if (!editingRuleId) return;
        
        try {
            setLoading(true);
            const ruleData = {
                action: data.action,
                match: data.match,
                value: data.value,
                priority: data.priority || 0,
                enabled: true
            };

            await api.post(`/resource/${params.resourceId}/rule/${editingRuleId}`, ruleData);
            
            setRules(
                rules.map((rule) =>
                    rule.ruleId === editingRuleId
                        ? { ...rule, ...ruleData }
                        : rule
                )
            );

            setEditingRuleId(null);
            editRuleForm.reset();

            toast({
                title: t('rulesSuccessUpdate'),
                description: t('rulesSuccessUpdateDescription')
            });
        } catch (err) {
            console.error(err);
            toast({
                variant: "destructive",
                title: t('rulesErrorUpdate'),
                description: formatAxiosError(err, t('rulesErrorUpdateDescription'))
            });
        } finally {
            setLoading(false);
        }
    }

    function startEditingRule(rule: LocalRule) {
        setEditingRuleId(rule.ruleId);
        editRuleForm.reset({
            action: rule.action as "ACCEPT" | "DROP",
            match: rule.match as "CIDR" | "IP" | "PATH",
            value: rule.value,
            priority: rule.priority,
            enabled: rule.enabled
        });
    }

    function cancelEditing() {
        setEditingRuleId(null);
        editRuleForm.reset();
    }

    function getValueHelpText(type: string) {
        switch (type) {
            case "CIDR":
                return t('rulesMatchIpAddressRangeDescription');
            case "IP":
                return t('rulesMatchIpAddress');
            case "PATH":
                return t('rulesMatchUrl');
        }
    }



    if (pageLoading) {
        return <></>;
    }

    return (
        <SettingsContainer>
            <Alert className="mb-6">
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

            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div>
                    <div className="text-sm font-medium">
                        {t('rulesEnable')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {t('rulesEnableAfterEnabled')}
                    </div>
                </div>
                                        <SwitchInput
                            id="rules-toggle"
                            defaultChecked={rulesEnabled}
                            onCheckedChange={async (val) => {
                                try {
                                    setLoading(true);
                                    const res = await api.post(`/resource/${params.resourceId}`, {
                                        applyRules: val
                                    });
                                    
                                    if (res.status === 200) {
                                        setRulesEnabled(val);
                                        updateResource({ applyRules: val });
                                        toast({
                                            title: t('rulesSuccessUpdate'),
                                            description: t('rulesSuccessUpdateDescription')
                                        });
                                    }
                                } catch (err) {
                                    console.error(err);
                                    toast({
                                        variant: "destructive",
                                        title: t('rulesErrorUpdate'),
                                        description: formatAxiosError(err, t('rulesErrorUpdateDescription'))
                                    });
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
            </div>

            {rulesEnabled && (
                <SettingsSection>
                    <SettingsSectionBody>
                        <Tabs defaultValue="overview" className="space-y-6">
                            <TabsList>
                                <TabsTrigger value="overview" className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Overview
                                </TabsTrigger>
                                <TabsTrigger value="manage" className="flex items-center gap-2">
                                    <Settings className="h-4 w-4" />
                                    Templates
                                </TabsTrigger>
                                <TabsTrigger value="evaluator" className="flex items-center gap-2">
                                    <Play className="h-4 w-4" />
                                    Evaluator
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-6">
                                <div className="space-y-6">
                                    {/* Create Manual Rule Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-medium">All Rules</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Manage rules for this resource.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => setCreateDialogOpen(true)}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Manual Rule
                                            </Button>
                                        </div>
                                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                                            <DialogContent className="sm:max-w-[600px]">
                                                <DialogHeader>
                                                    <DialogTitle>Create Manual Rule</DialogTitle>
                                                    <DialogDescription>
                                                        Create a custom rule specific to this resource.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <Form {...addRuleForm}>
                                                    <form
                                                        onSubmit={addRuleForm.handleSubmit(async (data) => {
                                                            try {
                                                                await addRule({
                                                                    action: data.action as "ACCEPT" | "DROP",
                                                                    match: data.match as "CIDR" | "IP" | "PATH",
                                                                    value: data.value,
                                                                    priority: data.priority,
                                                                    enabled: true
                                                                });
                                                                // Reset form and close dialog
                                                                addRuleForm.reset({
                                                                    action: "ACCEPT",
                                                                    match: "IP",
                                                                    value: "",
                                                                    priority: undefined,
                                                                    enabled: true
                                                                });
                                                                setCreateDialogOpen(false);
                                                                // Fetch updated rules
                                                                await fetchRules();
                                                            } catch (error) {
                                                                // Error is already handled in addRule
                                                                return;
                                                            }
                                                        })}
                                                        className="space-y-4"
                                                    >
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <FormField
                                                                control={addRuleForm.control}
                                                                name="action"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-sm font-medium">Action</FormLabel>
                                                                        <FormControl>
                                                                            <Select
                                                                                value={field.value}
                                                                                onValueChange={field.onChange}
                                                                            >
                                                                                <SelectTrigger>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="ACCEPT">
                                                                                        {RuleAction.ACCEPT}
                                                                                    </SelectItem>
                                                                                    <SelectItem value="DROP">
                                                                                        {RuleAction.DROP}
                                                                                    </SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={addRuleForm.control}
                                                                name="match"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-sm font-medium">Match Type</FormLabel>
                                                                        <FormControl>
                                                                            <Select
                                                                                value={field.value}
                                                                                onValueChange={field.onChange}
                                                                            >
                                                                                <SelectTrigger>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {resource.http && (
                                                                                        <SelectItem value="PATH">
                                                                                            {RuleMatch.PATH}
                                                                                        </SelectItem>
                                                                                    )}
                                                                                    <SelectItem value="IP">
                                                                                        {RuleMatch.IP}
                                                                                    </SelectItem>
                                                                                    <SelectItem value="CIDR">
                                                                                        {RuleMatch.CIDR}
                                                                                    </SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                        <FormField
                                                            control={addRuleForm.control}
                                                            name="value"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-sm font-medium">Value</FormLabel>
                                                                    <FormControl>
                                                                        <Input 
                                                                            {...field}
                                                                            placeholder={
                                                                                addRuleForm.watch("match") === "IP" ? "192.168.1.1" :
                                                                                addRuleForm.watch("match") === "CIDR" ? "192.168.1.0/24" :
                                                                                "/api/*"
                                                                            }
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <DialogFooter>
                                                            <Button
                                                                type="submit"
                                                                disabled={!rulesEnabled || loading}
                                                                loading={loading}
                                                            >
                                                                Create Rule
                                                            </Button>
                                                        </DialogFooter>
                                                    </form>
                                                </Form>
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    {/* All Rules Section */}
                                    <div className="space-y-4">
                                        {rules.length === 0 ? (
                                            <div className="text-center py-8 border rounded-lg">
                                                <p className="text-muted-foreground">No rules found for this resource.</p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Create a rule or assign a template to get started.
                                                </p>
                                            </div>
                                        ) : (
                                            <RulesDataTable
                                                rules={rules}
                                                onEdit={startEditingRule}
                                                onDelete={removeRule}
                                                editingRuleId={editingRuleId}
                                                editRuleForm={editRuleForm}
                                                editRule={editRule}
                                                cancelEditing={cancelEditing}
                                                loading={loading}
                                                RuleAction={RuleAction}
                                                RuleMatch={RuleMatch}
                                                resource={resource}
                                            />
                                        )}
                                    </div>

                                    {/* Edit Rule Dialog */}
                                    {editingRuleId && (
                                        <Dialog open={!!editingRuleId} onOpenChange={(open) => !open && cancelEditing()}>
                                            <DialogContent className="sm:max-w-[600px]">
                                                <DialogHeader>
                                                    <DialogTitle>Edit Rule {editingRuleId}</DialogTitle>
                                                    <DialogDescription>
                                                        Modify the rule settings.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <Form {...editRuleForm}>
                                                    <form
                                                        onSubmit={editRuleForm.handleSubmit((data) => {
                                                            editRule(data);
                                                        })}
                                                        className="space-y-4"
                                                    >
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <FormField
                                                                control={editRuleForm.control}
                                                                name="action"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-sm font-medium">Action</FormLabel>
                                                                        <FormControl>
                                                                            <Select
                                                                                value={field.value}
                                                                                onValueChange={field.onChange}
                                                                            >
                                                                                <SelectTrigger>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="ACCEPT">
                                                                                        {RuleAction.ACCEPT}
                                                                                    </SelectItem>
                                                                                    <SelectItem value="DROP">
                                                                                        {RuleAction.DROP}
                                                                                    </SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={editRuleForm.control}
                                                                name="match"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-sm font-medium">Match Type</FormLabel>
                                                                        <FormControl>
                                                                            <Select
                                                                                value={field.value}
                                                                                onValueChange={field.onChange}
                                                                            >
                                                                                <SelectTrigger>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {resource.http && (
                                                                                        <SelectItem value="PATH">
                                                                                            {RuleMatch.PATH}
                                                                                        </SelectItem>
                                                                                    )}
                                                                                    <SelectItem value="IP">
                                                                                        {RuleMatch.IP}
                                                                                    </SelectItem>
                                                                                    <SelectItem value="CIDR">
                                                                                        {RuleMatch.CIDR}
                                                                                    </SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                        <FormField
                                                            control={editRuleForm.control}
                                                            name="value"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-sm font-medium">Value</FormLabel>
                                                                    <FormControl>
                                                                        <Input 
                                                                            {...field}
                                                                            placeholder={
                                                                                editRuleForm.watch("match") === "IP" ? "192.168.1.1" :
                                                                                editRuleForm.watch("match") === "CIDR" ? "192.168.1.0/24" :
                                                                                "/api/*"
                                                                            }
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <DialogFooter>
                                                            <Button
                                                                type="submit"
                                                                disabled={loading}
                                                                loading={loading}
                                                            >
                                                                Save Changes
                                                            </Button>
                                                        </DialogFooter>
                                                    </form>
                                                </Form>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="manage" className="space-y-6">
                                <div className="space-y-8">
                                    {/* Info Message */}
                                    <div className="p-4 border rounded-lg bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/30 dark:border-blue-800/50">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                                                <span className="text-white text-xs font-medium">i</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                                                    Rule Templates
                                                </p>
                                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                                    Assign rule templates to automatically apply consistent rules across multiple resources. All rules can be viewed in the <strong>Overview</strong> tab.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Template Assignment */}
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-medium">Manage Templates</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Assign rule templates to automatically apply consistent rules across multiple resources.
                                        </p>
                                        
                                        <div className="border rounded-lg">
                                            <ResourceRulesManager 
                                                resourceId={params.resourceId.toString()} 
                                                orgId={resource.orgId} 
                                                onUpdate={fetchRules}
                                            />
                                        </div>
                                    </div>
                                </div>
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
            )}


        </SettingsContainer>
    );
}
