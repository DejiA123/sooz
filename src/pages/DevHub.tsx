import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Code2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
    javaData,
    pythonData,
    cppData,
    cData,
    csharpData,
    javascriptData,
    type LanguageConfig,
    type CodeExample,
} from "@/data/languages";

const languages: LanguageConfig[] = [
    javaData,
    pythonData,
    cppData,
    cData,
    csharpData,
    javascriptData,
];

export default function DevHub() {
    const [selectedLang, setSelectedLang] = useState<LanguageConfig>(languages[0]);
    const [selectedExample, setSelectedExample] = useState<CodeExample | null>(null);
    const [output, setOutput] = useState<string>("");
    const [isRunning, setIsRunning] = useState(false);

    const simulateRun = (example: CodeExample) => {
        setIsRunning(true);
        setOutput(`Compiling ${selectedLang.name} code...\n`);

        setTimeout(() => {
            setOutput((prev) => prev + `Running ${example.name}...\n\n`);

            setTimeout(() => {
                setOutput((prev) => prev + example.output + "\n\n✓ Program finished successfully");
                setIsRunning(false);
            }, 400);
        }, 300);
    };

    const handleSelectLang = (lang: LanguageConfig) => {
        setSelectedLang(lang);
        setSelectedExample(null);
        setOutput("");
    };

    const categories = [...new Set(selectedLang.examples.map((e) => e.category))];

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Link to="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedLang.gradient} flex items-center justify-center text-lg`}>
                            {selectedLang.icon}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Developer Hub</h1>
                            <p className="text-xs text-muted-foreground">
                                Advanced {selectedLang.name} • Interview Ready
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6">
                {/* Language Selector */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {languages.map((lang) => (
                        <button
                            key={lang.id}
                            onClick={() => handleSelectLang(lang)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${selectedLang.id === lang.id
                                    ? `bg-gradient-to-r ${lang.gradient} text-white shadow-lg`
                                    : "bg-card border border-border hover:border-primary/30 text-foreground"
                                }`}
                        >
                            <span className="text-base">{lang.icon}</span>
                            <span>{lang.name}</span>
                        </button>
                    ))}
                </div>

                {/* Language Description */}
                <div className="mb-8 text-center">
                    <Badge className={`mb-3 bg-gradient-to-r ${selectedLang.gradient} text-white border-0`}>
                        {selectedLang.badge}
                    </Badge>
                    <h2 className="text-2xl md:text-3xl font-bold mb-2">{selectedLang.name}</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
                        {selectedLang.description}
                    </p>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                    {categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="px-3 py-1.5 text-xs">
                            {cat}
                        </Badge>
                    ))}
                </div>

                {/* Example Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {selectedLang.examples.map((example) => (
                        <Card
                            key={example.id}
                            className={`p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-border/50 ${selectedExample?.id === example.id ? "ring-2 ring-primary border-primary" : ""
                                }`}
                            onClick={() => {
                                setSelectedExample(example);
                                setOutput("");
                            }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${selectedLang.gradient} bg-opacity-20 flex items-center justify-center text-lg`}>
                                    {selectedLang.icon}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {example.complexity}
                                </Badge>
                            </div>
                            <h3 className="text-base font-semibold mb-1.5">{example.name}</h3>
                            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {example.description}
                            </p>
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">
                                    {example.category}
                                </Badge>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Selected Example Details */}
                {selectedExample && (
                    <Card className="p-5 md:p-6 border-primary/20">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold">{selectedExample.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedExample.category} • {selectedExample.complexity}
                                </p>
                            </div>
                            <Button
                                onClick={() => simulateRun(selectedExample)}
                                disabled={isRunning}
                                className={`gap-2 bg-gradient-to-r ${selectedLang.gradient} text-white hover:opacity-90`}
                            >
                                <Play className="w-4 h-4" />
                                {isRunning ? "Running..." : "Run Code"}
                            </Button>
                        </div>

                        <Tabs defaultValue="code" className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="code">{selectedLang.name} Code</TabsTrigger>
                                <TabsTrigger value="explanation">Explanation</TabsTrigger>
                                <TabsTrigger value="output">Output</TabsTrigger>
                            </TabsList>

                            <TabsContent value="code">
                                <div className="relative">
                                    <pre className="bg-zinc-950 text-zinc-100 p-4 md:p-6 rounded-xl overflow-x-auto text-xs md:text-sm font-mono leading-relaxed border border-zinc-800 max-h-[500px]">
                                        <code>{selectedExample.code}</code>
                                    </pre>
                                    <Badge className={`absolute top-3 right-3 bg-gradient-to-r ${selectedLang.gradient} text-white border-0`}>
                                        {selectedLang.badge}
                                    </Badge>
                                </div>
                            </TabsContent>

                            <TabsContent value="explanation">
                                <div className="space-y-5">
                                    <div>
                                        <h4 className="font-semibold mb-2">How it works</h4>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {selectedExample.explanation}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-2">Industry Use Cases</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedExample.useCases.map((use) => (
                                                <Badge key={use} variant="outline">
                                                    {use}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="output">
                                <div className="bg-zinc-950 text-green-400 p-4 md:p-6 rounded-xl min-h-[200px] max-h-[400px] overflow-auto font-mono text-xs md:text-sm border border-zinc-800 whitespace-pre-wrap">
                                    {output || (
                                        <span className="text-zinc-500">
                                            Click "Run Code" to see output...
                                        </span>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                )}
            </div>
        </div>
    );
}
