import { LanguageConfig } from "./index";

export const cData: LanguageConfig = {
    id: "c",
    name: "C",
    icon: "🔧",
    color: "text-gray-400",
    gradient: "from-gray-500 to-blue-600",
    badge: "C11/C17",
    description: "The foundation of systems programming — pointers, manual memory, and hardware-level control",
    examples: [
        {
            id: "c-pointers",
            name: "Pointers & Memory",
            category: "Core Concepts",
            complexity: "O(1) per operation",
            description: "Pointer arithmetic, arrays, function pointers, and void pointers — the heart of C",
            code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// === Pointer Basics ===
void swapValues(int *a, int *b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}

// === Array-Pointer Duality ===
void printArray(int *arr, int size) {
    printf("  [");
    for (int i = 0; i < size; i++) {
        if (i > 0) printf(", ");
        printf("%d", *(arr + i));  // Pointer arithmetic
    }
    printf("]\\n");
}

// === Function Pointers ===
typedef int (*Comparator)(const void*, const void*);

int ascending(const void *a, const void *b) {
    return (*(int*)a - *(int*)b);
}

int descending(const void *a, const void *b) {
    return (*(int*)b - *(int*)a);
}

void sortWith(int *arr, int size, Comparator cmp) {
    qsort(arr, size, sizeof(int), cmp);
}

// === Double Pointer (pointer to pointer) ===
void allocateMatrix(int ***matrix, int rows, int cols) {
    *matrix = (int**)malloc(rows * sizeof(int*));
    for (int i = 0; i < rows; i++) {
        (*matrix)[i] = (int*)calloc(cols, sizeof(int));
        for (int j = 0; j < cols; j++) {
            (*matrix)[i][j] = i * cols + j + 1;
        }
    }
}

void freeMatrix(int **matrix, int rows) {
    for (int i = 0; i < rows; i++) free(matrix[i]);
    free(matrix);
}

int main() {
    // Swap via pointers
    printf("=== Pointer Swap ===\\n");
    int x = 10, y = 20;
    printf("  Before: x=%d, y=%d\\n", x, y);
    swapValues(&x, &y);
    printf("  After:  x=%d, y=%d\\n", x, y);
    
    // Array-pointer duality
    printf("\\n=== Array-Pointer ===\\n");
    int nums[] = {5, 3, 8, 1, 9, 2, 7};
    int size = sizeof(nums) / sizeof(nums[0]);
    printf("  Original: "); printArray(nums, size);
    
    // Function pointers
    printf("\\n=== Function Pointers ===\\n");
    int data[] = {5, 3, 8, 1, 9, 2, 7};
    sortWith(data, 7, ascending);
    printf("  Ascending:  "); printArray(data, 7);
    sortWith(data, 7, descending);
    printf("  Descending: "); printArray(data, 7);
    
    // Double pointer for 2D allocation
    printf("\\n=== Dynamic 2D Array ===\\n");
    int **matrix;
    allocateMatrix(&matrix, 3, 4);
    for (int i = 0; i < 3; i++) {
        printf("  Row %d: ", i);
        printArray(matrix[i], 4);
    }
    freeMatrix(matrix, 3);
    printf("  Matrix freed successfully\\n");
    
    return 0;
}`,
            explanation: "Pointers are variables that store memory addresses. The & operator gets an address, * dereferences it. Array names decay to pointers to their first element. Function pointers enable callbacks and strategy patterns. Double pointers (int**) are used for dynamic 2D arrays and modifying pointer arguments. Interview focus: pointer arithmetic, dangling pointers, void* usage, const correctness.",
            useCases: ["System programming", "Device drivers", "Embedded systems", "Memory-mapped I/O"],
            output: "=== Pointer Swap ===\n  Before: x=10, y=20\n  After:  x=20, y=10\n\n=== Array-Pointer ===\n  Original: [5, 3, 8, 1, 9, 2, 7]\n\n=== Function Pointers ===\n  Ascending:  [1, 2, 3, 5, 7, 8, 9]\n  Descending: [9, 8, 7, 5, 3, 2, 1]\n\n=== Dynamic 2D Array ===\n  Row 0: [1, 2, 3, 4]\n  Row 1: [5, 6, 7, 8]\n  Row 2: [9, 10, 11, 12]\n  Matrix freed successfully"
        },
        {
            id: "c-structs",
            name: "Structs & OOP in C",
            category: "Data Modeling",
            complexity: "O(1)",
            description: "Object-oriented patterns in C using structs, function pointers, and opaque types",
            code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// === "Class" using struct + function pointers ===
typedef struct {
    char name[50];
    double balance;
    // "Methods" via function pointers
    void (*deposit)(void *self, double amount);
    void (*withdraw)(void *self, double amount);
    void (*display)(const void *self);
} Account;

void account_deposit(void *self, double amount) {
    Account *acc = (Account*)self;
    acc->balance += amount;
    printf("  Deposited $%.2f -> Balance: $%.2f\\n", amount, acc->balance);
}

void account_withdraw(void *self, double amount) {
    Account *acc = (Account*)self;
    if (amount > acc->balance) {
        printf("  Insufficient funds!\\n");
        return;
    }
    acc->balance -= amount;
    printf("  Withdrew $%.2f -> Balance: $%.2f\\n", amount, acc->balance);
}

void account_display(const void *self) {
    const Account *acc = (const Account*)self;
    printf("  Account: %s | Balance: $%.2f\\n", acc->name, acc->balance);
}

Account* account_new(const char *name, double initial) {
    Account *acc = (Account*)malloc(sizeof(Account));
    strncpy(acc->name, name, 49);
    acc->balance = initial;
    acc->deposit = account_deposit;
    acc->withdraw = account_withdraw;
    acc->display = account_display;
    return acc;
}

// === Tagged Union (variant type) ===
typedef enum { TYPE_INT, TYPE_FLOAT, TYPE_STRING } ValueType;

typedef struct {
    ValueType type;
    union {
        int intVal;
        float floatVal;
        char strVal[64];
    } data;
} Value;

void print_value(const Value *v) {
    switch (v->type) {
        case TYPE_INT:    printf("  Int: %d\\n", v->data.intVal); break;
        case TYPE_FLOAT:  printf("  Float: %.2f\\n", v->data.floatVal); break;
        case TYPE_STRING: printf("  String: \\"%s\\"\\n", v->data.strVal); break;
    }
}

int main() {
    printf("=== OOP with Structs ===\\n");
    Account *alice = account_new("Alice", 1000.0);
    Account *bob = account_new("Bob", 500.0);
    
    alice->display(alice);
    alice->deposit(alice, 250.0);
    alice->withdraw(alice, 100.0);
    
    bob->display(bob);
    bob->withdraw(bob, 600.0); // Insufficient
    
    free(alice);
    free(bob);
    
    printf("\\n=== Tagged Union ===\\n");
    Value values[] = {
        { TYPE_INT,    { .intVal = 42 } },
        { TYPE_FLOAT,  { .floatVal = 3.14 } },
        { TYPE_STRING, { .strVal = "hello" } },
    };
    
    for (int i = 0; i < 3; i++) {
        print_value(&values[i]);
    }
    
    return 0;
}`,
            explanation: "C achieves OOP-like patterns using structs with function pointers as 'methods'. The void* parameter acts as 'this/self'. Tagged unions (enum + union) create type-safe variant types. Opaque pointers in headers provide encapsulation. Interview focus: struct padding/alignment, designated initializers (C99), flexible array members, forward declarations.",
            useCases: ["OS kernel design", "Embedded firmware", "Protocol parsing", "Hardware abstraction layers"],
            output: "=== OOP with Structs ===\n  Account: Alice | Balance: $1000.00\n  Deposited $250.00 -> Balance: $1250.00\n  Withdrew $100.00 -> Balance: $1150.00\n  Account: Bob | Balance: $500.00\n  Insufficient funds!\n\n=== Tagged Union ===\n  Int: 42\n  Float: 3.14\n  String: \"hello\""
        },
        {
            id: "c-linked-list",
            name: "Linked List from Scratch",
            category: "Data Structures",
            complexity: "O(1) insert, O(n) search",
            description: "Complete singly linked list with insert, delete, reverse, and cycle detection",
            code: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

typedef struct {
    Node *head;
    int size;
} LinkedList;

LinkedList* list_create() {
    LinkedList *list = (LinkedList*)malloc(sizeof(LinkedList));
    list->head = NULL;
    list->size = 0;
    return list;
}

void list_push_front(LinkedList *list, int data) {
    Node *node = (Node*)malloc(sizeof(Node));
    node->data = data;
    node->next = list->head;
    list->head = node;
    list->size++;
}

void list_push_back(LinkedList *list, int data) {
    Node *node = (Node*)malloc(sizeof(Node));
    node->data = data;
    node->next = NULL;
    
    if (!list->head) {
        list->head = node;
    } else {
        Node *curr = list->head;
        while (curr->next) curr = curr->next;
        curr->next = node;
    }
    list->size++;
}

int list_delete(LinkedList *list, int data) {
    if (!list->head) return 0;
    
    if (list->head->data == data) {
        Node *temp = list->head;
        list->head = list->head->next;
        free(temp);
        list->size--;
        return 1;
    }
    
    Node *curr = list->head;
    while (curr->next && curr->next->data != data) {
        curr = curr->next;
    }
    
    if (curr->next) {
        Node *temp = curr->next;
        curr->next = temp->next;
        free(temp);
        list->size--;
        return 1;
    }
    return 0;
}

// Floyd's Cycle Detection
int list_has_cycle(Node *head) {
    Node *slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return 1;
    }
    return 0;
}

// Reverse in place
void list_reverse(LinkedList *list) {
    Node *prev = NULL, *curr = list->head, *next;
    while (curr) {
        next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    list->head = prev;
}

void list_print(const LinkedList *list) {
    printf("  [");
    Node *curr = list->head;
    while (curr) {
        printf("%d", curr->data);
        if (curr->next) printf(" -> ");
        curr = curr->next;
    }
    printf("] (size=%d)\\n", list->size);
}

void list_free(LinkedList *list) {
    Node *curr = list->head;
    while (curr) {
        Node *next = curr->next;
        free(curr);
        curr = next;
    }
    free(list);
}

int main() {
    LinkedList *list = list_create();
    
    printf("=== Building List ===\\n");
    list_push_back(list, 10);
    list_push_back(list, 20);
    list_push_back(list, 30);
    list_push_front(list, 5);
    list_print(list);
    
    printf("\\n=== Delete 20 ===\\n");
    list_delete(list, 20);
    list_print(list);
    
    printf("\\n=== Reverse ===\\n");
    list_reverse(list);
    list_print(list);
    
    printf("\\n=== Cycle Detection ===\\n");
    printf("  Has cycle: %s\\n", list_has_cycle(list->head) ? "YES" : "NO");
    
    list_free(list);
    printf("\\n  Memory freed successfully\\n");
    
    return 0;
}`,
            explanation: "Linked lists are the foundation of dynamic data structures in C. Each node is heap-allocated and connected via pointers. Floyd's cycle detection uses two pointers moving at different speeds — if they meet, a cycle exists. Reversing uses three pointers (prev/curr/next). Interview focus: memory leak prevention, sentinel nodes, doubly-linked variants, merge two sorted lists.",
            useCases: ["Memory allocators", "Undo/redo stacks", "Hash table chaining", "Kernel scheduling"],
            output: "=== Building List ===\n  [5 -> 10 -> 20 -> 30] (size=4)\n\n=== Delete 20 ===\n  [5 -> 10 -> 30] (size=3)\n\n=== Reverse ===\n  [30 -> 10 -> 5] (size=3)\n\n=== Cycle Detection ===\n  Has cycle: NO\n\n  Memory freed successfully"
        },
        {
            id: "c-file-io",
            name: "File I/O & Buffering",
            category: "Systems",
            complexity: "O(n) for n bytes",
            description: "Binary and text file operations, buffered I/O, and memory-mapped concepts",
            code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// === Struct for binary read/write ===
typedef struct {
    int id;
    char name[32];
    float score;
} Student;

void write_text_file(const char *filename) {
    FILE *fp = fopen(filename, "w");
    if (!fp) { perror("Open failed"); return; }
    
    fprintf(fp, "Name,Score\\n");
    fprintf(fp, "Alice,95.5\\n");
    fprintf(fp, "Bob,87.3\\n");
    fprintf(fp, "Carol,92.8\\n");
    
    fclose(fp);
    printf("  Wrote text file: %s\\n", filename);
}

void read_text_file(const char *filename) {
    FILE *fp = fopen(filename, "r");
    if (!fp) { perror("Open failed"); return; }
    
    char line[256];
    printf("  Reading %s:\\n", filename);
    while (fgets(line, sizeof(line), fp)) {
        // Remove newline
        line[strcspn(line, "\\n")] = 0;
        printf("    %s\\n", line);
    }
    
    fclose(fp);
}

void write_binary(const char *filename) {
    Student students[] = {
        {1, "Alice", 95.5f},
        {2, "Bob", 87.3f},
        {3, "Carol", 92.8f},
    };
    
    FILE *fp = fopen(filename, "wb");
    if (!fp) { perror("Open failed"); return; }
    
    int count = 3;
    fwrite(&count, sizeof(int), 1, fp);
    fwrite(students, sizeof(Student), count, fp);
    
    fclose(fp);
    printf("  Wrote %d records to %s\\n", count, filename);
}

void read_binary(const char *filename) {
    FILE *fp = fopen(filename, "rb");
    if (!fp) { perror("Open failed"); return; }
    
    int count;
    fread(&count, sizeof(int), 1, fp);
    
    Student *students = (Student*)malloc(count * sizeof(Student));
    fread(students, sizeof(Student), count, fp);
    
    printf("  Read %d records from %s:\\n", count, filename);
    for (int i = 0; i < count; i++) {
        printf("    [%d] %s: %.1f\\n",
            students[i].id, students[i].name, students[i].score);
    }
    
    free(students);
    fclose(fp);
}

// === Buffered copy ===
long file_copy(const char *src, const char *dst) {
    FILE *in = fopen(src, "rb");
    FILE *out = fopen(dst, "wb");
    if (!in || !out) return -1;
    
    char buffer[4096];
    size_t bytes;
    long total = 0;
    
    while ((bytes = fread(buffer, 1, sizeof(buffer), in)) > 0) {
        fwrite(buffer, 1, bytes, out);
        total += bytes;
    }
    
    fclose(in);
    fclose(out);
    return total;
}

int main() {
    printf("=== Text File I/O ===\\n");
    write_text_file("scores.csv");
    read_text_file("scores.csv");
    
    printf("\\n=== Binary File I/O ===\\n");
    write_binary("students.bin");
    read_binary("students.bin");
    
    printf("\\n=== File Copy ===\\n");
    long copied = file_copy("scores.csv", "scores_backup.csv");
    printf("  Copied %ld bytes\\n", copied);
    
    // Cleanup
    remove("scores.csv");
    remove("scores_backup.csv");
    remove("students.bin");
    printf("  Temp files cleaned up\\n");
    
    return 0;
}`,
            explanation: "C file I/O uses FILE* handles with fopen/fclose. Text mode (r/w) handles line endings; binary mode (rb/wb) preserves exact bytes. fread/fwrite handle struct serialization. Buffered I/O (using a 4KB buffer) dramatically improves performance over byte-at-a-byte reading. Interview focus: error handling, buffer overflow prevention, endianness in binary I/O, file locking.",
            useCases: ["Log file processing", "Database storage engines", "Configuration parsers", "Network packet capture"],
            output: "=== Text File I/O ===\n  Wrote text file: scores.csv\n  Reading scores.csv:\n    Name,Score\n    Alice,95.5\n    Bob,87.3\n    Carol,92.8\n\n=== Binary File I/O ===\n  Wrote 3 records to students.bin\n  Read 3 records from students.bin:\n    [1] Alice: 95.5\n    [2] Bob: 87.3\n    [3] Carol: 92.8\n\n=== File Copy ===\n  Copied 42 bytes\n  Temp files cleaned up"
        },
        {
            id: "c-bitwise",
            name: "Bitwise Operations",
            category: "Low-level",
            complexity: "O(1)",
            description: "Bit manipulation for flags, masks, and efficient algorithms — essential for systems programming",
            code: `#include <stdio.h>
#include <stdint.h>

// === Bit Flags ===
#define PERM_READ    (1 << 0)  // 001
#define PERM_WRITE   (1 << 1)  // 010
#define PERM_EXECUTE (1 << 2)  // 100

void print_permissions(uint8_t perms) {
    printf("  Permissions: ");
    printf("%c", (perms & PERM_READ)    ? 'r' : '-');
    printf("%c", (perms & PERM_WRITE)   ? 'w' : '-');
    printf("%c", (perms & PERM_EXECUTE) ? 'x' : '-');
    printf(" (0b");
    for (int i = 7; i >= 0; i--) printf("%d", (perms >> i) & 1);
    printf(")\\n");
}

// === Common Bit Tricks ===
int is_power_of_two(unsigned int n) {
    return n > 0 && (n & (n - 1)) == 0;
}

int count_set_bits(unsigned int n) {
    int count = 0;
    while (n) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

// Brian Kernighan's algorithm (faster)
int count_bits_kernighan(unsigned int n) {
    int count = 0;
    while (n) {
        n &= (n - 1); // Clear lowest set bit
        count++;
    }
    return count;
}

unsigned int swap_bits(unsigned int n) {
    // Swap odd/even bit positions
    return ((n & 0xAAAAAAAA) >> 1) | ((n & 0x55555555) << 1);
}

int find_missing(int arr[], int n) {
    int result = 0;
    for (int i = 1; i <= n; i++) result ^= i;
    for (int i = 0; i < n - 1; i++) result ^= arr[i];
    return result;
}

int main() {
    // Bit flags
    printf("=== Permission Flags ===\\n");
    uint8_t perms = 0;
    perms |= PERM_READ;                    // Set read
    print_permissions(perms);
    perms |= PERM_WRITE | PERM_EXECUTE;    // Set write+exec
    print_permissions(perms);
    perms &= ~PERM_WRITE;                  // Clear write
    print_permissions(perms);
    perms ^= PERM_EXECUTE;                 // Toggle exec
    print_permissions(perms);
    
    // Power of two
    printf("\\n=== Power of Two ===\\n");
    int tests[] = {1, 2, 3, 4, 16, 15, 64, 100};
    for (int i = 0; i < 8; i++) {
        printf("  %3d: %s\\n", tests[i],
            is_power_of_two(tests[i]) ? "YES" : "NO");
    }
    
    // Bit counting
    printf("\\n=== Bit Counting ===\\n");
    unsigned int num = 0b11010110;
    printf("  %u (0b11010110): %d bits set\\n", num, count_bits_kernighan(num));
    
    // XOR find missing number
    printf("\\n=== Find Missing (XOR) ===\\n");
    int arr[] = {1, 2, 4, 5, 6};  // Missing: 3
    printf("  Array: [1,2,4,5,6], Missing: %d\\n", find_missing(arr, 6));
    
    return 0;
}`,
            explanation: "Bitwise operations manipulate individual bits for maximum efficiency. OR (|) sets bits, AND (&) tests/masks bits, XOR (^) toggles/finds differences, NOT (~) inverts. Bit flags pack multiple booleans into a single byte. XOR's self-canceling property finds missing/unique elements. Interview focus: n & (n-1) clears lowest bit, XOR tricks, bit masks for permissions, endianness.",
            useCases: ["OS permission flags", "Network protocol headers", "Embedded register programming", "Cryptography"],
            output: "=== Permission Flags ===\n  Permissions: r-- (0b00000001)\n  Permissions: rwx (0b00000111)\n  Permissions: r-x (0b00000101)\n  Permissions: r-- (0b00000001)\n\n=== Power of Two ===\n    1: YES\n    2: YES\n    3: NO\n    4: YES\n   16: YES\n   15: NO\n   64: YES\n  100: NO\n\n=== Bit Counting ===\n  214 (0b11010110): 5 bits set\n\n=== Find Missing (XOR) ===\n  Array: [1,2,4,5,6], Missing: 3"
        },
        {
            id: "c-malloc",
            name: "Dynamic Memory Management",
            category: "Memory",
            complexity: "O(1) alloc, O(n) realloc",
            description: "malloc, calloc, realloc, free — and building a simple memory arena allocator",
            code: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// === Dynamic String Builder ===
typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} StringBuilder;

StringBuilder* sb_create(size_t initial) {
    StringBuilder *sb = (StringBuilder*)malloc(sizeof(StringBuilder));
    sb->data = (char*)malloc(initial);
    sb->data[0] = '\\0';
    sb->length = 0;
    sb->capacity = initial;
    return sb;
}

void sb_append(StringBuilder *sb, const char *str) {
    size_t addLen = strlen(str);
    
    // Grow if needed (double capacity)
    while (sb->length + addLen + 1 > sb->capacity) {
        sb->capacity *= 2;
        sb->data = (char*)realloc(sb->data, sb->capacity);
        printf("    [Resized to %zu bytes]\\n", sb->capacity);
    }
    
    memcpy(sb->data + sb->length, str, addLen + 1);
    sb->length += addLen;
}

void sb_free(StringBuilder *sb) {
    free(sb->data);
    free(sb);
}

// === Simple Arena Allocator ===
typedef struct {
    char *buffer;
    size_t capacity;
    size_t offset;
    int alloc_count;
} Arena;

Arena* arena_create(size_t size) {
    Arena *arena = (Arena*)malloc(sizeof(Arena));
    arena->buffer = (char*)malloc(size);
    arena->capacity = size;
    arena->offset = 0;
    arena->alloc_count = 0;
    return arena;
}

void* arena_alloc(Arena *arena, size_t size) {
    // Align to 8 bytes
    size = (size + 7) & ~7;
    
    if (arena->offset + size > arena->capacity) {
        printf("    Arena full!\\n");
        return NULL;
    }
    
    void *ptr = arena->buffer + arena->offset;
    arena->offset += size;
    arena->alloc_count++;
    return ptr;
}

void arena_reset(Arena *arena) {
    arena->offset = 0;
    arena->alloc_count = 0;
}

void arena_free(Arena *arena) {
    free(arena->buffer);
    free(arena);
}

int main() {
    // Dynamic string
    printf("=== StringBuilder ===\\n");
    StringBuilder *sb = sb_create(16);
    sb_append(sb, "Hello");
    sb_append(sb, ", ");
    sb_append(sb, "World!");
    sb_append(sb, " This is a longer string to trigger resize.");
    printf("  Result: \\"%s\\"\\n", sb->data);
    printf("  Length: %zu, Capacity: %zu\\n", sb->length, sb->capacity);
    sb_free(sb);
    
    // Arena allocator
    printf("\\n=== Arena Allocator ===\\n");
    Arena *arena = arena_create(1024);
    
    int *nums = (int*)arena_alloc(arena, 5 * sizeof(int));
    for (int i = 0; i < 5; i++) nums[i] = (i + 1) * 10;
    
    char *name = (char*)arena_alloc(arena, 32);
    strcpy(name, "John Doe");
    
    printf("  Numbers: ");
    for (int i = 0; i < 5; i++) printf("%d ", nums[i]);
    printf("\\n  Name: %s\\n", name);
    printf("  Used: %zu/%zu bytes, %d allocations\\n",
        arena->offset, arena->capacity, arena->alloc_count);
    
    // Reset frees everything at once (O(1))
    arena_reset(arena);
    printf("  After reset: %zu bytes used\\n", arena->offset);
    
    arena_free(arena);
    
    return 0;
}`,
            explanation: "malloc allocates uninitialized memory, calloc zero-initializes, realloc resizes (may move data). Always check return values and free when done. Arena allocators allocate from a pre-allocated buffer — individual frees aren't needed, just reset the offset. This eliminates fragmentation and is O(1) for both alloc and reset. Interview focus: memory leaks, fragmentation, alignment, pool allocators.",
            useCases: ["Game frame allocators", "Parser temporary storage", "Server request buffers", "Embedded memory pools"],
            output: "=== StringBuilder ===\n    [Resized to 32 bytes]\n    [Resized to 64 bytes]\n  Result: \"Hello, World! This is a longer string to trigger resize.\"\n  Length: 56, Capacity: 64\n\n=== Arena Allocator ===\n  Numbers: 10 20 30 40 50\n  Name: John Doe\n  Used: 56/1024 bytes, 2 allocations\n  After reset: 0 bytes used"
        }
    ]
};
