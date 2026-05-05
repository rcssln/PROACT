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
/**
 * Robust matching for city/LGU names to retrieve barangays.
 */
export function getBarangaysForCity(cityName) {
  if (!cityName) return []
  
  // Ensure cityName is a string and trim it
  let name = typeof cityName === 'object' ? (cityName.value || cityName.label || '') : String(cityName)
  name = name.trim()
  let province = ''
  
  if (name.includes(' (')) {
    const match = name.match(/(.*) \((.*)\)/)
    if (match) {
      name = match[1].trim()
      province = match[2].trim()
    }
  }

  // Normalization helper: remove common prefixes/suffixes and lowercase
  const normalize = (s) => {
    if (!s) return ''
    return s.toLowerCase()
      .replace(/^(city of|municipality of)\s+/i, '')
      .replace(/\s+(city|municipality)$/i, '')
      .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric for strict comparison
      .trim()
  }

  const targetNorm = normalize(name)
  const provinceNorm = normalize(province)

  // 1. Try multi-stage matching
  let lgu = null

  // Priority 1: Normalized match with province (if provided)
  if (province) {
    lgu = allLgus.find(l => 
      normalize(l.name) === targetNorm && 
      normalize(l.province) === provinceNorm
    )
  }

  // Priority 2: Normalized match (ignore province if priority 1 fails or no province provided)
  if (!lgu) {
    lgu = allLgus.find(l => normalize(l.name) === targetNorm)
  }

  // Priority 3: Fuzzy start match
  if (!lgu && targetNorm.length >= 3) {
    lgu = allLgus.find(l => 
      normalize(l.name).startsWith(targetNorm) || 
      targetNorm.startsWith(normalize(l.name))
    )
  }

  if (lgu) {
    return [...lgu.barangays].sort()
  }

  return []
}

/** Get LGU (city/municipality) name that contains the given barangay. */
export function getCityForBarangay(barangayName) {
  if (!barangayName) return ''
  const lgu = allLgus.find((l) =>
    l.barangays.some((b) => b.toLowerCase() === barangayName.toLowerCase())
  )
  return lgu ? lgu.name : ''
}

export function getProvinceForCity(cityName) {
  if (!cityName) return ''
  const norm = cityName.toLowerCase().replace(/\s+city$/i, '').trim()
  const lgu = allLgus.find(l => l.name.toLowerCase().replace(/\s+city$/i, '').trim() === norm)
  return lgu ? lgu.province : ''
}

export default { 
  lgus: allLgus, 
  region: regionData.region, 
  provinces: regionData.provinces,
  getBarangaysForCity,
  getCityForBarangay,
  getLguNames,
  getProvinceForCity
}
