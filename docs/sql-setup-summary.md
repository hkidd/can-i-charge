# Database upgrade summary

This repository contains upgrade migrations, not a complete initial schema.
For the agreed direct rollout, inspect the live schema and confirm a recoverable
backup before applying them. A separate staging project is optional.

Apply in order:

1. `supabase/migrations/20261124222811_station_refresh.sql` adds normalized capacity,
   shared scoring fields, run-aware staging, and transactional publication. It
   requires the four existing data tables and their staging counterparts.
2. `supabase/migrations/20261124222816_region_lookup.sql` adds the containing-ZIP
   lookup. It uses the existing `zip_geometries.geometry` PostGIS column when
   available. Missing geometry permits a county-boundary fallback.
3. `supabase/migrations/20261124222817_subscription_access.sql` adds subscription
   event ordering, key-delivery receipts, and transactional daily quotas. It
   requires the existing `api_keys` table and retires its legacy write paths.

The existing map function `get_zip_data_with_geometry` and the ZIP geometry
reference data remain prerequisites. Historical setup SQL filenames referenced
in earlier documentation are not present in this repository. Do not run geometry
import scripts as a routine refresh; the legacy importer clears geometry data.

See [the production guide](PRODUCTION.md) for required schema checks, preview
configuration, staging scenarios, deployment coordination, and recovery limits.
