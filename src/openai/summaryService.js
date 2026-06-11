/**
 * summaryService.js
 *
 * Provides AI-powered summary generation using the Google Gemini API with
 * a rule-based fallback when no API key is configured or when the API fails.
 */

import api from '../lib/api'

/**
 * Builds the plain-text prompt payload from the report data.
 */
function buildPromptPayload(data, event, relatedIncidents = []) {
  if (!data) data = {}
  const { categoryTotals = {}, byCityCategory = {}, details = {} } = data
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

  const categoryRemarks = []
  if (details) {
    Object.entries(details).forEach(([cat, list]) => {
      if (!Array.isArray(list)) return
      const catRemarks = list
        .map(item => {
          const text = item.remarks || item.description || item.damage_description || item.subject
          return text?.trim()
        })
        .filter(Boolean)
      
      if (catRemarks.length > 0) {
        const label = cat.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        categoryRemarks.push(`${label} Remarks:\n- ${catRemarks.slice(0, 15).join('\n- ')}`)
      }
    })
  }

  const incidentLines = (relatedIncidents || [])
    .slice(0, 15)
    .map(inc => {
      const d = new Date(inc.date_time || inc.created_at || inc.date_of_occurrence)
      const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `- ${dateStr} at ${timeStr}: ${inc.description || inc.type_of_incident || 'Incident reported'}`
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
    incidentLines ? `\nTimeline of Incidents:\n${incidentLines}` : '',
    categoryRemarks.length > 0 ? `\nDetailed Remarks & Observations:\n${categoryRemarks.join('\n\n')}` : '',
    `---`,
    `Generation Seed: ${Date.now()}` // Forces AI to rethink and avoid cached/deterministic patterns
  ].filter(Boolean).join('\n')

  return `You are a professional disaster risk reduction officer. Based on the following situational report data and qualitative remarks, write a formal Executive Summary for an official government PDF document. Use clear, concise, and factual Philippine government report language. 

Incorporate the qualitative remarks and specific observations into the relevant sections to provide context beyond just numbers. Structure it with sections: Introduction, Chronology of Events, Impact Overview, Infrastructure Status, Damage Assessment, Government Actions, and Response Efforts. 

Each section should be a short, professional paragraph. Do not include section header labels if the section has no data. Keep the total summary under 500 words and ensure it flows logically.

IMPORTANT: Provide a fresh perspective or slightly vary the phrasing/sentence structure compared to standard templates while maintaining professionalism.

DATA & REMARKS:
${stats}`
}

/**
 * Generates an AI-powered executive summary using the Groq API (Llama 3).
 * Falls back to the rule-based summary on failure or missing API key.
 */
export async function generateAISummary(data, event, relatedIncidents = []) {
  let aiConfig = {
    activeModel: 'groq',
    geminiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    groqKey: import.meta.env.VITE_GROQ_API_KEY || ''
  }

  try {
    const { data: configData } = await api.get('/settings/ai')
    if (configData) {
      console.log('[summaryService] AI config successfully fetched from backend.')
      aiConfig = { ...aiConfig, ...configData }
    }
  } catch (err) {
    console.warn(`[summaryService] Backend fetch failed (${err.response?.status || err.message}). Using local VITE_ env variables. Current URL: ${api.defaults.baseURL}/settings/ai`)
  }

  const activeModel = aiConfig.activeModel || 'groq'
  const prompt = buildPromptPayload(data, event, relatedIncidents)

  try {
    if (activeModel === 'gemini') {
      if (!aiConfig.geminiKey) throw new Error('Gemini API key is not configured.')
      
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiConfig.geminiKey}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1000, topP: 0.8 }
        })
      })

      if (!response.ok) throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
      const json = await response.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Empty response from Gemini')
      return text.trim()

    } else {
      // Default to Groq
      if (!aiConfig.groqKey) throw new Error('Groq API key is not configured.')

      const endpoint = 'https://api.groq.com/openai/v1/chat/completions'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates professional disaster report summaries. Always vary your phrasing slightly between generations.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 1024
        })
      })

      if (!response.ok) throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
      const json = await response.json()
      const text = json?.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty response from Groq')
      return text.trim()
    }
  } catch (err) {
    console.warn(`[summaryService] ${activeModel} AI summary failed, using rule-based fallback:`, err.message)
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
  console.log('[generateSummary] Checking inputs:', { hasData: !!data, hasEvent: !!event })
  
  if (!data || !event) {
    console.warn('[generateSummary] Missing required parameters. data:', !!data, 'event:', !!event)
    return 'No data available to generate summary.'
  }

  const { categoryTotals } = data
  // Also warn if categoryTotals is missing, though we still try to generate
  if (!categoryTotals) {
    console.warn('[generateSummary] data object is missing categoryTotals')
  }

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
