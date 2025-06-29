"use client";

import { useEffect, useState } from "react";
import { Badge } from "@app/components/ui/badge";
import { Button } from "@app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@app/components/ui/table";
import { Input } from "@app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/components/ui/select";
import { UserX, Unlock, Shield, Clock, Loader2, AlertTriangle } from "lucide-react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { AxiosResponse } from "axios";
import { toast } from "@app/hooks/useToast";

interface AccountLockout {
    lockoutId: number;
    email: string;
    ipAddress: string | null;
    failedAttempts: number;
    lockedAt: number | null;
    lockoutExpiresAt: number | null;
    isLocked: boolean;
    isExpired: boolean;
    remainingTime: number | null;
}

interface ListAccountLockoutsResponse {
    lockouts: AccountLockout[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

const formatRemainingTime = (remainingTimeMs: number | null) => {
    if (!remainingTimeMs || remainingTimeMs <= 0) return "Expired";
    
    const minutes = Math.ceil(remainingTimeMs / (1000 * 60));
    if (minutes < 60) {
        return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const getLockoutStatus = (lockout: AccountLockout) => {
    if (!lockout.isLocked || lockout.isExpired) {
        return <Badge variant="outline">Expired</Badge>;
    }
    return <Badge variant="destructive">Locked</Badge>;
};

export default function AccountLockoutsPage() {
    const [lockouts, setLockouts] = useState<AccountLockout[]>([]);
    const [loading, setLoading] = useState(true);
    const [unlocking, setUnlocking] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });

    const api = createApiClient(useEnvContext());

    useEffect(() => {
        document.title = "Account Lockouts - Admin - Pangolin";
    }, []);

    const fetchLockouts = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                includeExpired: statusFilter === "all" ? "true" : "false"
            });

            const response = await api.get<AxiosResponse<ListAccountLockoutsResponse>>(
                `/admin/security/lockouts?${params.toString()}`
            );

            if (response?.data?.data) {
                let filteredLockouts = response.data.data.lockouts;
                
                // Apply search filter
                if (search.trim()) {
                    const searchTerm = search.trim().toLowerCase();
                    filteredLockouts = filteredLockouts.filter(lockout =>
                        lockout.email.toLowerCase().includes(searchTerm) ||
                        (lockout.ipAddress && lockout.ipAddress.toLowerCase().includes(searchTerm))
                    );
                }

                // Apply status filter
                if (statusFilter === "active") {
                    filteredLockouts = filteredLockouts.filter(lockout => 
                        lockout.isLocked && !lockout.isExpired
                    );
                }

                setLockouts(filteredLockouts);
                setPagination(response.data.data.pagination);
            }
        } catch (err) {
            console.error('Error fetching account lockouts:', err);
            setError('Failed to fetch account lockouts');
        } finally {
            setLoading(false);
        }
    };

    const unlockAccount = async (email: string) => {
        if (!confirm(`Are you sure you want to unlock the account for ${email}?`)) {
            return;
        }

        try {
            setUnlocking(prev => new Set(prev).add(email));
            
            const response = await api.post('/admin/security/unlock-account', { email });
            
            if (response?.data?.success) {
                toast({
                    title: "Success",
                    description: `Account ${email} has been unlocked successfully`,
                    variant: "default"
                });
                
                // Refresh the lockouts list
                await fetchLockouts();
            }
        } catch (err) {
            console.error('Error unlocking account:', err);
            toast({
                title: "Error",
                description: `Failed to unlock account ${email}`,
                variant: "destructive"
            });
        } finally {
            setUnlocking(prev => {
                const newSet = new Set(prev);
                newSet.delete(email);
                return newSet;
            });
        }
    };

    useEffect(() => {
        fetchLockouts();
    }, [pagination.page, statusFilter]);

    // Refetch when search changes with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLockouts();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
    };

    if (loading && lockouts.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Account Lockouts</h1>
                    <p className="text-muted-foreground">
                        Manage and unlock blocked user accounts
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
                    <h1 className="text-3xl font-bold">Account Lockouts</h1>
                    <p className="text-muted-foreground">
                        Manage and unlock blocked user accounts
                    </p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <p className="text-destructive">{error}</p>
                </div>
            </div>
        );
    }

    const activeLockouts = lockouts.filter(l => l.isLocked && !l.isExpired);
    const expiredLockouts = lockouts.filter(l => !l.isLocked || l.isExpired);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Account Lockouts</h1>
                <p className="text-muted-foreground">
                    Manage and unlock blocked user accounts
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Lockouts</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pagination.total}</div>
                        <p className="text-xs text-muted-foreground">All time</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Lockouts</CardTitle>
                        <UserX className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {activeLockouts.length}
                        </div>
                        <p className="text-xs text-muted-foreground">Currently locked</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Expired Lockouts</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">
                            {expiredLockouts.length}
                        </div>
                        <p className="text-xs text-muted-foreground">Auto-expired</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filter Lockouts</CardTitle>
                    <CardDescription>
                        Search for specific accounts or filter by lockout status
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 md:flex-row">
                        <div className="flex-1">
                            <Input 
                                placeholder="Search by email or IP address..." 
                                className="w-full"
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lockouts</SelectItem>
                                <SelectItem value="active">Active Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Lockouts Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Lockouts</CardTitle>
                    <CardDescription>
                        View and manage locked user accounts (Page {pagination.page} of {pagination.totalPages})
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : lockouts.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <p className="text-muted-foreground">No account lockouts found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Failed Attempts</TableHead>
                                    <TableHead>Locked At</TableHead>
                                    <TableHead>Remaining Time</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lockouts.map((lockout) => (
                                    <TableRow key={lockout.lockoutId}>
                                        <TableCell className="font-mono text-sm">
                                            {lockout.email}
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {lockout.ipAddress || 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                                {lockout.failedAttempts}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {lockout.lockedAt ? (
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(lockout.lockedAt).toLocaleString()}
                                                </div>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatRemainingTime(lockout.remainingTime)}
                                        </TableCell>
                                        <TableCell>
                                            {getLockoutStatus(lockout)}
                                        </TableCell>
                                        <TableCell>
                                            {lockout.isLocked && !lockout.isExpired ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => unlockAccount(lockout.email)}
                                                    disabled={unlocking.has(lockout.email)}
                                                    className="flex items-center gap-2"
                                                >
                                                    {unlocking.has(lockout.email) ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                            Unlocking...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Unlock className="h-4 w-4" />
                                                            Unlock
                                                        </>
                                                    )}
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">N/A</span>
                                            )}
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