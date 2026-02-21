#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/**
 * @file DataProcessor.c
 * @brief Low-level C module for high-efficiency memory management and buffer processing.
 * 
 * Standard: C11
 * Focus: Manual memory management, pointer arithmetic, and heap safety.
 */

// Structure representing a raw data packet
typedef struct {
    unsigned int id;
    float value;
    char type; // Packet type identifier
} DataPacket;

// Structure for a linked list of processed packets
typedef struct PacketNode {
    DataPacket packet;
    struct PacketNode* next;
} PacketNode;

/**
 * @brief Dynamically allocates and initializes a packet node.
 * @return Pointer to the new node, or NULL on failure.
 */
PacketNode* create_node(unsigned int id, float value, char type) {
    // Step 1: Manual Heap Allocation
    PacketNode* new_node = (PacketNode*)malloc(sizeof(PacketNode));
    
    // Step 2: Robust Safety Check (Crucial for Industry Standard C)
    if (new_node == NULL) {
        perror("Failed to allocate memory for PacketNode");
        return NULL;
    }

    // Step 3: Direct Memory Initialization using pointers
    new_node->packet.id = id;
    new_node->packet.value = value;
    new_node->packet.type = type;
    new_node->next = NULL;

    return new_node;
}

/**
 * @brief Processes a buffer of raw binary data into a linked list.
 */
void process_metrics_buffer(int count) {
    printf("🛠 SOOZ C-CORE: INITIALIZING MEMORY ALLOCATOR...\n");
    
    PacketNode* head = NULL;
    PacketNode* current = NULL;

    // Seed the random number generator
    srand((unsigned int)time(NULL));

    // Step 4: Iterative Processing with Pointer Chaining
    for (int i = 0; i < count; i++) {
        // Simulate data extraction
        float val = (float)rand() / (float)(RAND_MAX / 100.0);
        char packet_type = (i % 2 == 0) ? 'S' : 'M'; // Sensor vs Metric

        PacketNode* node = create_node(1000 + i, val, packet_type);
        if (node == NULL) break;

        // Linked List Management
        if (head == NULL) {
            head = node;
            current = head;
        } else {
            current->next = node;
            current = node;
        }
    }

    // Step 5: Traversal and Analysis
    printf("📊 C-CORE REPORT: PROCESSED %d PACKETS\n", count);
    PacketNode* temp = head;
    int sensor_count = 0;
    while (temp != NULL) {
        if (temp->packet.type == 'S') sensor_count++;
        // Print sample of the data
        if (temp->packet.id % 50 == 0) {
            printf("   [PACKET-ID: %d] Value: %.2f | Type: %c\n", 
                   temp->packet.id, temp->packet.value, temp->packet.type);
        }
        temp = temp->next;
    }
    printf("   - Total Sensor Packets: %d\n", sensor_count);

    // Step 6: CRITICAL Cleanup (Preventing Memory Leaks)
    // Every malloc must have a corresponding free
    temp = head;
    while (temp != NULL) {
        PacketNode* next = temp->next;
        free(temp); // Release heap memory
        temp = next;
    }
    printf("✅ MEMORY DEALLOCATED SUCCESSFULLY\n");
}

int main() {
    process_metrics_buffer(250);
    return 0;
}
