"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@app/components/ui/data-table";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    createTemplate?: () => void;
}

export function RuleTemplatesDataTable<TData, TValue>({
    columns,
    data,
    createTemplate
}: DataTableProps<TData, TValue>) {

    return (
        <DataTable
            columns={columns}
            data={data}
            title="Rule Templates"
            searchPlaceholder="Search templates..."
            searchColumn="name"
            onAdd={createTemplate}
            addButtonText="Create Template"
            defaultSort={{
                id: "name",
                desc: false
            }}
        />
    );
} 