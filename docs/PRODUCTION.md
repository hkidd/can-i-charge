# Production Deployment Guide

## Current review status

Local validation passes 172 tests, TypeScript, ESLint with no warnings, and the
Webpack production build using placeholder public Supabase configuration.
All nine production migrations are applied. The first complete snapshot published
at `2026-11-24T22:42:49.515715Z` under run
`875eb121-43c0-42c2-8090-381c03a9cf7c`. Health returns 200. No billing events,
charges, or subscriber emails were generated during verification.

The agreed rollout uses the existing production projects. A separate staging
project is not required. Supabase and Vercel production access were verified on
2026-11-24. This Free-plan project has no managed backups. A full manual database
archive and role definitions were created before the deployment window and
verified with SHA-256 and full `pg_restore` decompression. The archive is
184,143,023 bytes; its SHA-256 is
`2ee10fa7ab98b2d1d42eb62bdca0156a945130993ed3ad9ac00751615f281929`.
It is stored locally under
`~/.local/share/can-i-charge/backups/2026-11-24T21-25-20-354Z/`.
This verifies archive integrity; a restore was not rehearsed.

For the manual backup, save the production PostgreSQL Session pooler URI as
`DATABASE_URL` in the ignored `.env.local` file, then run:

```sh
node scripts/backup-production.mjs
```

This read-only script writes a full custom-format database archive, grants,
role definitions without passwords, and a SHA-256 manifest under
`~/.local/share/can-i-charge/backups/`. It checks required table-data and ACL
entries and decompresses the entire archive with `pg_restore`. A successful
manifest confirms archive integrity, not a rehearsed restore. It requires the
PostgreSQL 18 Homebrew tools (`PG_BIN` can override their directory).
Keep backups outside the checkout and deployment source. Database credentials
and pulled Vercel configuration remain in ignored, mode-600 local files.

The live project is Supabase `lwymugddoqggxkvilodu` and Vercel
`prj_hyCgw7mcUTcFpIh6mFKiq6vWuFng` in team `team_vrn4VFuMcpmv1r04IGCjo8ig`.
The final production deployment is `dpl_BLzSKmtBfXHqySQBe6jdBu7GdfJ3`
(`can-i-charge-hj21gzfen-hkidds-projects.vercel.app`), built from the uncommitted
working tree on `fix/priority-security`. No commit or Git push was made.
The deployment-source manifest SHA-256 is
`558d14298884fc69137cb48acf6b0e084a0ebfdb204e536d38fb29198be653d1`;
its file manifest is retained locally in `.vercel/release-source-manifest.json`.
Both custom domains point to this deployment. Automatic production-domain
assignment is restored. The deployed schedules are `/api/refresh-data` at
03:00 UTC and `/api/smart-update` at 03:30 UTC daily.
The overnight scheduled refresh published successfully at
`2026-11-25T03:38:23.675405Z` (run `f8eaf0ff-757b-41a5-bde2-3842f6d6e0be`),
with 84,538 stations. The complete manual refresh and same-run retry also passed.

The pre-upgrade deployment was `dpl_EpSPUxKnfh4iBFTyMipT4iWU4EYx`, commit
`f69ebe4fb449709025ffd942b9db32e571a02df5`, serving `www.canicharge.com`
and `canicharge.com`. Preserve this deployment for recovery.

Read-only live review found 82,910 stations, 33,791 ZIP geometries, no station
foreign keys, no API keys or stored subscriptions, and no database cron jobs.
No runtime log records were returned for the last 30 minutes; this does not
establish that the site has no traffic or that Polar has no subscriptions.
Polar reports no active production subscriptions. Its existing webhook endpoint
`0deeaa85-35b2-4c9e-ad7a-83c56c80f143` is disabled and updated to API version
`2026-10`. `POLAR_ENVIRONMENT=production` is set, but `POLAR_PRODUCT_ID` remains
unconfigured, so checkout and subscription delivery remain off pending approval.
The browser-exposed cron configuration was retired and the production-only
`CRON_SECRET` rotated. The existing billing-page redirects remain in place.

