export interface CodeExample {
    id: string;
    name: string;
    category: string;
    complexity: string;
    description: string;
    code: string;
    explanation: string;
    useCases: string[];
    output: string;
}

export interface LanguageConfig {
    id: string;
    name: string;
    icon: string;
    color: string;
    gradient: string;
    badge: string;
    description: string;
    examples: CodeExample[];
}

export { javaData } from "./javaData";
export { pythonData } from "./pythonData";
export { cppData } from "./cppData";
export { cData } from "./cData";
export { csharpData } from "./csharpData";
export { javascriptData } from "./javascriptData";
