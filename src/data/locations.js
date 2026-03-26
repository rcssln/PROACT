import regionData from './region1_complete.json'

/**
 * Build a flat list of all LGUs (cities + municipalities) across all provinces.
 */
const allLgus = []
for (const province of regionData.provinces) {
  for (const city of province.cities || []) {
    allLgus.push({ name: city.name, province: province.name, barangays: city.barangays || [] })
  }
  for (const mun of province.municipalities || []) {
    allLgus.push({ name: mun.name, province: province.name, barangays: mun.barangays || [] })
  }
}

/** List of LGU names (city/municipality) for dropdowns */
/** List of unique LGU names (city/municipality) for dropdowns. 
 * If names are duplicated across provinces, include province name in parentheses. */
export const LGU_NAMES = allLgus.map((lgu) => {
  const isDuplicate = allLgus.filter((l) => l.name === lgu.name).length > 1
  return isDuplicate ? `${lgu.name} (${lgu.province})` : lgu.name
})

/** Get LGU names filtered by province. If provinceName is null, returns all names. 
 * Uses the same unique naming logic as LGU_NAMES. */
export function getLguNames(provinceName = null) {
  const filtered = provinceName 
    ? allLgus.filter(lgu => lgu.province === provinceName)
    : allLgus;
    
  return filtered.map((lgu) => {
    const isDuplicate = allLgus.filter((l) => l.name === lgu.name).length > 1
    return isDuplicate ? `${lgu.name} (${lgu.province})` : lgu.name
  })
}

/** Get barangays for a given LGU (city/municipality) name. Returns empty array if not found. */
export function getBarangaysForCity(cityName) {
  if (!cityName) return []
  
  // Ensure cityName is a string (SearchableSelect might sometimes pass the option object)
  let name = typeof cityName === 'object' ? (cityName.value || cityName.label || '') : String(cityName)
  let province = ''
  
  if (name.includes(' (')) {
    const match = name.match(/(.*) \((.*)\)/)
    if (match) {
      name = match[1]
      province = match[2]
    }
  }

  // Try exact match with province if provided
  let lgu = allLgus.find((l) => l.name === name && (!province || l.province === province))
  
  if (!lgu) {
    // Try case-insensitive match
    const lower = name.toLowerCase()
    lgu = allLgus.find((l) => l.name.toLowerCase() === lower && (!province || l.province === province))
  }
  
  if (!lgu) {
    // Try partial match
    const lower = name.toLowerCase()
    lgu = allLgus.find((l) => l.name.toLowerCase().startsWith(lower) && (!province || l.province === province))
  }
  
  return lgu ? [...lgu.barangays] : []
}

/** Get LGU (city/municipality) name that contains the given barangay. Returns '' if not found. */
export function getCityForBarangay(barangayName) {
  if (!barangayName) return ''
  const lgu = allLgus.find((l) =>
    l.barangays.some((b) => b.toLowerCase() === barangayName.toLowerCase())
  )
  return lgu ? lgu.name : ''
}

/** Full region data (replaces the old laUnionData default export) */
export default { lgus: allLgus, region: regionData.region, provinces: regionData.provinces }
