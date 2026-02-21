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
            code: `using System;
using System.Linq;
using System.Collections.Generic;

class LinqDemo {
    record Employee(string Name, string Dept, decimal Salary, int Age);
    
    static void Main() {
        var employees = new List<Employee> {
            new("Alice", "Engineering", 120000, 30),
            new("Bob", "Engineering", 95000, 25),
            new("Carol", "Marketing", 85000, 35),
            new("Dave", "Engineering", 140000, 40),
            new("Eve", "Marketing", 92000, 28)
        };
        
        // Query Syntax
        var highEarners = from e in employees
                          where e.Salary > 90000
                          orderby e.Name
                          select e.Name;
        Console.WriteLine("High earners: " + string.Join(", ", highEarners));
        
        // Method Syntax with GroupBy
        var deptStats = employees
            .GroupBy(e => e.Dept)
            .Select(g => new {
                Dept = g.Key,
                Avg = g.Average(e => e.Salary)
            });
        
        foreach (var d in deptStats)
            Console.WriteLine($"  {d.Dept}: avg=${d.Avg: N0
        }");

        // Aggregate
        Console.WriteLine($"Total: ${employees.Sum(e => e.Salary):N0}");
}
}`,
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
      code: `using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

class AsyncDemo {
    static async Task<string> FetchAsync(string name, int ms) {
        Console.WriteLine($"  Fetching {name}...");
        await Task.Delay(ms);
        return $"{name}: OK";
    }

    static async Task LongRunning(CancellationToken ct) {
        for (int i = 0; i < 10; i++) {
            ct.ThrowIfCancellationRequested();
            Console.WriteLine($"  Step {i + 1}/10...");
            await Task.Delay(100, ct);
        }
    }

    static async IAsyncEnumerable<int> StreamNumbers(int n) {
        for (int i = 0; i < n; i++) {
            await Task.Delay(50);
            yield return i * i;
        }
    }

    static async Task Main() {
        // Parallel fetch
        var results = await Task.WhenAll(
            FetchAsync("users", 200),
            FetchAsync("posts", 150),
            FetchAsync("comments", 100)
        );
        foreach(var r in results) Console.WriteLine($"  Done: {r}");

        // Cancellation
        var cts = new CancellationTokenSource();
        cts.CancelAfter(350);
        try { await LongRunning(cts.Token); }
        catch (OperationCanceledException) {
            Console.WriteLine("  Cancelled!");
        }

        // Async stream
        await foreach(var n in StreamNumbers(5))
        Console.Write($"  {n}");
    }
} `,
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
      code: `using System;
using System.Collections.Generic;

class EventsDemo {
    class StockTicker {
    public event EventHandler<PriceArgs>?PriceChanged;
    private decimal _price;
    public string Symbol { get; }
        
        public StockTicker(string sym, decimal price) {
    Symbol = sym; _price = price;
}
        
        public decimal Price {
    get => _price;
            set {
        var old = _price; _price = value;
        PriceChanged?.Invoke(this, new PriceArgs(Symbol, old, value));
    }
}
    }
    
    record PriceArgs(string Symbol, decimal Old, decimal New) : EventArgs {
        public decimal Change => New - Old;
}
    
    static List < T > Filter<T>(List < T > src, Func < T, bool > pred) {
    var result = new List<T>();
    foreach(var item in src) if (pred(item)) result.Add(item);
    return result;
}
    
    static void Main() {
    // Multicast delegate
    Action < string > logger = m => Console.WriteLine($"  [Console] {m}");
    logger += m => Console.WriteLine($"  [File] {m}");
    logger("Server started");

    // Events
    var stock = new StockTicker("AAPL", 150m);
    stock.PriceChanged += (_, a) =>
        Console.WriteLine($"  {a.Symbol}: ${a.Old} -> ${a.New} ({(a.Change>=0?" + ":"")}{a.Change})");
    stock.PriceChanged += (_, a) => {
        if (Math.Abs(a.Change) > 5)
            Console.WriteLine($"  ALERT: Large move!");
    };

    stock.Price = 153.50m;
    stock.Price = 142.00m;

    // Func/Action
    var nums = new List < int > { 1, 2, 3, 4, 5, 6, 7, 8};
    var evens = Filter(nums, n => n % 2 == 0);
    Console.WriteLine("Evens: " + string.Join(", ", evens));
}
}`,
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
      code: `using System;
using System.Collections.Generic;
using System.Linq;

class GenericsDemo {
    interface IEntity { int Id { get; } }
    record Product(int Id, string Name, decimal Price) : IEntity;

class Repository<T> where T: class, IEntity {
        private readonly List < T > _items = new ();
        public void Add(T item) => _items.Add(item);
        public T ? FindById(int id) => _items.FirstOrDefault(x => x.Id == id);
        public IEnumerable < T > Where(Func < T, bool > pred) => _items.Where(pred);
        public int Count => _items.Count;
}
    
    static T Max<T>(T a, T b) where T: IComparable<T>
        => a.CompareTo(b) >= 0 ? a : b;

// Result<T> monad
class Result<T> {
    public T? Value { get; }
        public string ? Error { get; }
        public bool IsOk => Error == null;
Result(T ? v, string ? e) { Value = v; Error = e; }
        public static Result < T > Ok(T val) => new (val, null);
        public static Result < T > Fail(string err) => new (default, err);
        public Result < U > Map<U>(Func < T, U > fn)
            => IsOk ? Result<U>.Ok(fn(Value!)) : Result<U>.Fail(Error!);
    }
    
    static void Main() {
    var repo = new Repository<Product>();
    repo.Add(new (1, "Laptop", 999m));
    repo.Add(new (2, "Mouse", 29m));
    repo.Add(new (3, "Keyboard", 79m));

    Console.WriteLine($"Found: {repo.FindById(2)}");
    foreach(var p in repo.Where(p => p.Price > 50))
    Console.WriteLine($"  {p.Name}: ${p.Price}");

    Console.WriteLine($"Max(3,7) = {Max(3, 7)}");

    var r1 = Result<int>.Ok(42).Map(n => n * 2);
    var r2 = Result<int>.Fail("bad input").Map(n => n * 2);
    Console.WriteLine($"Ok: {r1.Value}, Fail: {r2.Error}");
}
}`,
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
      code: `using System;
using System.Collections.Generic;

class DIDemo {
    interface ILogger { void Log(string msg); }
interface IEmailSvc { void Send(string to, string subj); }
interface IUserRepo { string? GetEmail(string user); }

class ConsoleLogger : ILogger {
        public void Log(string msg) => Console.WriteLine($"  [LOG] {msg}");
}

class MockEmail : IEmailSvc {
        public int Count { get; private set; }
        public void Send(string to, string subj) {
        Count++;
        Console.WriteLine($"  [EMAIL] {to}: {subj}");
    }
}

class UserRepo : IUserRepo {
    Dictionary < string, string > _db = new () {
        ["alice"] = "alice@dev.io", ["bob"] = "bob@dev.io"
    };
        public string ? GetEmail(string u) =>
    _db.TryGetValue(u, out var e) ?e: null;
}

class NotificationService {
    readonly ILogger _log;
    readonly IEmailSvc _email;
    readonly IUserRepo _users;

    public NotificationService(ILogger l, IEmailSvc e, IUserRepo u) {
        _log = l; _email = e; _users = u;
    }

    public bool Notify(string user, string msg) {
        _log.Log($"Notifying {user}...");
        var email = _users.GetEmail(user);
        if (email == null) { _log.Log("Not found!"); return false; }
        _email.Send(email, msg);
        return true;
    }
}
    
    static void Main() {
    var log = new ConsoleLogger();
    var email = new MockEmail();
    var users = new UserRepo();
    var svc = new NotificationService(log, email, users);

    svc.Notify("alice", "Order shipped!");
    svc.Notify("unknown", "Hello!");
    Console.WriteLine($"Emails sent: {email.Count}");
}
}`,
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
      code: `using System;
using System.Linq;

class PatternsDemo {
    abstract record Shape;
    record Circle(double R): Shape;
    record Rect(double W, double H): Shape;
    record Tri(double Base, double Height): Shape;

    static string Describe(Shape s) => s switch {
        Circle { R: > 10 } c => $"Large circle r={c.R}",
            Circle c => $"Circle r={c.R}, area={Math.PI*c.R*c.R:F1}",
                Rect { W: var w, H: var h } when w == h => $"Square {w}x{h}",
                    Rect r => $"Rect {r.W}x{r.H}",
                        Tri t => $"Triangle base={t.Base}",
                            _ => "Unknown"
    };

    // Extension methods
    static void Main() {
    Shape[] shapes = {
        new Circle(5), new Circle(15),
        new Rect(4, 4), new Rect(3, 7),
        new Tri(6, 4)
    };

    foreach(var s in shapes)
    Console.WriteLine($"  {Describe(s)}");

    // with-expression (non-destructive mutation)
    var p1 = new Circle(5);
    var p2 = p1 with { R = 10 };
    Console.WriteLine($"  Original: {p1}, Copy: {p2}");
    Console.WriteLine($"  Equal? {p1 == p2}");

    // Deconstruct
    var (r) = new Circle(7);
    Console.WriteLine($"  Deconstructed radius: {r}");
}
}`,
      explanation: "Pattern matching supports type, property, relational, and positional patterns. Records provide value equality, with-expressions, and deconstruction. Switch expressions are exhaustive. Interview focus: when vs if in patterns, positional vs nominal, record struct vs record class.",
      useCases: ["Domain modeling", "State machines", "Validation", "API responses"],
      output: "  Circle r=5, area=78.5\n  Large circle r=15\n  Square 4x4\n  Rect 3x7\n  Triangle base=6\n  Original: Circle { R = 5 }, Copy: Circle { R = 10 }\n  Equal? False\n  Deconstructed radius: 7"
    }
  ]
};
