"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@app/hooks/useToast";
import { Play, Copy, CheckCircle, XCircle } from "lucide-react";
import { createApiClient, formatAxiosError } from "@app/lib/api";
import { useEnvContext } from "@app/hooks/useEnvContext";

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

export function RuleEvaluator({ templateId, orgId }: { templateId: string; orgId: string }) {
    const [evaluationType, setEvaluationType] = useState<"IP" | "CIDR" | "PATH">("IP");
    const [evaluationValue, setEvaluationValue] = useState("");
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { env } = useEnvContext();
    const api = createApiClient({ env });

    const quickExamples = {
        IP: ["192.168.1.1", "10.0.0.5", "172.16.0.100"],
        CIDR: ["192.168.1.0/24", "10.0.0.0/8", "172.16.0.0/12"],
        PATH: ["/api/users", "/admin/dashboard", "/public/static"]
    };

    const handleEvaluate = async () => {
        if (!evaluationValue.trim()) {
            toast({
                title: "Error",
                description: "Please enter a value to evaluate",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post(`/org/${orgId}/rule-templates/${templateId}/evaluate`, {
                type: evaluationType,
                value: evaluationValue
            });

            if (response.status === 200) {
                setResult(response.data.data);
                toast({
                    title: "Success",
                    description: "Rules evaluated successfully"
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || "Failed to evaluate rules",
                    variant: "destructive"
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: formatAxiosError(error, "Failed to evaluate rules"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickExample = (example: string) => {
        setEvaluationValue(example);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied",
            description: "Value copied to clipboard"
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Test Request</CardTitle>
                    <CardDescription>
                        Enter a value to test against your resource rules
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="evaluation-type">Type</Label>
                            <Select value={evaluationType} onValueChange={(value: "IP" | "CIDR" | "PATH") => setEvaluationType(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="IP">IP Address</SelectItem>
                                    <SelectItem value="CIDR">CIDR Range</SelectItem>
                                    <SelectItem value="PATH">Path Pattern</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="evaluation-value">Value</Label>
                            <div className="flex space-x-2">
                                <Input
                                    id="evaluation-value"
                                    value={evaluationValue}
                                    onChange={(e) => setEvaluationValue(e.target.value)}
                                    placeholder={
                                        evaluationType === "IP" ? "192.168.1.1" :
                                        evaluationType === "CIDR" ? "192.168.1.0/24" :
                                        "/api/users"
                                    }
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(evaluationValue)}
                                    disabled={!evaluationValue}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label>Quick Examples</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {quickExamples[evaluationType].map((example) => (
                                <Button
                                    key={example}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickExample(example)}
                                >
                                    {example}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleEvaluate} disabled={loading || !evaluationValue}>
                        <Play className="mr-2 h-4 w-4" />
                        {loading ? "Evaluating..." : "Evaluate Rules"}
                    </Button>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle>Evaluation Result</CardTitle>
                        <CardDescription>
                            How your rules evaluated against the test value
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <span className="font-medium">Final Result:</span>
                            {result.matched ? (
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <Badge variant={result.action === "ACCEPT" ? "default" : "destructive"}>
                                        {result.action === "ACCEPT" ? "Allow" : "Deny"}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">(Rule matched)</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <XCircle className="h-5 w-5 text-gray-500" />
                                    <Badge variant="default">Allow</Badge>
                                    <span className="text-sm text-muted-foreground">(No rules apply - using default)</span>
                                </div>
                            )}
                        </div>

                        {result.matchedRule && (
                            <div className="p-3 bg-muted rounded-lg">
                                <h4 className="font-medium mb-2">Matched Rule</h4>
                                <div className="space-y-1 text-sm">
                                    <div><span className="font-medium">Match Type:</span> {result.matchedRule.match}</div>
                                    <div><span className="font-medium">Value:</span> {result.matchedRule.value}</div>
                                    <div><span className="font-medium">Priority:</span> {result.matchedRule.priority}</div>
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="font-medium mb-2">All Rules Evaluation</h4>
                            <div className="space-y-2">
                                {result.evaluatedRules.map((rule) => (
                                    <div
                                        key={rule.ruleId}
                                        className={`p-3 border rounded-lg ${
                                            rule.matched 
                                                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                                                : 'bg-muted/50 border-border'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium">Rule {rule.ruleId}</span>
                                                {rule.matched ? (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Badge variant={rule.action === "ACCEPT" ? "default" : "destructive"}>
                                                    {rule.action === "ACCEPT" ? "Allow" : "Deny"}
                                                </Badge>
                                                <Badge variant="outline">
                                                    Priority {rule.priority}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {rule.match}: {rule.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 