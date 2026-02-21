using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Diagnostics;

namespace Sooz.Analytics
{
    /// <summary>
    /// SystemReporter: A high-level C# module for infrastructure monitoring.
    /// Utilizes .NET 7/8 features like Records, LINQ, and Task-based Asynchrony.
    /// </summary>
    public sealed class SystemReporter
    {
        /// <summary>
        /// Immutable Record to hold telemetry data for system components.
        /// Init-only properties provide thread-safety and predictability.
        /// </summary>
        public record HealthMetric(string Component, bool IsOperational, double LoadPercentage, TimeSpan Uptime);

        /// <summary>
        /// Generates a comprehensive system vitality report asynchronously.
        /// </summary>
        public async Task RunSystemDiagnosticAsync()
        {
            Console.WriteLine("💎 Initializing C# System Vitality Engine...");
            
            // Simulate I/O latency (calling external probes/APIs)
            await Task.Delay(500); 

            // Initialize dataset using Collection Expression (C# 12) or standard List
            var componentMetrics = new List<HealthMetric>
            {
                new("CORE_DATABASE", true, 0.42, TimeSpan.FromDays(12)),
                new("R2_STORAGE_EDGE", true, 0.15, TimeSpan.FromDays(45)),
                new("AUTH_VALVE_PROMETHEUS", true, 0.09, TimeSpan.FromDays(5)),
                new("GATEWAY_NODE_01", true, 0.78, TimeSpan.FromHours(14)),
                new("GATEWAY_NODE_02", false, 0.00, TimeSpan.Zero), // Simulated failure
                new("AI_INFERENCE_ORCH", true, 0.61, TimeSpan.FromDays(2))
            };

            // Use LINQ (Language Integrated Query) for advanced Data Shaping
            // This is functional-style programming in C#
            var aggregatedReport = componentMetrics
                .GroupBy(m => m.IsOperational)
                .Select(g => new 
                { 
                    Status = g.Key ? "ONLINE" : "OFFLINE", 
                    Count = g.Count(),
                    AvgLoad = g.Average(x => x.LoadPercentage)
                });

            var stopwatch = Stopwatch.StartNew();

            Console.WriteLine("\n┌──────────────────────────────────────────────────────────┐");
            Console.WriteLine("│             SOOZ INFRASTRUCTURE HEALTH REPORT            │");
            Console.WriteLine("└──────────────────────────────────────────────────────────┘");

            // Step: Iterate and display status utilizing string interpolation ($"")
            foreach (var group in aggregatedReport)
            {
                string icon = group.Status == "ONLINE" ? "✅" : "❌";
                Console.WriteLine($"  {icon} {group.Status,-8} | Count: {group.Count} | Avg Load: {group.AvgLoad:P1}");
            }

            // Step: Filter for high-load components using LINQ Where()
            // .P0 format specifier converts 0.78 to 78%
            var criticalComponents = componentMetrics
                .Where(c => c.IsOperational && c.LoadPercentage > 0.60)
                .ToList();

            if (criticalComponents.Any())
            {
                Console.WriteLine("\n  ⚠️ [ALERT] CRITICAL LOAD DETECTED:");
                foreach (var component in criticalComponents)
                {
                    // Using Pattern Matching or conditional formatting
                    string statusLevel = component.LoadPercentage > 0.75 ? "CRITICAL" : "ELEVATED";
                    Console.WriteLine($"     - {component.Component,-20} : {component.LoadPercentage:P0} [{statusLevel}]");
                }
            }

            stopwatch.Stop();
            Console.WriteLine($"\n  Telemetry synchronized in {stopwatch.ElapsedMilliseconds}ms");
            Console.WriteLine("────────────────────────────────────────────────────────────\n");
        }

        /// <summary>
        /// Entry point for the C# console environment.
        /// </summary>
        public static async Task Main(string[] args)
        {
            var reporter = new SystemReporter();
            await reporter.RunSystemDiagnosticAsync();
        }
    }
}
