import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Play, Code2, Cpu, Zap, Binary, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

interface Algorithm {
  id: string;
  name: string;
  category: string;
  complexity: string;
  description: string;
  cppCode: string;
  explanation: string;
  useCases: string[];
}

const algorithms: Algorithm[] = [
  {
    id: "quicksort",
    name: "QuickSort",
    category: "Sorting",
    complexity: "O(n log n)",
    description: "Efficient divide-and-conquer sorting algorithm using pivot partitioning",
    cppCode: `#include <iostream>
#include <vector>
using namespace std;

// Partition function for QuickSort
int partition(vector<int>& arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    
    for (int j = low; j < high; j++) {
        if (arr[j] < pivot) {
            i++;
            swap(arr[i], arr[j]);
        }
    }
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

// QuickSort implementation
void quickSort(vector<int>& arr, int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

int main() {
    vector<int> arr = {64, 34, 25, 12, 22, 11, 90};
    
    cout << "Original array: ";
    for (int x : arr) cout << x << " ";
    cout << endl;
    
    quickSort(arr, 0, arr.size() - 1);
    
    cout << "Sorted array: ";
    for (int x : arr) cout << x << " ";
    cout << endl;
    
    return 0;
}`,
    explanation: "QuickSort works by selecting a 'pivot' element and partitioning the array around it. Elements smaller than the pivot go to the left, larger elements go to the right. This process is recursively applied to sub-arrays.",
    useCases: ["General-purpose sorting", "Database indexing", "File systems"]
  },
  {
    id: "binary-search",
    name: "Binary Search",
    category: "Searching",
    complexity: "O(log n)",
    description: "Efficient search algorithm for sorted arrays using divide and conquer",
    cppCode: `#include <iostream>
#include <vector>
using namespace std;

// Iterative Binary Search
int binarySearch(const vector<int>& arr, int target) {
    int left = 0;
    int right = arr.size() - 1;
    
    while (left <= right) {
        int mid = left + (right - left) / 2;
        
        if (arr[mid] == target) {
            return mid;  // Found!
        }
        else if (arr[mid] < target) {
            left = mid + 1;  // Search right half
        }
        else {
            right = mid - 1;  // Search left half
        }
    }
    
    return -1;  // Not found
}

// Recursive Binary Search
int binarySearchRecursive(const vector<int>& arr, int target, 
                          int left, int right) {
    if (left > right) return -1;
    
    int mid = left + (right - left) / 2;
    
    if (arr[mid] == target) return mid;
    if (arr[mid] < target) 
        return binarySearchRecursive(arr, target, mid + 1, right);
    return binarySearchRecursive(arr, target, left, mid - 1);
}

int main() {
    vector<int> arr = {2, 5, 8, 12, 16, 23, 38, 56, 72, 91};
    int target = 23;
    
    int result = binarySearch(arr, target);
    
    if (result != -1)
        cout << "Element found at index: " << result << endl;
    else
        cout << "Element not found" << endl;
    
    return 0;
}`,
    explanation: "Binary Search eliminates half of the remaining elements in each step. It requires a sorted array and compares the target with the middle element, then searches the appropriate half.",
    useCases: ["Finding elements in sorted data", "Database queries", "Spell checking"]
  },
  {
    id: "dijkstra",
    name: "Dijkstra's Algorithm",
    category: "Graph",
    complexity: "O((V+E) log V)",
    description: "Finds shortest paths from source to all vertices in weighted graph",
    cppCode: `#include <iostream>
#include <vector>
#include <queue>
#include <limits>
using namespace std;

typedef pair<int, int> pii;

class Graph {
    int V;
    vector<vector<pii>> adj;  // adjacency list
    
public:
    Graph(int V) : V(V), adj(V) {}
    
    void addEdge(int u, int v, int weight) {
        adj[u].push_back({v, weight});
        adj[v].push_back({u, weight});
    }
    
    vector<int> dijkstra(int src) {
        // Min-heap priority queue
        priority_queue<pii, vector<pii>, greater<pii>> pq;
        
        // Distance vector initialized to infinity
        vector<int> dist(V, numeric_limits<int>::max());
        
        dist[src] = 0;
        pq.push({0, src});
        
        while (!pq.empty()) {
            int u = pq.top().second;
            int d = pq.top().first;
            pq.pop();
            
            // Skip if we found a better path already
            if (d > dist[u]) continue;
            
            // Check all neighbors
            for (auto& [v, weight] : adj[u]) {
                if (dist[u] + weight < dist[v]) {
                    dist[v] = dist[u] + weight;
                    pq.push({dist[v], v});
                }
            }
        }
        
        return dist;
    }
};

int main() {
    Graph g(5);
    g.addEdge(0, 1, 4);
    g.addEdge(0, 2, 1);
    g.addEdge(2, 1, 2);
    g.addEdge(1, 3, 1);
    g.addEdge(2, 3, 5);
    g.addEdge(3, 4, 3);
    
    vector<int> distances = g.dijkstra(0);
    
    cout << "Shortest distances from vertex 0:" << endl;
    for (int i = 0; i < 5; i++) {
        cout << "To " << i << ": " << distances[i] << endl;
    }
    
    return 0;
}`,
    explanation: "Dijkstra's algorithm uses a greedy approach with a priority queue. It repeatedly selects the unvisited vertex with the smallest distance and updates distances to its neighbors.",
    useCases: ["GPS navigation", "Network routing", "Social network analysis"]
  },
  {
    id: "lru-cache",
    name: "LRU Cache",
    category: "Data Structures",
    complexity: "O(1)",
    description: "Least Recently Used cache with constant time get and put operations",
    cppCode: `#include <iostream>
#include <unordered_map>
#include <list>
using namespace std;

class LRUCache {
    int capacity;
    list<pair<int, int>> cache;  // {key, value}
    unordered_map<int, list<pair<int, int>>::iterator> map;
    
public:
    LRUCache(int capacity) : capacity(capacity) {}
    
    int get(int key) {
        if (map.find(key) == map.end()) {
            return -1;  // Not found
        }
        
        // Move to front (most recently used)
        auto it = map[key];
        int value = it->second;
        cache.erase(it);
        cache.push_front({key, value});
        map[key] = cache.begin();
        
        return value;
    }
    
    void put(int key, int value) {
        if (map.find(key) != map.end()) {
            // Key exists, update and move to front
            cache.erase(map[key]);
        } 
        else if (cache.size() >= capacity) {
            // Cache full, remove LRU (back of list)
            int lruKey = cache.back().first;
            cache.pop_back();
            map.erase(lruKey);
        }
        
        // Add new entry to front
        cache.push_front({key, value});
        map[key] = cache.begin();
    }
};

int main() {
    LRUCache cache(3);
    
    cache.put(1, 100);
    cache.put(2, 200);
    cache.put(3, 300);
    
    cout << "Get 1: " << cache.get(1) << endl;  // 100
    
    cache.put(4, 400);  // Evicts key 2
    
    cout << "Get 2: " << cache.get(2) << endl;  // -1 (evicted)
    cout << "Get 3: " << cache.get(3) << endl;  // 300
    cout << "Get 4: " << cache.get(4) << endl;  // 400
    
    return 0;
}`,
    explanation: "LRU Cache combines a doubly-linked list with a hash map. The list maintains order (front = most recent), while the map provides O(1) key lookup. This is a critical pattern used in this SOOZ app for caching posts and user data.",
    useCases: ["Browser cache", "Database query caching", "Memory management"]
  },
  {
    id: "merge-sort",
    name: "Merge Sort",
    category: "Sorting",
    complexity: "O(n log n)",
    description: "Stable divide-and-conquer sorting with guaranteed performance",
    cppCode: `#include <iostream>
#include <vector>
using namespace std;

// Merge two sorted subarrays
void merge(vector<int>& arr, int left, int mid, int right) {
    vector<int> leftArr(arr.begin() + left, arr.begin() + mid + 1);
    vector<int> rightArr(arr.begin() + mid + 1, arr.begin() + right + 1);
    
    int i = 0, j = 0, k = left;
    
    while (i < leftArr.size() && j < rightArr.size()) {
        if (leftArr[i] <= rightArr[j]) {
            arr[k++] = leftArr[i++];
        } else {
            arr[k++] = rightArr[j++];
        }
    }
    
    while (i < leftArr.size()) arr[k++] = leftArr[i++];
    while (j < rightArr.size()) arr[k++] = rightArr[j++];
}

// Merge Sort implementation
void mergeSort(vector<int>& arr, int left, int right) {
    if (left >= right) return;
    
    int mid = left + (right - left) / 2;
    
    mergeSort(arr, left, mid);
    mergeSort(arr, mid + 1, right);
    merge(arr, left, mid, right);
}

int main() {
    vector<int> arr = {38, 27, 43, 3, 9, 82, 10};
    
    cout << "Original: ";
    for (int x : arr) cout << x << " ";
    cout << endl;
    
    mergeSort(arr, 0, arr.size() - 1);
    
    cout << "Sorted: ";
    for (int x : arr) cout << x << " ";
    cout << endl;
    
    return 0;
}`,
    explanation: "Merge Sort divides the array in half, recursively sorts each half, then merges the sorted halves. It's stable and guarantees O(n log n) even in worst case, making it ideal for sorting linked lists and external sorting.",
    useCases: ["External sorting", "Linked list sorting", "Stable sort requirements"]
  },
  {
    id: "trie",
    name: "Trie (Prefix Tree)",
    category: "Data Structures",
    complexity: "O(m) per operation",
    description: "Efficient tree structure for storing strings with prefix-based operations",
    cppCode: `#include <iostream>
#include <unordered_map>
#include <vector>
using namespace std;

class TrieNode {
public:
    unordered_map<char, TrieNode*> children;
    bool isEndOfWord;
    
    TrieNode() : isEndOfWord(false) {}
};

class Trie {
    TrieNode* root;
    
public:
    Trie() : root(new TrieNode()) {}
    
    // Insert a word
    void insert(const string& word) {
        TrieNode* node = root;
        for (char c : word) {
            if (!node->children[c]) {
                node->children[c] = new TrieNode();
            }
            node = node->children[c];
        }
        node->isEndOfWord = true;
    }
    
    // Search for exact word
    bool search(const string& word) {
        TrieNode* node = root;
        for (char c : word) {
            if (!node->children[c]) return false;
            node = node->children[c];
        }
        return node->isEndOfWord;
    }
    
    // Check if any word starts with prefix
    bool startsWith(const string& prefix) {
        TrieNode* node = root;
        for (char c : prefix) {
            if (!node->children[c]) return false;
            node = node->children[c];
        }
        return true;
    }
    
    // Autocomplete - get all words with given prefix
    void autocomplete(const string& prefix, vector<string>& results) {
        TrieNode* node = root;
        for (char c : prefix) {
            if (!node->children[c]) return;
            node = node->children[c];
        }
        dfs(node, prefix, results);
    }
    
private:
    void dfs(TrieNode* node, string current, vector<string>& results) {
        if (node->isEndOfWord) results.push_back(current);
        for (auto& [c, child] : node->children) {
            dfs(child, current + c, results);
        }
    }
};

int main() {
    Trie trie;
    
    // Insert words (like usernames in SOOZ)
    trie.insert("john");
    trie.insert("johnny");
    trie.insert("jane");
    trie.insert("janet");
    
    cout << "Search 'john': " << trie.search("john") << endl;    // 1
    cout << "Search 'jo': " << trie.search("jo") << endl;        // 0
    cout << "Prefix 'jo': " << trie.startsWith("jo") << endl;    // 1
    
    vector<string> suggestions;
    trie.autocomplete("ja", suggestions);
    
    cout << "Autocomplete 'ja': ";
    for (const auto& s : suggestions) cout << s << " ";
    cout << endl;
    
    return 0;
}`,
    explanation: "Trie stores strings character by character in a tree structure. Each path from root to a node forms a prefix. This is used in SOOZ for username autocomplete and hashtag suggestions.",
    useCases: ["Autocomplete", "Spell checking", "IP routing tables"]
  }
];

