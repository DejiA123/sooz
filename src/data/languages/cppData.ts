import { LanguageConfig } from "./index";

export const cppData: LanguageConfig = {
    id: "cpp",
    name: "C++",
    icon: "⚡",
    color: "text-blue-500",
    gradient: "from-blue-600 to-cyan-500",
    badge: "C++17/20",
    description: "High-performance systems programming with zero-overhead abstractions and manual memory control",
    examples: [
        {
            id: "cpp-smart-pointers",
            name: "Smart Pointers & RAII",
            category: "Memory Management",
            complexity: "O(1) per operation",
            description: "Automatic resource management using unique_ptr, shared_ptr, and RAII principle",
            code: `#include <iostream>
#include <memory>
#include <vector>
using namespace std;

class Resource {
    string name;
public:
    Resource(string n) : name(n) {
        cout << "  Created: " << name << endl;
    }
    ~Resource() {
        cout << "  Destroyed: " << name << endl;
    }
    void use() { cout << "  Using: " << name << endl; }
};

// === unique_ptr: Exclusive ownership ===
void uniqueDemo() {
    cout << "--- unique_ptr ---" << endl;
    auto res = make_unique<Resource>("FileHandle");
    res->use();
    
    // Transfer ownership
    auto moved = std::move(res);
    // res is now nullptr
    cout << "  Original is null: " << (res == nullptr) << endl;
    moved->use();
    // Automatically destroyed when moved goes out of scope
}

// === shared_ptr: Shared ownership ===
void sharedDemo() {
    cout << "\\n--- shared_ptr ---" << endl;
    auto shared1 = make_shared<Resource>("DBConnection");
    cout << "  Ref count: " << shared1.use_count() << endl;
    
    {
        auto shared2 = shared1; // Copy, not move
        cout << "  Ref count: " << shared1.use_count() << endl;
        shared2->use();
    } // shared2 destroyed, ref count decreases
    
    cout << "  Ref count: " << shared1.use_count() << endl;
    // Destroyed when last shared_ptr goes out of scope
}

// === RAII Lock Guard ===
class SpinLock {
    bool locked = false;
public:
    void lock() { locked = true; cout << "  Lock acquired" << endl; }
    void unlock() { locked = false; cout << "  Lock released" << endl; }
};

class LockGuard {
    SpinLock& mtx;
public:
    LockGuard(SpinLock& m) : mtx(m) { mtx.lock(); }
    ~LockGuard() { mtx.unlock(); } // Always released
};

int main() {
    uniqueDemo();
    sharedDemo();
    
    cout << "\\n--- RAII LockGuard ---" << endl;
    SpinLock lock;
    {
        LockGuard guard(lock);
        cout << "  Critical section" << endl;
        // Even if exception thrown, lock is released
    }
    cout << "  Outside critical section" << endl;
    
    return 0;
}`,
            explanation: "RAII (Resource Acquisition Is Initialization) ties resource lifetime to object lifetime. unique_ptr has exclusive ownership (cannot copy, only move). shared_ptr uses reference counting for shared ownership. This eliminates memory leaks, dangling pointers, and double-free bugs. Interview focus: unique vs shared vs weak_ptr, move semantics, custom deleters.",
            useCases: ["Memory management", "File handles", "Mutex locking", "Database connections"],
            output: "--- unique_ptr ---\n  Created: FileHandle\n  Using: FileHandle\n  Original is null: 1\n  Using: FileHandle\n  Destroyed: FileHandle\n\n--- shared_ptr ---\n  Created: DBConnection\n  Ref count: 1\n  Ref count: 2\n  Using: DBConnection\n  Ref count: 1\n  Destroyed: DBConnection\n\n--- RAII LockGuard ---\n  Lock acquired\n  Critical section\n  Lock released\n  Outside critical section"
        },
        {
            id: "cpp-templates",
            name: "Templates & SFINAE",
            category: "Generic Programming",
            complexity: "Compile-time",
            description: "Compile-time polymorphism with function/class templates and constexpr",
            code: `#include <iostream>
#include <vector>
#include <type_traits>
using namespace std;

// === Function Template ===
template<typename T>
T maxOf(T a, T b) {
    return (a > b) ? a : b;
}

// === Class Template with specialization ===
template<typename T>
class Stack {
    vector<T> data;
public:
    void push(const T& val) { data.push_back(val); }
    
    T pop() {
        T top = data.back();
        data.pop_back();
        return top;
    }
    
    bool empty() const { return data.empty(); }
    size_t size() const { return data.size(); }
    
    void print() const {
        cout << "  [";
        for (size_t i = 0; i < data.size(); i++) {
            if (i > 0) cout << ", ";
            cout << data[i];
        }
        cout << "] (size=" << data.size() << ")" << endl;
    }
};

// === Variadic Template ===
template<typename T>
T sum(T val) { return val; }

template<typename T, typename... Args>
T sum(T first, Args... rest) {
    return first + sum(rest...);
}

// === constexpr: Compile-time computation ===
constexpr int factorial(int n) {
    return (n <= 1) ? 1 : n * factorial(n - 1);
}

// === SFINAE: enable_if ===
template<typename T>
typename enable_if<is_integral<T>::value, T>::type
safeDiv(T a, T b) {
    if (b == 0) {
        cout << "  Division by zero!" << endl;
        return 0;
    }
    return a / b;
}

template<typename T>
typename enable_if<is_floating_point<T>::value, T>::type
safeDiv(T a, T b) {
    return a / b; // NaN/Inf is valid for floats
}

int main() {
    // Function template
    cout << "=== Function Templates ===" << endl;
    cout << "  max(3, 7) = " << maxOf(3, 7) << endl;
    cout << "  max(3.14, 2.72) = " << maxOf(3.14, 2.72) << endl;
    cout << "  max('a', 'z') = " << maxOf('a', 'z') << endl;
    
    // Class template
    cout << "\\n=== Stack<T> ===" << endl;
    Stack<int> intStack;
    for (int i : {10, 20, 30}) intStack.push(i);
    intStack.print();
    cout << "  Popped: " << intStack.pop() << endl;
    intStack.print();
    
    // Variadic templates
    cout << "\\n=== Variadic Templates ===" << endl;
    cout << "  sum(1,2,3,4,5) = " << sum(1,2,3,4,5) << endl;
    cout << "  sum(1.1, 2.2, 3.3) = " << sum(1.1, 2.2, 3.3) << endl;
    
    // constexpr
    cout << "\\n=== constexpr ===" << endl;
    constexpr int fact10 = factorial(10);
    cout << "  10! = " << fact10 << " (computed at compile time)" << endl;
    
    // SFINAE
    cout << "\\n=== SFINAE ===" << endl;
    cout << "  safeDiv(10, 3) = " << safeDiv(10, 3) << endl;
    cout << "  safeDiv(10, 0) = "; safeDiv(10, 0);
    cout << "  safeDiv(10.0, 3.0) = " << safeDiv(10.0, 3.0) << endl;
    
    return 0;
}`,
            explanation: "Templates enable compile-time polymorphism — the compiler generates specialized code for each type used. Variadic templates handle arbitrary argument counts. constexpr forces compile-time evaluation. SFINAE (Substitution Failure Is Not An Error) enables conditional compilation based on type traits. Interview focus: template instantiation, specialization, concept (C++20) vs SFINAE.",
            useCases: ["Generic containers (STL)", "Compile-time optimization", "Library development", "Policy-based design"],
            output: "=== Function Templates ===\n  max(3, 7) = 7\n  max(3.14, 2.72) = 3.14\n  max('a', 'z') = z\n\n=== Stack<T> ===\n  [10, 20, 30] (size=3)\n  Popped: 30\n  [10, 20] (size=2)\n\n=== Variadic Templates ===\n  sum(1,2,3,4,5) = 15\n  sum(1.1, 2.2, 3.3) = 6.6\n\n=== constexpr ===\n  10! = 3628800 (computed at compile time)\n\n=== SFINAE ===\n  safeDiv(10, 3) = 3\n  safeDiv(10, 0) =   Division by zero!\n  safeDiv(10.0, 3.0) = 3.33333"
        },
        {
            id: "cpp-move-semantics",
            name: "Move Semantics & Rvalues",
            category: "Performance",
            complexity: "O(1) move vs O(n) copy",
            description: "Efficient resource transfer using move constructors and rvalue references",
            code: `#include <iostream>
#include <vector>
#include <string>
#include <utility>
using namespace std;

class Buffer {
    int* data;
    size_t size;
    string label;
    
public:
    // Constructor
    Buffer(size_t sz, string lbl) : size(sz), label(lbl) {
        data = new int[size];
        for (size_t i = 0; i < size; i++) data[i] = i;
        cout << "  Constructed: " << label << " (" << size << " ints)" << endl;
    }
    
    // Copy constructor (expensive: deep copy)
    Buffer(const Buffer& other) : size(other.size), label(other.label + "_copy") {
        data = new int[size];
        copy(other.data, other.data + size, data);
        cout << "  COPIED: " << label << " (" << size << " ints)" << endl;
    }
    
    // Move constructor (cheap: steal resources)
    Buffer(Buffer&& other) noexcept
        : data(other.data), size(other.size), label(std::move(other.label)) {
        other.data = nullptr;
        other.size = 0;
        cout << "  MOVED: " << label << " (zero-cost)" << endl;
    }
    
    // Move assignment
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data;
            data = other.data;
            size = other.size;
            label = std::move(other.label);
            other.data = nullptr;
            other.size = 0;
        }
        return *this;
    }
    
    ~Buffer() {
        delete[] data;
    }
    
    size_t getSize() const { return size; }
};

// Perfect forwarding
template<typename T>
void logAndStore(vector<Buffer>& vec, T&& item) {
    cout << "  Forwarding..." << endl;
    vec.push_back(std::forward<T>(item));
}

int main() {
    cout << "=== Copy vs Move ===" << endl;
    Buffer original(1000000, "original");
    
    Buffer copied = original;           // Copy constructor
    Buffer moved = std::move(original); // Move constructor
    
    cout << "  Original size after move: " << original.getSize() << endl;
    cout << "  Moved size: " << moved.getSize() << endl;
    
    cout << "\\n=== Return Value Optimization ===" << endl;
    auto makeBuffer = [](string name) -> Buffer {
        Buffer b(500, name);
        return b; // NRVO or move
    };
    Buffer rvo = makeBuffer("rvo_buffer");
    
    cout << "\\n=== Perfect Forwarding ===" << endl;
    vector<Buffer> buffers;
    buffers.reserve(4);
    Buffer lvalue(100, "lvalue");
    logAndStore(buffers, lvalue);              // Copy
    logAndStore(buffers, Buffer(200, "temp")); // Move
    
    return 0;
}`,
            explanation: "Move semantics eliminate unnecessary copies by 'stealing' resources from temporary objects. Rvalue references (&&) bind to temporaries. std::move casts to rvalue reference, enabling the move constructor. Perfect forwarding (std::forward) preserves value category through templates. Interview focus: lvalue vs rvalue, Rule of Five, noexcept importance, RVO/NRVO.",
            useCases: ["Container operations", "Factory functions", "Resource transfer", "Performance optimization"],
            output: "=== Copy vs Move ===\n  Constructed: original (1000000 ints)\n  COPIED: original_copy (1000000 ints)\n  MOVED: original (zero-cost)\n  Original size after move: 0\n  Moved size: 1000000\n\n=== Return Value Optimization ===\n  Constructed: rvo_buffer (500 ints)\n\n=== Perfect Forwarding ===\n  Constructed: lvalue (100 ints)\n  Forwarding...\n  COPIED: lvalue_copy (100 ints)\n  Constructed: temp (200 ints)\n  Forwarding...\n  MOVED: temp (zero-cost)"
        },
        {
            id: "cpp-stl",
            name: "STL Algorithms & Containers",
            category: "Standard Library",
            complexity: "Varies by algorithm",
            description: "Mastering the STL: algorithms, iterators, and container adapters",
            code: `#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
#include <map>
#include <set>
#include <queue>
#include <functional>
using namespace std;

int main() {
    // === Algorithms ===
    cout << "=== STL Algorithms ===" << endl;
    vector<int> v = {5, 2, 8, 1, 9, 3, 7, 4, 6};
    
    // Sort
    sort(v.begin(), v.end());
    cout << "Sorted: ";
    for (int x : v) cout << x << " ";
    cout << endl;
    
    // Binary search
    cout << "Contains 7: " << binary_search(v.begin(), v.end(), 7) << endl;
    
    // Partition
    auto it = partition(v.begin(), v.end(), [](int x) { return x % 2 == 0; });
    cout << "Even|Odd partition: ";
    for (int x : v) cout << x << " ";
    cout << endl;
    
    // Accumulate with custom operation
    sort(v.begin(), v.end());
    int product = accumulate(v.begin(), v.end(), 1, multiplies<int>());
    cout << "Product: " << product << endl;
    
    // Transform
    vector<int> squared(v.size());
    transform(v.begin(), v.end(), squared.begin(), [](int x) { return x * x; });
    cout << "Squared: ";
    for (int x : squared) cout << x << " ";
    cout << endl;
    
    // === Associative Containers ===
    cout << "\\n=== map & set ===" << endl;
    map<string, int> scores = {{"Alice", 95}, {"Bob", 87}, {"Carol", 92}};
    scores["Dave"] = 88;
    
    for (auto& [name, score] : scores) {
        cout << "  " << name << ": " << score << endl;
    }
    
    // Multiset (allows duplicates, sorted)
    multiset<int> ms = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5};
    cout << "\\nMultiset: ";
    for (int x : ms) cout << x << " ";
    cout << "\\nCount of 5: " << ms.count(5) << endl;
    
    // === Priority Queue ===
    cout << "\\n=== priority_queue ===" << endl;
    // Min-heap
    priority_queue<int, vector<int>, greater<int>> minHeap;
    for (int x : {30, 10, 50, 20, 40}) minHeap.push(x);
    
    cout << "Min-heap order: ";
    while (!minHeap.empty()) {
        cout << minHeap.top() << " ";
        minHeap.pop();
    }
    cout << endl;
    
    // === nth_element (partial sort) ===
    cout << "\\n=== nth_element ===" << endl;
    vector<int> data = {9, 1, 5, 3, 7, 2, 8, 4, 6};
    nth_element(data.begin(), data.begin() + 4, data.end());
    cout << "Median (5th element): " << data[4] << endl;
    
    return 0;
}`,
            explanation: "The STL provides generic algorithms that work with any container through iterators. Key categories: sorting (sort, partial_sort, nth_element), searching (binary_search, lower_bound), modifying (transform, remove_if), numeric (accumulate, inner_product). Interview focus: iterator categories, algorithm complexity guarantees, when to use which container.",
            useCases: ["Data processing", "Competitive programming", "System software", "Performance-critical code"],
            output: "=== STL Algorithms ===\nSorted: 1 2 3 4 5 6 7 8 9\nContains 7: 1\nEven|Odd partition: 8 2 6 4 5 3 7 1 9\nProduct: 362880\nSquared: 1 4 9 16 25 36 49 64 81\n\n=== map & set ===\n  Alice: 95\n  Bob: 87\n  Carol: 92\n  Dave: 88\n\nMultiset: 1 1 2 3 3 4 5 5 5 6 9\nCount of 5: 3\n\n=== priority_queue ===\nMin-heap order: 10 20 30 40 50\n\n=== nth_element ===\nMedian (5th element): 5"
        },
        {
            id: "cpp-multithreading",
            name: "Multithreading & Atomics",
            category: "Concurrency",
            complexity: "O(1) per operation",
            description: "Thread management, mutexes, condition variables, and lock-free programming",
            code: `#include <iostream>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <vector>
#include <queue>
using namespace std;

// === Thread-safe Queue ===
template<typename T>
class ThreadSafeQueue {
    queue<T> q;
    mutable mutex mtx;
    condition_variable cv;
    
public:
    void push(T value) {
        {
            lock_guard<mutex> lock(mtx);
            q.push(std::move(value));
        }
        cv.notify_one();
    }
    
    T pop() {
        unique_lock<mutex> lock(mtx);
        cv.wait(lock, [this] { return !q.empty(); });
        T val = std::move(q.front());
        q.pop();
        return val;
    }
    
    bool empty() const {
        lock_guard<mutex> lock(mtx);
        return q.empty();
    }
};

// === Atomic counter (lock-free) ===
atomic<int> globalCounter{0};

void incrementCounter(int iterations) {
    for (int i = 0; i < iterations; i++) {
        globalCounter.fetch_add(1, memory_order_relaxed);
    }
}

int main() {
    // === Basic Threads ===
    cout << "=== Thread Basics ===" << endl;
    auto worker = [](int id, int count) {
        for (int i = 0; i < count; i++) {
            cout << "  Thread " << id << ": task " << i << endl;
        }
    };
    
    thread t1(worker, 1, 3);
    thread t2(worker, 2, 3);
    t1.join();
    t2.join();
    
    // === Producer-Consumer ===
    cout << "\\n=== Producer-Consumer ===" << endl;
    ThreadSafeQueue<string> taskQueue;
    
    thread producer([&]() {
        for (int i = 0; i < 5; i++) {
            string task = "Task_" + to_string(i);
            taskQueue.push(task);
            cout << "  Produced: " << task << endl;
        }
        taskQueue.push("STOP");
    });
    
    thread consumer([&]() {
        while (true) {
            string task = taskQueue.pop();
            if (task == "STOP") break;
            cout << "  Consumed: " << task << endl;
        }
    });
    
    producer.join();
    consumer.join();
    
    // === Atomic Operations ===
    cout << "\\n=== Atomics (Lock-free) ===" << endl;
    vector<thread> threads;
    for (int i = 0; i < 4; i++) {
        threads.emplace_back(incrementCounter, 25000);
    }
    for (auto& t : threads) t.join();
    
    cout << "  Counter (4 threads x 25000): " << globalCounter.load() << endl;
    cout << "  Correct: " << (globalCounter == 100000 ? "YES" : "NO") << endl;
    
    return 0;
}`,
            explanation: "C++ provides low-level threading primitives: std::thread for execution, mutex/lock_guard for mutual exclusion, condition_variable for signaling, and atomics for lock-free operations. lock_guard uses RAII for automatic unlock. condition_variable.wait() atomically releases the lock and sleeps. Interview focus: data races, deadlock prevention, memory ordering, lock-free vs lock-based.",
            useCases: ["Game engines", "Server backends", "Real-time systems", "Parallel computation"],
            output: "=== Thread Basics ===\n  Thread 1: task 0\n  Thread 1: task 1\n  Thread 1: task 2\n  Thread 2: task 0\n  Thread 2: task 1\n  Thread 2: task 2\n\n=== Producer-Consumer ===\n  Produced: Task_0\n  Produced: Task_1\n  Consumed: Task_0\n  Consumed: Task_1\n  Produced: Task_2\n  Produced: Task_3\n  Consumed: Task_2\n  Produced: Task_4\n  Consumed: Task_3\n  Consumed: Task_4\n\n=== Atomics (Lock-free) ===\n  Counter (4 threads x 25000): 100000\n  Correct: YES"
        },
        {
            id: "cpp-polymorphism",
            name: "Virtual Functions & Polymorphism",
            category: "OOP",
            complexity: "O(1) vtable lookup",
            description: "Runtime polymorphism with virtual functions, abstract classes, and the vtable mechanism",
            code: `#include <iostream>
#include <vector>
#include <memory>
using namespace std;

// === Abstract Base Class ===
class Shape {
protected:
    string name;
public:
    Shape(string n) : name(n) {}
    virtual ~Shape() = default;
    
    // Pure virtual functions
    virtual double area() const = 0;
    virtual double perimeter() const = 0;
    
    // Virtual with default implementation
    virtual void describe() const {
        cout << "  " << name << ": area=" << area()
             << ", perimeter=" << perimeter() << endl;
    }
};

class Circle : public Shape {
    double radius;
public:
    Circle(double r) : Shape("Circle"), radius(r) {}
    double area() const override { return 3.14159 * radius * radius; }
    double perimeter() const override { return 2 * 3.14159 * radius; }
};

class Rectangle : public Shape {
    double w, h;
public:
    Rectangle(double w, double h) : Shape("Rectangle"), w(w), h(h) {}
    double area() const override { return w * h; }
    double perimeter() const override { return 2 * (w + h); }
};

class Triangle : public Shape {
    double a, b, c, height;
public:
    Triangle(double a, double b, double c, double h)
        : Shape("Triangle"), a(a), b(b), c(c), height(h) {}
    double area() const override { return 0.5 * a * height; }
    double perimeter() const override { return a + b + c; }
};

// === CRTP: Compile-time Polymorphism ===
template<typename Derived>
class Printable {
public:
    void print() const {
        static_cast<const Derived*>(this)->printImpl();
    }
};

class Product : public Printable<Product> {
    string name;
    double price;
public:
    Product(string n, double p) : name(n), price(p) {}
    void printImpl() const {
        cout << "  Product: " << name << " ($" << price << ")" << endl;
    }
};

int main() {
    // Runtime polymorphism via base pointer
    cout << "=== Runtime Polymorphism ===" << endl;
    vector<unique_ptr<Shape>> shapes;
    shapes.push_back(make_unique<Circle>(5.0));
    shapes.push_back(make_unique<Rectangle>(4.0, 6.0));
    shapes.push_back(make_unique<Triangle>(3.0, 4.0, 5.0, 4.0));
    
    double totalArea = 0;
    for (const auto& s : shapes) {
        s->describe(); // Virtual dispatch
        totalArea += s->area();
    }
    cout << "  Total area: " << totalArea << endl;
    
    // CRTP (no vtable overhead)
    cout << "\\n=== CRTP (Compile-time) ===" << endl;
    Product p("Laptop", 999.99);
    p.print(); // Resolved at compile time
    
    return 0;
}`,
            explanation: "Virtual functions enable runtime polymorphism through the vtable (virtual table). Each class with virtual functions has a vtable containing pointers to its implementations. The base pointer uses the vtable to dispatch the correct function at runtime. CRTP (Curiously Recurring Template Pattern) achieves static polymorphism without vtable overhead. Interview focus: vtable mechanism, virtual destructor necessity, override/final keywords, diamond problem.",
            useCases: ["Plugin systems", "UI frameworks", "Game entity systems", "Abstract interfaces"],
            output: "=== Runtime Polymorphism ===\n  Circle: area=78.5398, perimeter=31.4159\n  Rectangle: area=24, perimeter=20\n  Triangle: area=6, perimeter=12\n  Total area: 108.54\n\n=== CRTP (Compile-time) ===\n  Product: Laptop ($999.99)"
        }
    ]
};
