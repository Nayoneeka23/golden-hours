from codecarbon import EmissionsTracker
import time

tracker = EmissionsTracker(
    project_name="golden-hours",
    output_dir="./carbon_reports",
    log_level="warning"
)

tracker.start()

# Simulate app workload
time.sleep(30)

emissions = tracker.stop()
print(f"Estimated emissions: {emissions:.6f} kg CO2eq")