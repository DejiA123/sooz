import { LanguageConfig } from "./index";

export const csharpData: LanguageConfig = {
    id: "csharp",
    name: "C#",
    icon: "💎",
    color: "text-purple-500",
    gradient: "from-purple-600 to-violet-500",
    badge: "C# 12 / .NET 8",
    description: "Modern enterprise language with LINQ, async/await, and the .NET ecosystem",
    examples: [
        {
            id: "cs-linq",
            name: "LINQ & Functional Queries",
            category: "Data Processing",
            complexity: "O(n) typical",
            description: "Language-Integrated Query for declarative data manipulation",
            code: "using System;\nusing System.Linq;\nusing System.Collections.Generic;\n\nclass LinqDemo {\n    record Employee(string Name, string Dept, decimal Salary, int Age);\n    \n    static void Main() {\n        var employees = new List<Employee> {\n            new(\"Alice\", \"Engineering\", 120000, 30),\n            new(\"Bob\", \"Engineering\", 95000, 25),\n            new(\"Carol\", \"Marketing\", 85000, 35),\n            new(\"Dave\", \"Engineering\", 140000, 40),\n            new(\"Eve\", \"Marketing\", 92000, 28)\n        };\n        \n        // Query Syntax\n        var highEarners = from e in employees\n                          where e.Salary > 90000\n                          orderby e.Name\n                          select e.Name;\n        Console.WriteLine(\"High earners: \" + string.Join(\", \", highEarners));\n        \n        // Method Syntax with GroupBy\n        var deptStats = employees\n            .GroupBy(e => e.Dept)\n            .Select(g => new {\n                Dept = g.Key,\n                Avg = g.Average(e => e.Salary)\n            });\n        \n        foreach (var d in deptStats)\n            Console.WriteLine($\"  {d.Dept}: avg=${d.Avg:N0}\");\n\n        // Aggregate\n        Console.WriteLine($\"Total: ${employees.Sum(e => e.Salary):N0}\");\n    }\n}",
            explanation: "LINQ brings SQL-like queries into C#. Supports query syntax and method chaining. Deferred execution means queries run only when iterated. Interview focus: IQueryable vs IEnumerable, expression trees, deferred execution.",
            useCases: ["Database queries (EF Core)", "Collection filtering", "Report generation"],
            output: "High earners: Alice, Bob, Dave, Eve\n  Engineering: avg=$118,333\n  Marketing: avg=$88,500\nTotal: $530,000"
        },
        {
            id: "cs-async",
            name: "Async/Await & Tasks",
            category: "Concurrency",
            complexity: "O(1) per await",
            description: "Non-blocking async with Task, cancellation tokens, and async streams",
            code: "using System;\nusing System.Threading;\nusing System.Threading.Tasks;\nusing System.Collections.Generic;\n\nclass AsyncDemo {\n    static async Task<string> FetchAsync(string name, int ms) {\n        Console.WriteLine($\"  Fetching {name}...\");\n        await Task.Delay(ms);\n        return $\"{name}: OK\";\n    }\n\n    static async Task LongRunning(CancellationToken ct) {\n        for (int i = 0; i < 10; i++) {\n            ct.ThrowIfCancellationRequested();\n            Console.WriteLine($\"  Step {i + 1}/10...\");\n            await Task.Delay(100, ct);\n        }\n    }\n\n    static async IAsyncEnumerable<int> StreamNumbers(int n) {\n        for (int i = 0; i < n; i++) {\n            await Task.Delay(50);\n            yield return i * i;\n        }\n    }\n\n    static async Task Main() {\n        // Parallel fetch\n        var results = await Task.WhenAll(\n            FetchAsync(\"users\", 200),\n            FetchAsync(\"posts\", 150),\n            FetchAsync(\"comments\", 100)\n        );\n        foreach(var r in results) Console.WriteLine($\"  Done: {r}\");\n\n        // Cancellation\n        var cts = new CancellationTokenSource();\n        cts.CancelAfter(350);\n        try { await LongRunning(cts.Token); }\n        catch (OperationCanceledException) {\n            Console.WriteLine(\"  Cancelled!\");\n        }\n\n        // Async stream\n        await foreach(var n in StreamNumbers(5))\n            Console.Write($\"  {n}\");\n    }\n}",
            explanation: "C# async/await compiles to a state machine. Task.WhenAll runs concurrently. CancellationToken enables cooperative cancellation. IAsyncEnumerable streams data. Interview focus: ConfigureAwait, deadlocks, ValueTask vs Task, SynchronizationContext.",
            useCases: ["Web API endpoints", "Database queries", "Microservices", "File I/O"],
            output: "  Fetching users...\n  Fetching posts...\n  Fetching comments...\n  Done: users: OK\n  Done: posts: OK\n  Done: comments: OK\n  Step 1/10...\n  Step 2/10...\n  Step 3/10...\n  Cancelled!\n  0  1  4  9  16"
        },
        {
            id: "cs-delegates",
            name: "Delegates & Events",
            category: "Event-Driven",
            complexity: "O(1) per invocation",
            description: "Type-safe function refs with multicast delegates and observer pattern",
            code: "using System;\nusing System.Collections.Generic;\n\nclass EventsDemo {\n    class StockTicker {\n        public event EventHandler<PriceArgs>? PriceChanged;\n        private decimal _price;\n        public string Symbol { get; }\n        \n        public StockTicker(string sym, decimal price) {\n            Symbol = sym; _price = price;\n        }\n        \n        public decimal Price {\n            get => _price;\n            set {\n                var old = _price; _price = value;\n                PriceChanged?.Invoke(this, new PriceArgs(Symbol, old, value));\n            }\n        }\n    }\n    \n    record PriceArgs(string Symbol, decimal Old, decimal New) : EventArgs {\n        public decimal Change => New - Old;\n    }\n    \n    static List<T> Filter<T>(List<T> src, Func<T, bool> pred) {\n        var result = new List<T>();\n        foreach(var item in src) if (pred(item)) result.Add(item);\n        return result;\n    }\n    \n    static void Main() {\n        // Multicast delegate\n        Action<string> logger = m => Console.WriteLine($\"  [Console] {m}\");\n        logger += m => Console.WriteLine($\"  [File] {m}\");\n        logger(\"Server started\");\n\n        // Events\n        var stock = new StockTicker(\"AAPL\", 150m);\n        stock.PriceChanged += (_, a) =>\n            Console.WriteLine($\"  {a.Symbol}: ${a.Old} -> ${a.New} ({(a.Change>=0?\"+\":\"\")}{ a.Change})\");\n        stock.PriceChanged += (_, a) => {\n            if (Math.Abs(a.Change) > 5)\n                Console.WriteLine($\"  ALERT: Large move!\");\n        };\n\n        stock.Price = 153.50m;\n        stock.Price = 142.00m;\n\n        // Func/Action\n        var nums = new List<int> { 1, 2, 3, 4, 5, 6, 7, 8 };\n        var evens = Filter(nums, n => n % 2 == 0);\n        Console.WriteLine(\"Evens: \" + string.Join(\", \", evens));\n    }\n}",
            explanation: "Delegates are type-safe function pointers. Multicast delegates chain handlers. Events restrict invocation to the declaring class. Func<T,TResult> and Action<T> are built-in generics. Interview focus: delegate vs event, lambda closures, weak events.",
            useCases: ["UI event handling", "Callbacks", "Observer pattern", "LINQ predicates"],
            output: "  [Console] Server started\n  [File] Server started\n  AAPL: $150 -> $153.50 (+3.50)\n  AAPL: $153.50 -> $142.00 (-11.50)\n  ALERT: Large move!\nEvens: 2, 4, 6, 8"
        },
        {
            id: "cs-generics",
            name: "Generics & Constraints",
            category: "Type System",
            complexity: "Compile-time",
            description: "Generic classes with type constraints for safe, reusable code",
            code: "using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\nclass GenericsDemo {\n    interface IEntity { int Id { get; } }\n    record Product(int Id, string Name, decimal Price) : IEntity;\n\n    class Repository<T> where T : class, IEntity {\n        private readonly List<T> _items = new();\n        public void Add(T item) => _items.Add(item);\n        public T? FindById(int id) => _items.FirstOrDefault(x => x.Id == id);\n        public IEnumerable<T> Where(Func<T, bool> pred) => _items.Where(pred);\n        public int Count => _items.Count;\n    }\n    \n    static T Max<T>(T a, T b) where T : IComparable<T>\n        => a.CompareTo(b) >= 0 ? a : b;\n\n    // Result<T> monad\n    class Result<T> {\n        public T? Value { get; }\n        public string? Error { get; }\n        public bool IsOk => Error == null;\n        Result(T? v, string? e) { Value = v; Error = e; }\n        public static Result<T> Ok(T val) => new(val, null);\n        public static Result<T> Fail(string err) => new(default, err);\n        public Result<U> Map<U>(Func<T, U> fn)\n            => IsOk ? Result<U>.Ok(fn(Value!)) : Result<U>.Fail(Error!);\n    }\n    \n    static void Main() {\n        var repo = new Repository<Product>();\n        repo.Add(new(1, \"Laptop\", 999m));\n        repo.Add(new(2, \"Mouse\", 29m));\n        repo.Add(new(3, \"Keyboard\", 79m));\n\n        Console.WriteLine($\"Found: {repo.FindById(2)}\");\n        foreach(var p in repo.Where(p => p.Price > 50))\n            Console.WriteLine($\"  {p.Name}: ${p.Price}\");\n\n        Console.WriteLine($\"Max(3,7) = {Max(3, 7)}\");\n\n        var r1 = Result<int>.Ok(42).Map(n => n * 2);\n        var r2 = Result<int>.Fail(\"bad input\").Map(n => n * 2);\n        Console.WriteLine($\"Ok: {r1.Value}, Fail: {r2.Error}\");\n    }\n}",
            explanation: "C# generics are reified (type info preserved at runtime). Constraints restrict type parameters: class, struct, new(), interface. The Result<T> pattern provides error handling without exceptions. Interview focus: covariance/contravariance, type erasure (Java) vs reification (C#).",
            useCases: ["Repository pattern", "Result types", "Generic collections", "Type-safe builders"],
            output: "Found: Product { Id = 2, Name = Mouse, Price = 29 }\n  Laptop: $999\n  Keyboard: $79\nMax(3,7) = 7\nOk: 84, Fail: bad input"
        },
        {
            id: "cs-di",
            name: "Dependency Injection",
            category: "Architecture",
            complexity: "O(1)",
            description: "Constructor injection and interface-based design for testable code",
            code: "using System;\nusing System.Collections.Generic;\n\nclass DIDemo {\n    interface ILogger { void Log(string msg); }\n    interface IEmailSvc { void Send(string to, string subj); }\n    interface IUserRepo { string? GetEmail(string user); }\n\n    class ConsoleLogger : ILogger {\n        public void Log(string msg) => Console.WriteLine($\"  [LOG] {msg}\");\n    }\n\n    class MockEmail : IEmailSvc {\n        public int Count { get; private set; }\n        public void Send(string to, string subj) {\n            Count++;\n            Console.WriteLine($\"  [EMAIL] {to}: {subj}\");\n        }\n    }\n\n    class UserRepo : IUserRepo {\n        Dictionary<string, string> _db = new() {\n            [\"alice\"] = \"alice@dev.io\", [\"bob\"] = \"bob@dev.io\"\n        };\n        public string? GetEmail(string u) =>\n            _db.TryGetValue(u, out var e) ? e : null;\n    }\n\n    class NotificationService {\n        readonly ILogger _log;\n        readonly IEmailSvc _email;\n        readonly IUserRepo _users;\n\n        public NotificationService(ILogger l, IEmailSvc e, IUserRepo u) {\n            _log = l; _email = e; _users = u;\n        }\n\n        public bool Notify(string user, string msg) {\n            _log.Log($\"Notifying {user}...\");\n            var email = _users.GetEmail(user);\n            if (email == null) { _log.Log(\"Not found!\"); return false; }\n            _email.Send(email, msg);\n            return true;\n        }\n    }\n    \n    static void Main() {\n        var log = new ConsoleLogger();\n        var email = new MockEmail();\n        var users = new UserRepo();\n        var svc = new NotificationService(log, email, users);\n\n        svc.Notify(\"alice\", \"Order shipped!\");\n        svc.Notify(\"unknown\", \"Hello!\");\n        Console.WriteLine($\"Emails sent: {email.Count}\");\n    }\n}",
            explanation: "DI inverts control: classes declare dependencies via constructors, containers provide implementations. Enables testability (inject mocks), flexibility (swap implementations). .NET supports Transient, Scoped, Singleton lifetimes. Interview focus: IoC, service lifetimes, composition root.",
            useCases: ["ASP.NET Core", "Unit testing", "Plugin systems", "Configuration"],
            output: "  [LOG] Notifying alice...\n  [EMAIL] alice@dev.io: Order shipped!\n  [LOG] Notifying unknown...\n  [LOG] Not found!\nEmails sent: 1"
        },
        {
            id: "cs-patterns",
            name: "Pattern Matching & Records",
            category: "Modern C#",
            complexity: "O(1)",
            description: "Switch expressions, property patterns, and immutable records",
            code: "using System;\nusing System.Linq;\n\nclass PatternsDemo {\n    abstract record Shape;\n    record Circle(double R) : Shape;\n    record Rect(double W, double H) : Shape;\n    record Tri(double Base, double Height) : Shape;\n\n    static string Describe(Shape s) => s switch {\n        Circle { R: > 10 } c => $\"Large circle r={c.R}\",\n        Circle c => $\"Circle r={c.R}, area={Math.PI*c.R*c.R:F1}\",\n        Rect { W: var w, H: var h } when w == h => $\"Square {w}x{h}\",\n        Rect r => $\"Rect {r.W}x{r.H}\",\n        Tri t => $\"Triangle base={t.Base}\",\n        _ => \"Unknown\"\n    };\n\n    static void Main() {\n        Shape[] shapes = {\n            new Circle(5), new Circle(15),\n            new Rect(4, 4), new Rect(3, 7),\n            new Tri(6, 4)\n        };\n\n        foreach(var s in shapes)\n            Console.WriteLine($\"  {Describe(s)}\");\n\n        // with-expression (non-destructive mutation)\n        var p1 = new Circle(5);\n        var p2 = p1 with { R = 10 };\n        Console.WriteLine($\"  Original: {p1}, Copy: {p2}\");\n        Console.WriteLine($\"  Equal? {p1 == p2}\");\n\n        // Deconstruct\n        var (r) = new Circle(7);\n        Console.WriteLine($\"  Deconstructed radius: {r}\");\n    }\n}",
            explanation: "Pattern matching supports type, property, relational, and positional patterns. Records provide value equality, with-expressions, and deconstruction. Switch expressions are exhaustive. Interview focus: when vs if in patterns, positional vs nominal, record struct vs record class.",
            useCases: ["Domain modeling", "State machines", "Validation", "API responses"],
            output: "  Circle r=5, area=78.5\n  Large circle r=15\n  Square 4x4\n  Rect 3x7\n  Triangle base=6\n  Original: Circle { R = 5 }, Copy: Circle { R = 10 }\n  Equal? False\n  Deconstructed radius: 7"
        }
    ]
};
