import { LanguageConfig } from "./index";

export const javaData: LanguageConfig = {
    id: "java",
    name: "Java",
    icon: "☕",
    color: "text-orange-500",
    gradient: "from-orange-500 to-red-600",
    badge: "Java 17+",
    description: "Enterprise-grade OOP with strong typing, multithreading, and the JVM ecosystem",
    examples: [
        {
            id: "java-multithreading",
            name: "Multithreading & ExecutorService",
            category: "Concurrency",
            complexity: "O(1) per task submission",
            description: "Thread pool management using ExecutorService for scalable concurrent execution",
            code: `import java.util.concurrent.*;
import java.util.List;
import java.util.ArrayList;

public class ThreadPoolDemo {
    
    // Callable task that returns a result
    static class PriceCalculator implements Callable<Double> {
        private final String product;
        private final double basePrice;
        
        PriceCalculator(String product, double basePrice) {
            this.product = product;
            this.basePrice = basePrice;
        }
        
        @Override
        public Double call() throws Exception {
            // Simulate API call delay
            Thread.sleep(100);
            double discount = Math.random() * 0.3; // 0-30% discount
            double finalPrice = basePrice * (1 - discount);
            System.out.printf("[%s] %s: $%.2f -> $%.2f%n",
                Thread.currentThread().getName(), product, basePrice, finalPrice);
            return finalPrice;
        }
    }
    
    public static void main(String[] args) throws Exception {
        // Create a fixed thread pool with 3 threads
        ExecutorService executor = Executors.newFixedThreadPool(3);
        
        // Submit multiple tasks
        List<Future<Double>> futures = new ArrayList<>();
        String[] products = {"Laptop", "Phone", "Tablet", "Watch", "Headphones"};
        double[] prices = {999.99, 699.99, 449.99, 299.99, 199.99};
        
        for (int i = 0; i < products.length; i++) {
            Future<Double> future = executor.submit(
                new PriceCalculator(products[i], prices[i])
            );
            futures.add(future);
        }
        
        // Collect results
        double total = 0;
        for (Future<Double> f : futures) {
            total += f.get(); // Blocks until result is ready
        }
        
        System.out.printf("\\nTotal discounted price: $%.2f%n", total);
        
        // Graceful shutdown
        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println("All tasks completed.");
    }
}`,
            explanation: "ExecutorService manages a pool of reusable threads, avoiding the overhead of creating new threads for each task. Callable<T> returns a Future<T> that represents a pending result. Thread pools are essential for web servers, batch processing, and any concurrent workload. Interview focus: thread safety, deadlocks, Future.get() blocking behavior.",
            useCases: ["Web server request handling", "Parallel API calls", "Batch data processing", "Background task scheduling"],
            output: "[pool-1-thread-1] Laptop: $999.99 -> $812.34\n[pool-1-thread-2] Phone: $699.99 -> $553.20\n[pool-1-thread-3] Tablet: $449.99 -> $398.10\n[pool-1-thread-1] Watch: $299.99 -> $245.67\n[pool-1-thread-2] Headphones: $199.99 -> $171.45\n\nTotal discounted price: $2180.76\nAll tasks completed."
        },
        {
            id: "java-generics",
            name: "Generics & Bounded Wildcards",
            category: "Type System",
            complexity: "Compile-time only",
            description: "Type-safe generic programming with bounded wildcards for flexible APIs",
            code: `import java.util.*;

public class GenericsDemo {
    
    // Generic class with bounded type parameter
    static class SortedPair<T extends Comparable<T>> {
        private final T first;
        private final T second;
        
        SortedPair(T a, T b) {
            if (a.compareTo(b) <= 0) {
                this.first = a;
                this.second = b;
            } else {
                this.first = b;
                this.second = a;
            }
        }
        
        T getFirst() { return first; }
        T getSecond() { return second; }
        
        @Override
        public String toString() {
            return "[" + first + ", " + second + "]";
        }
    }
    
    // Upper bounded wildcard: reads from list (producer)
    static double sumOfList(List<? extends Number> list) {
        double sum = 0;
        for (Number n : list) {
            sum += n.doubleValue();
        }
        return sum;
    }
    
    // Lower bounded wildcard: writes to list (consumer)
    static void addNumbers(List<? super Integer> list) {
        for (int i = 1; i <= 5; i++) {
            list.add(i);
        }
    }
    
    // Generic method with multiple type parameters
    static <K, V> Map<V, K> invertMap(Map<K, V> original) {
        Map<V, K> inverted = new HashMap<>();
        for (Map.Entry<K, V> entry : original.entrySet()) {
            inverted.put(entry.getValue(), entry.getKey());
        }
        return inverted;
    }
    
    public static void main(String[] args) {
        // Bounded generics
        SortedPair<Integer> intPair = new SortedPair<>(42, 17);
        SortedPair<String> strPair = new SortedPair<>("Zebra", "Apple");
        System.out.println("Int pair: " + intPair);
        System.out.println("Str pair: " + strPair);
        
        // PECS: Producer Extends, Consumer Super
        List<Integer> ints = Arrays.asList(1, 2, 3);
        List<Double> doubles = Arrays.asList(1.5, 2.5, 3.5);
        System.out.println("Sum of ints: " + sumOfList(ints));
        System.out.println("Sum of doubles: " + sumOfList(doubles));
        
        List<Number> numbers = new ArrayList<>();
        addNumbers(numbers); // Integer is subtype of Number
        System.out.println("Numbers: " + numbers);
        
        // Generic method
        Map<String, Integer> original = Map.of("A", 1, "B", 2, "C", 3);
        Map<Integer, String> inverted = invertMap(original);
        System.out.println("Inverted: " + inverted);
    }
}`,
            explanation: "Java Generics provide compile-time type safety while allowing code reuse. The PECS principle (Producer Extends, Consumer Super) determines wildcard usage: use '? extends T' for reading, '? super T' for writing. Type erasure means generics are compile-time only. Interview focus: PECS, type erasure, generic method syntax vs generic class.",
            useCases: ["Type-safe collections", "API design", "Framework development", "Data structures"],
            output: "Int pair: [17, 42]\nStr pair: [Apple, Zebra]\nSum of ints: 6.0\nSum of doubles: 7.5\nNumbers: [1, 2, 3, 4, 5]\nInverted: {1=A, 2=B, 3=C}"
        },
        {
            id: "java-streams",
            name: "Streams API & Functional",
            category: "Functional",
            complexity: "O(n) typical",
            description: "Declarative data processing pipelines with lambdas and method references",
            code: `import java.util.*;
import java.util.stream.*;

public class StreamsDemo {
    
    record Employee(String name, String dept, double salary, int age) {}
    
    public static void main(String[] args) {
        List<Employee> employees = List.of(
            new Employee("Alice", "Engineering", 120000, 30),
            new Employee("Bob", "Engineering", 95000, 25),
            new Employee("Carol", "Marketing", 85000, 35),
            new Employee("Dave", "Engineering", 140000, 40),
            new Employee("Eve", "Marketing", 92000, 28),
            new Employee("Frank", "Sales", 78000, 32),
            new Employee("Grace", "Sales", 88000, 29)
        );
        
        // 1. Filter + Map + Collect
        List<String> highEarners = employees.stream()
            .filter(e -> e.salary() > 90000)
            .map(Employee::name)
            .sorted()
            .collect(Collectors.toList());
        System.out.println("High earners: " + highEarners);
        
        // 2. GroupBy + Aggregate
        Map<String, Double> avgSalaryByDept = employees.stream()
            .collect(Collectors.groupingBy(
                Employee::dept,
                Collectors.averagingDouble(Employee::salary)
            ));
        System.out.println("Avg salary by dept: " + avgSalaryByDept);
        
        // 3. Reduce
        double totalPayroll = employees.stream()
            .mapToDouble(Employee::salary)
            .reduce(0, Double::sum);
        System.out.printf("Total payroll: $%,.2f%n", totalPayroll);
        
        // 4. FlatMap
        List<List<String>> teams = List.of(
            List.of("Alice", "Bob"),
            List.of("Carol", "Dave"),
            List.of("Eve")
        );
        List<String> allMembers = teams.stream()
            .flatMap(Collection::stream)
            .collect(Collectors.toList());
        System.out.println("All members: " + allMembers);
        
        // 5. Partition
        Map<Boolean, List<Employee>> partitioned = employees.stream()
            .collect(Collectors.partitioningBy(e -> e.age() > 30));
        System.out.println("Over 30: " + partitioned.get(true).stream()
            .map(Employee::name).toList());
        System.out.println("Under 30: " + partitioned.get(false).stream()
            .map(Employee::name).toList());
    }
}`,
            explanation: "The Streams API enables declarative, functional-style data processing. Streams are lazy — intermediate operations (filter, map) create a pipeline that executes only when a terminal operation (collect, reduce) is called. Parallel streams can automatically distribute work across CPU cores. Interview focus: lazy evaluation, intermediate vs terminal operations, Collectors utility class.",
            useCases: ["Data transformation pipelines", "Report generation", "ETL processing", "Collection manipulation"],
            output: "High earners: [Alice, Bob, Dave, Eve]\nAvg salary by dept: {Engineering=118333.33, Marketing=88500.0, Sales=83000.0}\nTotal payroll: $698,000.00\nAll members: [Alice, Bob, Carol, Dave, Eve]\nOver 30: [Carol, Dave, Frank]\nUnder 30: [Alice, Bob, Eve, Grace]"
        },
        {
            id: "java-design-patterns",
            name: "Design Patterns",
            category: "Architecture",
            complexity: "Varies",
            description: "Singleton, Factory, Observer, and Strategy patterns — core OOP interview topics",
            code: `import java.util.*;
import java.util.function.*;

public class DesignPatterns {
    
    // === SINGLETON (Thread-safe, lazy) ===
    static class DatabasePool {
        private static volatile DatabasePool instance;
        private final int maxConnections;
        
        private DatabasePool(int max) { this.maxConnections = max; }
        
        static DatabasePool getInstance() {
            if (instance == null) {
                synchronized (DatabasePool.class) {
                    if (instance == null) {
                        instance = new DatabasePool(10);
                    }
                }
            }
            return instance;
        }
        
        void query(String sql) {
            System.out.println("[DB Pool-" + maxConnections + "] " + sql);
        }
    }
    
    // === FACTORY ===
    interface Notification { void send(String msg); }
    
    static class EmailNotification implements Notification {
        public void send(String msg) { System.out.println("📧 Email: " + msg); }
    }
    static class SMSNotification implements Notification {
        public void send(String msg) { System.out.println("📱 SMS: " + msg); }
    }
    static class PushNotification implements Notification {
        public void send(String msg) { System.out.println("🔔 Push: " + msg); }
    }
    
    static Notification createNotification(String type) {
        return switch (type.toLowerCase()) {
            case "email" -> new EmailNotification();
            case "sms"   -> new SMSNotification();
            case "push"  -> new PushNotification();
            default -> throw new IllegalArgumentException("Unknown: " + type);
        };
    }
    
    // === STRATEGY ===
    static double calculatePrice(double base, Function<Double, Double> strategy) {
        return strategy.apply(base);
    }
    
    public static void main(String[] args) {
        // Singleton
        DatabasePool db = DatabasePool.getInstance();
        db.query("SELECT * FROM users");
        System.out.println("Same instance: " + (db == DatabasePool.getInstance()));
        
        // Factory
        System.out.println("\\n--- Factory ---");
        for (String type : List.of("email", "sms", "push")) {
            createNotification(type).send("Hello from " + type);
        }
        
        // Strategy with lambdas
        System.out.println("\\n--- Strategy ---");
        double price = 100.0;
        System.out.printf("Regular: $%.2f%n", calculatePrice(price, p -> p));
        System.out.printf("Member:  $%.2f%n", calculatePrice(price, p -> p * 0.9));
        System.out.printf("VIP:     $%.2f%n", calculatePrice(price, p -> p * 0.75));
    }
}`,
            explanation: "Design patterns are reusable solutions to common software design problems. Singleton ensures one instance (double-checked locking for thread safety). Factory encapsulates object creation logic. Strategy uses lambdas/function interfaces to swap algorithms at runtime. Interview focus: when to use each pattern, trade-offs, SOLID principles.",
            useCases: ["Connection pooling", "Plugin architectures", "Payment processing", "Configuration management"],
            output: "[DB Pool-10] SELECT * FROM users\nSame instance: true\n\n--- Factory ---\n📧 Email: Hello from email\n📱 SMS: Hello from sms\n🔔 Push: Hello from push\n\n--- Strategy ---\nRegular: $100.00\nMember:  $90.00\nVIP:     $75.00"
        },
        {
            id: "java-hashmap",
            name: "HashMap Internals",
            category: "Data Structures",
            complexity: "O(1) avg, O(n) worst",
            description: "Custom HashMap implementation showing hashing, collisions, and resizing",
            code: `public class CustomHashMap<K, V> {
    
    private static class Entry<K, V> {
        final K key;
        V value;
        final int hash;
        Entry<K, V> next; // Linked list for collisions
        
        Entry(K key, V value, int hash, Entry<K, V> next) {
            this.key = key;
            this.value = value;
            this.hash = hash;
            this.next = next;
        }
    }
    
    private Entry<K, V>[] table;
    private int size;
    private int capacity;
    private static final double LOAD_FACTOR = 0.75;
    
    @SuppressWarnings("unchecked")
    public CustomHashMap(int initialCapacity) {
        this.capacity = initialCapacity;
        this.table = new Entry[capacity];
        this.size = 0;
    }
    
    private int hash(K key) {
        int h = key.hashCode();
        return (h ^ (h >>> 16)) & (capacity - 1); // Spread bits
    }
    
    public void put(K key, V value) {
        if (size >= capacity * LOAD_FACTOR) resize();
        
        int idx = hash(key);
        Entry<K, V> current = table[idx];
        
        while (current != null) {
            if (current.key.equals(key)) {
                current.value = value; // Update existing
                return;
            }
            current = current.next;
        }
        
        // Insert at head of chain
        table[idx] = new Entry<>(key, value, idx, table[idx]);
        size++;
    }
    
    public V get(K key) {
        int idx = hash(key);
        Entry<K, V> current = table[idx];
        
        while (current != null) {
            if (current.key.equals(key)) return current.value;
            current = current.next;
        }
        return null;
    }
    
    @SuppressWarnings("unchecked")
    private void resize() {
        int newCap = capacity * 2;
        Entry<K, V>[] newTable = new Entry[newCap];
        capacity = newCap;
        
        for (Entry<K, V> entry : table) {
            while (entry != null) {
                Entry<K, V> next = entry.next;
                int idx = (entry.key.hashCode() ^ (entry.key.hashCode() >>> 16)) & (newCap - 1);
                entry.next = newTable[idx];
                newTable[idx] = entry;
                entry = next;
            }
        }
        table = newTable;
        System.out.println("  [Resized to " + newCap + "]");
    }
    
    public static void main(String[] args) {
        CustomHashMap<String, Integer> map = new CustomHashMap<>(4);
        
        String[] keys = {"apple", "banana", "cherry", "date", "elderberry"};
        for (int i = 0; i < keys.length; i++) {
            map.put(keys[i], (i + 1) * 10);
            System.out.println("Put '" + keys[i] + "' -> " + (i + 1) * 10);
        }
        
        System.out.println("\\nGet 'cherry': " + map.get("cherry"));
        System.out.println("Get 'fig': " + map.get("fig"));
        System.out.println("Size: " + map.size);
    }
}`,
            explanation: "HashMap uses an array of buckets indexed by hash. Collisions (multiple keys mapping to same index) are resolved with linked lists (or trees in Java 8+ when chain length > 8). When load factor exceeds 0.75, the table doubles in size and all entries are rehashed. Interview focus: hashCode/equals contract, collision resolution, amortized O(1), rehashing.",
            useCases: ["Caching", "Indexing", "Counting frequencies", "Deduplication"],
            output: "Put 'apple' -> 10\nPut 'banana' -> 20\nPut 'cherry' -> 30\n  [Resized to 8]\nPut 'date' -> 40\nPut 'elderberry' -> 50\n\nGet 'cherry': 30\nGet 'fig': null\nSize: 5"
        },
        {
            id: "java-completablefuture",
            name: "CompletableFuture Async",
            category: "Concurrency",
            complexity: "O(1) per chain",
            description: "Non-blocking async programming with composition, error handling, and chaining",
            code: `import java.util.concurrent.*;
import java.util.*;

public class AsyncDemo {
    
    // Simulate async API calls
    static CompletableFuture<String> fetchUser(int id) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(100);
            return "User_" + id;
        });
    }
    
    static CompletableFuture<List<String>> fetchOrders(String user) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(150);
            return List.of(user + "_Order1", user + "_Order2");
        });
    }
    
    static CompletableFuture<Double> fetchPrice(String order) {
        return CompletableFuture.supplyAsync(() -> {
            sleep(50);
            return Math.random() * 100 + 10;
        });
    }
    
    static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) {}
    }
    
    public static void main(String[] args) throws Exception {
        long start = System.currentTimeMillis();
        
        // 1. Chain: fetchUser -> fetchOrders -> process
        CompletableFuture<Void> chain = fetchUser(42)
            .thenCompose(user -> {
                System.out.println("Got: " + user);
                return fetchOrders(user);
            })
            .thenAccept(orders -> {
                System.out.println("Orders: " + orders);
            });
        
        // 2. Combine two independent futures
        CompletableFuture<String> combined = fetchUser(1)
            .thenCombine(fetchUser(2), (u1, u2) -> u1 + " & " + u2);
        
        // 3. Race: first to complete wins
        CompletableFuture<String> fastest = CompletableFuture.anyOf(
            fetchUser(10), fetchUser(20), fetchUser(30)
        ).thenApply(obj -> "Winner: " + obj);
        
        // 4. All of: wait for all
        CompletableFuture<Void> allDone = CompletableFuture.allOf(
            chain, combined, fastest
        );
        
        allDone.join(); // Wait for everything
        
        System.out.println("Combined: " + combined.get());
        System.out.println(fastest.get());
        System.out.printf("Total time: %dms%n", System.currentTimeMillis() - start);
    }
}`,
            explanation: "CompletableFuture enables non-blocking async programming with a fluent API. thenCompose chains dependent futures (flatMap), thenCombine merges independent futures, anyOf races them. Unlike Future.get(), these don't block threads while waiting. Interview focus: thenApply vs thenCompose, exception handling with exceptionally(), thread pool selection.",
            useCases: ["Microservice orchestration", "Parallel API aggregation", "Non-blocking I/O", "Event-driven systems"],
            output: "Got: User_42\nOrders: [User_42_Order1, User_42_Order2]\nCombined: User_1 & User_2\nWinner: User_10\nTotal time: 265ms"
        }
    ]
};
