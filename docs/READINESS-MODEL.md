# Fleet provision model — deployed 2026-11-25

`fleet-provision-v4` replaces the former bonus-based readiness heuristic. It is an
absolute planning index: **how much compatible, unrestricted public charging
provision exists toward two fleet-scaled targets?** It does not compare peers and
is not measured utilization, live availability, or a complete siting assessment.

## Inputs and provenance

- Reported station capacity and charging-unit connector/speed associations from
  the production station snapshot. Only sites explicitly marked unrestricted
  contribute. Patron-only and unknown-access sites remain in the underlying feed
  but do not contribute to readiness or nearby open-access results.
- Approximate 2025 state BEV and PHEV registrations from the
  [AFDC state registration source](https://afdc.energy.gov/vehicle-registration),
  rounded by the provider to 100 vehicles. The reviewed, pinned dataset is
  `data/ev-registrations-2025.json`: 51 states/DC, 7,454,800 plug-in vehicles.
  Its retrieval date and source-page checksum are retained. Updating this source
  requires a reviewed dataset/model release, not a silent live-page scrape.
- ACS 2024 population where available, with retained prior population/provenance
  where lookups fail. States use their registered fleet. Counties and ZIPs use
  `state plug-in fleet × local population / state population`, explicitly labeled
  as population estimates. They are not local registration counts.
- Historical EPA 2023 road-mile observations, with exact FIPS matching and source
  checksum. County/state demand intensity is road miles per resident divided by
  national road miles per resident, bounded to 0.5–2. ZIPs use a labeled state
  proxy; unavailable traffic uses a factor of 1. All-vehicle road traffic is a
  demand proxy, not observed resident EV miles. National traffic normalization
  requires complete state coverage.

Legacy ZIP state placeholders (`US`) are resolved using the bundled county
boundaries at the ZIP center, with station-state majority as a fallback. Valid
existing state codes are retained. Out-of-coverage/unresolved regions remain
Unrated; no nearest-state guess is made.

## Targets and score meaning

The planning ratios derive from the
[NREL 2030 National Charging Network mid-adoption scenario](https://driveelectric.gov/files/2030-charging-network.pdf):
33 million plug-in vehicles, 1 million public Level 2 ports, and 182,000 public
DC fast ports. That scenario assumes 90% BEVs / 10% PHEVs and 90% residential
charging access. These are national study assumptions, not local measurements.
Applying these ratios to today's fleet is our transparent first-pass model
assumption; NREL has not validated these local scores.

For the current planning estimate:

```text
L2 target   = estimated (BEV + PHEV) × traffic factor × 1,000,000 / 33,000,000
Fast target = estimated BEV × traffic factor × 182,000 / (33,000,000 × 0.9)
L2 coverage = min(reported compatible unrestricted L2 ports / L2 target, 1)
DC coverage = min(reported compatible unrestricted DC ports / Fast target, 1)
Score       = round(85 × L2 coverage) + round(15 × DC coverage)
```

The 85/15 weights approximate the study's required public-port mix (84.6/15.4).
A score of 80 means approximately 80% of this weighted provision benchmark is
met; 100 means both targets are met. Excess of one port type cannot compensate
for a shortage of the other. There are no diversity, connector-presence, or
site-size bonus points. Level 1 ports are visible but do not replace either
benchmark type. Component rounding is explicit and sums exactly to the score.

Connector/speed filters reduce eligible supply while retaining the whole-area
fleet target; connector-specific ownership is unavailable. The port/site toggle
changes the count display only. Distinct sites use speed masks rather than
summing overlapping speed counts. Point filtering requires the connector and
speed on the same charging unit.

At least 95% of eligible sites must report capacity. Missing ports are never
imputed. Missing/nonpositive population or unavailable fleet mapping produces
Unrated. A known empty region with positive modeled demand scores zero.

## Opportunity Mode

Opportunity is the remaining percentage gap under a **33-million-PEV 2030
scenario**. Local fleet sizes grow by `33,000,000 / 7,454,800` (about 4.43), retaining
current geographic shares and traffic intensity. Fast demand uses the scenario's
90% BEV share. The same two targets are calculated against existing supply.
The displayed gap is `100 − scenario provision score`. Lower is better for
readiness: 0% means both modeled targets are covered, and 100% means none of the
weighted target provision is covered. A 78% gap therefore means 22% covered.
The map uses green for smaller gaps and red for larger gaps; the legend, filter
subtitle, and region card explicitly state the direction.

This is a named scenario, not a forecast. It is not an estimate of commercial
viability or a claim that small, high-gap ZIPs justify a charging investment.
The map displays estimated future fleet and target counts alongside the gap.

## API and user-visible evidence

Map hover cards, search, and widgets explain fleet basis, year, reported supply,
and target counts. `/methodology` publishes the interpretation and assumptions.
The API returns `evidence` with fleet estimate, target/gap/coverage by type,
traffic basis/factor, excluded access counts, horizon, version, and limitations.
The old `percentile` field is retained as null; peer ranking has been removed.
Legacy breakdown keys remain for compatibility: `nearby_chargers` is L2 target
points (85 maximum), `fast_charging` is DC target points (15 maximum), and the
other two deprecated fields are zero. Widgets show only the two current parts.

## Impact and verification

The unchanged 84,538-station snapshot produces:

| Region | Previous score | Current readiness | 2030 scenario gap |
| --- | ---: | ---: | ---: |
| California | 54 | 85 | 78 |
| Texas | 44 | 57 | 83 |
| Vermont | 54 | 100 | 62 |
| Washington | 48 | 98 | 74 |
| Mississippi | 43 | 76 | 71 |

States span 39–100 (median 82); counties span 0–100 (median 31). There are 33,262
rated ZIPs; 630 have missing/nonpositive population and 182 have no supported
state fleet mapping. Zero-demand-region assumptions are not used to award 100.
See [the impact artifact](score-impact-2026-11-25.json) for all states and sample
ZIPs, including supply, targets, fleet, and original scores.

Tests cover target boundaries, monotonicity, exact breakdown sums, local fleet
allocation, BEV/PHEV distinction, traffic normalization and bounds, access
restrictions, connector compatibility, distinct site counts, future gaps,
legacy migrations, and escaped widget evidence. The production backfill changes
only scoring metadata/scores and resolved ZIP state labels; IDs, station rows,
regional counts, population, and traffic observations remain intact.

## Limits and next calibration work

The model does not measure local home charging, actual power, uptime, queues,
observed charging demand, fine-grained EV ownership, or within-region route
coverage. A national provision ratio can overstate or understate local need.
The traffic proxy includes trucks and through-travel, and the bounded factor is
a model policy rather than a direct EV-mile measurement. Small ZIP estimates
are especially uncertain. These limitations are visible in the API/widgets and
methodology; they are not hidden by a wider color scale.

Next improvements should replace estimates with reviewed local registration and
utilization data, assess spatial coverage, and test targets against regional
planning evidence. Any calibration change should receive a new scoring version
and before/after report, rather than silently tuning states to expected grades.
