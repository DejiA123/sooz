package com.sooz.analytics;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ForkJoinPool;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * <h2>AppReportGenerator</h2>
 * <p>
 * Enterprise-grade Analytics Engine for processing high-volume user engagement
 * data.
 * </p>
 * 
 * <p>
 * This implementation utilizes Java 17+ record types for immutability and
 * memory efficiency,
 * alongside Parallel Streams for horizontal scalability across CPU cores.
 * </p>
 * 
 * @author Sooz Engineering
 * @version 2.0
 */
public final class AppReportGenerator {

    // Logger following standard naming conventions
    private static final Logger LOGGER = Logger.getLogger(AppReportGenerator.class.getName());

    /**
     * Immutable data carrier for raw engagement events.
     * Records auto-generate constructors, getters, equals, and hashCode.
     */
    public record EngagementMetric(
            String userId,
            String action,
            LocalDateTime timestamp,
            int durationInSeconds) {
    }

    /**
     * Result set representing a calculated user engagement profile.
     */
    public record UserSummary(
            String userId,
            long totalActions,
            double averageDuration,
            String primaryActivity) {
    }

    // Encapsulated raw data storage
    private final List<EngagementMetric> rawMetrics;

    /**
     * Initializes the generator with simulated dataset.
     * In production, this would be injected via a Data Access Object (DAO).
     */
    public AppReportGenerator() {
        // Pre-allocate list and generate 10,000 simulated records
        this.rawMetrics = generateSimulatedData(10000);
        LOGGER.info("Analytics Engine initialized with " + rawMetrics.size() + " records.");
    }

    /**
     * Executes the heavy-lifting analytics process asynchronously.
     * 
     * @return CompletableFuture containing the sorted list of User Summaries.
     */
    public CompletableFuture<List<UserSummary>> generateAsyncAnalyticsReport() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // START PARALLEL PROCESSING PIPELINE
                // .parallelStream() leverages the common ForkJoinPool for multi-core processing
                return rawMetrics.parallelStream()
                        // Step 1: Group by UserID -> O(N) complexity
                        .collect(Collectors.groupingBy(EngagementMetric::userId))
                        // Step 2: Convert Map entries to a stream for per-user calculation
                        .entrySet().stream()
                        // Step 3: Map each entry to a UserSummary record
                        .map(this::calculateUserStatistics)
                        // Step 4: Sort by total engagement volume (Descending)
                        .sorted(Comparator.comparing(UserSummary::totalActions).reversed())
                        // Final Step: Collect into an immutable-style list
                        .collect(Collectors.toList());
            } catch (Exception e) {
                LOGGER.log(Level.SEVERE, "Analytics pipeline failure", e);
                return Collections.emptyList();
            }
        });
    }

    /**
     * Calculates specific metrics for a single user group.
     * 
     * @param entry Map entry containing UserID and their associated metrics.
     * @return UserSummary derived from the input data.
     */
    private UserSummary calculateUserStatistics(final Map.Entry<String, List<EngagementMetric>> entry) {
        final String userId = entry.getKey(); // Extract user identifier
        final List<EngagementMetric> userEvents = entry.getValue(); // Get all events for this user

        // Aggregate total count of interactions
        final long eventCount = userEvents.size();

        // Calculate Mean duration using DoubleStream metrics
        final double meanLatency = userEvents.stream()
                .mapToInt(EngagementMetric::durationInSeconds)
                .average()
                .orElse(0.0);

        // Identify most frequent activity using Frequency Map pattern
        final String dominantActivity = userEvents.stream()
                .collect(Collectors.groupingBy(EngagementMetric::action, Collectors.counting()))
                .entrySet().stream()
                // Find the maximum value in the frequency map
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("IDLE");

        return new UserSummary(userId, eventCount, meanLatency, dominantActivity);
    }

    /**
     * Generates a statistically randomized dataset for engine testing.
     * 
     * @param volume Number of records to generate.
     * @return List of Metric objects.
     */
    private List<EngagementMetric> generateSimulatedData(final int volume) {
        final String[] supportedActions = { "QUERY", "TRANSCODE", "INDEX", "STREAM", "UPLOAD" };
        final Random secureRandom = new Random(); // PRNG for simulation
        final List<EngagementMetric> dataset = new ArrayList<>(volume);

        for (int i = 0; i < volume; i++) {
            dataset.add(new EngagementMetric(
                    "UID-" + (1000 + secureRandom.nextInt(500)), // Simulate 500 unique users
                    supportedActions[secureRandom.nextInt(supportedActions.length)],
                    LocalDateTime.now().minusHours(secureRandom.nextInt(168)), // Within last week
                    secureRandom.nextInt(5000) // Simulated processing time
            ));
        }
        return dataset;
    }

    /**
     * Diagnostic entry point for standard-alone engine validation.
     */
    public static void main(String[] args) {
        // Log environment capability
        LOGGER.info("Target CPU Cores for Parallelism: " + Runtime.getRuntime().availableProcessors());

        // Instantiate Engine
        final AppReportGenerator analyticsEngine = new AppReportGenerator();

        // Track wall-clock time for performance benchmarking
        final long startTime = System.currentTimeMillis();

        // Trigger non-blocking report generation and wait for completion
        analyticsEngine.generateAsyncAnalyticsReport()
                .thenAccept(report -> {
                    final long elapsed = System.currentTimeMillis() - startTime;
                    System.out.println("\n========================================================");
                    System.out.printf("  SOOZ ADVANCED ANALYTICS: LATENCY %dms%n", elapsed);
                    System.out.println("========================================================");

                    // Print top 10 Power Users
                    report.stream().limit(10)
                            .forEach(profile -> System.out.printf(
                                    "  [USER] %s | Hits: %-5d | Active: %-10s | Avg: %.2fms%n",
                                    profile.userId(), profile.totalActions(), profile.primaryActivity(),
                                    profile.averageDuration()));
                    System.out.println("========================================================\n");
                }).join(); // Block main thread only for simulation output
    }
}
