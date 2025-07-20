"use client";

import { ColumnDef } from "@tanstack/react-table";
import { RuleTemplatesDataTable } from "./RuleTemplatesDataTable";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@app/components/ui/dropdown-menu";
import { Button } from "@app/components/ui/button";
import {
    ArrowRight,
    ArrowUpDown,
    MoreHorizontal,
    Edit,
    Trash2,
    Plus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDeleteDialog from "@app/components/ConfirmDeleteDialog";
import { formatAxiosError } from "@app/lib/api";
import { toast } from "@app/hooks/useToast";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { Badge } from "@app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

export type TemplateRow = {
    id: string;
    name: string;
    description: string;
    orgId: string;
};

type RuleTemplatesTableProps = {
    templates: TemplateRow[];
    orgId: string;
};

const createTemplateSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional()
});

export function RuleTemplatesTable({ templates, orgId }: RuleTemplatesTableProps) {
    const router = useRouter();
    const api = createApiClient(useEnvContext());

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const form = useForm<z.infer<typeof createTemplateSchema>>({
        resolver: zodResolver(createTemplateSchema),
        defaultValues: {
            name: "",
            description: ""
        }
    });

    const deleteTemplate = (templateId: string) => {
        api.delete(`/org/${orgId}/rule-templates/${templateId}`)
            .catch((e) => {
                console.error("Failed to delete template:", e);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: formatAxiosError(e, "Failed to delete template")
                });
            })
            .then(() => {
                router.refresh();
                setIsDeleteModalOpen(false);
            });
    };

    const handleCreateTemplate = async (values: z.infer<typeof createTemplateSchema>) => {
        try {
            const response = await api.post(`/org/${orgId}/rule-templates`, values);

            if (response.status === 201) {
                setIsCreateDialogOpen(false);
                form.reset();
                toast({
                    title: "Success",
                    description: "Rule template created successfully"
                });
                router.refresh();
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

    const formatDate = (timestamp: string | number) => {
        const date = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
        return new Date(date).toLocaleDateString();
    };

    const columns: ColumnDef<TemplateRow>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                    >
                        Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            }
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => {
                const template = row.original;
                return (
                    <span className="text-muted-foreground">
                        {template.description || "No description provided"}
                    </span>
                );
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const template = row.original;
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
                                <DropdownMenuItem
                                    onClick={() => {
                                        setSelectedTemplate(template);
                                        setIsDeleteModalOpen(true);
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span className="text-red-500">Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link
                            href={`/${template.orgId}/settings/rule-templates/${template.id}`}
                        >
                            <Button
                                variant="secondary"
                                className="ml-2"
                                size="sm"
                            >
                                Edit
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                );
            }
        }
    ];

    return (
        <>
            {selectedTemplate && (
                <ConfirmDeleteDialog
                    open={isDeleteModalOpen}
                    setOpen={(val) => {
                        setIsDeleteModalOpen(val);
                        setSelectedTemplate(null);
                    }}
                    dialog={
                        <div>
                            <p className="mb-2">
                                Are you sure you want to delete the template "{selectedTemplate?.name}"?
                            </p>
                            <p className="mb-2">This action cannot be undone and will remove all rules associated with this template.</p>
                            <p className="mb-2">This will also unassign the template from any resources that are using it.</p>
                            <p className="text-sm text-muted-foreground">
                                To confirm, please type <span className="font-mono font-medium">{selectedTemplate?.name}</span> below.
                            </p>
                        </div>
                    }
                    buttonText="Delete Template"
                    onConfirm={async () => deleteTemplate(selectedTemplate!.id)}
                    string={selectedTemplate.name}
                    title="Delete Rule Template"
                />
            )}

            {/* Create Template Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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

            <RuleTemplatesDataTable
                columns={columns}
                data={templates}
                createTemplate={() => setIsCreateDialogOpen(true)}
            />
        </>
    );
} 