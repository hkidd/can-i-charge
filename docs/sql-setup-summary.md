# SQL Setup Summary for ZIP Geometries Separation

## 1. Create the zip_geometries table
Run: `create-zip-geometries-table.sql`
- Creates dedicated table for ZIP polygon geometries
- Adds spatial indexes for performance
- Enables RLS with public read access

## 2. Create helper functions
Run: `create-zip-geometry-functions.sql`
- `insert_zip_geometry()` - Inserts geometries with PostGIS conversion
- `update_zip_geometry_states()` - Updates state info from zip_level_data

## 3. Update the data retrieval function
Run: `create-zip-data-function.sql`
- `get_zip_data_with_geometry()` - Joins zip_level_data with zip_geometries for map display

## 4. Import geometries to new table
Run: `node scripts/import-zip-geometries-v2.mjs`
- Imports all ZIP geometries from zips.geojson
- Stores in dedicated zip_geometries table
- One-time operation (geometries rarely change)

## Benefits:
- ✅ Geometries are permanent reference data
- ✅ Data generation won't delete geometries
- ✅ Better performance with dedicated spatial indexes
- ✅ Cleaner separation of concerns
- ✅ Daily updates only touch aggregated data, not geometries