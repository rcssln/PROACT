/**
 * summaryService.js
 *
 * Provides AI-powered summary generation using the Google Gemini API with
 * a rule-based fallback when no API key is configured or when the API fails.
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Builds the plain-text prompt payload from the report data.
 */
function buildPromptPayload(data, event, relatedIncidents = []) {
  const { categoryTotals, byCityCategory } = data
  const fmt = (n) => (n || 0).toLocaleString()

  const incidents = categoryTotals?.relatedIncidents ?? 0
  const pop = categoryTotals?.affectedPopulation ?? 0
  const roads = categoryTotals?.roadsAndBridges ?? 0
  const power = categoryTotals?.power ?? 0
  const water = categoryTotals?.waterSupply ?? 0
  const comms = categoryTotals?.communicationLines ?? 0
  const houses = categoryTotals?.damagedHouses ?? 0
  const evac = categoryTotals?.preEmptiveEvacuation ?? 0
  const agri = categoryTotals?.agricultureDamage ?? 0
  const infra = categoryTotals?.infrastructureDamage ?? 0
  const classSusp = categoryTotals?.classSuspension ?? 0
  const workSusp = categoryTotals?.workSuspension ?? 0
  const calamity = categoryTotals?.stateOfCalamity ?? 0
  const assist = categoryTotals?.assistanceProvided ?? 0
  const lguAssist = categoryTotals?.assistanceLgus ?? 0

  const affectedCities = Object.keys(byCityCategory || {}).join(', ') || 'various areas'

  const incidentLines = (relatedIncidents || [])
    .slice(0, 10)
    .map(inc => {
      const d = new Date(inc.date_time || inc.created_at)
      const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `- ${dateStr} at ${timeStr}: ${inc.description || 'Incident reported'}`
    })
    .join('\n')

  const stats = [
    `Event: ${event.name}`,
    `Event Type: ${event.eventType || 'N/A'}`,
    `Alert Status: ${event.alertStatus?.toUpperCase() || 'WHITE'}`,
    `Start Date: ${new Date(event.startDate).toLocaleDateString()}`,
    `Affected Cities/Municipalities: ${affectedCities}`,
    `---`,
    `Related Incidents: ${fmt(incidents)}`,
    `Affected Population (families): ${fmt(pop)}`,
    `Roads & Bridges Affected: ${fmt(roads)}`,
    `Power Interruptions: ${fmt(power)}`,
    `Water Supply Issues: ${fmt(water)}`,
    `Communication Lines Down: ${fmt(comms)}`,
    `Damaged Houses: ${fmt(houses)}`,
    `Evacuation Operations: ${fmt(evac)}`,
    `Agriculture Damage Records: ${fmt(agri)}`,
    `Infrastructure Damage Records: ${fmt(infra)}`,
    `Class Suspensions: ${fmt(classSusp)}`,
    `Work Suspensions: ${fmt(workSusp)}`,
    `State of Calamity Declarations: ${fmt(calamity)}`,
    `Assistance Provided Records: ${fmt(assist)}`,
    `LGU/Agency Assistance Records: ${fmt(lguAssist)}`,
    incidentLines ? `\nTimeline of Incidents:\n${incidentLines}` : ''
  ].filter(Boolean).join('\n')

  return `You are a professional disaster risk reduction officer. Based on the following situational report data, write a formal Executive Summary for an official government PDF document. Use clear, concise, and factual Philippine government report language. Structure it with sections: Introduction, Chronology of Events, Impact Overview, Infrastructure Status, Damage Assessment, Government Actions, and Response Efforts. Each section should be a short paragraph. Do not include section header labels if the section has no data. Keep the total summary under 400 words.\n\nDATA:\n${stats}`
}

/**
 * Generates an AI-powered executive summary using the Google Gemini API.
 * Falls back to the rule-based summary on failure or missing API key.
 *
 * @param {Object} data - The aggregated data from fetchEventConsolidatedData
 * @param {Object} event - The event object
 * @param {Array} relatedIncidents - Array of incident objects
 * @returns {Promise<string>} The generated summary text
 */
export async function generateAISummary(data, event, relatedIncidents = []) {
  if (!GEMINI_API_KEY) {
    console.warn('[summaryService] VITE_GEMINI_API_KEY not set – using rule-based fallback.')
    return generateSummary(data, event, relatedIncidents)
  }

  try {
    const prompt = buildPromptPayload(data, event, relatedIncidents)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 700,
          topP: 0.8
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')

    return text.trim()
  } catch (err) {
    console.warn('[summaryService] AI summary failed, using rule-based fallback:', err.message)
    return generateSummary(data, event, relatedIncidents)
  }
}

/**
 * Rule-based summary generator (fallback).
 * Produces a structured executive summary from aggregated statistics.
 *
 * @param {Object} data - The aggregated data object from fetchEventConsolidatedData
 * @param {Object} event - The event object details
 * @param {Array<Object>} relatedIncidents - An array of incident objects
 * @returns {string} The generated summary text
 */
