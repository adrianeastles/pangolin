import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Security Events - Admin - Pangolin",
    description: "View and manage security events"
};

export default function SecurityEventsPage() {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Security Events</h1>
                <p className="text-muted-foreground">
                    Monitor and review security events across your system
                </p>
            </div>
            
            <div className="rounded-md border">
                <div className="p-6">
                    <p className="text-center text-muted-foreground">
                        Security events functionality will be implemented here.
                    </p>
                </div>
            </div>
        </div>
    );
} 