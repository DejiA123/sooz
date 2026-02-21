import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, List, Any, Union

# Set up industrial standard logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EngagementAnalyzer:
    """
    Advanced Python Data Engine for trend analysis and statistical modeling.
    Utilizes Pandas for vectorized data processing and Python type hints for robustness.
    """
    
    def __init__(self, sample_size: int = 5000):
        # Initialize internal configuration
        self.sample_size = sample_size
        # Generate initial dataset upon instantiation
        self.data = self._generate_optimized_dataset()
        logger.info(f"EngagementAnalyzer initialized with {sample_size} records.")

    def _generate_optimized_dataset(self) -> pd.DataFrame:
        """
        Generates a synthetic dataset using NumPy for high-performance array operations.
        Returns a Pandas DataFrame for complex relational analysis.
        """
        # Create a time horizon of 30 days
        base_date = datetime.now()
        dates = [base_date - timedelta(days=x) for x in range(30)]
        
        # Define categorical variables
        user_pool = [f"UID_{i:03d}" for i in range(100)]
        event_types = ['VIEW_MEDIA', 'INTERACT', 'SHARE_CONTENT', 'COMMENT_ADD']
        
        # Use NumPy to generate vectorized data arrays (Standard Practice for Speed)
        data = {
            'timestamp': np.random.choice(dates, self.sample_size),
            'user_id': np.random.choice(user_pool, self.sample_size),
            'event': np.random.choice(event_types, self.sample_size),
            # Gamma distribution simulates realistic time-spent (long-tail skew)
            'compute_load': np.random.gamma(shape=2.0, scale=1.5, size=self.sample_size) * 10
        }
        
        # Return converted DataFrame
        return pd.DataFrame(data)

    def analyze_engagement_patterns(self) -> Dict[str, Any]:
        """
        Executes business logic across the dataset.
        Uses vectorized Pandas operations instead of Python 'for' loops for O(N) performance.
        """
        logger.info("Executing engagement analysis pipeline...")
        
        try:
            # 1. Temporal Analysis: Group by timestamp and count volume
            temporal_trends = self.data.groupby('timestamp').size()
            
            # 2. Metric Aggregation: Calculate global averages
            avg_computing_sec = self.data['compute_load'].mean()
            median_load = self.data['compute_load'].median()
            
            # 3. User Penetration: Extract unique user count
            unique_reach = self.data['user_id'].nunique()
            
            # 4. Intensity: Interactions per unique user
            depth_ratio = len(self.data) / unique_reach if unique_reach > 0 else 0
            
            # Construct the final JSON-serializable report object
            report = {
                "metadata": {
                    "analyzer_version": "3.1.2-stable",
                    "execution_time": datetime.now().isoformat(),
                    "records_processed": self.sample_size
                },
                "high_level_metrics": {
                    "total_events": int(len(self.data)),
                    "unique_audience": int(unique_reach),
                    "interaction_depth": round(float(depth_ratio), 2),
                    "avg_resource_load_ms": round(float(avg_computing_sec), 2),
                    "median_load_ms": round(float(median_load), 2)
                },
                # Value counts returns the frequency of each event type
                "distribution": self.data['event'].value_counts().to_dict()
            }
            
            logger.info("Analysis successfully completed.")
            return report
            
        except Exception as e:
            logger.error(f"Analysis Pipeline Error: {str(e)}")
            return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Standard entry point protection
    print("\n" + "="*50)
    print("🔥 SOOZ PYTHON ANALYTICS ENGINE: LIVE")
    print("="*50)
    
    # Instantiate and Run
    engine = EngagementAnalyzer(sample_size=25000)
    final_output = engine.analyze_engagement_patterns()
    
    # Pretty-print JSON results back to the system out
    print(json.dumps(final_output, indent=4))
    print("="*50 + "\n")