const categoryIcons: Record<string, typeof Code2> = {
  "Sorting": Zap,
  "Searching": Binary,
  "Graph": GitBranch,
  "Data Structures": Cpu
};

export default function Algorithms() {
  const [selectedAlgo, setSelectedAlgo] = useState<Algorithm | null>(null);
  const [output, setOutput] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  const simulateRun = (algo: Algorithm) => {
    setIsRunning(true);
    setOutput("Compiling C++ code...\n");
    
    setTimeout(() => {
      setOutput(prev => prev + "g++ -std=c++17 -O2 algorithm.cpp -o algorithm\n");
      
      setTimeout(() => {
        setOutput(prev => prev + "Executing...\n\n");
        
        setTimeout(() => {
          // Simulated outputs
          const outputs: Record<string, string> = {
            "quicksort": "Original array: 64 34 25 12 22 11 90\nSorted array: 11 12 22 25 34 64 90",
            "binary-search": "Element found at index: 5",
            "dijkstra": "Shortest distances from vertex 0:\nTo 0: 0\nTo 1: 3\nTo 2: 1\nTo 3: 4\nTo 4: 7",
            "lru-cache": "Get 1: 100\nGet 2: -1\nGet 3: 300\nGet 4: 400",
            "merge-sort": "Original: 38 27 43 3 9 82 10\nSorted: 3 9 10 27 38 43 82",
            "trie": "Search 'john': 1\nSearch 'jo': 0\nPrefix 'jo': 1\nAutocomplete 'ja': jane janet"
          };
          
          setOutput(prev => prev + (outputs[algo.id] || "Execution complete.") + "\n\n✓ Program finished successfully");
          setIsRunning(false);
        }, 500);
      }, 300);
    }, 400);
  };

  const categories = [...new Set(algorithms.map(a => a.category))];

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">C++ Algorithm Showcase</h1>
              <p className="text-xs text-muted-foreground">Data Structures & Algorithms powering SOOZ</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <Badge className="mb-4 bg-blue-500/10 text-blue-400 border-blue-500/20">
            Built with Modern C++17/20
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            High-Performance Algorithms
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            This showcase demonstrates the C++ algorithms and data structures that inspire 
            the architecture of SOOZ. From efficient caching strategies to optimized search algorithms, 
            these implementations represent industry-standard patterns.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {categories.map(cat => {
            const Icon = categoryIcons[cat] || Code2;
            return (
              <Badge 
                key={cat} 
                variant="secondary"
                className="px-4 py-2 text-sm cursor-pointer hover:bg-primary/20 transition-colors"
              >
                <Icon className="w-4 h-4 mr-2" />
                {cat}
              </Badge>
            );
          })}
        </div>

        {/* Algorithm Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {algorithms.map(algo => {
            const Icon = categoryIcons[algo.category] || Code2;
            return (
              <Card 
                key={algo.id}
                className={`p-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg border-border/50 ${
                  selectedAlgo?.id === algo.id ? 'ring-2 ring-primary border-primary' : ''
                }`}
                onClick={() => {
                  setSelectedAlgo(algo);
                  setOutput("");
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {algo.complexity}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold mb-2">{algo.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{algo.description}</p>
                <Badge variant="secondary" className="text-xs">
                  {algo.category}
                </Badge>
              </Card>
            );
          })}
        </div>

        {/* Selected Algorithm Details */}
        {selectedAlgo && (
          <Card className="p-6 border-primary/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold">{selectedAlgo.name}</h3>
                <p className="text-muted-foreground">{selectedAlgo.category} • {selectedAlgo.complexity}</p>
              </div>
              <Button 
                onClick={() => simulateRun(selectedAlgo)}
                disabled={isRunning}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                {isRunning ? "Running..." : "Run Code"}
              </Button>
            </div>

            <Tabs defaultValue="code" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="code">C++ Code</TabsTrigger>
                <TabsTrigger value="explanation">Explanation</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
              </TabsList>

              <TabsContent value="code">
                <div className="relative">
                  <pre className="bg-zinc-950 text-zinc-100 p-6 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed border border-zinc-800">
                    <code>{selectedAlgo.cppCode}</code>
                  </pre>
                  <Badge className="absolute top-4 right-4 bg-blue-600">
                    C++17
                  </Badge>
                </div>
              </TabsContent>

              <TabsContent value="explanation">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-2">How it works</h4>
                    <p className="text-muted-foreground">{selectedAlgo.explanation}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Use Cases</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlgo.useCases.map(use => (
                        <Badge key={use} variant="outline">{use}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="output">
                <div className="bg-zinc-950 text-green-400 p-6 rounded-xl min-h-[200px] font-mono text-sm border border-zinc-800">
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

        {/* Tech Stack Section */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold mb-6">Why C++ Matters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <Zap className="w-8 h-8 text-yellow-500 mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Performance</h4>
              <p className="text-sm text-muted-foreground">
                C++ provides low-level memory control and zero-overhead abstractions for maximum efficiency.
              </p>
            </Card>
            <Card className="p-6">
              <Cpu className="w-8 h-8 text-blue-500 mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Systems Programming</h4>
              <p className="text-sm text-muted-foreground">
                Used in operating systems, game engines, databases, and high-frequency trading systems.
              </p>
            </Card>
            <Card className="p-6">
              <Binary className="w-8 h-8 text-purple-500 mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Algorithm Design</h4>
              <p className="text-sm text-muted-foreground">
                STL provides battle-tested containers and algorithms that form the foundation of efficient software.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