export function generateSummary(data, event, relatedIncidents = []) {
  if (!data || !event) return 'No data available to generate summary.'

  const { categoryTotals } = data
  const fmt = (n) => (n || 0).toLocaleString()

  let summary = `EXECUTIVE SUMMARY\n\n`

  summary += `As of ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}, the municipality is monitoring the effects of ${event.name} (${event.eventType || 'Incidents'}). The event started on ${new Date(event.startDate).toLocaleDateString()} and is currently at ${event.alertStatus?.toUpperCase() || 'WHITE'} alert status.\n\n`

  if (relatedIncidents && relatedIncidents.length > 0) {
    summary += `CHRONOLOGY OF EVENTS:\n`
    const sorted = [...relatedIncidents].sort((a, b) => new Date(a.date_time || a.created_at) - new Date(b.date_time || b.created_at))
    let lastDate = ''
    sorted.forEach(inc => {
      const d = new Date(inc.date_time || inc.created_at)
      const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      if (dateStr !== lastDate) { summary += `On ${dateStr}:\n`; lastDate = dateStr }
      summary += `- At ${timeStr}, ${inc.description || 'Incident reported'}.\n`
    })
    summary += `\n`
  } else {
    summary += `CHRONOLOGY OF EVENTS (Template - Edit as needed):\nOn [Date], [Event Name] entered the Philippine Area of Responsibility (PAR).\n- At [Time], Signal No. 1 was raised over [Area].\n- At [Time], Landfall reported in [Location].\n\n`
  }

  const incidents = categoryTotals?.relatedIncidents || 0
  const pop = categoryTotals?.affectedPopulation || 0
  if (incidents > 0 || pop > 0) {
    summary += `IMPACT OVERVIEW: A total of ${fmt(incidents)} related incidents have been reported. The event has affected an estimated ${fmt(pop)} families across respective barangays.\n\n`
  }

  const infraText = []
  if ((categoryTotals?.roadsAndBridges ?? 0) > 0) infraText.push(`${fmt(categoryTotals.roadsAndBridges)} road/bridge sections affected`)
  if ((categoryTotals?.power ?? 0) > 0) infraText.push(`${fmt(categoryTotals.power)} areas reporting power interruptions`)
  if ((categoryTotals?.waterSupply ?? 0) > 0) infraText.push(`${fmt(categoryTotals.waterSupply)} areas with water supply issues`)
  if ((categoryTotals?.communicationLines ?? 0) > 0) infraText.push(`${fmt(categoryTotals.communicationLines)} communication lines reported down`)
  if (infraText.length > 0) summary += `INFRASTRUCTURE STATUS: Critical lifelines have been impacted: ${infraText.join('; ')}. Restoration efforts are ongoing.\n\n`

  const damageSummary = []
  if ((categoryTotals?.agricultureDamage ?? 0) > 0) damageSummary.push(`${fmt(categoryTotals.agricultureDamage)} agriculture damage records`)
  if ((categoryTotals?.infrastructureDamage ?? 0) > 0) damageSummary.push(`${fmt(categoryTotals.infrastructureDamage)} infrastructure damage records`)
  if (damageSummary.length > 0) summary += `DAMAGE ASSESSMENT: Initial reports document ${damageSummary.join(' and ')}.\n\n`

  const housingText = []
  if ((categoryTotals?.damagedHouses ?? 0) > 0) housingText.push(`${fmt(categoryTotals.damagedHouses)} damaged house records`)
  if ((categoryTotals?.preEmptiveEvacuation ?? 0) > 0) housingText.push(`${fmt(categoryTotals.preEmptiveEvacuation)} evacuation operations`)
  if (housingText.length > 0) summary += `HOUSING & DISPLACEMENT: Assessments reveal ${housingText.join(' and ')}.\n\n`

  const govActions = []
  if ((categoryTotals?.stateOfCalamity ?? 0) > 0) govActions.push(`${fmt(categoryTotals.stateOfCalamity)} areas declared under State of Calamity`)
  if ((categoryTotals?.classSuspension ?? 0) > 0) govActions.push(`Class suspensions in ${fmt(categoryTotals.classSuspension)} areas`)
  if ((categoryTotals?.workSuspension ?? 0) > 0) govActions.push(`Work suspensions in ${fmt(categoryTotals.workSuspension)} areas`)
  if (govActions.length > 0) summary += `GOVERNMENT ACTIONS: The following measures are in effect: ${govActions.join('; ')}.\n\n`

  const totalAssist = (categoryTotals?.assistanceProvided ?? 0) + (categoryTotals?.assistanceLgus ?? 0)
  if (totalAssist > 0) summary += `RESPONSE EFFORTS: A total of ${fmt(totalAssist)} assistance records have been logged covering national, provincial, and LGU/agency distributions.\n\n`

  summary += `The LDRRMO continues to monitor the situation and coordinate with barangay officials for updates.`

  return summary
}