The pre-upgrade ZIP map RPC failed with `column z.geometry does not exist` because
geometry lives in `zip_geometries`. The fourth migration below repairs that
join and removes its internal 1,000-row limit. It also retires all four legacy
publication RPCs and removes direct application-role writes to production data.
Representative ZIP geometries (Denver, Boston, DC, Honolulu, Anchorage) have
valid SRID 4326 multipolygons. Live RPC and browser checks passed after
the migrations. The local compatibility tests exercise relational behavior,
pagination, and grants with a geometry stand-in, not PostGIS execution.

Local PostgreSQL tests use a fixture schema; they do not verify the live schema,
PostGIS execution, external services, or the provider's real delivery behavior.
Separate live checks passed for desktop/mobile address search, state/county/ZIP
map levels, leading-zero ZIPs, Alaska, Hawaii, DC, explicit state/county lookups,
non-US rejection, and all three embedded widget layouts. The browser console was
clear after the CSP was corrected for the configured Sentry ingestion hostname.
A single labeled monitoring verification event was accepted by Sentry with HTTP
200; this test and earlier failed refresh attempts can generate alert emails.
No further synthetic errors were generated after the user reported alert noise.

The initial published snapshot contained 84,536 stations, 51 states/DC, 3,142 counties,
and 34,074 ZIP regions. State totals reconcile to 84,536 stations; county totals
reconcile after 402 unmatched boundary locations, and ZIP totals reconcile after
124 stations without ZIPs. All Census requests succeeded; 32 regions had unknown
population. It had 33,443 rated ZIPs and 631 unrated ZIPs under `regional-v2`.
The 2017 county-boundary vintage and missing data remain explicit limitations.
Retrying the published run returned the same run without rewriting the snapshot.

The 286 MB national JSON feed required a grouped Node stream pipeline; per-token
Web Stream boundaries exceeded the original deadline. The parser remains bounded
in memory and retains only normalized stations. The provider deadline is now
180 seconds within the shared 240-second refresh deadline. The successful full
refresh took about 163 seconds. A follow-up migration adds primary-key predicates
to cleanup/publication DELETE statements for the live database's guard.

