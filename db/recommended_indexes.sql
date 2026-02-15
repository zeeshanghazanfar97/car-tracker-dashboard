-- Run these once on the same database that stores vehicle_tracking_data_v3.
CREATE INDEX IF NOT EXISTS idx_vtd_v3_plate_last_server
  ON vehicle_tracking_data_v3 (plate_number, last_server_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_vtd_v3_plate_first_gps
  ON vehicle_tracking_data_v3 (plate_number, first_gps_timestamp);

CREATE INDEX IF NOT EXISTS idx_vtd_v3_plate_last_gps
  ON vehicle_tracking_data_v3 (plate_number, last_gps_timestamp);
