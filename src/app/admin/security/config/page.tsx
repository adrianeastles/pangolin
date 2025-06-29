"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/components/ui/card";
import { Button } from "@app/components/ui/button";
import { Input } from "@app/components/ui/input";
import { Label } from "@app/components/ui/label";
import { Switch } from "@app/components/ui/switch";
import { Shield, Settings, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { createApiClient } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";
import { AxiosResponse } from "axios";
import { toast } from "@app/hooks/useToast";

interface SecurityConfig {
    lockoutEnabled: boolean;
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    logFailedAttempts: boolean;
    requireEmailVerification: boolean;
    sessionTimeoutMinutes: number;
}

export default function SecurityConfigPage() {
    const [config, setConfig] = useState<SecurityConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const api = createApiClient(useEnvContext());

    useEffect(() => {
        document.title = "Security Configuration - Admin - Pangolin";
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const response = await api.get("/admin/security/config");
            
            if (response?.data?.data) {
                setConfig(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching security config:', error);
            toast({
                title: "Error",
                description: "Failed to load security configuration",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = (updates: Partial<SecurityConfig>) => {
        if (!config) return;
        
        setConfig({ ...config, ...updates });
        setHasChanges(true);
    };

    const saveConfig = async () => {
        if (!config) return;

        try {
            setSaving(true);
            await api.post("/admin/security/config", config);
            
            setHasChanges(false);
            toast({
                title: "Success",
                description: "Security configuration saved successfully",
                variant: "default"
            });
        } catch (error) {
            console.error('Error saving security config:', error);
            toast({
                title: "Error",
                description: "Failed to save security configuration",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const resetToDefaults = async () => {
        if (!confirm('Are you sure you want to reset all security settings to defaults? This cannot be undone.')) {
            return;
        }

        try {
            setSaving(true);
            const response = await api.post("/admin/security/config/reset");
            
            if (response?.data?.data) {
                setConfig(response.data.data);
                setHasChanges(false);
                toast({
                    title: "Success",
                    description: "Security configuration reset to defaults",
                    variant: "default"
                });
            }
        } catch (error) {
            console.error('Error resetting security config:', error);
            toast({
                title: "Error",
                description: "Failed to reset security configuration",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Security Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure security settings for your application
                    </p>
                </div>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold">Security Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure security settings for your application
                    </p>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            Failed to load security configuration. Please try refreshing the page.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Security Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure security settings for your application
                    </p>
                </div>
                <div className="flex gap-2">
                    {hasChanges && (
                        <Button onClick={saveConfig} disabled={saving}>
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    )}
                    <Button variant="outline" onClick={resetToDefaults} disabled={saving}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Defaults
                    </Button>
                </div>
            </div>

            {hasChanges && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">You have unsaved changes. Remember to save your configuration.</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Account Lockout Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Account Lockout
                    </CardTitle>
                    <CardDescription>
                        Configure automatic account lockout after failed login attempts
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="lockout-enabled">Enable Account Lockout</Label>
                            <div className="text-sm text-muted-foreground">
                                Automatically lock accounts after multiple failed login attempts
                            </div>
                        </div>
                        <Switch
                            id="lockout-enabled"
                            checked={config.lockoutEnabled}
                            onCheckedChange={(checked) => updateConfig({ lockoutEnabled: checked })}
                        />
                    </div>

                    {config.lockoutEnabled && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="max-attempts">Maximum Failed Attempts</Label>
                                    <Input
                                        id="max-attempts"
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={config.maxFailedAttempts}
                                        onChange={(e) => updateConfig({ maxFailedAttempts: parseInt(e.target.value) || 5 })}
                                    />
                                    <div className="text-sm text-muted-foreground">
                                        Number of failed attempts before account is locked
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lockout-duration">Lockout Duration (minutes)</Label>
                                    <Input
                                        id="lockout-duration"
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={config.lockoutDurationMinutes}
                                        onChange={(e) => updateConfig({ lockoutDurationMinutes: parseInt(e.target.value) || 30 })}
                                    />
                                    <div className="text-sm text-muted-foreground">
                                        How long accounts remain locked (max 24 hours)
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* General Security Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        General Security
                    </CardTitle>
                    <CardDescription>
                        Configure general security settings and logging
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="log-failed-attempts">Log Failed Login Attempts</Label>
                            <div className="text-sm text-muted-foreground">
                                Record all failed login attempts in security events
                            </div>
                        </div>
                        <Switch
                            id="log-failed-attempts"
                            checked={config.logFailedAttempts}
                            onCheckedChange={(checked) => updateConfig({ logFailedAttempts: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="require-email-verification">Require Email Verification</Label>
                            <div className="text-sm text-muted-foreground">
                                Users must verify their email before accessing the system
                            </div>
                        </div>
                        <Switch
                            id="require-email-verification"
                            checked={config.requireEmailVerification}
                            onCheckedChange={(checked) => updateConfig({ requireEmailVerification: checked })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                        <Input
                            id="session-timeout"
                            type="number"
                            min="5"
                            max="43200"
                            value={config.sessionTimeoutMinutes}
                            onChange={(e) => updateConfig({ sessionTimeoutMinutes: parseInt(e.target.value) || 60 })}
                        />
                        <div className="text-sm text-muted-foreground">
                            How long user sessions remain active (5 minutes to 30 days)
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Current Settings Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Configuration Summary</CardTitle>
                    <CardDescription>
                        Overview of your current security settings
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <div className="font-medium">Account Lockout</div>
                            <div className="text-muted-foreground">
                                {config.lockoutEnabled ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        {config.lockoutEnabled && (
                            <>
                                <div>
                                    <div className="font-medium">Max Attempts</div>
                                    <div className="text-muted-foreground">{config.maxFailedAttempts}</div>
                                </div>
                                <div>
                                    <div className="font-medium">Lockout Duration</div>
                                    <div className="text-muted-foreground">{config.lockoutDurationMinutes} minutes</div>
                                </div>
                            </>
                        )}
                        <div>
                            <div className="font-medium">Failed Attempt Logging</div>
                            <div className="text-muted-foreground">
                                {config.logFailedAttempts ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <div>
                            <div className="font-medium">Email Verification</div>
                            <div className="text-muted-foreground">
                                {config.requireEmailVerification ? 'Required' : 'Optional'}
                            </div>
                        </div>
                        <div>
                            <div className="font-medium">Session Timeout</div>
                            <div className="text-muted-foreground">
                                {Math.round(config.sessionTimeoutMinutes / 60)} hours
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 