Supabase still reports pre-existing advisories for PostGIS in `public`, its
`spatial_ref_sys` RLS configuration and `st_estimatedextent` definer functions,
and mutable search paths on retired helpers/the timestamp trigger. Moving the
managed extension is a separate compatibility change. See the provider's
[extension guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
and [search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
The new backend-only tables deliberately have no client RLS policies.


The reported-capacity follow-up on 2026-11-25 used a fresh verified manual archive
at `~/.local/share/can-i-charge/backups/2026-11-25T13-57-53-844Z/`,
188,245,275 bytes, SHA-256
`3e5e5939bbbad6dbd6c6a9d42f36f76bc822006677a78d530cce7ced089dccc0`.
Full archive decompression and required data/grants checks passed; a restore was
not rehearsed. The sixth migration recomputed suppressed scores without changing
station rows or regional counts. Checksums confirm all complete-region scores
are unchanged. California scores 54 (20,710 of 20,711 sites reporting capacity),
Solano County 63 (166 of 167), and ZIP 94590 scores 55 (24 of 25).
The daily refresh imports upstream corrections automatically. There is currently
no separate remediation queue, independent verification process, or manual
capacity override. The unknown station's port counts remain unknown. The reported-capacity release had 33,444 rated ZIPs and 630 unrated ZIPs under
`regional-v3`. Live desktop/mobile
search, the California map hover, and compact/standard/detailed embedded widgets
show the coverage notice and expected scores. Browser checks recorded no errors;
Vercel returned no error/fatal runtime entries for the new deployment in the
verification window. No synthetic Sentry events were sent for this follow-up.
The previous `regional-v2` app deployment is
`dpl_FJqeAaBpjtDeY2pX2e2vfnmkrYET`; an app rollback must account for the
changed scoring contract and then-current `regional-v3` regional rows.

## Connector and traffic follow-up — 2026-11-25

A fresh verified backup before this follow-up is stored at
`~/.local/share/can-i-charge/backups/2026-11-25T14-27-24-419Z/`,
188,245,903 bytes, SHA-256
`4da51f6e82c2f7d8469a3f318866bca8eed7940e0e126a7749ad66768149e1c6`.
The required table data/grants checks and full decompression passed. Restore was
not rehearsed. Both additive migrations and atomic imports ran with no active
station refresh. The existing app remained compatible during the backfill.
No separate staging project was created, and no billing delivery was enabled.

All 51 states/DC, 3,142 counties, and 34,074 ZIPs have filter summaries. Snapshot
counts and default readiness scores remain unchanged. The first filter release
was `dpl_4SJ6UutXveTYVyxLHQgv2iPz9f8H`; the earlier reported-capacity release was
`dpl_FHzpWsAJjQuB2GuxnMuxuAwSgmry`. That follow-up deployment added traffic
provenance, Opportunity notices, and guards against stale point responses.
Local tests cover all 128 connector/speed/weight/view combinations, compatible
charging units, distinct site counts, reporting coverage, traffic parsing/units,
FIPS conversions, and traffic preservation through refresh. Default California
remains 54; its connector selections return numeric results rather than blanket
Unrated. Live browser checks passed for the real connector/speed/weight/mode controls,
the state traffic notice, county traffic metadata (2,706 records in the
verification viewport), and 118 ZIP geometries retaining connector summaries
without fabricated traffic. Browser errors were empty. Health is healthy, and
Vercel returned no error/fatal runtime entries for the final deployment in the
verification window. No synthetic Sentry events were generated.

The retired ArcGIS feed returns `Token Required`. Its replacement is the public
[EPA 2023 NEI final onroad activity release](https://gaftp.epa.gov/Air/nei/2023/doc/supporting_data/onroad/2023NEI_onroad_activity_final_20251010/).
The reviewed file is `VMT_2023NEI_20250923_24sep2025_v0.csv`, SHA-256
`cc92bda364288128b01022ec4c052db7513720a157ec73075cf44fd126213c85`.
It contains 315,940 activity records. Exact FIPS matching plus the documented
Alaska predecessor/successor conversion covers all map counties and states/DC.
The source, year, retrieval time, hash, and aggregation coverage are retained.
Traffic remains historical all-vehicle road miles; it is not EV-only demand,
live traffic, or a 2030 forecast. ZIP traffic remains unavailable rather than
receiving invented county allocations. Opportunity Mode shows this distinction.

Download that specific EPA file outside deployment source, then review a dry run:

```sh
node scripts/ingest-vmt.mjs --file=PATH_TO_REVIEWED_CSV
node scripts/ingest-vmt.mjs --file=PATH_TO_REVIEWED_CSV --apply
```

The importer requires the expected source hash, validates schema/year/units,
rejects duplicate/invalid records and implausible national coverage, and publishes
all observations atomically. It preserves existing station/regional score rows.
The legacy `ingest-vmt` and `ingest-vmt-arcgis` commands delegate to this importer.
Daily station refreshes preserve observations and recompute county per-capita
values against the updated population. An annual source refresh is an explicit
operator task; this fixed release is not falsely presented as an updating feed.

Readiness has not been silently recalibrated. See [the model review](READINESS-MODEL.md)
for why population-only supply and the existing bonus components do not yet
establish whether expected EV charging demand is met, and the proposed separation
between current readiness and future Opportunity scenarios.

## Fleet score rework — 2026-11-25

The ninth migration and atomic backfill publish `fleet-provision-v4`, built from
the reviewed 2025 AFDC registration dataset and the existing station/population/
traffic snapshot. Backup before this rework:
`~/.local/share/can-i-charge/backups/2026-11-25T14-48-20-641Z/`, 189,802,060 bytes,
SHA-256 `610ca1b4a5a55373e5a954e49e4aff6ae97a77d00a00e3adb349465cc981007c`.
Required data/grants checks and full archive decompression passed; restore was
not rehearsed. The prior app is `dpl_2GvVZmy2WGKVKf9z4XwJE1YP5C3V`.

The app was briefly paused for the scoring transaction and matching promotion,
then unpaused. All 84,538 station rows and regional counts remain unchanged.
Legacy ZIP state placeholders are resolved from boundary membership, with
station-state majority as fallback. Unsupported regions remain Unrated. The
backfill guard requires the same published snapshot and no active refresh.
Read-only source export streams rows rather than aggregating the full national
JSON object in database memory. The reviewed publication SQL and recovery SQL
are retained privately in `.vercel/model/`; no recovery SQL was executed.

All 51 states/DC and 3,142 counties are rated. Of 34,074 ZIPs, 33,262 are rated;
630 lack positive population and 182 lack a supported state fleet mapping.
California moves 54→85, Texas 44→57, Vermont 54→100, and Washington 48→98.
State scores span 39–100. The detailed before/after report is
`docs/score-impact-2026-11-25.json`. This is a planning benchmark with explicit
estimates, not measured charging utilization or a validated local forecast.

Daily refreshes rebuild the same public supply and fleet metadata using the
pinned registration dataset and current/retained population and traffic inputs.
The pinned fleet data is refreshed through a reviewed source/model release.
The final frontend follow-up also replaces obsolete homepage four-factor copy,
links the methodology, and repairs mobile Enter submission while suggestions are
loading. Mobile hero suggestions stay in normal flow to avoid covering submit.
The model/database publication first used `dpl_FzDbrTX9kykfyLrNS5VN4UuDXoLU`;
the final deployment above retains the same model and adds these UI fixes.

Live checks passed for California's 85 target coverage, its 78% 2030 scenario gap,
ZIP 94590's 64 with local fleet evidence, leading-zero ZIP 02108 on mobile, all
three embedded widget sizes, and methodology access. Browser errors were empty.
All 51 state scores match the shared model; both connector selections obey
supply monotonicity. Health is healthy. The final deployment returned no
error/fatal runtime entries in the verification window. No synthetic Sentry
errors, billing events, or subscriber emails were generated.

For recovery, coordinate both the previous app and previous scoring rows; rolling
back only the app cannot restore the old score meaning. Check for subsequent
station publications before using any prepared recovery transaction.

## Gap-direction clarification — 2026-11-25

This presentation-only release labels the 2030 gap as **lower is better** and
current readiness as **higher is better**. Region cards show both missing and
covered percentages (California: 78% still needed, 22% covered). The opportunity
legend and fill/border colors now run green at low gaps to red at high gaps,
with explicit 0%, 50%, and 100% labels. The methodology documents that this is
a percentage of the weighted future target, not a growth percentage applied to
current ports. Scoring formulas, database rows, and scheduled jobs are unchanged.
TypeScript, ESLint, and the Vercel production build pass. Live desktop checks
confirmed the 78%/22% explanation and directional legend; the methodology was
verified on mobile without horizontal overflow. Browser errors were empty, and
no error/fatal runtime entries were returned for this deployment.

## Legend layout correction — 2026-11-25

Desktop filters and the legend now share a bottom-anchored flex stack with a
12px gap, replacing independently positioned overlays. Expanded filters scroll
on short windows. Both legends run left-to-right from 0% to 100%: readiness
uses target met (higher is better), while opportunity uses gap remaining (lower
is better). This replaces the inconsistent qualitative readiness labels.

Live expanded, collapsed, and opportunity-mode checks passed at 1440×1000,
1366×768, and 1024×600, retaining 12px separation at every size. Mobile layout
also passed, with no browser errors. TypeScript, ESLint, the production build,
and whitespace checks pass. No model or database changes were made.

These production releases were uploaded directly from the local working tree.
The reviewed source is now recorded in six commits on `fix/priority-security`,
including the pinned fleet dataset. Source-file hashes and deployment manifests
are retained locally for comparison. The existing deployment metadata still
references the historical base commit; committing this source does not replace
the verified production deployment. Future releases should deploy reviewed Git
commits so production can be traced directly to GitHub.

## Direct production rollout

1. Identify the existing Supabase project, Vercel project, production domain,
   and currently deployed build. Confirm actual traffic and active subscriptions
   rather than assuming the application is unused.
2. Inspect the live schema, API-key column types, foreign keys, RLS policies, and
   geometry functions. Confirm a current recoverable database backup and retain
   the current deployment and database grants for recovery.
3. Pause scheduled refresh jobs and any active billing deliveries for the short
   upgrade window. Apply the nine migrations below in order. Keep existing
   station and regional rows until the new refresh publishes successfully.
4. Configure the existing production environment and deploy the reviewed patch.
   Keep the current billing-page redirects and leave unconfigured billing off.
   Existing configured billing requires the matching product ID and environment.
5. Run one complete refresh, then check health, representative location searches,
   all map levels, the embedded widget, browser errors, and monitoring. Verify
   billing only if it is actually enabled; use provider sandbox events separately
   rather than test charges or emails to existing subscribers.
6. Resume scheduled jobs after those checks pass. If publication fails, retain
   the last published data and fix the failing step before resuming jobs. An app
   rollback alone does not undo database permission changes.

## Optional staging rehearsal

1. Create an isolated Supabase database with the existing production schema,
   constraints, indexes, RLS policies, functions, and required reference data.
   Include the four data tables, their staging counterparts, `api_keys`, and the
   existing ZIP geometry infrastructure. The repository does not contain a full
   initial schema. Confirm API-key column types and station-table foreign keys.
2. Apply these upgrade migrations in order:
   - `20261124222811_station_refresh.sql`: complete refresh snapshots and shared scoring fields.
   - `20261124222816_region_lookup.sql`: containing-ZIP lookup with county fallback.
   - `20261124222817_subscription_access.sql`: ordered subscription updates, key delivery receipts, and atomic quotas.
   - `20261124222818_production_schema_compatibility.sql`: live ZIP geometry join, complete pagination, and retirement of additional legacy write paths.
   - `20261124224006_refresh_safeupdate_compatibility.sql`: explicit primary-key predicates for staging cleanup and publication under the live database's DELETE guard.
   - `20261125140053_reported_capacity_scoring.sql`: score sufficiently reported regions and retain complete-region scores; set `regional-v3` on all regional rows. Apply while no refresh is active.
   - `20261125143508_connector_filter_summaries.sql`: add measured connector/speed summaries; run `node scripts/backfill-filter-summaries.mjs --apply` after its dry run reconciles all regional counts.
   - `20261125144158_traffic_provenance.sql`: retain historical traffic observations and provenance in regional snapshots; import the reviewed EPA release as described below.
   - `20261125150129_fleet_readiness_model.sql`: add demand/supply metadata; prepare and review `node scripts/rework-readiness.mjs`, then publish its guarded transaction with `--apply` while the matching app promotion is coordinated.
3. Connect a Vercel preview to that database using isolated credentials from
   `.env.example`. Set `NEXT_PUBLIC_URL` to the preview URL. Keep production
   credentials out of the preview and leave scheduled jobs disabled there.
4. Run the combined refresh once. Verify all four tables publish together, health
   becomes current, counts reconcile, and provider/Census diagnostics are reviewed.
   Retry the published run and confirm it does not rewrite production tables.
   Rehearse a failed publication and verify the previous snapshot survives.
5. Check ZIP containment against the real PostGIS geometry column and functions.
   Test explicit ZIP/county/state lookups, leading-zero ZIPs, state abbreviations,
   county borders, rural addresses, Alaska, Hawaii, DC, and non-US locations.
   Review missing populations and the Census 2017 county-boundary limitation.
6. Set `POLAR_ENVIRONMENT=sandbox`, a sandbox `POLAR_PRODUCT_ID`, sandbox access
   token/signing secret, and a verified Resend sender. Configure webhook API
   version `2026-10`. Verify the billing scenarios below using real sandbox
   deliveries, without charging customers or emailing production subscribers.
7. Run browser checks on desktop and mobile: rapid address typing, delayed and
   failed requests, clear/select/submit, keyboard access, map zoom and pan,
   mixed-speed sites, connector filters, unrated states, score cards, embedded
   widgets, reduced motion, and navigation/unmounting. Inspect console errors,
   repeated network requests, and Sentry delivery.

## Local verification

Use Node.js 26 (`nvm use`), install with `npm ci`, and provide the public Supabase
URL/key before building. Local tests use fixtures and do not require credentials.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Public placeholder Supabase values permit a build check; they do not verify a
working application connection. Run the browser/integration checks separately.

## Production deployment gate

Use the direct production rollout above; a staging rehearsal is optional under
the user's chosen release approach. Review the live schema and confirm a backup
of schema, data, and grants before applying migrations. Coordinate a short deployment
window with refresh jobs and billing deliveries paused: these migrations retire
legacy write privileges, so old backend handlers cannot safely remain active
between the schema upgrade and application deployment. Apply all nine migrations
before enabling the new handlers. Set `POLAR_ENVIRONMENT=production` and use the
production product, token, signing secret, sender, and canonical public URL.
Keep the existing billing-page redirects until the provider integration is approved.

The first station snapshot assigns deterministic provider-based UUIDs; it does
not preserve every legacy station UUID value. Verify foreign keys and external ID
consumers before publication. The billing update retains the newest legacy key
for a subscription and revokes duplicate keys when that subscription is processed.
Review affected subscriptions before resuming billing deliveries.

After deployment, manually verify health, a known location, all map levels, an
embedded widget, error reporting, and the first scheduled refresh. Resume cron
and billing delivery only after those checks pass.

For recovery, leave those jobs paused and retain the last published snapshot.
A failed refresh cannot publish partial tables. Prefer correcting the new backend;
reverting only the application to the old backend will not restore its retired
write permissions. Any full database/application restore must account for
subscription changes received since the backup.

## Runtime and dependency updates

`npm run build` uses the supported Webpack builder. Turbopack compilation stalled
in the development environment during this upgrade; `npm run build:turbo` remains
available for a separate compatibility investigation. Development still uses
Next.js's default dev server.

The project targets Node.js 26 LTS, including Vercel builds and Functions. Use
`nvm use` before installing dependencies. `package.json` selects `26.x` for Vercel.

The Polar integration uses the SDK's `2026-10` API definitions. Before enabling
billing, configure the Polar webhook endpoint for API version `2026-10`, then
verify activation and cancellation in the provider sandbox. Local tests use
signed fixtures and do not contact Polar or send email.

Dependencies are pinned to tested stable versions. SheetJS is installed from its
official distribution because the npm registry package is outdated; it remains a
development dependency for the VMT import script. ESLint 9 and TypeScript 6 are
retained because the Next.js lint plugins do not yet support ESLint 10 and
TypeScript 7 across their declared peer ranges.

## Station refresh rollout

As part of the coordinated rollout above, apply
`supabase/migrations/20261124222811_station_refresh.sql` to the existing database. It expects
the four production tables and their staging counterparts to exist. This is an
upgrade migration, not an initial database schema. It adds columns, refresh-run
tracking, restricted backend RPCs, and transactional publication. Existing
production rows are retained. The old `copy_staging_to_production` RPC is retired
for application roles, so the previous backend cannot publish while the new
backend is being deployed.

Configure `NLR_API_KEY` (or retain the existing `NREL_API_KEY`),
`SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`. The station provider URL is
`https://developer.nlr.gov/api/alt-fuel-stations/v1.json`. All mutation entry points
require the configured bearer secret.

- `POST /api/refresh-data` validates and stages a station snapshot and returns its
  `run_id`. It does not replace production data.
- `POST /api/smart-update` with `{"run_id":"<returned UUID>"}` builds all three
  region levels and publishes the validated snapshot. A GET claims the latest
  unexpired staged run for the existing cron schedule.
- `GET /api/cron/daily-refresh` performs both steps directly, with one deadline,
  and propagates the same run identity. This is the initial-refresh entry point.
- `GET /api/health` returns 200 after a successful publication within 36 hours,
  and 503 when the database is unavailable or publication is missing or stale.

The cron schedule remains a station staging job followed by regional publication.
Concurrent runs are rejected. Staging writes are restricted to the run-aware RPCs; the old standalone ZIP generators are retired. Fetch/aggregation leases last six minutes; a staged
snapshot remains claimable for 60 minutes. Ready snapshots are retained for 60 minutes after validation, including after a failed publication attempt. Expired runs are replaced by a fresh
snapshot. A ready snapshot can be retried without recomputing aggregates, and an
already-published run can be retried without rewriting production. If a batch or
publication fails, incomplete data cannot replace production.

The first run checks a minimum of 40,000 valid stations and reconciles the feed's
result count, and requires positive reported capacity for at least 90% of sites. Subsequent runs additionally reject station-count drops over 20%.
Database validation reconciles station, state, county, and ZIP counts before
publication. More than 1% of stations without a county match aborts aggregation.
Small unmatched counts and missing ZIPs are exposed in refresh diagnostics.

### Counting and population conventions

The snapshot includes public, available stations in the 50 states and DC, including
public sites with restrictions such as hotel patron access. Those restrictions
are retained. Stations retain a stable provider ID and deterministic UUID. Total
ports sum every reported speed; connector branding does not determine speed.
Unknown port counts remain unknown. Level-specific station counts can overlap at
mixed-speed sites; `charger_count` remains the distinct site count.

One station pass supplies every region level. Existing ZIP regions remain present
after their final station is removed. The full rebuild is deliberate: it avoids
partial region snapshots and incorporates population changes even when stations
are unchanged. The change report identifies additions, removals, capacity changes,
and both sides of station moves; it does not suppress regeneration.

Population comes from three bulk ACS 2024 datasets. Failed lookups retain an
existing value with its prior provenance (or `previous_unverified` for legacy data), or remain null. Random population
substitutes have been removed. County boundaries match the map's bundled
`us-atlas@3` Census 2017 geometry. The geometry vintage and missing population
counts are included in diagnostics; upgrading that geography is a separate data
migration. No new postcode geometry is generated by this refresh.

The score API now counts actual station locations within 1, 5, and 10 miles using
great-circle distances. It reads every page of the bounding-box query and excludes
sites outside the circle. `chargers.total` and the speed-specific counts describe
distinct sites within 10 miles, rather than regional totals. Mixed-speed sites
can appear in more than one speed count. The nearest station is the closest site
within that radius, or null when there is none. These distances do not describe
driving routes or current charger availability. A database lookup failure returns
an error rather than a zero-site result.

Explicit ZIP/county/state requests now retain the requested region. Address and
coordinate requests use `find_zip_region` to choose a covering ZIP polygon.
Absent ZIP geometry or a missing optional RPC falls back to the containing county
in the bundled boundaries. Operational database errors return a service error;
they do not trigger a nearest-center guess. `region.match` identifies a requested
region or a boundary lookup. `region.distance` is the distance to its center,
not the distance to a charger or boundary. PostGIS behavior still requires the
real-schema rehearsal above.

### Shared scoring contract

The live model is `fleet-provision-v4`. Stored regional scores, map, search, and
widgets use the same fleet/provision calculation. [The model specification](READINESS-MODEL.md)
documents its benchmark ratios, 85/15 component weights, assumptions, API evidence,
and limitations. [The live methodology](https://www.canicharge.com/methodology)
explains it for users. Peer ranking has been removed (`percentile` stays null for
compatibility); only L2 and DC target components contribute.

Scores use unrestricted compatible ports against fleet-scaled targets, with
2025 state registrations, explicitly estimated county/ZIP fleets, and a labeled
historical traffic adjustment. Connector/speed selections reduce supply; the
port/site toggle only changes counts. Opportunity Mode is the missing provision
percentage under the named 33-million-PEV 2030 scenario, not the old heuristic.

The 95% site-reporting gate remains. Unknown capacity is not imputed. Missing
population or unsupported state fleet mapping stays Unrated. Population alone
does not award readiness points, and a known empty region with positive demand
scores zero. The API's `evidence` field exposes the target counts and assumptions.

The ZIP geometry endpoint joins the geometry RPC results to the current regional
table, so a legacy RPC's fixed return columns cannot discard new scoring fields.
Map data reads now paginate instead of accepting a silently truncated response.
Verify this against the actual PostGIS function during deployment; local fixtures do
not verify that function's return type or pagination behavior.

## Billing and API quotas

Checkout is unavailable until its token, public URL, and `POLAR_PRODUCT_ID` are
configured. It selects that product on the server and does not forward arbitrary
customer/product parameters. `POLAR_ENVIRONMENT` selects sandbox or production.
The webhook verifies the original body and signature before processing, and
subscription events require the configured product ID. Switching a subscription
to another product cannot retain access to this product.

The database serializes updates by subscription ID and ignores older provider
updates. Revocation wins timestamp ties. Duplicate activations reuse the same key.
Scheduled cancellation retains access until the period ends; revocation, an ended
subscription, or a terminal status removes access. Recoverable `past_due` status
retains access as the current grace-period policy. Verify that policy in staging.

Welcome email uses a stable Resend idempotency key and a persisted delivery
receipt. Failed persistence, email delivery, or receipt storage returns a webhook
error so the provider can retry. Provider idempotency retention still applies;
a delivery accepted by Resend but never recorded locally can be duplicated after
that provider window. This is not a guarantee of exactly-once email delivery.

API requests with `Authorization: Bearer cic_live_...` atomically check active
status and consume a 1,000-request daily quota, reset at midnight UTC. Invalid
keys return 401, exhausted quota 429, and unavailable quota storage 503. There is
no non-atomic update fallback or anonymous downgrade for failed key checks.
Successful keyed responses expose remaining quota headers. Requests without a
key remain public and use a basic in-process limit; that limit is not distributed
across Vercel instances. A failed score lookup can still consume a keyed request.
Widgets send configured keys in the authorization header and use the origin of
the loaded widget script.

Verify activation, duplicate delivery, out-of-order revocation/activation,
scheduled cancellation, undo cancellation, immediate revocation, another product,
email failure/retry, quota exhaustion, UTC reset, and revoked-key rejection in
staging. The migration expects the existing API-key schema; its local test fixture
cannot establish compatibility with every live constraint or custom function.

## Environment Variables Reference

| Variable | Required for | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_URL` | Application | Canonical application or preview URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Application/build | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Map/build | Public key with read-only station access |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Privileged database access; never expose to clients |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Maps/search | Public token restricted to intended origins |
| `NLR_API_KEY` or `NREL_API_KEY` | Refresh | Station provider key; legacy name remains supported |
| `CENSUS_API_KEY` | Optional | Census population API key |
| `CRON_SECRET` | Refresh | Required bearer secret for all refresh entry points |
| `POLAR_ACCESS_TOKEN` | Billing | Provider access token for the selected environment |
| `POLAR_PRODUCT_ID` | Billing | Product that grants API access |
| `POLAR_ENVIRONMENT` | Billing | `sandbox` for rehearsal; `production` for production |
| `POLAR_WEBHOOK_SECRET` | Billing | Signing secret for that environment's endpoint |
| `RESEND_API_KEY` | Billing/email | Email delivery; verify the configured sender |
| `NEXT_PUBLIC_SENTRY_DSN` | Monitoring | Error reporting |
| `SENTRY_AUTH_TOKEN` | Optional build | Source map upload |

## Refresh read timeout correction — 2026-11-26

The scheduled `GET /api/smart-update` run at 03:30 UTC failed while reading
`zip_level_data` through PostgREST. Database logs identified an ordered
`SELECT * LIMIT … OFFSET …` statement timing out. Run
`ca8d514e-a50b-4188-bffc-3fa73e3416a8` was marked failed; the previously
published snapshot was retained, so incomplete station data never went live.

The refresh now walks indexed primary keys instead of scanning progressively
larger offsets. Regional references request only identity, location, population
provenance, and retained traffic inputs; charger counts, filter summaries,
public supply, and demand JSON are rebuilt from station data. Reference pages
are bounded to 500 rows. Cursor validation rejects duplicate or unordered rows,
server-capped pages are fully traversed, and errors identify the failing table.
The existing processing deadline and publication safeguards remain in place.

Read-only checks through the actual refreshed store and production Data API
retrieved all 51 state, 3,142 county, and 34,074 ZIP references. ZIP reads took
21.2 seconds cold and 7.2 seconds warm. Complete staged (84,668) and published
(84,538) station snapshots loaded in 39.6 seconds combined. No schema changes
or timeout increases are required. Release this patch from its reviewed GitHub
commit; deployment records must identify that commit rather than a dirty tree.
