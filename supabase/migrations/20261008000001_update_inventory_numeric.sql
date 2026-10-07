ALTER TABLE inventory_items ALTER COLUMN current_stock TYPE numeric;
ALTER TABLE inventory_items ALTER COLUMN expected_washes TYPE numeric;
ALTER TABLE inventory_logs ALTER COLUMN quantity TYPE numeric;
