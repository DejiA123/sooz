import { LanguageConfig } from "./index";

export const javascriptData: LanguageConfig = {
    id: "javascript",
    name: "JavaScript",
    icon: "✨",
    color: "text-yellow-400",
    gradient: "from-yellow-400 to-orange-500",
    badge: "ES2024+",
    description: "The language of the web — closures, event loop, async patterns, and modern ES6+ features",
    examples: [
        {
            id: "js-closures",
            name: "Closures & Scope",
            category: "Core Concepts",
            complexity: "O(1)",
            description: "Lexical scoping, closure patterns, and the module pattern",
            code: `// === Closure: function remembers its environment ===
function createCounter(initial = 0) {
    let count = initial; // Enclosed variable
    
    return {
        increment: () => ++count,
        decrement: () => --count,
        getCount: () => count,
        reset: () => { count = initial; return count; }
    };
}

// === Closure for data privacy ===
function createBankAccount(owner, balance = 0) {
    // Private state — not accessible from outside
    let _balance = balance;
    const _history = [];
    
    function record(type, amount) {
        _history.push({ type, amount, balance: _balance, date: new Date().toISOString() });
    }
    
    return {
        get owner() { return owner; },
        get balance() { return _balance; },
        
        deposit(amount) {
            if (amount <= 0) throw new Error("Invalid amount");
            _balance += amount;
            record("deposit", amount);
            return this;
        },
        
        withdraw(amount) {
            if (amount > _balance) throw new Error("Insufficient funds");
            _balance -= amount;
            record("withdrawal", amount);
            return this;
        },
        
        getStatement() {
            return _history.map(h =>
                \`  \${h.type}: $\${h.amount} -> Balance: $\${h.balance}\`
            ).join("\\n");
        }
    };
}

// === IIFE (Immediately Invoked Function Expression) ===
const Utils = (() => {
    const cache = new Map();
    
    return {
        memoize(fn) {
            return (...args) => {
                const key = JSON.stringify(args);
                if (!cache.has(key)) cache.set(key, fn(...args));
                return cache.get(key);
            };
        },
        cacheSize: () => cache.size
    };
})();

// --- Usage ---
console.log("=== Counter Closure ===");
const counter = createCounter(10);
console.log("  Increment:", counter.increment()); // 11
console.log("  Increment:", counter.increment()); // 12
console.log("  Decrement:", counter.decrement()); // 11
console.log("  Reset:", counter.reset());          // 10

console.log("\\n=== Bank Account (Private State) ===");
const acct = createBankAccount("Alice", 1000);
acct.deposit(500).withdraw(200).deposit(100);
console.log("  Balance: $" + acct.balance);
console.log(acct.getStatement());

console.log("\\n=== Memoization ===");
const factorial = Utils.memoize(n => n <= 1 ? 1 : n * factorial(n - 1));
console.log("  5! =", factorial(5));
console.log("  Cache entries:", Utils.cacheSize());`,
            explanation: "A closure is a function that retains access to its lexical scope even after the outer function returns. This enables data privacy (no direct access to _balance), factory patterns (createCounter), and memoization. The IIFE pattern creates a private scope immediately. Interview focus: var vs let hoisting, closure memory leaks, IIFE use cases.",
            useCases: ["Data encapsulation", "Factory functions", "Memoization", "Module pattern"],
            output: "=== Counter Closure ===\n  Increment: 11\n  Increment: 12\n  Decrement: 11\n  Reset: 10\n\n=== Bank Account (Private State) ===\n  Balance: $1400\n  deposit: $500 -> Balance: $1500\n  withdrawal: $200 -> Balance: $1300\n  deposit: $100 -> Balance: $1400\n\n=== Memoization ===\n  5! = 120\n  Cache entries: 5"
        },
        {
            id: "js-promises",
            name: "Promises & Async/Await",
            category: "Async",
            complexity: "O(1) per then",
            description: "Mastering async: Promise chains, error handling, concurrency patterns",
            code: `// === Promise creation ===
function fetchUser(id) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (id <= 0) reject(new Error("Invalid ID"));
            else resolve({ id, name: "User_" + id, role: "dev" });
        }, 100);
    });
}

function fetchOrders(userId) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                { id: "ORD-1", total: 99.99 },
                { id: "ORD-2", total: 149.50 }
            ]);
        }, 80);
    });
}

// === Async/Await with error handling ===
async function getUserSummary(id) {
    try {
        const user = await fetchUser(id);
        const orders = await fetchOrders(user.id);
        const total = orders.reduce((sum, o) => sum + o.total, 0);
        return { ...user, orderCount: orders.length, totalSpent: total };
    } catch (error) {
        console.error("  Error:", error.message);
        return null;
    }
}

// === Concurrency patterns ===
async function concurrencyDemo() {
    // Promise.all — all must succeed
    console.log("\\n=== Promise.all ===");
    const [u1, u2, u3] = await Promise.all([
        fetchUser(1), fetchUser(2), fetchUser(3)
    ]);
    console.log("  All done:", [u1, u2, u3].map(u => u.name).join(", "));
    
    // Promise.allSettled — get all results regardless
    console.log("\\n=== Promise.allSettled ===");
    const results = await Promise.allSettled([
        fetchUser(1), fetchUser(-1), fetchUser(3)
    ]);
    results.forEach((r, i) => {
        const status = r.status === "fulfilled" ? r.value.name : r.reason.message;
        console.log(\`  [\${i}] \${r.status}: \${status}\`);
    });
    
    // Promise.race — first to complete wins
    console.log("\\n=== Promise.race ===");
    const fastest = await Promise.race([
        fetchUser(1), fetchUser(2), fetchUser(3)
    ]);
    console.log("  Winner:", fastest.name);
}

// === Retry with backoff ===
async function withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            console.log(\`  Retry \${i + 1}/\${maxRetries}...\`);
            await new Promise(r => setTimeout(r, 100 * (i + 1)));
        }
    }
}

// --- Run ---
(async () => {
    console.log("=== Async/Await ===");
    const summary = await getUserSummary(42);
    console.log("  Summary:", summary);

    await concurrencyDemo();
})();`,
            explanation: "Promises represent eventual values. async/await is syntactic sugar over Promise chains. Promise.all fails fast (one rejection = all fail). Promise.allSettled always returns all results. Promise.race returns the first to settle. Interview focus: microtask queue, unhandled rejections, Promise.any vs race, async error boundaries.",
            useCases: ["API calls", "Database queries", "File operations", "UI data loading"],
            output: "=== Async/Await ===\n  Summary: { id: 42, name: 'User_42', role: 'dev', orderCount: 2, totalSpent: 249.49 }\n\n=== Promise.all ===\n  All done: User_1, User_2, User_3\n\n=== Promise.allSettled ===\n  [0] fulfilled: User_1\n  [1] rejected: Invalid ID\n  [2] fulfilled: User_3\n\n=== Promise.race ===\n  Winner: User_1"
        },
        {
            id: "js-prototypes",
            name: "Prototypal Inheritance",
            category: "OOP",
            complexity: "O(1) lookup per level",
            description: "Prototype chain, class syntax, mixins, and Object.create patterns",
            code: `// === Class syntax (ES6+) ===
class EventEmitter {
    #listeners = new Map();
    
    on(event, handler) {
        if (!this.#listeners.has(event))
            this.#listeners.set(event, []);
        this.#listeners.get(event).push(handler);
        return this;
    }
    
    emit(event, ...args) {
        const handlers = this.#listeners.get(event) || [];
        handlers.forEach(h => h(...args));
    }
    
    off(event, handler) {
        const handlers = this.#listeners.get(event) || [];
        this.#listeners.set(event, handlers.filter(h => h !== handler));
    }
}

// === Inheritance ===
class Component extends EventEmitter {
    #state;
    
    constructor(name, initialState = {}) {
        super();
        this.name = name;
        this.#state = { ...initialState };
    }
    
    setState(updates) {
        const prev = { ...this.#state };
        this.#state = { ...this.#state, ...updates };
        this.emit("stateChange", { prev, next: this.#state });
    }
    
    get state() { return { ...this.#state }; }
}

// === Mixins ===
const Serializable = (Base) => class extends Base {
    toJSON() {
        return JSON.stringify({ name: this.name, state: this.state });
    }
};

const Loggable = (Base) => class extends Base {
    log(msg) {
        console.log(\`  [\${this.name}] \${msg}\`);
    }
};

class Widget extends Loggable(Serializable(Component)) {}

// --- Usage ---
console.log("=== EventEmitter ===");
const emitter = new EventEmitter();
emitter.on("data", (d) => console.log("  Received:", d));
emitter.emit("data", { type: "message", text: "Hello" });

console.log("\\n=== Component State ===");
const btn = new Component("Button", { label: "Click me", count: 0 });
btn.on("stateChange", ({ prev, next }) => {
    console.log("  State:", JSON.stringify(prev), "->", JSON.stringify(next));
});
btn.setState({ count: 1 });
btn.setState({ label: "Clicked!", count: 2 });

console.log("\\n=== Mixins ===");
const widget = new Widget("MyWidget", { visible: true });
widget.log("Initialized");
widget.setState({ visible: false });
console.log("  JSON:", widget.toJSON());

console.log("\\n=== Prototype Chain ===");
console.log("  widget instanceof Widget:", widget instanceof Widget);
console.log("  widget instanceof Component:", widget instanceof Component);
console.log("  widget instanceof EventEmitter:", widget instanceof EventEmitter);`,
            explanation: "JavaScript uses prototypal inheritance — objects inherit directly from other objects via the prototype chain. ES6 classes are syntactic sugar over prototypes. Private fields (#) provide true encapsulation. Mixins compose functionality using higher-order class expressions. Interview focus: __proto__ vs prototype, class vs function constructor, Symbol, WeakRef.",
            useCases: ["UI frameworks", "Event systems", "Plugin architectures", "State management"],
            output: "=== EventEmitter ===\n  Received: { type: 'message', text: 'Hello' }\n\n=== Component State ===\n  State: {\"label\":\"Click me\",\"count\":0} -> {\"label\":\"Click me\",\"count\":1}\n  State: {\"label\":\"Click me\",\"count\":1} -> {\"label\":\"Clicked!\",\"count\":2}\n\n=== Mixins ===\n  [MyWidget] Initialized\n  JSON: {\"name\":\"MyWidget\",\"state\":{\"visible\":false}}\n\n=== Prototype Chain ===\n  widget instanceof Widget: true\n  widget instanceof Component: true\n  widget instanceof EventEmitter: true"
        },
        {
            id: "js-event-loop",
            name: "Event Loop & Microtasks",
            category: "Runtime",
            complexity: "O(1) per tick",
            description: "JavaScript's concurrency model: call stack, task queue, and microtask queue",
            code: `// === Event loop ordering ===
console.log("=== Execution Order ===");
console.log("1. Synchronous");

setTimeout(() => console.log("5. setTimeout (macrotask)"), 0);

Promise.resolve().then(() => {
    console.log("3. Promise.then (microtask)");
}).then(() => {
    console.log("4. Chained .then (microtask)");
});

queueMicrotask(() => console.log("3b. queueMicrotask"));

console.log("2. Synchronous (end of script)");

// === Demonstrating event loop phases ===
function demonstrateLoop() {
    console.log("\\n=== Task Scheduling ===");
    
    // Macrotasks: setTimeout, setInterval
    const tasks = [];
    
    setTimeout(() => tasks.push("timeout-1"), 0);
    setTimeout(() => tasks.push("timeout-2"), 0);
    
    // Microtasks: Promise, queueMicrotask
    Promise.resolve()
        .then(() => tasks.push("promise-1"))
        .then(() => tasks.push("promise-2"))
        .then(() => {
            // Microtasks added during microtask phase
            // execute before next macrotask
            tasks.push("promise-3");
            
            // This macrotask goes after current microtasks
            setTimeout(() => {
                tasks.push("timeout-3");
                console.log("  Order:", tasks.join(" -> "));
            }, 0);
        });
}

demonstrateLoop();

// === Avoiding blocking the event loop ===
function processLargeArray(arr, chunkSize = 1000) {
    return new Promise(resolve => {
        let index = 0;
        const results = [];
        
        function processChunk() {
            const end = Math.min(index + chunkSize, arr.length);
            for (let i = index; i < end; i++) {
                results.push(arr[i] * arr[i]);
            }
            index = end;
            
            if (index < arr.length) {
                // Yield to event loop between chunks
                setTimeout(processChunk, 0);
            } else {
                resolve(results);
            }
        }
        
        processChunk();
    });
}

// Run chunked processing
setTimeout(async () => {
    console.log("\\n=== Non-blocking Processing ===");
    const data = Array.from({length: 5000}, (_, i) => i);
    const result = await processLargeArray(data, 2000);
    console.log(\`  Processed \${result.length} items\`);
    console.log(\`  Last 3: [\${result.slice(-3).join(", ")}]\`);
}, 100);`,
            explanation: "JavaScript is single-threaded with an event loop. The call stack executes synchronous code. When empty, the event loop first processes ALL microtasks (Promise callbacks, queueMicrotask), then one macrotask (setTimeout, I/O). Microtasks added during microtask processing execute before any macrotask. Interview focus: microtask vs macrotask priority, starvation, requestAnimationFrame timing.",
            useCases: ["UI responsiveness", "Background processing", "Animation scheduling", "Debouncing/throttling"],
            output: "=== Execution Order ===\n1. Synchronous\n2. Synchronous (end of script)\n3. Promise.then (microtask)\n3b. queueMicrotask\n4. Chained .then (microtask)\n5. setTimeout (macrotask)\n\n=== Task Scheduling ===\n  Order: promise-1 -> promise-2 -> promise-3 -> timeout-1 -> timeout-2 -> timeout-3\n\n=== Non-blocking Processing ===\n  Processed 5000 items\n  Last 3: [24970009, 24980004, 24990001]"
        },
        {
            id: "js-es6",
            name: "ES6+ Advanced Features",
            category: "Modern JS",
            complexity: "Varies",
            description: "Proxy, Reflect, Symbols, iterators, generators, and destructuring mastery",
            code: `// === Proxy & Reflect: Reactive data ===
function reactive(target) {
    const handlers = new Map();
    
    const proxy = new Proxy(target, {
        get(obj, prop, receiver) {
            return Reflect.get(obj, prop, receiver);
        },
        set(obj, prop, value, receiver) {
            const oldVal = obj[prop];
            const result = Reflect.set(obj, prop, value, receiver);
            if (oldVal !== value && handlers.has(prop)) {
                handlers.get(prop).forEach(fn => fn(value, oldVal));
            }
            return result;
        }
    });
    
    proxy.$watch = (prop, fn) => {
        if (!handlers.has(prop)) handlers.set(prop, []);
        handlers.get(prop).push(fn);
    };
    
    return proxy;
}

// === Generators & Iterators ===
function* range(start, end, step = 1) {
    for (let i = start; i < end; i += step) {
        yield i;
    }
}

function* fibonacci() {
    let [a, b] = [0, 1];
    while (true) {
        yield a;
        [a, b] = [b, a + b];
    }
}

// === Symbol for unique keys ===
const SERIALIZE = Symbol("serialize");

class Config {
    #data;
    constructor(data) { this.#data = data; }
    
    get(key) { return this.#data[key]; }
    
    [SERIALIZE]() {
        return JSON.stringify(this.#data);
    }
    
    // Make iterable
    *[Symbol.iterator]() {
        for (const [key, val] of Object.entries(this.#data)) {
            yield { key, val };
        }
    }
}

// === Advanced Destructuring ===
function processResponse({ 
    data: { users = [], meta: { total, page = 1 } = {} } = {},
    status = 200,
    ...rest
} = {}) {
    return { users, total, page, status, extra: Object.keys(rest) };
}

// --- Usage ---
console.log("=== Reactive Proxy ===");
const state = reactive({ count: 0, name: "App" });
state.$watch("count", (n, o) => console.log(\`  count: \${o} -> \${n}\`));
state.$watch("name", (n) => console.log(\`  name -> \${n}\`));
state.count = 1;
state.count = 2;
state.name = "MyApp";

console.log("\\n=== Generators ===");
console.log("  Range:", [...range(0, 10, 2)]);
const fib = fibonacci();
const first8 = Array.from({length: 8}, () => fib.next().value);
console.log("  Fibonacci:", first8);

console.log("\\n=== Symbol & Iterator ===");
const config = new Config({ theme: "dark", lang: "en", debug: true });
console.log("  Serialized:", config[SERIALIZE]());
for (const { key, val } of config) {
    console.log(\`  \${key} = \${val}\`);
}

console.log("\\n=== Destructuring ===");
const resp = processResponse({
    data: { users: ["a","b"], meta: { total: 100 } },
    status: 200,
    headers: {}
});
console.log("  Result:", resp);`,
            explanation: "Proxy intercepts object operations (get/set/delete) enabling reactive programming, validation, and logging. Generators produce values lazily with yield. Symbols create unique property keys that don't collide. The iterator protocol ([Symbol.iterator]) makes objects work with for...of. Interview focus: Proxy traps, generator delegation (yield*), well-known Symbols.",
            useCases: ["Reactive frameworks (Vue)", "Data validation", "Lazy sequences", "Meta-programming"],
            output: "=== Reactive Proxy ===\n  count: 0 -> 1\n  count: 1 -> 2\n  name -> MyApp\n\n=== Generators ===\n  Range: [0, 2, 4, 6, 8]\n  Fibonacci: [0, 1, 1, 2, 3, 5, 8, 13]\n\n=== Symbol & Iterator ===\n  Serialized: {\"theme\":\"dark\",\"lang\":\"en\",\"debug\":true}\n  theme = dark\n  lang = en\n  debug = true\n\n=== Destructuring ===\n  Result: { users: ['a','b'], total: 100, page: 1, status: 200, extra: ['headers'] }"
        },
        {
            id: "js-modules",
            name: "Module Patterns & Design",
            category: "Architecture",
            complexity: "O(1)",
            description: "Module systems, pub/sub, middleware chains, and composition patterns",
            code: `// === Pub/Sub (Event Bus) ===
class EventBus {
    #channels = {};
    
    subscribe(channel, handler) {
        this.#channels[channel] ??= [];
        this.#channels[channel].push(handler);
        // Return unsubscribe function
        return () => {
            this.#channels[channel] = 
                this.#channels[channel].filter(h => h !== handler);
        };
    }
    
    publish(channel, data) {
        (this.#channels[channel] || []).forEach(h => h(data));
    }
}

// === Middleware Chain (Express-style) ===
class Pipeline {
    #middlewares = [];
    
    use(fn) {
        this.#middlewares.push(fn);
        return this;
    }
    
    async execute(context) {
        let index = 0;
        
        const next = async () => {
            if (index < this.#middlewares.length) {
                const middleware = this.#middlewares[index++];
                await middleware(context, next);
            }
        };
        
        await next();
        return context;
    }
}

// === Compose & Pipe ===
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);
const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);

// --- Usage ---
console.log("=== Event Bus ===");
const bus = new EventBus();
const unsub = bus.subscribe("user:login", (user) =>
    console.log(\`  Welcome, \${user.name}!\`)
);
bus.subscribe("user:login", (user) =>
    console.log(\`  Logging: \${user.name} logged in\`)
);
bus.publish("user:login", { name: "Alice" });
unsub(); // Unsubscribe first handler
bus.publish("user:login", { name: "Bob" });

console.log("\\n=== Middleware Pipeline ===");
const api = new Pipeline();
api.use(async (ctx, next) => {
    console.log(\`  -> Auth: checking token\`);
    ctx.user = "Alice";
    await next();
});
api.use(async (ctx, next) => {
    console.log(\`  -> Logger: \${ctx.method} \${ctx.path}\`);
    const start = Date.now();
    await next();
    console.log(\`  <- Logger: done\`);
});
api.use(async (ctx, next) => {
    console.log(\`  -> Handler: processing for \${ctx.user}\`);
    ctx.result = { status: 200, data: "OK" };
});

api.execute({ method: "GET", path: "/api/users" })
    .then(ctx => console.log("  Result:", ctx.result));

console.log("\\n=== Compose & Pipe ===");
const transform = pipe(
    x => x * 2,
    x => x + 10,
    x => \`Result: \${x}\`
);
console.log("  pipe(5):", transform(5));

const format = compose(
    s => s.toUpperCase(),
    s => s.trim(),
    s => \`[\${s}]\`
);
console.log("  compose:", format("  hello  "));`,
            explanation: "Pub/Sub decouples publishers from subscribers through named channels. Middleware pipelines chain async handlers where each calls next() to pass control. pipe() and compose() create function pipelines — pipe is left-to-right, compose is right-to-left. Interview focus: dependency inversion, loose coupling, middleware execution order, memory management with closures.",
            useCases: ["React state management", "Express/Koa middleware", "Event-driven architecture", "Functional composition"],
            output: "=== Event Bus ===\n  Welcome, Alice!\n  Logging: Alice logged in\n  Logging: Bob logged in\n\n=== Middleware Pipeline ===\n  -> Auth: checking token\n  -> Logger: GET /api/users\n  -> Handler: processing for Alice\n  <- Logger: done\n  Result: { status: 200, data: 'OK' }\n\n=== Compose & Pipe ===\n  pipe(5): Result: 20\n  compose: [  HELLO  ]"
        }
    ]
};
