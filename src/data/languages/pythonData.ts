import { LanguageConfig } from "./index";

export const pythonData: LanguageConfig = {
    id: "python",
    name: "Python",
    icon: "🐍",
    color: "text-yellow-500",
    gradient: "from-blue-500 to-yellow-500",
    badge: "Python 3.11+",
    description: "Versatile high-level language for web, data science, AI/ML, and automation",
    examples: [
        {
            id: "py-decorators",
            name: "Decorators & Metaclasses",
            category: "Advanced OOP",
            complexity: "O(1) wrapper overhead",
            description: "Function and class decorators for cross-cutting concerns like caching, logging, and validation",
            code: `import functools
import time

# === Function Decorator with Arguments ===
def retry(max_attempts=3, delay=1):
    """Retry a function on failure with exponential backoff."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts:
                        raise
                    wait = delay * (2 ** (attempt - 1))
                    print(f"  Attempt {attempt} failed: {e}. Retrying in {wait}s...")
                    time.sleep(0.01)  # Simulated delay
            return None
        return wrapper
    return decorator

# === Memoization Decorator ===
def memoize(func):
    """Cache function results based on arguments."""
    cache = {}
    @functools.wraps(func)
    def wrapper(*args):
        if args not in cache:
            cache[args] = func(*args)
            print(f"  Computing {func.__name__}({args}) = {cache[args]}")
        else:
            print(f"  Cache hit: {func.__name__}({args}) = {cache[args]}")
        return cache[args]
    return wrapper

# === Class Decorator ===
def singleton(cls):
    """Ensure only one instance of a class exists."""
    instances = {}
    @functools.wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

# --- Usage ---
@retry(max_attempts=3)
def fetch_data(url):
    import random
    if random.random() < 0.6:
        raise ConnectionError("Timeout")
    return {"status": 200, "data": "Success"}

@memoize
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@singleton
class Config:
    def __init__(self):
        self.settings = {"debug": True, "version": "2.0"}

print("=== Retry Decorator ===")
try:
    result = fetch_data("https://api.example.com")
    print(f"Result: {result}")
except ConnectionError:
    print("All attempts failed")

print("\\n=== Memoization ===")
print(f"fib(6) = {fibonacci(6)}")

print("\\n=== Singleton ===")
c1, c2 = Config(), Config()
print(f"Same instance: {c1 is c2}")  # True`,
            explanation: "Decorators wrap functions/classes to add behavior without modifying their code. @functools.wraps preserves the original function's metadata. Common patterns: memoization (cache results), retry (fault tolerance), singleton (single instance), authentication checks. Interview focus: closure mechanics, decorator stacking order, functools.wraps importance.",
            useCases: ["Caching/memoization", "Authentication middleware", "Logging & monitoring", "Rate limiting"],
            output: "=== Retry Decorator ===\n  Attempt 1 failed: Timeout. Retrying in 1s...\nResult: {'status': 200, 'data': 'Success'}\n\n=== Memoization ===\n  Computing fibonacci((0,)) = 0\n  Computing fibonacci((1,)) = 1\n  Computing fibonacci((2,)) = 1\n  Computing fibonacci((3,)) = 2\n  Computing fibonacci((4,)) = 3\n  Computing fibonacci((5,)) = 5\n  Computing fibonacci((6,)) = 8\nfib(6) = 8\n\n=== Singleton ===\nSame instance: True"
        },
        {
            id: "py-generators",
            name: "Generators & Iterators",
            category: "Memory Efficiency",
            complexity: "O(1) memory per yield",
            description: "Lazy evaluation with yield for processing large datasets without loading everything into memory",
            code: `# === Generator Function ===
def fibonacci_gen(limit):
    """Infinite Fibonacci generator — only computes on demand."""
    a, b = 0, 1
    count = 0
    while count < limit:
        yield a
        a, b = b, a + b
        count += 1

# === Generator Pipeline (Unix pipes style) ===
def read_logs(lines):
    """Simulate reading log lines."""
    for line in lines:
        yield line.strip()

def filter_errors(lines):
    """Filter only ERROR lines."""
    for line in lines:
        if "ERROR" in line:
            yield line

def extract_message(lines):
    """Extract the message portion."""
    for line in lines:
        parts = line.split(": ", 1)
        yield parts[1] if len(parts) > 1 else line

# === Generator Expression vs List Comprehension ===
def memory_comparison():
    import sys
    # List stores everything in memory
    list_comp = [x**2 for x in range(10000)]
    # Generator computes lazily
    gen_exp = (x**2 for x in range(10000))
    
    print(f"List size:      {sys.getsizeof(list_comp):,} bytes")
    print(f"Generator size: {sys.getsizeof(gen_exp)} bytes")

# === Send values into generator (coroutine style) ===
def running_average():
    """Generator that accepts values and yields running average."""
    total = 0
    count = 0
    average = None
    while True:
        value = yield average
        if value is None:
            break
        total += value
        count += 1
        average = total / count

# --- Usage ---
print("=== Fibonacci Generator ===")
fibs = list(fibonacci_gen(10))
print(f"First 10: {fibs}")

print("\\n=== Log Processing Pipeline ===")
logs = [
    "2024-01-15 INFO: Server started",
    "2024-01-15 ERROR: Connection refused",
    "2024-01-15 INFO: Request processed",
    "2024-01-15 ERROR: Timeout on DB query",
    "2024-01-15 WARNING: High memory usage",
    "2024-01-15 ERROR: Authentication failed",
]

pipeline = extract_message(filter_errors(read_logs(logs)))
for msg in pipeline:
    print(f"  ⚠ {msg}")

print("\\n=== Memory Comparison ===")
memory_comparison()

print("\\n=== Running Average ===")
avg = running_average()
next(avg)  # Prime the generator
for val in [10, 20, 30, 40, 50]:
    result = avg.send(val)
    print(f"  Sent {val}, avg = {result:.1f}")`,
            explanation: "Generators produce values lazily using 'yield', consuming O(1) memory regardless of data size. Generator pipelines compose like Unix pipes — each stage processes one item at a time. generator.send() enables two-way communication. Interview focus: yield vs return, lazy evaluation, memory efficiency, itertools module.",
            useCases: ["Processing large files", "Streaming data pipelines", "Infinite sequences", "Coroutine-based async"],
            output: "=== Fibonacci Generator ===\nFirst 10: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n\n=== Log Processing Pipeline ===\n  ⚠ Connection refused\n  ⚠ Timeout on DB query\n  ⚠ Authentication failed\n\n=== Memory Comparison ===\nList size:      87,616 bytes\nGenerator size: 112 bytes\n\n=== Running Average ===\n  Sent 10, avg = 10.0\n  Sent 20, avg = 15.0\n  Sent 30, avg = 20.0\n  Sent 40, avg = 25.0\n  Sent 50, avg = 30.0"
        },
        {
            id: "py-context-managers",
            name: "Context Managers",
            category: "Resource Management",
            complexity: "O(1)",
            description: "Guaranteed resource cleanup using 'with' statements and __enter__/__exit__",
            code: `import time
from contextlib import contextmanager

# === Class-based Context Manager ===
class DatabaseConnection:
    """Simulates a DB connection with automatic cleanup."""
    
    def __init__(self, db_name):
        self.db_name = db_name
        self.connected = False
        self.queries = []
    
    def __enter__(self):
        print(f"Connecting to '{self.db_name}'...")
        self.connected = True
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            print(f"Rolling back due to: {exc_val}")
        else:
            print(f"Committing {len(self.queries)} queries")
        print(f"Disconnecting from '{self.db_name}'")
        self.connected = False
        return False  # Don't suppress exceptions
    
    def execute(self, query):
        if not self.connected:
            raise RuntimeError("Not connected!")
        self.queries.append(query)
        print(f"  Executed: {query}")

# === Generator-based Context Manager ===
@contextmanager
def timer(label):
    """Measure execution time of a block."""
    start = time.perf_counter()
    print(f"⏱ [{label}] Starting...")
    try:
        yield  # Code block runs here
    finally:
        elapsed = time.perf_counter() - start
        print(f"⏱ [{label}] Completed in {elapsed:.4f}s")

# === Nested Context Managers ===
@contextmanager
def temp_directory(name):
    print(f"  Creating temp dir: {name}/")
    try:
        yield name
    finally:
        print(f"  Cleaning up temp dir: {name}/")

# --- Usage ---
print("=== Database Connection ===")
with DatabaseConnection("users_db") as db:
    db.execute("SELECT * FROM users")
    db.execute("UPDATE users SET active=1 WHERE id=42")

print("\\n=== Timer ===")
with timer("Data Processing"):
    total = sum(i**2 for i in range(100000))
    print(f"  Result: {total:,}")

print("\\n=== Error Handling ===")
try:
    with DatabaseConnection("orders_db") as db:
        db.execute("INSERT INTO orders VALUES (1, 'item')")
        raise ValueError("Invalid order data")
except ValueError:
    print("Error caught outside context")

print("\\n=== Nested ===")
with timer("Batch Job"):
    with temp_directory("batch_001") as d:
        print(f"  Processing in {d}/")`,
            explanation: "Context managers ensure resources (files, connections, locks) are properly cleaned up even when exceptions occur. __enter__ acquires the resource, __exit__ releases it. @contextmanager simplifies creation using generators. Interview focus: __exit__ return value (True suppresses exceptions), resource cleanup guarantees, contextlib utilities.",
            useCases: ["File handling", "Database transactions", "Lock management", "Temporary resources"],
            output: "=== Database Connection ===\nConnecting to 'users_db'...\n  Executed: SELECT * FROM users\n  Executed: UPDATE users SET active=1 WHERE id=42\nCommitting 2 queries\nDisconnecting from 'users_db'\n\n=== Timer ===\n⏱ [Data Processing] Starting...\n  Result: 333,328,333,350,000\n⏱ [Data Processing] Completed in 0.0123s\n\n=== Error Handling ===\nConnecting to 'orders_db'...\n  Executed: INSERT INTO orders VALUES (1, 'item')\nRolling back due to: Invalid order data\nDisconnecting from 'orders_db'\nError caught outside context\n\n=== Nested ===\n⏱ [Batch Job] Starting...\n  Creating temp dir: batch_001/\n  Processing in batch_001/\n  Cleaning up temp dir: batch_001/\n⏱ [Batch Job] Completed in 0.0001s"
        },
        {
            id: "py-async",
            name: "Async/Await & Asyncio",
            category: "Concurrency",
            complexity: "O(1) per coroutine",
            description: "Concurrent I/O-bound operations using Python's async/await syntax and event loop",
            code: `import asyncio

# === Async function (coroutine) ===
async def fetch_api(name, delay):
    """Simulate an async API call."""
    print(f"  📡 Fetching {name}...")
    await asyncio.sleep(delay)  # Non-blocking sleep
    return {"name": name, "status": 200, "data": f"{name}_data"}

# === Async generator ===
async def stream_events(count):
    """Simulate a real-time event stream."""
    for i in range(count):
        await asyncio.sleep(0.1)
        yield {"event": f"update_{i}", "timestamp": i * 100}

# === Producer-Consumer with Queue ===
async def producer(queue, items):
    for item in items:
        await asyncio.sleep(0.05)
        await queue.put(item)
        print(f"  Produced: {item}")
    await queue.put(None)  # Sentinel

async def consumer(queue, name):
    while True:
        item = await queue.get()
        if item is None:
            await queue.put(None)  # Pass sentinel
            break
        await asyncio.sleep(0.08)
        print(f"  {name} consumed: {item}")

# === Semaphore for rate limiting ===
async def rate_limited_fetch(sem, url):
    async with sem:
        print(f"    Fetching {url}")
        await asyncio.sleep(0.1)
        return f"{url}: OK"

async def main():
    # 1. Gather: run concurrently
    print("=== Parallel API Calls ===")
    results = await asyncio.gather(
        fetch_api("users", 0.2),
        fetch_api("posts", 0.3),
        fetch_api("comments", 0.1),
    )
    for r in results:
        print(f"  ✓ {r['name']}: {r['status']}")
    
    # 2. Async generator
    print("\\n=== Event Stream ===")
    async for event in stream_events(3):
        print(f"  📨 {event}")
    
    # 3. Producer-Consumer
    print("\\n=== Producer-Consumer ===")
    queue = asyncio.Queue(maxsize=3)
    await asyncio.gather(
        producer(queue, ["task_A", "task_B", "task_C"]),
        consumer(queue, "Worker-1"),
    )
    
    # 4. Semaphore rate limiting
    print("\\n=== Rate Limited (max 2 concurrent) ===")
    sem = asyncio.Semaphore(2)
    urls = [f"api/endpoint/{i}" for i in range(5)]
    results = await asyncio.gather(
        *[rate_limited_fetch(sem, url) for url in urls]
    )
    for r in results:
        print(f"  ✓ {r}")

asyncio.run(main())`,
            explanation: "Asyncio enables concurrent I/O operations on a single thread using an event loop. 'await' suspends the coroutine and lets others run while waiting for I/O. asyncio.gather runs multiple coroutines concurrently. Semaphores control concurrency limits. Interview focus: async vs threading vs multiprocessing, event loop mechanics, when to use async (I/O-bound, not CPU-bound).",
            useCases: ["Web scraping", "API servers (FastAPI)", "WebSocket handling", "Microservice communication"],
            output: "=== Parallel API Calls ===\n  📡 Fetching users...\n  📡 Fetching posts...\n  📡 Fetching comments...\n  ✓ users: 200\n  ✓ posts: 200\n  ✓ comments: 200\n\n=== Event Stream ===\n  📨 {'event': 'update_0', 'timestamp': 0}\n  📨 {'event': 'update_1', 'timestamp': 100}\n  📨 {'event': 'update_2', 'timestamp': 200}\n\n=== Producer-Consumer ===\n  Produced: task_A\n  Worker-1 consumed: task_A\n  Produced: task_B\n  Produced: task_C\n  Worker-1 consumed: task_B\n  Worker-1 consumed: task_C\n\n=== Rate Limited (max 2 concurrent) ===\n  ✓ api/endpoint/0: OK\n  ✓ api/endpoint/1: OK\n  ✓ api/endpoint/2: OK\n  ✓ api/endpoint/3: OK\n  ✓ api/endpoint/4: OK"
        },
        {
            id: "py-dataclasses",
            name: "Data Classes & Type Hints",
            category: "Modern Python",
            complexity: "O(1)",
            description: "Structured data with automatic methods, type safety, and modern Python idioms",
            code: `from dataclasses import dataclass, field
from typing import Optional, List, Dict, Protocol
from enum import Enum, auto

# === Enum for type safety ===
class Role(Enum):
    ADMIN = auto()
    USER = auto()
    MODERATOR = auto()

# === Dataclass with defaults and validation ===
@dataclass
class User:
    name: str
    email: str
    role: Role = Role.USER
    age: int = 0
    tags: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if self.age < 0:
            raise ValueError(f"Age cannot be negative: {self.age}")
        if "@" not in self.email:
            raise ValueError(f"Invalid email: {self.email}")
    
    @property
    def is_admin(self) -> bool:
        return self.role == Role.ADMIN

# === Frozen (immutable) dataclass ===
@dataclass(frozen=True)
class Point:
    x: float
    y: float
    
    def distance_to(self, other: 'Point') -> float:
        return ((self.x - other.x)**2 + (self.y - other.y)**2) ** 0.5

# === Protocol (structural subtyping) ===
class Serializable(Protocol):
    def to_dict(self) -> Dict: ...

@dataclass
class Product:
    name: str
    price: float
    quantity: int = 0
    
    def to_dict(self) -> Dict:
        return {"name": self.name, "price": self.price, "qty": self.quantity}
    
    @property
    def total_value(self) -> float:
        return self.price * self.quantity

def serialize(obj: Serializable) -> Dict:
    """Works with any object that has to_dict()."""
    return obj.to_dict()

# --- Usage ---
print("=== Users ===")
alice = User("Alice", "alice@dev.io", Role.ADMIN, 30, ["python", "java"])
bob = User("Bob", "bob@dev.io", age=25)
print(f"{alice.name}: admin={alice.is_admin}, tags={alice.tags}")
print(f"{bob.name}: admin={bob.is_admin}, role={bob.role.name}")

print("\\n=== Immutable Points ===")
p1, p2 = Point(0, 0), Point(3, 4)
print(f"Distance: {p1.distance_to(p2)}")
print(f"Can use as dict key: { {p1: 'origin', p2: 'target'} }")

print("\\n=== Protocol (Duck Typing) ===")
products = [
    Product("Laptop", 999.99, 5),
    Product("Mouse", 29.99, 50),
]
for p in products:
    print(f"  {serialize(p)} -> value=\${p.total_value:,.2f}")

print("\\n=== Validation ===")
try:
    bad = User("X", "invalid-email")
except ValueError as e:
    print(f"  Caught: {e}")`,
            explanation: "Dataclasses auto-generate __init__, __repr__, __eq__, and more. __post_init__ enables validation. Frozen dataclasses are immutable and hashable. Protocol enables structural subtyping (duck typing with type checking). Interview focus: dataclass vs namedtuple, field() for mutable defaults, Protocol vs ABC, Enum best practices.",
            useCases: ["API response models", "Configuration objects", "Domain entities", "DTO patterns"],
            output: "=== Users ===\nAlice: admin=True, tags=['python', 'java']\nBob: admin=False, role=USER\n\n=== Immutable Points ===\nDistance: 5.0\nCan use as dict key: {Point(x=0, y=0): 'origin', Point(x=3, y=4): 'target'}\n\n=== Protocol (Duck Typing) ===\n  {'name': 'Laptop', 'price': 999.99, 'qty': 5} -> value=$4,999.95\n  {'name': 'Mouse', 'price': 29.99, 'qty': 50} -> value=$1,499.50\n\n=== Validation ===\n  Caught: Invalid email: invalid-email"
        }
    ]
};
