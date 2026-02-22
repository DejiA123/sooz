import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Activity,
    BarChart3,
    Cpu,
    Database,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    User
} from "lucide-react";
import { AnalyticsBridge, type ServiceReport } from "@/services/AnalyticsBridge";
import { toast } from "sonner";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

export default function AnalyticsDashboard() {
    const [reports, setReports] = useState<ServiceReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState(false);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === "0902") {
            setIsAuthenticated(true);
            setPasswordError(false);
            loadData();
        } else {
            setPasswordError(true);
            toast.error("Incorrect Admin Password");
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await AnalyticsBridge.getAllReports();
            setReports(data);
        } catch (error) {
            toast.error("Failed to sync polyglot services");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only load data if already authenticated (e.g. session persistence)
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center px-4">
                <Card className="w-full max-w-md p-8 border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                            <BarChart3 className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">Admin Access Required</h2>
                        <p className="text-sm text-muted-foreground mt-2">Enter the authorization code to view app analytics</p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <input
                                type="password"
                                placeholder="Enter Admin Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full bg-white/5 border ${passwordError ? 'border-destructive' : 'border-white/10'} rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all`}
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full h-12 text-lg font-semibold rounded-xl">
                            Unlock Dashboard
                        </Button>
                    </form>
                </Card>
            </div>
        );
    }

    const javaReport = reports.find(r => r.language === "Java");
    const pythonReport = reports.find(r => r.language === "Python");
    const cppReport = reports.find(r => r.language === "C++");
    const csReport = reports.find(r => r.language === "C#");

    return (
        <div className="container mx-auto px-4 py-8 pb-24">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                        App Analytics Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Real-time processing powered by Java, Python, C++ & C# Polyglot Engines
                    </p>
                </div>
                <Button onClick={loadData} disabled={isLoading} className="gap-2">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Sync Services
                </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {reports.map((report) => (
                    <Card key={report.language} className="p-4 border-white/10 bg-white/5 backdrop-blur-lg">
                        <div className="flex justify-between items-start mb-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                {report.language === "Java" && <BarChart3 className="w-5 h-5 text-red-400" />}
                                {report.language === "Python" && <Activity className="w-5 h-5 text-yellow-400" />}
                                {report.language === "C++" && <Cpu className="w-5 h-5 text-blue-400" />}
                                {report.language === "C#" && <Database className="w-5 h-5 text-purple-400" />}
                            </div>
                            <Badge variant={report.status === 'success' ? 'default' : 'destructive'}
                                className={report.status === 'success' ? 'bg-green-500/20 text-green-400' : ''}>
                                {report.status}
                            </Badge>
                        </div>
                        <h3 className="font-bold text-lg">{report.language} Engine</h3>
                        <p className="text-xs text-muted-foreground">Execution: {report.duration}ms</p>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="java" className="w-full">
                <TabsList className="bg-white/5 border border-white/10 p-1 mb-6">
                    <TabsTrigger value="java" className="px-6">Java Reports</TabsTrigger>
                    <TabsTrigger value="python" className="px-6">Python Trends</TabsTrigger>
                    <TabsTrigger value="cpp" className="px-6">C++ Performance</TabsTrigger>
                    <TabsTrigger value="csharp" className="px-6">Health (C#)</TabsTrigger>
                </TabsList>

                <TabsContent value="java">
                    <Card className="p-6 bg-white/5 border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <BarChart3 className="w-6 h-6 text-red-400" />
                            <h2 className="text-xl font-bold">Advanced Engagement Analysis</h2>
                        </div>
                        <div className="space-y-4">
                            {javaReport?.results.map((u: any) => (
                                <div key={u.userId} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                                            <User className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold">{u.userId}</p>
                                            <p className="text-xs text-muted-foreground">{u.primaryActivity}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-primary">{u.totalActions} actions</p>
                                        <p className="text-[10px] text-muted-foreground">Avg: {u.avgDuration}ms</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="python">
                    <Card className="p-6 bg-white/5 border-white/10">
                        <div className="flex items-center gap-3 mb-6">
                            <Activity className="w-6 h-6 text-yellow-400" />
                            <h2 className="text-xl font-bold">Statistical Trends</h2>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-fit">
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 text-center">
                                    <p className="text-sm text-yellow-400 mb-1 font-medium">Unique Users</p>
                                    <p className="text-4xl font-bold">{pythonReport?.results.metrics.unique_users}</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 text-center">
                                    <p className="text-sm text-blue-400 mb-1 font-medium">Avg Interaction Rate</p>
                                    <p className="text-4xl font-bold">{pythonReport?.results.metrics.avg_interactions_per_user}</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 text-center">
                                    <p className="text-sm text-purple-400 mb-1 font-medium">Avg Time Spent</p>
                                    <p className="text-4xl font-bold">{pythonReport?.results.metrics.avg_time_spent_sec}s</p>
                                </div>
                            </div>

                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <h3 className="text-lg font-semibold mb-6">Interaction Distribution</h3>
                                <div className="h-[200px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Posts', value: pythonReport?.results.distribution.Posts || 0, color: '#ef4444' },
                                            { name: 'Likes', value: pythonReport?.results.distribution.Likes || 0, color: '#3b82f6' },
                                            { name: 'Views', value: pythonReport?.results.distribution.Views || 0, color: '#10b981' }
                                        ]}>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                            <YAxis hide />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                                itemStyle={{ color: '#fff' }}
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                                {
                                                    [0, 1, 2].map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={['#ef4444', '#3b82f6', '#10b981'][index]} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="cpp">
                    <Card className="p-6 bg-white/5 border-white/10">
                        <div className="flex items-center gap-3 mb-4">
                            <Cpu className="w-6 h-6 text-blue-400" />
                            <h2 className="text-xl font-bold">C++ FastSort Algorithm Analysis</h2>
                        </div>
                        <div className="bg-black/40 p-6 rounded-xl font-mono text-sm space-y-2 border border-blue-500/20">
                            <p className="text-blue-400 mt-2">Initializing dataset: {cppReport?.results.processedCount.toLocaleString()} elements</p>
                            <p className="text-zinc-400">&gt; Allocating memory... OK</p>
                            <p className="text-zinc-400">&gt; Generating random values... OK</p>
                            <p className="text-zinc-400">&gt; Sorting with std::sort (O(n log n))...</p>
                            <p className="text-green-400">✓ Completed in {cppReport?.results.sortDuration} seconds</p>
                            <p className="text-zinc-400">&gt; Verification: min={cppReport?.results.minVal}, max={cppReport?.results.maxVal}</p>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="csharp">
                    <Card className="p-6 bg-white/5 border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Database className="w-6 h-6 text-purple-400" />
                                <h2 className="text-xl font-bold">System Vitality (C# Service)</h2>
                            </div>
                            <Badge variant="outline" className="gap-2">
                                <Clock className="w-3 h-3" />
                                {new Date(csReport?.lastRun || '').toLocaleTimeString()}
                            </Badge>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(csReport?.results.componentStatus || {}).map(([name, data]: [string, any]) => (
                                <div key={name} className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/5">
                                    {data.status === 'OK' ?
                                        <CheckCircle2 className="w-5 h-5 text-green-400" /> :
                                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                    }
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-semibold">{name}</span>
                                            <span className="text-xs text-muted-foreground">Load: {Math.round(data.load * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${data.load * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
