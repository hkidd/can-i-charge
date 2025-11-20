export interface ChargerFilters {
  showDCFast: boolean
  showLevel2: boolean
  showLevel1: boolean
}

export interface HoveredData {
  state_name?: string
  county_name?: string
  zip_code?: string
  state?: string
  score?: number
  charger_count?: number
  filtered_charger_count?: number
  population?: number
}