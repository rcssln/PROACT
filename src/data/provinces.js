/**
 * Provinces and cities (LGUs) for the report system.
 * Derived from region1_complete.json so all location data stays in sync.
 */
import regionData from './region1_complete.json'

export const PROVINCE_NAMES = regionData.provinces.map((p) => p.name)

export const PROVINCES_WITH_CITIES = {}
for (const province of regionData.provinces) {
  const cityNames = [
    ...(province.cities || []).map((c) => c.name),
    ...(province.municipalities || []).map((m) => m.name),
  ]
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
  for (const [province, cities] of Object.entries(PROVINCES_WITH_CITIES)) {
    if (cities.some((c) => c.toLowerCase() === String(cityName).toLowerCase())) return province
  }
  return ''
}
