/**
 * Provinces and cities (LGUs) for the report system.
 * Derived from region1_barangays.json so all location data stays in sync.
 */
import regionData from './region1_barangays.json'

export const PROVINCE_NAMES = regionData.provinces.map((p) => p.name)

export const PROVINCES_WITH_CITIES = {}
for (const province of regionData.provinces) {
  const cityNames = (province.cities_municipalities || []).map((c) => c.name)
  PROVINCES_WITH_CITIES[province.name] = cityNames
}

/** Get cities for a province. Returns empty array if unknown. */
export function getCitiesForProvince(provinceName) {
  if (!provinceName) return []
  return PROVINCES_WITH_CITIES[provinceName] || []
}

/** Get province that contains the given city/LGU. Returns '' if unknown. */
export function getProvinceForCity(cityName) {
  if (!cityName) return ''
  
  // 1. Try exact match first
  for (const [province, cities] of Object.entries(PROVINCES_WITH_CITIES)) {
    if (cities.some((c) => c.toLowerCase() === String(cityName).toLowerCase())) return province
  }

  // 2. Try stripping province suffix e.g. "Santo Tomas (La Union)" -> "Santo Tomas"
  const stripped = String(cityName).replace(/\s*\(.*\)$/, '');
  const suffixMatch = String(cityName).match(/\((.*)\)$/);
  const suffix = suffixMatch ? suffixMatch[1].toLowerCase() : null;

  for (const [province, cities] of Object.entries(PROVINCES_WITH_CITIES)) {
    if (cities.some((c) => c.toLowerCase() === stripped.toLowerCase())) {
      // If there was a suffix, it MUST match the province name to avoid cross-province overlaps (e.g. Santo Tomas in both LU and Pangasinan)
      if (suffix && suffix !== province.toLowerCase()) continue;
      return province
    }
  }
  
  return ''
}
