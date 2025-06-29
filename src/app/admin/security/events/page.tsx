"use client";

import { useEffect, useState } from "react";
import { Badge } from "@app/components/ui/badge";
import { Button } from "@app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@app/components/ui/table";
import { Input } from "@app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/components/ui/select";
import { AlertTriangle, Shield, UserX, UserCheck, Key, Settings, Clock, Loader2, Trash2 } from "lucide-react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { AxiosResponse } from "axios";
import { toast } from "@app/hooks/useToast";

// Types from the server
type SecurityEventType = 
    | "FAILED_LOGIN"
    | "SUCCESSFUL_LOGIN"
    | "PASSWORD_CHANGE"
    | "API_KEY_USED"
    | "ADMIN_ACCESS"
    | "TWO_FACTOR_ENABLED"
    | "TWO_FACTOR_DISABLED"
    | "PASSWORD_RESET_REQUESTED"
    | "PASSWORD_RESET_COMPLETED"
    | "ACCOUNT_CREATED"
    | "ACCOUNT_DELETED"
    | "SESSION_EXPIRED"
    | "SUSPICIOUS_ACTIVITY";

type SecurityEventSeverity = "low" | "medium" | "high";

interface SecurityEvent {
    eventId: number;
    type: SecurityEventType;
    message: string;
    userId: string | null;
    email: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    severity: SecurityEventSeverity;
    metadata: string | null;
    timestamp: number;
}

interface ListSecurityEventsResponse {
    events: SecurityEvent[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const getEventIcon = (type: string) => {
    switch (type) {
        case "FAILED_LOGIN":
            return <UserX className="h-4 w-4" />;
        case "SUCCESSFUL_LOGIN":
            return <UserCheck className="h-4 w-4" />;
        case "PASSWORD_CHANGE":
            return <Key className="h-4 w-4" />;
        case "API_KEY_USED":
            return <Shield className="h-4 w-4" />;
        case "ADMIN_ACCESS":
            return <Settings className="h-4 w-4" />;
        default:
            return <AlertTriangle className="h-4 w-4" />;
    }
};

const getSeverityBadge = (severity: string) => {
    switch (severity) {
        case "high":
            return <Badge variant="destructive">High</Badge>;
        case "medium":
            return <Badge variant="secondary">Medium</Badge>;
        case "low":
            return <Badge variant="outline">Low</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
};

const formatEventType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export default function SecurityEventsPage() {
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });

    const api = createApiClient(useEnvContext());

    useEffect(() => {
        document.title = "Security Events - Admin - Pangolin";
    }, []);

    const fetchSecurityEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });

            if (search.trim()) {
                params.append('search', search.trim());
            }
            if (typeFilter !== 'all') {
                params.append('type', typeFilter);
            }
            if (severityFilter !== 'all') {
                params.append('severity', severityFilter);
            }

            const response = await api.get<AxiosResponse<ListSecurityEventsResponse>>(
                `/admin/security/events?${params.toString()}`
            );

            if (response?.data?.data) {
                setSecurityEvents(response.data.data.events);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            console.error('Error fetching security events:', err);
            setError('Failed to fetch security events');
        } finally {
            setLoading(false);
        }
    };

    const clearAllEvents = async () => {
        if (!confirm('Are you sure you want to clear ALL security events? This action cannot be undone.')) {
            return;
        }

        try {
            setClearing(true);
            const response = await api.delete('/admin/security/events');
            
            if (response?.data?.success) {
                const deletedCount = response.data.data?.deletedCount || 0;
                toast({
                    title: "Success",
                    description: `Successfully cleared ${deletedCount} security events`,
                    variant: "default"
                });
                
                // Refresh the events list
                await fetchSecurityEvents();
            }
        } catch (err) {
            console.error('Error clearing security events:', err);
            toast({
                title: "Error",
                description: "Failed to clear security events",
                variant: "destructive"
            });
        } finally {
            setClearing(false);
        }
    };

    useEffect(() => {
        fetchSecurityEvents();
    }, [pagination.page, search, typeFilter, severityFilter]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on search
    };

    const handleTypeFilterChange = (value: string) => {
        setTypeFilter(value);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on filter
    };

    const handleSeverityFilterChange = (value: string) => {
        setSeverityFilter(value);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 on filter
    };

    if (loading && securityEvents.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Security Events</h1>
                    <p className="text-muted-foreground">
                        Monitor and review security events across your system
                    </p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Security Events</h1>
                    <p className="text-muted-foreground">
                        Monitor and review security events across your system
                    </p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <p className="text-destructive">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Security Events</h1>
                <p className="text-muted-foreground">
                    Monitor and review security events across your system
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pagination.total}</div>
                        <p className="text-xs text-muted-foreground">All time</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                        <UserX className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {securityEvents.filter(e => e.type === "FAILED_LOGIN").length}
                        </div>
                        <p className="text-xs text-muted-foreground">Current page</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Successful Logins</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {securityEvents.filter(e => e.type === "SUCCESSFUL_LOGIN").length}
                        </div>
                        <p className="text-xs text-muted-foreground">Current page</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">High Severity</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {securityEvents.filter(e => e.severity === "high").length}
                        </div>
                        <p className="text-xs text-muted-foreground">Current page</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filter Events</CardTitle>
                    <CardDescription>
                        Filter security events by type, severity, or search for specific users
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div className="flex-1">
                            <Input 
                                placeholder="Search by user, IP address, or message..." 
                                className="w-full"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Event Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="FAILED_LOGIN">Failed Login</SelectItem>
                                <SelectItem value="SUCCESSFUL_LOGIN">Successful Login</SelectItem>
                                <SelectItem value="PASSWORD_CHANGE">Password Change</SelectItem>
                                <SelectItem value="API_KEY_USED">API Key Used</SelectItem>
                                <SelectItem value="ADMIN_ACCESS">Admin Access</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={severityFilter} onValueChange={handleSeverityFilterChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Severity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severities</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Events Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recent Security Events</CardTitle>
                            <CardDescription>
                                Latest security events from across your system (Page {pagination.page} of {pagination.totalPages})
                            </CardDescription>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={clearAllEvents}
                            disabled={clearing || loading || securityEvents.length === 0}
                            className="flex items-center gap-2"
                        >
                            {clearing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Clearing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Clear All
                                </>
                            )}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : securityEvents.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <p className="text-muted-foreground">No security events found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Severity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {securityEvents.map((event) => (
                                    <TableRow key={event.eventId}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getEventIcon(event.type)}
                                                <span className="font-medium">
                                                    {formatEventType(event.type)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{event.message}</TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {event.email || 'N/A'}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {event.ipAddress || 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {new Date(event.timestamp).toLocaleString()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getSeverityBadge(event.severity)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 