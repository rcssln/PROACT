/**
 * Generate the "RELATED INCIDENTS" first-table PDF (RDRRMC/NDRRMC-style).
 * Focus: correct table structure + visible row/column lines.
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

export function generateRelatedIncidentsPdf({
  eventName,
  province,
  cities,
  categoryTotals,
  byCityCategory,
  relatedIncidentsDetails = [],
  affectedPopulationDetails = [],
  roadsAndBridgesDetails = [],
  powerDetails = [],
  waterSupplyDetails = [],
  communicationLinesDetails = [],
  damagedHousesDetails = [],
  classSuspensionDetails = [],
  workSuspensionDetails = [],
  stateOfCalamityDetails = [],
  preEmptiveEvacuationDetails = [],
  assistanceProvidedDetails = [],
  assistanceLgusDetails = [],
  agricultureDamageDetails = [],
  infrastructureDamageDetails = [],
  summaryText = '',
  signatories = [],
  reportTitle = '',
}) {
  const n = (v) => Number(v ?? 0) || 0
  // Consistent row highlight colors (match Related Incidents table)
  const ROW_COLORS = {
    grandTotal: [255, 255, 160],  // yellow
    region: [170, 255, 240],     // light green
    province: [255, 220, 230],   // light pink
    city: [240, 240, 240],       // gray
  }
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 16
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  let y = margin

  // --- Intro Page / Summary Section ---
  if (summaryText) {
    // Title Header (simulating the image style)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text("Regional Disaster Risk Reduction and Management Council 1", pageW / 2, y + 5, { align: 'center' })

    doc.setFontSize(16)
    doc.text(eventName?.toUpperCase() || "SITUATIONAL REPORT", pageW / 2, y + 13, { align: 'center' })

    doc.setFontSize(12)
    doc.text(province || "Region 1", pageW / 2, y + 21, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const titleText = reportTitle || `Situational Report for the Effects of ${eventName || 'the Event'}`
    doc.text(titleText, pageW / 2, y + 29, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }), pageW / 2, y + 35, { align: 'center' })

    y += 48

    // Summary content - handling multi-line with page overflow check
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const splitSummary = doc.splitTextToSize(summaryText, pageW - margin * 2)

    for (let i = 0; i < splitSummary.length; i++) {
      if (y > pageH - margin - 10) {
        doc.addPage()
        y = margin
      }
      doc.text(splitSummary[i], margin, y)
      y += 5.5 // Line height reduced from 6
    }

    // --- Signatories on the Summary Page ---
    if (signatories && (signatories.preparedBy?.length > 0 || signatories.notedBy || signatories.approvedBy)) {
      y += 12 // Reduced from 20

      const rightX = pageW - margin
      doc.setFontSize(10)

      if (signatories.preparedBy?.length > 0) {
        const names = signatories.preparedBy.map(s => s.name).join(' AND ')
        doc.setFont('helvetica', 'normal')
        doc.text(`Prepared by: ${names}`, rightX, y, { align: 'right' })
        y += 15
      }

      if (signatories.notedBy) {
        doc.setFont('helvetica', 'normal')
        doc.text(`Noted by: ${signatories.notedBy.name}`, rightX, y, { align: 'right' })
        y += 15
      }

      if (signatories.approvedBy) {
        doc.setFont('helvetica', 'normal')
        doc.text(`Approved by: ${signatories.approvedBy.name}`, rightX, y, { align: 'right' })
        y += 15
      }
    }

    // Start tables on a new page
    doc.addPage()
    y = margin
  }

  const headerH = 10
  const addYellowHeader = (title) => {
    // Yellow bar
    doc.setFillColor(255, 243, 128) // light yellow
    doc.rect(margin, y - 6, pageW - margin * 2, headerH, 'F')

    doc.setFont(undefined, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(0, 0, 0)
    doc.text(title, pageW / 2, y, { align: 'center' })
    y += 12
  }

  const ensureSpace = (needed = 28) => {
    if (y + needed > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  const gridTableDefaults = {
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 9,
      lineWidth: 0.3,
      lineColor: [0, 0, 0],
      cellPadding: 2.2,
      valign: 'middle',
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.5,
      lineColor: [0, 0, 0],
    },
  }

  const riTotals = categoryTotals?.relatedIncidents || { total: 0, ongoing: 0, resolved: 0 }
  if (riTotals.total > 0) {
    addYellowHeader(`${eventName || 'TYPHOON'} - RELATED INCIDENTS`)

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `The following incidents were reported in some areas of ${province || 'the province'}.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const body = []
    body.push([
      'Total',
      Number(riTotals.total || 0),
      0, // flooded
      Number(riTotals.resolved || 0), // subsided
      0, // receding
      0, // fallen debris
      0, // storm surge
      Number(riTotals.ongoing || 0), // other/ongoing
    ])
    for (const city of cities) {
      const cityRi = byCityCategory?.[city]?.relatedIncidents || { total: 0, ongoing: 0, resolved: 0 }
      if (cityRi.total <= 0) continue
      body.push([
        city === 'N/A' ? 'All areas' : city,
        Number(cityRi.total || 0),
        0,
        Number(cityRi.resolved || 0),
        0,
        0,
        0,
        Number(cityRi.ongoing || 0),
      ])
    }

    const head = [
      [
        { content: 'PROVINCE', rowSpan: 2, styles: { halign: 'left' } },
        { content: 'Flooded Areas', colSpan: 3, styles: { halign: 'center' } },
        { content: 'Fallen Debris/Trees', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'Storm Surge', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'Other Incidents', rowSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'Flooded', styles: { halign: 'center' } },
        { content: 'Subsided', styles: { halign: 'center' } },
        { content: 'Receding', styles: { halign: 'center' } },
      ],
    ]

    autoTable(doc, {
      startY: y,
      head,
      body,
      ...gridTableDefaults,
      columnStyles: {
        0: { halign: 'left', cellWidth: 32 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 20 },
        7: { halign: 'center', cellWidth: 26 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('PDRRMOs, Ongoing validation of data', pageW / 2, y, { align: 'center' })
    y += 16
  }

  // AFFECTED POPULATION
  const affectedFamilies = Number(categoryTotals?.affectedPopulation?.families || 0)
  const affectedPersons = Number(categoryTotals?.affectedPopulation?.persons || 0)

  if (affectedFamilies > 0 || affectedPersons > 0) {
    ensureSpace(50)
    addYellowHeader('AFFECTED POPULATION')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${affectedFamilies.toLocaleString()} families or ${affectedPersons.toLocaleString()} persons were affected.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const apHead = [
      [
        { content: 'Affected Provinces', rowSpan: 2, styles: { halign: 'left' } },
        { content: 'AFFECTED', colSpan: 3, styles: { halign: 'center' } },
        { content: 'INSIDE ECs', colSpan: 3, styles: { halign: 'center' } },
        { content: 'OUTSIDE ECs', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'Brgy', styles: { halign: 'center' } },
        { content: 'Families', styles: { halign: 'center' } },
        { content: 'Persons', styles: { halign: 'center' } },
        { content: 'No. of ECs', styles: { halign: 'center' } },
        { content: 'Families', styles: { halign: 'center' } },
        { content: 'Persons', styles: { halign: 'center' } },
        { content: 'Families', styles: { halign: 'center' } },
        { content: 'Persons', styles: { halign: 'center' } },
      ],
    ]

    const apBody = []
    apBody.push(['TOTAL', '', affectedFamilies, affectedPersons, 0, 0, 0, 0, 0])
    for (const city of cities) {
      const fam = Number(byCityCategory?.[city]?.affectedPopulation?.families || 0)
      const per = Number(byCityCategory?.[city]?.affectedPopulation?.persons || 0)
      if (fam <= 0 && per <= 0) continue
      apBody.push([city === 'N/A' ? 'All areas' : city, '', fam, per, 0, 0, 0, 0, 0])
    }

    autoTable(doc, {
      startY: y,
      head: apHead,
      body: apBody,
      ...gridTableDefaults,
      styles: { ...gridTableDefaults.styles, fontSize: 8 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 40 },
        1: { halign: 'center', cellWidth: 12 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 16 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'center', cellWidth: 18 },
        8: { halign: 'center', cellWidth: 20 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: DSWD FO1', pageW / 2, y, { align: 'center' })
    y += 18
  }

  // ROADS AND BRIDGES
  const roadsOnly = roadsAndBridgesDetails.filter(r => r.type === 'Road').length
  const bridgesOnly = roadsAndBridgesDetails.filter(r => r.type === 'Bridge').length
  const totalBoth = roadsAndBridgesDetails.length

  if (totalBoth > 0) {
    ensureSpace(45)
    addYellowHeader('ROADS AND BRIDGES')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${roadsOnly.toLocaleString()} road sections and ${bridgesOnly.toLocaleString()} bridges were affected.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const rbHead = [
      [
        { content: '', rowSpan: 2, styles: { halign: 'left' } },
        { content: 'NOT PASSABLE', colSpan: 2, styles: { halign: 'center' } },
        { content: 'PASSABLE (previously reported as not passable and/or one lane passable)', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'ROADS', styles: { halign: 'center' } },
        { content: 'BRIDGES', styles: { halign: 'center' } },
        { content: 'ROADS', styles: { halign: 'center' } },
        { content: 'BRIDGES', styles: { halign: 'center' } },
      ],
    ]

    const rbBody = []
    rbBody.push(['GRAND TOTAL', roadsOnly, bridgesOnly, 0, 0])
    for (const city of cities) {
      const cityRows = roadsAndBridgesDetails.filter(r => (r.city === city || (city === 'N/A' && r.city === 'Unknown')))
      const cityRoads = cityRows.filter(r => r.type === 'Road').length
      const cityBridges = cityRows.filter(r => r.type === 'Bridge').length

      if (cityRoads <= 0 && cityBridges <= 0) continue
      rbBody.push([city === 'N/A' ? 'All areas' : city, cityRoads, cityBridges, 0, 0])
    }

    autoTable(doc, {
      startY: y,
      head: rbHead,
      body: rbBody,
      ...gridTableDefaults,
      columnStyles: {
        0: { halign: 'left', cellWidth: 58 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 30 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: PDRRMO and DPWH', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const pTotals = categoryTotals?.power || { total: 0, interrupted: 0, restored: 0 }
  const powerTotal = pTotals.total
  const powerRestored = pTotals.restored

  if (powerTotal > 0) {
    ensureSpace(45)
    addYellowHeader('POWER')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${powerTotal.toLocaleString()} power interruption/outage and ${powerRestored.toLocaleString()} restored.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const prHead = [
      [
        { content: 'PROVINCE', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NO. OF CITIES/ MUNICIPALITIES', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'INTERRUPTED', styles: { halign: 'center' } },
        { content: 'RESTORED', styles: { halign: 'center' } },
      ],
    ]

    const prBody = []
    prBody.push(['GRAND TOTAL', powerTotal, powerRestored])
    for (const city of cities) {
      const cityP = byCityCategory?.[city]?.power || { total: 0, interrupted: 0, restored: 0 }
      if (cityP.total <= 0) continue
      prBody.push([city === 'N/A' ? 'All areas' : city, cityP.total, cityP.restored])
    }

    autoTable(doc, {
      startY: y,
      head: prHead,
      body: prBody,
      ...gridTableDefaults,
      columnStyles: {
        0: { halign: 'center', cellWidth: 78 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center', cellWidth: 50 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('PDRRMOs, DOE', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const wTotals = categoryTotals?.waterSupply || { total: 0, interrupted: 0, restored: 0 }
  const waterTotal = wTotals.total
  const waterRestored = wTotals.restored

  if (waterTotal > 0) {
    ensureSpace(45)
    addYellowHeader('WATER SUPPLY')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${waterTotal.toLocaleString()} water interruption/outage and ${waterRestored.toLocaleString()} restored.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const wsHead = [
      [
        { content: 'PROVINCE', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NO. OF CITIES/ MUNICIPALITIES', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'INTERRUPTED', styles: { halign: 'center' } },
        { content: 'RESTORED', styles: { halign: 'center' } },
      ],
    ]

    const wsBody = []
    wsBody.push(['GRAND TOTAL', waterTotal, waterRestored])
    for (const city of cities) {
      const cityW = byCityCategory?.[city]?.waterSupply || { total: 0, interrupted: 0, restored: 0 }
      if (cityW.total <= 0) continue
      wsBody.push([city === 'N/A' ? 'All areas' : city, cityW.total, cityW.restored])
    }

    autoTable(doc, {
      startY: y,
      head: wsHead,
      body: wsBody,
      ...gridTableDefaults,
      columnStyles: {
        0: { halign: 'center', cellWidth: 78 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center', cellWidth: 50 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: PDRRMOs', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const cTotals = categoryTotals?.communicationLines || { total: 0, interrupted: 0, restored: 0 }
  const commTotal = cTotals.total
  const commRestored = cTotals.restored

  if (commTotal > 0) {
    ensureSpace(45)
    addYellowHeader('COMMUNICATION LINES')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${commTotal.toLocaleString()} communication interruption/outage and ${commRestored.toLocaleString()} restored.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const clHead = [
      [
        { content: 'Region', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'No of Areas', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'Without Communication', styles: { halign: 'center' } },
        { content: 'Restored Communication Lines', styles: { halign: 'center' } },
      ],
    ]

    const clBody = []
    clBody.push(['GRAND TOTAL', commTotal, commRestored])
    for (const city of cities) {
      const cityC = byCityCategory?.[city]?.communicationLines || { total: 0, interrupted: 0, restored: 0 }
      if (cityC.total <= 0) continue
      clBody.push([city === 'N/A' ? 'All areas' : city, cityC.total, cityC.restored])
    }

    autoTable(doc, {
      startY: y,
      head: clHead,
      body: clBody,
      ...gridTableDefaults,
      styles: { ...gridTableDefaults.styles, fontSize: 8.5 },
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 58 },
        1: { halign: 'center', cellWidth: 60 },
        2: { halign: 'center', cellWidth: 60 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: PDRRMOs', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const hTotals = categoryTotals?.damagedHouses || { total: 0, totally: 0, partially: 0 }
  const damagedTotal = hTotals.total
  const totallyDamaged = hTotals.totally
  const partiallyDamaged = hTotals.partially

  if (damagedTotal > 0) {
    ensureSpace(45)
    addYellowHeader('DAMAGED HOUSES')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${damagedTotal.toLocaleString()} houses were damaged: ${totallyDamaged.toLocaleString()} totally and ${partiallyDamaged.toLocaleString()} partially.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    const dhHead = [[
      { content: 'REGION', styles: { halign: 'center' } },
      { content: 'PARTIALLY', styles: { halign: 'center' } },
      { content: 'TOTALLY', styles: { halign: 'center' } },
      { content: 'TOTAL', styles: { halign: 'center' } },
      { content: 'AMOUNT (PHP)', styles: { halign: 'center' } },
    ]]

    const dhBody = []
    dhBody.push(['GRAND TOTAL', totallyDamaged, partiallyDamaged, damagedTotal, 0])
    for (const city of cities) {
      const cityH = byCityCategory?.[city]?.damagedHouses || { total: 0, totally: 0, partially: 0 }
      if (cityH.total <= 0) continue
      dhBody.push([city === 'N/A' ? 'All areas' : city, cityH.totally, cityH.partially, cityH.total, 0])
    }

    autoTable(doc, {
      startY: y,
      head: dhHead,
      body: dhBody,
      ...gridTableDefaults,
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 50 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 30 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 40 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: DSWD FO1', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const classTotal = Number(categoryTotals?.classSuspension || 0)
  if (classTotal > 0) {
    ensureSpace(45)
    addYellowHeader('CLASS SUSPENSION')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text('Classes were suspended in the following regions:', pageW / 2, y, { align: 'center' })
    y += 8

    const csHead = [
      [
        { content: 'PROVINCE', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'No of cities/municipalities', styles: { halign: 'center' } },
      ],
      [
        { content: 'CLASSES', styles: { halign: 'center' } },
      ],
    ]

    const csBody = []
    csBody.push(['GRAND TOTAL', classTotal])
    for (const city of cities) {
      const n = Number(byCityCategory?.[city]?.classSuspension || 0)
      if (n <= 0) continue
      csBody.push([city === 'N/A' ? 'All areas' : city, n])
    }

    autoTable(doc, {
      startY: y,
      head: csHead,
      body: csBody,
      ...gridTableDefaults,
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 98 },
        1: { halign: 'center', cellWidth: 80 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Sources: PDRRMOs', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const workTotal = Number(categoryTotals?.workSuspension || 0)
  if (workTotal > 0) {
    ensureSpace(45)
    addYellowHeader('WORK SUSPENSION')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text('Work were suspended in the following regions:', pageW / 2, y, { align: 'center' })
    y += 8

    const wsuspHead = [
      [
        { content: 'PROVINCE', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'No of cities/municipalities', styles: { halign: 'center' } },
      ],
      [{ content: 'WORK', styles: { halign: 'center' } }],
    ]

    const wsuspBody = []
    wsuspBody.push(['GRAND TOTAL', workTotal])
    for (const city of cities) {
      const n = Number(byCityCategory?.[city]?.workSuspension || 0)
      if (n <= 0) continue
      wsuspBody.push([city === 'N/A' ? 'All areas' : city, n])
    }

    autoTable(doc, {
      startY: y,
      head: wsuspHead,
      body: wsuspBody,
      ...gridTableDefaults,
      columnStyles: {
        0: { halign: 'center', cellWidth: 98 },
        1: { halign: 'center', cellWidth: 80 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: PDRRMOs', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const socTotal = Number(categoryTotals?.stateOfCalamity || 0)
  if (socTotal > 0) {
    ensureSpace(45)
    addYellowHeader('DECLARATION OF STATE OF CALAMITY')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${socTotal.toLocaleString()} cities/municipalities were declared under the State of Calamity.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 10

    const socHead = [[
      { content: 'PROVINCE', styles: { halign: 'center' } },
      { content: 'NO OF CITIES / MUNICIPALITIES', styles: { halign: 'center' } },
    ]]

    const socBody = []
    socBody.push(['GRAND TOTAL', socTotal])
    for (const city of cities) {
      const n = Number(byCityCategory?.[city]?.stateOfCalamity || 0)
      if (n <= 0) continue
      socBody.push([city === 'N/A' ? 'All areas' : city, n])
    }

    autoTable(doc, {
      startY: y,
      head: socHead,
      body: socBody,
      ...gridTableDefaults,
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 78 },
        1: { halign: 'center', cellWidth: 100 },
      },
    })

    y = doc.lastAutoTable.finalY + 18
  }

  const evacFamilies = Number(categoryTotals?.preEmptiveEvacuation || 0)
  if (evacFamilies > 0) {
    ensureSpace(55)
    addYellowHeader('PRE-EMPTIVE EVACUATION')

    const evacPersons = evacFamilies * 5
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${evacFamilies.toLocaleString()} families or ${evacPersons.toLocaleString()} persons were pre-emptively evacuated:`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 10

    const peHead = [[
      { content: 'PROVINCE', styles: { halign: 'center' } },
      { content: 'No of Families', styles: { halign: 'center' } },
      { content: 'No. of Persons', styles: { halign: 'center' } },
    ]]

    const peBody = []
    peBody.push(['GRAND TOTAL', evacFamilies, evacPersons])
    for (const city of cities) {
      const fam = Number(byCityCategory?.[city]?.preEmptiveEvacuation || 0)
      if (fam <= 0) continue
      peBody.push([city === 'N/A' ? 'All areas' : city, fam, fam * 5])
    }

    autoTable(doc, {
      startY: y,
      head: peHead,
      body: peBody,
      ...gridTableDefaults,
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 58 },
        1: { halign: 'center', cellWidth: 60 },
        2: { halign: 'center', cellWidth: 60 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: PDRRMOs, LGU, DILG', pageW / 2, y, { align: 'center' })
    y += 18
  }

  const asTotals = categoryTotals?.assistanceProvided || { total: 0, cost: 0 }
  const assistanceTotal = asTotals.total
  const costTotal = asTotals.cost

  if (assistanceTotal > 0) {
    ensureSpace(55)
    addYellowHeader('ASSISTANCE PROVIDED TO AFFECTED FAMILIES')

    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(
      `A total of ${assistanceTotal.toLocaleString()} instances of assistance were provided with a total cost of PHP ${costTotal.toLocaleString()}.`,
      pageW / 2,
      y,
      { align: 'center' }
    )
    y += 8

    // With current data, we only have counts; costs are not tracked yet.
    // We format the table like the reference and populate what we can.
    const apvHead = [[
      { content: '', styles: { halign: 'center' } },
      { content: 'NO OF FAMILIES\nREQUIRING\nASSISTANCE', styles: { halign: 'center' } },
      { content: 'COST OF\nASSISTANCE', styles: { halign: 'center' } },
      { content: 'NO OF FAMILIES\nASSISTED', styles: { halign: 'center' } },
      { content: '% OF FAMILIES\nASSISTED', styles: { halign: 'center' } },
    ]]

    const fmtMoney = (n) =>
      Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    const fmtPct = (n) =>
      Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const apvBody = []
    {
      const requiring = assistanceTotal
      const assisted = assistanceTotal
      const cost = costTotal
      const pct = requiring > 0 ? (assisted / requiring) * 100 : 0
      apvBody.push(['GRAND TOTAL', requiring, fmtMoney(cost), assisted, fmtPct(pct)])
    }

    for (const city of cities) {
      const cityAs = byCityCategory?.[city]?.assistanceProvided || { total: 0, cost: 0 }
      const requiring = cityAs.total
      if (requiring <= 0) continue
      const assisted = requiring
      const cost = cityAs.cost
      const pct = requiring > 0 ? (assisted / requiring) * 100 : 0
      apvBody.push([city === 'N/A' ? 'All areas' : city, requiring, fmtMoney(cost), assisted, fmtPct(pct)])
    }

    autoTable(doc, {
      startY: y,
      head: apvHead,
      body: apvBody,
      ...gridTableDefaults,
      styles: { ...gridTableDefaults.styles, fontSize: 8.2 },
      columnStyles: {
        // total = 178
        0: { halign: 'center', cellWidth: 38 },
        1: { halign: 'center', cellWidth: 36 },
        2: { halign: 'center', cellWidth: 34 },
        3: { halign: 'center', cellWidth: 36 },
        4: { halign: 'center', cellWidth: 34 },
      },
    })

    y = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.text('Source: DSWD', pageW / 2, y, { align: 'center' })
    y += 18
  }

  // --- NEW: ASSISTANCE FROM LGUS/AGENCIES PORTRAIT ---
  const alTotal = assistanceLgusDetails.length
  const alTotalAmount = assistanceLgusDetails.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  if (alTotal > 0) {
    ensureSpace(45)
    addYellowHeader('ASSISTANCE FROM LGUS/AGENCIES')
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(`A total of ${alTotal} assistance records from LGUs/Agencies with a total amount of PHP ${alTotalAmount.toLocaleString()}.`, pageW / 2, y, { align: 'center' })
    y += 10

    const alHead = [['PROVINCE', 'RECORDS', 'TOTAL AMOUNT']]
    const alBody = [['GRAND TOTAL', alTotal, alTotalAmount.toLocaleString()]]
    for (const city of cities) {
      const cityDetails = assistanceLgusDetails.filter(r => r.city === city || (city === 'N/A' && r.city === 'Unknown'))
      if (cityDetails.length === 0) continue
      const cityAmt = cityDetails.reduce((s, r) => s + (Number(r.amount) || 0), 0)
      alBody.push([city === 'N/A' ? 'All areas' : city, cityDetails.length, cityAmt.toLocaleString()])
    }
    autoTable(doc, {
      startY: y,
      head: alHead,
      body: alBody,
      ...gridTableDefaults,
    })
    y = doc.lastAutoTable.finalY + 18
  }

  // --- NEW: AGRICULTURE DAMAGE PORTRAIT ---
  const adTotalFarmers = agricultureDamageDetails.reduce((s, r) => s + (Number(r.farmers_affected) || 0), 0)
  const adTotalLoss = agricultureDamageDetails.reduce((s, r) => s + (Number(r.production_loss_value) || 0), 0)
  if (agricultureDamageDetails.length > 0) {
    ensureSpace(45)
    addYellowHeader('AGRICULTURE DAMAGE')
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(`Affected farmers: ${adTotalFarmers.toLocaleString()}. Total production loss: PHP ${adTotalLoss.toLocaleString()}.`, pageW / 2, y, { align: 'center' })
    y += 10

    const adHead = [['PROVINCE', 'FARMERS AFFECTED', 'LOSS VALUE']]
    const adBody = [['GRAND TOTAL', adTotalFarmers.toLocaleString(), adTotalLoss.toLocaleString()]]
    for (const city of cities) {
      const cityDetails = agricultureDamageDetails.filter(r => r.city === city || (city === 'N/A' && r.city === 'Unknown'))
      if (cityDetails.length === 0) continue
      const cityFarmers = cityDetails.reduce((s, r) => s + (Number(r.farmers_affected) || 0), 0)
      const cityLoss = cityDetails.reduce((s, r) => s + (Number(r.production_loss_value) || 0), 0)
      adBody.push([city === 'N/A' ? 'All areas' : city, cityFarmers.toLocaleString(), cityLoss.toLocaleString()])
    }
    autoTable(doc, {
      startY: y,
      head: adHead,
      body: adBody,
      ...gridTableDefaults,
    })
    y = doc.lastAutoTable.finalY + 18
  }

  // --- NEW: INFRASTRUCTURE DAMAGE PORTRAIT ---
  const idTotalCost = infrastructureDamageDetails.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  if (infrastructureDamageDetails.length > 0) {
    ensureSpace(45)
    addYellowHeader('INFRASTRUCTURE DAMAGE')
    doc.setFont(undefined, 'normal')
    doc.setFontSize(9)
    doc.text(`Total estimated cost of infrastructure damage: PHP ${idTotalCost.toLocaleString()}.`, pageW / 2, y, { align: 'center' })
    y += 10

    const idHead = [['PROVINCE', 'ITEMS DAMAGED', 'TOTAL COST']]
    const idBody = [['GRAND TOTAL', infrastructureDamageDetails.length, idTotalCost.toLocaleString()]]
    for (const city of cities) {
      const cityDetails = infrastructureDamageDetails.filter(r => r.city === city || (city === 'N/A' && r.city === 'Unknown'))
      if (cityDetails.length === 0) continue
      const cityCost = cityDetails.reduce((s, r) => s + (Number(r.cost) || 0), 0)
      idBody.push([city === 'N/A' ? 'All areas' : city, cityDetails.length, cityCost.toLocaleString()])
    }
    autoTable(doc, {
      startY: y,
      head: idHead,
      body: idBody,
      ...gridTableDefaults,
    })
    y = doc.lastAutoTable.finalY + 18
  }


  const addPageNumbers = () => {
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p)
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`Page ${p}/${totalPages}`, w / 2, h - 8, { align: 'center' })
    }
  }

  // Landscape title at top left (consistent with Affected Population)
  const addLandscapeTitle = (title, startY) => {
    doc.setFont(undefined, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(0, 0, 0)
    doc.text(title, margin, startY)
    return startY + 10
  }

  // Maximize width: use full content width (A4 landscape 297mm - 2*margin 16 = 265mm)
  const LANDSCAPE_TABLE_WIDTH = 265
  const LANDSCAPE_AREA_COL = 56   // ~21% of table
  const LANDSCAPE_TOTAL_COL = 15  // ~5.7%
  const LANDSCAPE_REST_WIDTH = LANDSCAPE_TABLE_WIDTH - LANDSCAPE_AREA_COL - LANDSCAPE_TOTAL_COL // 194
  const landscapeDataColWidth = (numDataCols) => (numDataCols > 0 ? LANDSCAPE_REST_WIDTH / numDataCols : 0)

  // =========================
  // LANDSCAPE: Related Incidents detailed table
  // =========================
  let lastLandscapePageNumber = null
  let lastLandscapeY = null

  if (relatedIncidentsDetails && relatedIncidentsDetails.length > 0) {
    doc.addPage('a4', 'landscape')
    let ly = margin
    const lPageW = doc.internal.pageSize.getWidth()
    const lContentW = lPageW - margin * 2

    ly = addLandscapeTitle('Related Incidents', ly)

    const formatTime = (timeStr) => {
      if (!timeStr) return ''
      if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const [h, m] = timeStr.split(':')
        const hour = parseInt(h, 10)
        if (Number.isNaN(hour)) return timeStr
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${m || '00'} ${ampm}`.toLowerCase()
      }
      return String(timeStr)
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      if (Number.isNaN(d.getTime())) return String(dateStr)
      return d.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }

    // Sort then group by province -> city
    const incidents = [...relatedIncidentsDetails].sort((a, b) => {
      const ca = String(a.city || '').localeCompare(String(b.city || ''))
      if (ca !== 0) return ca
      const da = new Date(a.date_of_occurrence || a.created_at || 0).getTime()
      const db = new Date(b.date_of_occurrence || b.created_at || 0).getTime()
      return da - db
    })

    const byCity = new Map()
    for (const r of incidents) {
      const city = String(r.city || 'Unknown')
      if (!byCity.has(city)) byCity.set(city, [])
      byCity.get(city).push(r)
    }

    const body = []
    const grandTotal = incidents.length

    body.push({
      _kind: 'region',
      area: 'REGION 1',
      qty: grandTotal,
      type: '',
      date: '',
      time: '',
      description: '',
      actions: '',
      remarks: '',
      status: '',
    })

    body.push({
      _kind: 'province',
      area: String(province || '').toUpperCase() || 'PROVINCE',
      qty: grandTotal,
      type: '',
      date: '',
      time: '',
      description: '',
      actions: '',
      remarks: '',
      status: '',
    })

    for (const [city, rows] of Array.from(byCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      body.push({
        _kind: 'city',
        area: city.toUpperCase(),
        qty: rows.length,
        type: '',
        date: '',
        time: '',
        description: '',
        actions: '',
        remarks: '',
        status: '',
      })

      for (const r of rows) {
        body.push({
          _kind: 'incident',
          area: `   ${r.barangay || ''}`.trimEnd(),
          qty: 1,
          type: r.type_of_incident || '',
          date: formatDate(r.date_of_occurrence),
          time: formatTime(r.time_of_occurrence),
          description: r.description || '',
          actions: r.actions_taken || '',
          remarks: r.remarks || '',
          status: r.status || '',
        })
      }
    }

    body.push({
      _kind: 'grand',
      area: 'GRAND TOTAL',
      qty: grandTotal,
      type: '',
      date: '',
      time: '',
      description: '',
      actions: '',
      remarks: '',
      status: '',
    })

    const columns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'qty' },
      { header: 'TYPE OF INCIDENT', dataKey: 'type' },
      { header: 'DATE OF\nOCCURRENCE', dataKey: 'date' },
      { header: 'TIME OF\nOCCURRENCE', dataKey: 'time' },
      { header: 'DESCRIPTION', dataKey: 'description' },
      { header: 'ACTIONS TAKEN', dataKey: 'actions' },
      { header: 'REMARKS', dataKey: 'remarks' },
      { header: 'STATUS (for flooded areas)', dataKey: 'status' },
    ]

    const relatedDataCols = 7
    const relatedDataW = landscapeDataColWidth(relatedDataCols)
    const colW = {
      0: LANDSCAPE_AREA_COL,
      1: LANDSCAPE_TOTAL_COL,
      2: relatedDataW,
      3: relatedDataW,
      4: relatedDataW,
      5: relatedDataW,
      6: relatedDataW,
      7: relatedDataW,
      8: relatedDataW,
    }

    autoTable(doc, {
      startY: ly,
      columns,
      body,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.6,
        valign: 'top',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: colW[0], halign: 'left' },
        1: { cellWidth: colW[1], halign: 'center' },
        2: { cellWidth: colW[2], halign: 'center' },
        3: { cellWidth: colW[3], halign: 'center' },
        4: { cellWidth: colW[4], halign: 'center' },
        5: { cellWidth: colW[5], halign: 'left' },
        6: { cellWidth: colW[6], halign: 'left' },
        7: { cellWidth: colW[7], halign: 'left' },
        8: { cellWidth: colW[8], halign: 'center' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        const kind = raw?._kind
        if (!kind) return

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (kind === 'grand') setRowFill(ROW_COLORS.grandTotal)
        if (kind === 'region') setRowFill(ROW_COLORS.region)
        if (kind === 'province') setRowFill(ROW_COLORS.province)
        if (kind === 'city') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    // Remember where the last landscape table ended (so the next table can continue on the same page if possible)
    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Affected Population detailed table
  // =========================
  if (affectedPopulationDetails && affectedPopulationDetails.length > 0) {
    // If we already created a landscape page (from Related Incidents), try to place this on the same last page.
    // Otherwise, start a new landscape page.
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin

    // If not enough remaining space for the header + a few rows, start a new landscape page
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Affected Population', ly)

    const provLabel = String(province || 'PROVINCE').toUpperCase()
    const rows = [...affectedPopulationDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const byCity = new Map()
    for (const r of rows) {
      const city = String(r.city || 'Unknown')
      if (!byCity.has(city)) byCity.set(city, [])
      byCity.get(city).push(r)
    }

    const uniqBrgysAll = new Set(rows.map((r) => `${r.city}||${r.barangay || ''}`))
    const familiesAll = rows.reduce((s, r) => s + Number(r.families || 0), 0)
    const n = (v) => Number(v ?? 0) || 0
    const sumEc = (list) => {
      return {
        ecs_cum: list.reduce((s, r) => s + n(r.ecs_cum), 0),
        ecs_now: list.reduce((s, r) => s + n(r.ecs_now), 0),
        inside_families_cum: list.reduce((s, r) => s + n(r.inside_families_cum), 0),
        inside_families_now: list.reduce((s, r) => s + n(r.inside_families_now), 0),
        inside_persons_cum: list.reduce((s, r) => s + n(r.inside_persons_cum), 0),
        inside_persons_now: list.reduce((s, r) => s + n(r.inside_persons_now), 0),
        outside_families_cum: list.reduce((s, r) => s + n(r.outside_families_cum), 0),
        outside_families_now: list.reduce((s, r) => s + n(r.outside_families_now), 0),
        outside_persons_cum: list.reduce((s, r) => s + n(r.outside_persons_cum), 0),
        outside_persons_now: list.reduce((s, r) => s + n(r.outside_persons_now), 0),
      }
    }
    const ecAll = sumEc(rows)

    const makeRow = (label, total, brgys, families, ec = {}) => {
      const persons = n(ec.persons) || (Number(families || 0) * 5)
      const ecsCum = n(ec.ecs_cum)
      const ecsNow = n(ec.ecs_now)
      const inFamCum = n(ec.inside_families_cum)
      const inFamNow = n(ec.inside_families_now)
      const inPerCum = n(ec.inside_persons_cum)
      const inPerNow = n(ec.inside_persons_now)
      const outFamCum = n(ec.outside_families_cum)
      const outFamNow = n(ec.outside_families_now)
      const outPerCum = n(ec.outside_persons_cum)
      const outPerNow = n(ec.outside_persons_now)
      const totFamCum = inFamCum + outFamCum
      const totFamNow = inFamNow + outFamNow
      const totPerCum = inPerCum + outPerCum
      const totPerNow = inPerNow + outPerNow
      return [
        label,
        total,
        brgys,
        families,
        persons,
        ecsCum,
        ecsNow,
        inFamCum,
        inFamNow,
        inPerCum,
        inPerNow,
        outFamCum,
        outFamNow,
        outPerCum,
        outPerNow,
        totFamCum,
        totFamNow,
        totPerCum,
        totPerNow,
      ]
    }

    const body = []
    body.push(makeRow('REGION 1', familiesAll, uniqBrgysAll.size, familiesAll, ecAll))
    body.push(makeRow(provLabel, familiesAll, uniqBrgysAll.size, familiesAll, ecAll))

    for (const [city, list] of Array.from(byCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const uniqBrgysCity = new Set(list.map((r) => r.barangay || '')).size
      const famCity = list.reduce((s, r) => s + Number(r.families || 0), 0)
      const ecCity = sumEc(list)
      body.push(makeRow(String(city).toUpperCase(), famCity, uniqBrgysCity, famCity, ecCity))
      for (const r of list) {
        const label = `  ${r.barangay || ''}`.trimEnd()
        const fam = Number(r.families || 0)
        body.push(makeRow(label, fam, 1, fam, r))
      }
    }

    body.push(makeRow('GRAND TOTAL', familiesAll, uniqBrgysAll.size, familiesAll, ecAll))

    const head = [
      [
        { content: 'REGION | PROVINCE | CITY/\nMUNICIPALITY | BARANGAY', rowSpan: 3, styles: { halign: 'left' } },
        { content: 'TOTAL', rowSpan: 3, styles: { halign: 'center' } },
        { content: 'NO. OF AFFECTED', colSpan: 3, styles: { halign: 'center' } },
        { content: 'No. of ECs', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Inside Evacuation Centers', colSpan: 4, styles: { halign: 'center' } },
        { content: 'Outside Evacuation Centers', colSpan: 4, styles: { halign: 'center' } },
        { content: 'TOTAL SERVED\n(Inside + Outside)', colSpan: 4, styles: { halign: 'center' } },
      ],
      [
        { content: 'Brgys.', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'Families', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'Persons', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'CUM', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NOW', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'Families', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Persons', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Families', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Persons', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Families', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Persons', colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
        { content: 'CUM', styles: { halign: 'center' } },
        { content: 'NOW', styles: { halign: 'center' } },
      ],
    ]

    const affectedDataCols = 17
    const affectedDataW = landscapeDataColWidth(affectedDataCols)
    const colWidths = [
      LANDSCAPE_AREA_COL,
      LANDSCAPE_TOTAL_COL,
      ...Array(affectedDataCols).fill(affectedDataW),
    ]

    autoTable(doc, {
      startY: ly,
      head,
      body,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 6.6,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.3,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(colWidths.map((w, i) => [i, { cellWidth: w, halign: i === 0 ? 'left' : 'center' }]).concat([[0, { cellWidth: colWidths[0], halign: 'left' }]])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '')
        const trimmed = label.trimStart()
        const isIndented = label.startsWith(' ')

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (trimmed === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (trimmed === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (trimmed === provLabel) setRowFill(ROW_COLORS.province)
        else if (!isIndented && trimmed === trimmed.toUpperCase() && trimmed !== '') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Roads and Bridges detailed table
  // =========================
  if (roadsAndBridgesDetails && roadsAndBridgesDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Roads and Bridges', ly)

    const formatDateR = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeR = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'pm' : 'am'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }

    const provLabelRb = String(province || 'PROVINCE').toUpperCase()
    const rbRows = [...roadsAndBridgesDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.road_section_bridge || '').localeCompare(String(b.road_section_bridge || ''))
    })

    const rbByCity = new Map()
    for (const r of rbRows) {
      const city = String(r.city || 'Unknown')
      if (!rbByCity.has(city)) rbByCity.set(city, [])
      rbByCity.get(city).push(r)
    }

    const rbGrandTotal = rbRows.length
    const rbHead = [[
      { content: 'REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', styles: { halign: 'center' } },
      { content: 'TOTAL', styles: { halign: 'center' } },
      { content: 'TYPE', styles: { halign: 'center' } },
      { content: 'CLASSIFICATION', styles: { halign: 'center' } },
      { content: 'ROAD SECTION/BRIDGE', styles: { halign: 'center' } },
      { content: 'STATUS', styles: { halign: 'center' } },
      { content: 'DATE REPORTED\n(passable)', styles: { halign: 'center' } },
      { content: 'TIME REPORTED\n(passable)', styles: { halign: 'center' } },
      { content: 'DATE REPORTED\n(not passable)', styles: { halign: 'center' } },
      { content: 'TIME REPORTED\n(not passable)', styles: { halign: 'center' } },
      { content: 'REMARKS', styles: { halign: 'center' } },
    ]]

    const rbBody = []
    rbBody.push(['REGION 1', rbGrandTotal, '', '', '', '', '', '', '', '', ''])
    rbBody.push([provLabelRb, rbGrandTotal, '', '', '', '', '', '', '', '', ''])

    for (const [city, list] of Array.from(rbByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      rbBody.push([city.toUpperCase(), list.length, '', '', '', '', '', '', '', '', ''])
      for (const r of list) {
        rbBody.push([
          `   ${r.barangay || ''}`.trimEnd(),
          '',
          r.type || '',
          r.classification || '',
          r.road_bridge_name || r.road_section_bridge || '',
          r.status || '',
          formatDateR(r.date_reported_passable),
          formatTimeR(r.time_reported_passable),
          formatDateR(r.date_reported_not_passable),
          formatTimeR(r.time_reported_not_passable),
          r.remarks || '',
        ])
      }
    }

    rbBody.push(['GRAND TOTAL', rbGrandTotal, '', '', '', '', '', '', '', '', ''])

    const rbDataCols = 9
    const rbDataW = landscapeDataColWidth(rbDataCols)
    const rbColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(rbDataCols).fill(rbDataW)]
    autoTable(doc, {
      startY: ly,
      head: rbHead,
      body: rbBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 6.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.2,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(rbColW.map((w, i) => [i, { cellWidth: w, halign: i === 0 || i === 4 || i === 10 ? 'left' : 'center' }])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelRb) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Power detailed table
  // =========================
  if (powerDetails && powerDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Power', ly)

    const formatDateP = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeP = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'pm' : 'am'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }

    const provLabelPwr = String(province || 'PROVINCE').toUpperCase()
    const pwrRows = [...powerDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return new Date(a.date_of_interruption || 0).getTime() - new Date(b.date_of_interruption || 0).getTime()
    })

    const pwrByCity = new Map()
    for (const r of pwrRows) {
      const city = String(r.city || 'Unknown')
      if (!pwrByCity.has(city)) pwrByCity.set(city, [])
      pwrByCity.get(city).push(r)
    }

    const pwrGrandTotal = pwrRows.length
    const pwrHead = [[
      { content: 'REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', styles: { halign: 'center' } },
      { content: 'TOTAL', styles: { halign: 'center' } },
      { content: 'TYPE', styles: { halign: 'center' } },
      { content: 'SERVICE PROVIDER', styles: { halign: 'center' } },
      { content: 'DATE OF INTERRUPTION/\nOUTAGE', styles: { halign: 'center' } },
      { content: 'TIME OF INTERRUPTION/\nOUTAGE', styles: { halign: 'center' } },
      { content: 'DATE RESTORED', styles: { halign: 'center' } },
      { content: 'TIME RESTORED', styles: { halign: 'center' } },
      { content: 'REMARKS', styles: { halign: 'center' } },
    ]]

    const pwrBody = []
    pwrBody.push(['REGION 1', pwrGrandTotal, '', '', '', '', '', '', ''])
    pwrBody.push([provLabelPwr, pwrGrandTotal, '', '', '', '', '', '', ''])

    for (const [city, list] of Array.from(pwrByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      pwrBody.push([city.toUpperCase(), list.length, '', '', '', '', '', '', ''])
      for (const r of list) {
        pwrBody.push([
          `   ${r.barangay || ''}`.trimEnd(),
          '',
          r.type || '',
          r.service_provider || '',
          formatDateP(r.date_of_interruption),
          formatTimeP(r.time_of_interruption),
          formatDateP(r.date_restored),
          formatTimeP(r.time_restored),
          r.remarks || '',
        ])
      }
    }

    pwrBody.push(['GRAND TOTAL', pwrGrandTotal, '', '', '', '', '', '', ''])

    const pwrDataCols = 7
    const pwrDataW = landscapeDataColWidth(pwrDataCols)
    const pwrColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(pwrDataCols).fill(pwrDataW)]
    autoTable(doc, {
      startY: ly,
      head: pwrHead,
      body: pwrBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 6.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.2,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(pwrColW.map((w, i) => [i, { cellWidth: w, halign: i === 0 || i === 8 ? 'left' : 'center' }])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelPwr) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Water Supply detailed table
  // =========================
  if (waterSupplyDetails && waterSupplyDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Water Supply', ly)

    const formatDateW = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeW = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'pm' : 'am'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }

    const provLabelWtr = String(province || 'PROVINCE').toUpperCase()
    const wtrGrandTotal = waterSupplyDetails.length
    const wtrHead = [[
      { content: 'REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', styles: { halign: 'center' } },
      { content: 'TOTAL', styles: { halign: 'center' } },
      { content: 'TYPE', styles: { halign: 'center' } },
      { content: 'SERVICE PROVIDER', styles: { halign: 'center' } },
      { content: 'DATE OF INTERRUPTION/\nOUTAGE', styles: { halign: 'center' } },
      { content: 'TIME OF INTERRUPTION/\nOUTAGE', styles: { halign: 'center' } },
      { content: 'DATE RESTORED', styles: { halign: 'center' } },
      { content: 'TIME RESTORED', styles: { halign: 'center' } },
      { content: 'REMARKS', styles: { halign: 'center' } },
    ]]

    const wtrBody = []
    wtrBody.push(['REGION 1', wtrGrandTotal, '', '', '', '', '', '', ''])
    wtrBody.push([provLabelWtr, wtrGrandTotal, '', '', '', '', '', '', ''])

    const wtrByCity = new Map()
    for (const r of waterSupplyDetails) {
      const city = String(r.city || 'N/A')
      if (!wtrByCity.has(city)) wtrByCity.set(city, [])
      wtrByCity.get(city).push(r)
    }

    for (const [city, list] of Array.from(wtrByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      wtrBody.push([city === 'N/A' ? 'Various' : city.toUpperCase(), list.length, '', '', '', '', '', '', ''])
      for (const r of list) {
        wtrBody.push([
          r.barangay ? `   ${r.barangay}` : '   —',
          '',
          r.type || '',
          r.service_provider || '',
          formatDateW(r.date_of_interruption),
          formatTimeW(r.time_of_interruption),
          formatDateW(r.date_restored),
          formatTimeW(r.time_restored),
          r.remarks || '',
        ])
      }
    }

    wtrBody.push(['GRAND TOTAL', wtrGrandTotal, '', '', '', '', '', '', ''])

    const wtrDataCols = 7
    const wtrDataW = landscapeDataColWidth(wtrDataCols)
    const wtrColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(wtrDataCols).fill(wtrDataW)]
    autoTable(doc, {
      startY: ly,
      head: wtrHead,
      body: wtrBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 6.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.2,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(wtrColW.map((w, i) => [i, { cellWidth: w, halign: i === 0 || i === 8 ? 'left' : 'center' }])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelWtr) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    ly = doc.lastAutoTable.finalY + 6
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    doc.text(`Source: PDRRMO ${province || ''}`, margin, ly)
    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = ly + 8
  }

  // =========================
  // LANDSCAPE: Communication Lines detailed table
  // =========================
  if (communicationLinesDetails && communicationLinesDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Communication Lines', ly)

    const formatDateC = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeC = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'pm' : 'am'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }
    const num = (n) => (n != null && n !== '' ? Number(n) : '')

    const provLabelComm = String(province || 'PROVINCE').toUpperCase()
    const commRows = [...communicationLinesDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return new Date(a.date_interruption || 0).getTime() - new Date(b.date_interruption || 0).getTime()
    })

    const commByCity = new Map()
    for (const r of commRows) {
      const city = String(r.city || 'Unknown')
      if (!commByCity.has(city)) commByCity.set(city, [])
      commByCity.get(city).push(r)
    }

    const commGrandTotal = commRows.length
    const commHead = [[
      { content: 'REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', styles: { halign: 'center' } },
      { content: 'TOTAL', styles: { halign: 'center' } },
      { content: 'TELECOM\nCOMPANY', styles: { halign: 'center' } },
      { content: 'STATUS OF\nCOMMUNICATION', styles: { halign: 'center' } },
      { content: 'DATE\nINTERRUPTION', styles: { halign: 'center' } },
      { content: 'TIME\nINTERRUPTION', styles: { halign: 'center' } },
      { content: 'DATE\nRESTORATION', styles: { halign: 'center' } },
      { content: 'TIME\nRESTORATION', styles: { halign: 'center' } },
      { content: '2G SITE\nCOUNT', styles: { halign: 'center' } },
      { content: '2G WITH\nCOVERAGE', styles: { halign: 'center' } },
      { content: '2G %\nCOVERAGE', styles: { halign: 'center' } },
      { content: '3G SITE\nCOUNT', styles: { halign: 'center' } },
      { content: '3G WITH\nCOVERAGE', styles: { halign: 'center' } },
      { content: '3G %\nCOVERAGE', styles: { halign: 'center' } },
      { content: '4G SITE\nCOUNT', styles: { halign: 'center' } },
      { content: '4G WITH\nCOVERAGE', styles: { halign: 'center' } },
      { content: '4G %\nCOVERAGE', styles: { halign: 'center' } },
      { content: 'REMARKS', styles: { halign: 'center' } },
    ]]

    const commBody = []
    commBody.push(['REGION 1', commGrandTotal, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    commBody.push([provLabelComm, commGrandTotal, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    for (const [city, list] of Array.from(commByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      commBody.push([city.toUpperCase(), list.length, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
      for (const r of list) {
        commBody.push([
          `   ${r.barangay || ''}`.trimEnd(),
          '',
          r.telecompany || '',
          r.status_of_communication || '',
          formatDateC(r.date_interruption),
          formatTimeC(r.time_interruption),
          formatDateC(r.date_restoration),
          formatTimeC(r.time_restoration),
          num(r.site_count_2g),
          num(r.with_coverage_2g),
          num(r.pct_coverage_2g) !== '' ? r.pct_coverage_2g : '',
          num(r.site_count_3g),
          num(r.with_coverage_3g),
          num(r.pct_coverage_3g) !== '' ? r.pct_coverage_3g : '',
          num(r.site_count_4g),
          num(r.with_coverage_4g),
          num(r.pct_coverage_4g) !== '' ? r.pct_coverage_4g : '',
          r.remarks || '',
        ])
      }
    }

    commBody.push(['GRAND TOTAL', commGrandTotal, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])

    const commDataCols = 16
    const commDataW = landscapeDataColWidth(commDataCols)
    const commColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(commDataCols).fill(commDataW)]
    autoTable(doc, {
      startY: ly,
      head: commHead,
      body: commBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 5.8,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(commColW.map((w, i) => [i, { cellWidth: w, halign: i === 0 || i === 2 || i === 17 ? 'left' : 'center' }])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelComm) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    ly = doc.lastAutoTable.finalY + 6
    doc.setFont(undefined, 'normal')
    doc.setFontSize(8)
    doc.text('Source: PDRRMOs', margin, ly)
    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = ly + 8
  }

  // =========================
  // LANDSCAPE: Damaged Houses detailed table
  // =========================
  if (damagedHousesDetails && damagedHousesDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Damaged Houses', ly)

    const provLabelDh = String(province || 'PROVINCE').toUpperCase()
    const dhRows = [...damagedHousesDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const dhByCity = new Map()
    for (const r of dhRows) {
      const city = String(r.city || 'Unknown')
      if (!dhByCity.has(city)) dhByCity.set(city, [])
      dhByCity.get(city).push(r)
    }

    const sumTotally = dhRows.reduce((s, r) => s + Number(r.totally_damaged || 0), 0)
    const sumPartially = dhRows.reduce((s, r) => s + Number(r.partially_damaged || 0), 0)
    const sumGrand = dhRows.reduce((s, r) => s + Number(r.grand_total || 0), 0)
    const fmtPhp = (n) => (n != null && n !== '' ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0')

    const dhHead = [
      [
        { content: 'REGION | PROVINCE | CITY/\nMUNICIPALITY | BARANGAY', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NO. OF DAMAGED HOUSES', colSpan: 3, styles: { halign: 'center' } },
        { content: 'AMOUNT (PHP)', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'REMARKS', rowSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'TOTALLY', styles: { halign: 'center' } },
        { content: 'PARTIALLY', styles: { halign: 'center' } },
        { content: 'GRAND TOTAL', styles: { halign: 'center' } },
      ],
    ]

    const dhBody = []
    dhBody.push(['REGION 1', dhRows.length, sumTotally, sumPartially, sumGrand, fmtPhp(0), ''])
    dhBody.push([provLabelDh, dhRows.length, sumTotally, sumPartially, sumGrand, fmtPhp(0), ''])

    for (const [city, list] of Array.from(dhByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityTotally = list.reduce((s, r) => s + Number(r.totally_damaged || 0), 0)
      const cityPartially = list.reduce((s, r) => s + Number(r.partially_damaged || 0), 0)
      const cityGrand = list.reduce((s, r) => s + Number(r.grand_total || 0), 0)
      dhBody.push([city.toUpperCase(), list.length, cityTotally, cityPartially, cityGrand, '', ''])
      for (const r of list) {
        dhBody.push([
          `   ${r.barangay || ''}`.trimEnd(),
          '',
          Number(r.totally_damaged || 0),
          Number(r.partially_damaged || 0),
          Number(r.grand_total || 0),
          fmtPhp(r.amount_php),
          r.remarks || '',
        ])
      }
    }

    dhBody.push(['GRAND TOTAL', dhRows.length, sumTotally, sumPartially, sumGrand, fmtPhp(0), ''])

    const dhDataCols = 5
    const dhDataW = landscapeDataColWidth(dhDataCols)
    const dhColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(dhDataCols).fill(dhDataW)]
    autoTable(doc, {
      startY: ly,
      head: dhHead,
      body: dhBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.5,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: Object.fromEntries(dhColW.map((w, i) => [i, { cellWidth: w, halign: i === 0 || i === 6 ? 'left' : 'center' }])),
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelDh) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Class Suspension detailed table (same format as Related Incidents)
  // =========================
  if (classSuspensionDetails && classSuspensionDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Class Suspension', ly)

    const formatDateCs = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeCs = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'PM' : 'AM'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }

    const provLabelCs = String(province || 'PROVINCE').toUpperCase()
    const csRows = [...classSuspensionDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return new Date(a.date_of_suspension || 0).getTime() - new Date(b.date_of_suspension || 0).getTime()
    })

    const csByCity = new Map()
    for (const r of csRows) {
      const city = String(r.city || 'Unknown')
      if (!csByCity.has(city)) csByCity.set(city, [])
      csByCity.get(city).push(r)
    }

    const csGrandTotal = csRows.length
    const csBody = []

    csBody.push({
      _kind: 'region',
      area: 'REGION 1',
      qty: csGrandTotal,
      level_from: '',
      level_to: '',
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })
    csBody.push({
      _kind: 'province',
      area: provLabelCs,
      qty: csGrandTotal,
      level_from: '',
      level_to: '',
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })

    for (const [city, list] of Array.from(csByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      csBody.push({
        _kind: 'city',
        area: city.toUpperCase(),
        qty: list.length,
        level_from: '',
        level_to: '',
        type: '',
        date_susp: '',
        time_susp: '',
        date_resumed: '',
        time_resumed: '',
        remarks: '',
      })
      for (const r of list) {
        csBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          qty: '',
          level_from: r.level_from || '',
          level_to: r.level_to || '',
          type: r.type || '',
          date_susp: formatDateCs(r.date_of_suspension),
          time_susp: formatTimeCs(r.time_of_suspension),
          date_resumed: formatDateCs(r.date_resumed),
          time_resumed: formatTimeCs(r.time_resumed),
          remarks: r.remarks || '',
        })
      }
    }

    csBody.push({
      _kind: 'grand',
      area: 'GRAND TOTAL',
      qty: csGrandTotal,
      level_from: '',
      level_to: '',
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })

    const csColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'qty' },
      { header: 'LEVEL\nFROM', dataKey: 'level_from' },
      { header: 'LEVEL\nTO', dataKey: 'level_to' },
      { header: 'TYPE', dataKey: 'type' },
      { header: 'DATE OF\nSUSPENSION', dataKey: 'date_susp' },
      { header: 'TIME OF\nSUSPENSION', dataKey: 'time_susp' },
      { header: 'DATE\nRESUMED', dataKey: 'date_resumed' },
      { header: 'TIME\nRESUMED', dataKey: 'time_resumed' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const csDataCols = 8
    const csDataW = landscapeDataColWidth(csDataCols)
    const csColW = { 0: LANDSCAPE_AREA_COL, 1: LANDSCAPE_TOTAL_COL, 2: csDataW, 3: csDataW, 4: csDataW, 5: csDataW, 6: csDataW, 7: csDataW, 8: csDataW, 9: csDataW }
    autoTable(doc, {
      startY: ly,
      columns: csColumns,
      body: csBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.6,
        valign: 'top',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: csColW[0], halign: 'left' },
        1: { cellWidth: csColW[1], halign: 'center' },
        2: { cellWidth: csColW[2], halign: 'center' },
        3: { cellWidth: csColW[3], halign: 'center' },
        4: { cellWidth: csColW[4], halign: 'center' },
        5: { cellWidth: csColW[5], halign: 'center' },
        6: { cellWidth: csColW[6], halign: 'center' },
        7: { cellWidth: csColW[7], halign: 'center' },
        8: { cellWidth: csColW[8], halign: 'center' },
        9: { cellWidth: csColW[9], halign: 'left' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        const kind = raw?._kind
        if (!kind) return

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (kind === 'grand') setRowFill(ROW_COLORS.grandTotal)
        if (kind === 'region') setRowFill(ROW_COLORS.region)
        if (kind === 'province') setRowFill(ROW_COLORS.province)
        if (kind === 'city') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Work Suspension detailed table (same format as Class Suspension)
  // =========================
  if (workSuspensionDetails && workSuspensionDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Work Suspension', ly)

    const formatDateWs = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }
    const formatTimeWs = (t) => {
      if (!t) return ''
      const s = String(t)
      if (s.includes(':')) {
        const [h, m] = s.split(':')
        const hour = parseInt(h, 10)
        if (!Number.isNaN(hour)) {
          const ampm = hour >= 12 ? 'PM' : 'AM'
          const h12 = hour % 12 || 12
          return `${h12}:${m || '00'} ${ampm}`
        }
      }
      return s
    }

    const provLabelWs = String(province || 'PROVINCE').toUpperCase()
    const wsRows = [...workSuspensionDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return new Date(a.date_of_suspension || 0).getTime() - new Date(b.date_of_suspension || 0).getTime()
    })

    const wsByCity = new Map()
    for (const r of wsRows) {
      const city = String(r.city || 'Unknown')
      if (!wsByCity.has(city)) wsByCity.set(city, [])
      wsByCity.get(city).push(r)
    }

    const wsGrandTotal = wsRows.length
    const wsBody = []

    wsBody.push({
      _kind: 'region',
      area: 'REGION 1',
      qty: wsGrandTotal,
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })
    wsBody.push({
      _kind: 'province',
      area: provLabelWs,
      qty: wsGrandTotal,
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })

    for (const [city, list] of Array.from(wsByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      wsBody.push({
        _kind: 'city',
        area: city.toUpperCase(),
        qty: list.length,
        type: '',
        date_susp: '',
        time_susp: '',
        date_resumed: '',
        time_resumed: '',
        remarks: '',
      })
      for (const r of list) {
        wsBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          qty: '',
          type: r.type || '',
          date_susp: formatDateWs(r.date_of_suspension),
          time_susp: formatTimeWs(r.time_of_suspension),
          date_resumed: formatDateWs(r.date_resumed),
          time_resumed: formatTimeWs(r.time_resumed),
          remarks: r.remarks || '',
        })
      }
    }

    wsBody.push({
      _kind: 'grand',
      area: 'GRAND TOTAL',
      qty: wsGrandTotal,
      type: '',
      date_susp: '',
      time_susp: '',
      date_resumed: '',
      time_resumed: '',
      remarks: '',
    })

    const wsColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'qty' },
      { header: 'TYPE', dataKey: 'type' },
      { header: 'DATE OF\nSUSPENSION', dataKey: 'date_susp' },
      { header: 'TIME OF\nSUSPENSION', dataKey: 'time_susp' },
      { header: 'DATE\nRESUMED', dataKey: 'date_resumed' },
      { header: 'TIME\nRESUMED', dataKey: 'time_resumed' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const wsDataCols = 6
    const wsDataW = landscapeDataColWidth(wsDataCols)
    const wsColW = { 0: LANDSCAPE_AREA_COL, 1: LANDSCAPE_TOTAL_COL, 2: wsDataW, 3: wsDataW, 4: wsDataW, 5: wsDataW, 6: wsDataW, 7: wsDataW }
    autoTable(doc, {
      startY: ly,
      columns: wsColumns,
      body: wsBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.6,
        valign: 'top',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: wsColW[0], halign: 'left' },
        1: { cellWidth: wsColW[1], halign: 'center' },
        2: { cellWidth: wsColW[2], halign: 'center' },
        3: { cellWidth: wsColW[3], halign: 'center' },
        4: { cellWidth: wsColW[4], halign: 'center' },
        5: { cellWidth: wsColW[5], halign: 'center' },
        6: { cellWidth: wsColW[6], halign: 'center' },
        7: { cellWidth: wsColW[7], halign: 'left' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        const kind = raw?._kind
        if (!kind) return

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (kind === 'grand') setRowFill(ROW_COLORS.grandTotal)
        if (kind === 'region') setRowFill(ROW_COLORS.region)
        if (kind === 'province') setRowFill(ROW_COLORS.province)
        if (kind === 'city') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Declaration of State of Calamity detailed table
  // =========================
  if (stateOfCalamityDetails && stateOfCalamityDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Declaration of State of Calamity', ly)

    const formatDateSoc = (d) => {
      if (!d) return ''
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' })
    }

    const provLabelSoc = String(province || 'PROVINCE').toUpperCase()
    const socRows = [...stateOfCalamityDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return new Date(a.resolution_date || 0).getTime() - new Date(b.resolution_date || 0).getTime()
    })

    const socByCity = new Map()
    for (const r of socRows) {
      const city = String(r.city || 'Unknown')
      if (!socByCity.has(city)) socByCity.set(city, [])
      socByCity.get(city).push(r)
    }

    const socGrandTotal = socRows.length
    const socBody = []

    socBody.push({
      _kind: 'region',
      area: 'REGION 1',
      total: socGrandTotal,
      count_soc: socGrandTotal,
      type: '',
      resolution_number: '',
      resolution_date: '',
      remarks: '',
      attachment: '',
    })
    socBody.push({
      _kind: 'province',
      area: provLabelSoc,
      total: socGrandTotal,
      count_soc: socGrandTotal,
      type: '',
      resolution_number: '',
      resolution_date: '',
      remarks: '',
      attachment: '',
    })

    for (const [city, list] of Array.from(socByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      socBody.push({
        _kind: 'city',
        area: city.toUpperCase(),
        total: list.length,
        count_soc: list.length,
        type: '',
        resolution_number: '',
        resolution_date: '',
        remarks: '',
        attachment: '',
      })
      for (const r of list) {
        socBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          total: '',
          count_soc: r.count_soc !== '' && r.count_soc != null ? String(r.count_soc) : '',
          type: r.type || '',
          resolution_number: r.resolution_number || '',
          resolution_date: formatDateSoc(r.resolution_date),
          remarks: r.remarks || '',
          attachment: r.attachment_url ? 'Yes' : '',
        })
      }
    }

    socBody.push({
      _kind: 'grand',
      area: 'GRAND TOTAL',
      total: socGrandTotal,
      count_soc: socGrandTotal,
      type: '',
      resolution_number: '',
      resolution_date: '',
      remarks: '',
      attachment: '',
    })

    const socColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'total' },
      { header: 'TYPE', dataKey: 'type' },
      { header: 'COUNT SOC', dataKey: 'count_soc' },
      { header: 'RESOLUTION\nNUMBER', dataKey: 'resolution_number' },
      { header: 'RESOLUTION\nDATE', dataKey: 'resolution_date' },
      { header: 'REMARKS', dataKey: 'remarks' },
      { header: 'ATTACHMENT', dataKey: 'attachment' },
    ]

    const socDataCols = 6
    const socDataW = landscapeDataColWidth(socDataCols)
    const socColW = { 0: LANDSCAPE_AREA_COL, 1: LANDSCAPE_TOTAL_COL, 2: socDataW, 3: socDataW, 4: socDataW, 5: socDataW, 6: socDataW, 7: socDataW }
    autoTable(doc, {
      startY: ly,
      columns: socColumns,
      body: socBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.6,
        valign: 'top',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: socColW[0], halign: 'left' },
        1: { cellWidth: socColW[1], halign: 'center' },
        2: { cellWidth: socColW[2], halign: 'center' },
        3: { cellWidth: socColW[3], halign: 'center' },
        4: { cellWidth: socColW[4], halign: 'center' },
        5: { cellWidth: socColW[5], halign: 'center' },
        6: { cellWidth: socColW[6], halign: 'left' },
        7: { cellWidth: socColW[7], halign: 'center' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        const kind = raw?._kind
        if (!kind) return

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (kind === 'grand') setRowFill(ROW_COLORS.grandTotal)
        if (kind === 'region') setRowFill(ROW_COLORS.region)
        if (kind === 'province') setRowFill(ROW_COLORS.province)
        if (kind === 'city') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Pre-emptive Evacuation detailed table
  // =========================
  if (preEmptiveEvacuationDetails && preEmptiveEvacuationDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Pre-emptive Evacuation', ly)

    const provLabelEvac = String(province || 'PROVINCE').toUpperCase()
    const evacRows = [...preEmptiveEvacuationDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const evacByCity = new Map()
    for (const r of evacRows) {
      const city = String(r.city || 'Unknown')
      if (!evacByCity.has(city)) evacByCity.set(city, [])
      evacByCity.get(city).push(r)
    }

    const sumF = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0)
    const grandFamilies = evacRows.reduce((s, r) => s + Number(r.families || 0), 0)
    const grandMale = evacRows.reduce((s, r) => s + Number(r.male_count || 0), 0)
    const grandFemale = evacRows.reduce((s, r) => s + Number(r.female_count || 0), 0)
    const grandTotal = evacRows.reduce((s, r) => s + Number(r.total || 0), 0)

    const evacBody = []
    const evacCount = evacRows.length

    evacBody.push({
      _kind: 'region',
      area: 'REGION 1',
      total_count: evacCount,
      families: grandFamilies,
      male: grandMale,
      female: grandFemale,
      total: grandTotal,
      remarks: '',
    })
    evacBody.push({
      _kind: 'province',
      area: provLabelEvac,
      total_count: evacCount,
      families: grandFamilies,
      male: grandMale,
      female: grandFemale,
      total: grandTotal,
      remarks: '',
    })

    for (const [city, list] of Array.from(evacByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityFamilies = sumF(list, 'families')
      const cityMale = sumF(list, 'male_count')
      const cityFemale = sumF(list, 'female_count')
      const cityTotal = sumF(list, 'total')
      evacBody.push({
        _kind: 'city',
        area: city.toUpperCase(),
        total_count: list.length,
        families: cityFamilies,
        male: cityMale,
        female: cityFemale,
        total: cityTotal,
        remarks: '',
      })
      for (const r of list) {
        evacBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          total_count: '',
          families: Number(r.families || 0),
          male: Number(r.male_count || 0),
          female: Number(r.female_count || 0),
          total: Number(r.total || 0),
          remarks: r.remarks || '',
        })
      }
    }

    evacBody.push({
      _kind: 'grand',
      area: 'GRAND TOTAL',
      total_count: evacCount,
      families: grandFamilies,
      male: grandMale,
      female: grandFemale,
      total: grandTotal,
      remarks: '',
    })

    const evacColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'total_count' },
      { header: 'FAMILIES', dataKey: 'families' },
      { header: 'MALE', dataKey: 'male' },
      { header: 'FEMALE', dataKey: 'female' },
      { header: 'PERSONS', dataKey: 'total' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const evacDataCols = 5
    const evacDataW = landscapeDataColWidth(evacDataCols)
    const evacColW = { 0: LANDSCAPE_AREA_COL, 1: LANDSCAPE_TOTAL_COL, 2: evacDataW, 3: evacDataW, 4: evacDataW, 5: evacDataW, 6: evacDataW }
    autoTable(doc, {
      startY: ly,
      columns: evacColumns,
      body: evacBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 7.2,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.6,
        valign: 'top',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: evacColW[0], halign: 'left' },
        1: { cellWidth: evacColW[1], halign: 'center' },
        2: { cellWidth: evacColW[2], halign: 'right' },
        3: { cellWidth: evacColW[3], halign: 'right' },
        4: { cellWidth: evacColW[4], halign: 'right' },
        5: { cellWidth: evacColW[5], halign: 'right' },
        6: { cellWidth: evacColW[6], halign: 'left' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        const kind = raw?._kind
        if (!kind) return

        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }

        if (kind === 'grand') setRowFill(ROW_COLORS.grandTotal)
        if (kind === 'region') setRowFill(ROW_COLORS.region)
        if (kind === 'province') setRowFill(ROW_COLORS.province)
        if (kind === 'city') setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Assistance Provided to Affected Families detailed table
  // =========================
  if (assistanceProvidedDetails && assistanceProvidedDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Assistance Provided to Affected Families', ly)

    const fmtNum = (n) => (n != null && n !== '' ? Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 }) : '')
    const fmtAmount = (n) => (n != null && n !== '' ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
    const fmtPct = (n) => (n != null && n !== '' ? Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

    const provLabelAp = String(province || 'PROVINCE').toUpperCase()
    const apRows = [...assistanceProvidedDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const apByCity = new Map()
    for (const r of apRows) {
      const city = String(r.city || 'Unknown')
      if (!apByCity.has(city)) apByCity.set(city, [])
      apByCity.get(city).push(r)
    }

    const sumAp = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0)
    const grandAffected = sumAp(apRows, 'no_families_affected')
    const grandRequiring = sumAp(apRows, 'no_families_requiring_assistance')
    const grandAmount = apRows.reduce((s, r) => s + Number(r.fnfi_amount || 0), 0)
    const grandAssisted = sumAp(apRows, 'no_families_assisted')
    const grandPct = grandRequiring > 0 ? (grandAssisted / grandRequiring) * 100 : ''

    const apHead = [
      [
        { content: 'REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NO. OF\nFAMILIES AFFECTED', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NEEDS', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'NO. OF FAMILIES\nREQUIRING ASSISTANCE', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'F/NFIs PROVIDED', colSpan: 5, styles: { halign: 'center' } },
        { content: 'NO. OF\nFAMILIES ASSISTED', rowSpan: 2, styles: { halign: 'center' } },
        { content: '% OF\nFAMILIES ASSISTED', rowSpan: 2, styles: { halign: 'center' } },
        { content: 'REMARKS', rowSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'QTY', styles: { halign: 'center' } },
        { content: 'UNIT', styles: { halign: 'center' } },
        { content: 'COST\nPER UNIT', styles: { halign: 'center' } },
        { content: 'AMOUNT', styles: { halign: 'center' } },
        { content: 'SOURCE', styles: { halign: 'center' } },
      ],
    ]

    const apBody = []
    const apGrandCount = apRows.length
    apBody.push(['REGION 1', fmtNum(apGrandCount), fmtNum(grandAffected), '', fmtNum(grandRequiring), '', '', '', fmtAmount(grandAmount), '', fmtNum(grandAssisted), fmtPct(grandPct), ''])
    apBody.push([provLabelAp, fmtNum(apGrandCount), fmtNum(grandAffected), '', fmtNum(grandRequiring), '', '', '', fmtAmount(grandAmount), '', fmtNum(grandAssisted), fmtPct(grandPct), ''])

    for (const [city, list] of Array.from(apByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityAffected = sumAp(list, 'no_families_affected')
      const cityRequiring = sumAp(list, 'no_families_requiring_assistance')
      const cityAmount = list.reduce((s, r) => s + Number(r.fnfi_amount || 0), 0)
      const cityAssisted = sumAp(list, 'no_families_assisted')
      const cityPct = cityRequiring > 0 ? (cityAssisted / cityRequiring) * 100 : ''
      apBody.push([city.toUpperCase(), fmtNum(list.length), fmtNum(cityAffected), '', fmtNum(cityRequiring), '', '', '', fmtAmount(cityAmount), '', fmtNum(cityAssisted), fmtPct(cityPct), ''])
      for (const r of list) {
        apBody.push([
          `   ${r.barangay || ''}`.trimEnd(),
          '',
          fmtNum(r.no_families_affected),
          r.needs || '',
          fmtNum(r.no_families_requiring_assistance),
          r.fnfi_qty !== '' && r.fnfi_qty != null ? fmtNum(r.fnfi_qty) : '',
          r.fnfi_unit || '',
          r.fnfi_cost_per_unit !== '' && r.fnfi_cost_per_unit != null ? fmtNum(r.fnfi_cost_per_unit) : '',
          fmtAmount(r.fnfi_amount),
          r.fnfi_source || '',
          fmtNum(r.no_families_assisted),
          fmtPct(r.pct_families_assisted),
          r.remarks || '',
        ])
      }
    }

    apBody.push(['GRAND TOTAL', fmtNum(apGrandCount), fmtNum(grandAffected), '', fmtNum(grandRequiring), '', '', '', fmtAmount(grandAmount), '', fmtNum(grandAssisted), fmtPct(grandPct), ''])

    const apDataCols = 11
    const apDataW = landscapeDataColWidth(apDataCols)
    const apColW = [LANDSCAPE_AREA_COL, LANDSCAPE_TOTAL_COL, ...Array(apDataCols).fill(apDataW)]
    autoTable(doc, {
      startY: ly,
      head: apHead,
      body: apBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        lineWidth: 0.3,
        lineColor: [0, 0, 0],
        cellPadding: 1.2,
        valign: 'middle',
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.6,
        lineColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: apColW[0], halign: 'left' },
        1: { cellWidth: apColW[1], halign: 'center' },
        2: { cellWidth: apColW[2], halign: 'right' },
        3: { cellWidth: apColW[3], halign: 'left' },
        4: { cellWidth: apColW[4], halign: 'right' },
        5: { cellWidth: apColW[5], halign: 'right' },
        6: { cellWidth: apColW[6], halign: 'center' },
        7: { cellWidth: apColW[7], halign: 'right' },
        8: { cellWidth: apColW[8], halign: 'right' },
        9: { cellWidth: apColW[9], halign: 'left' },
        10: { cellWidth: apColW[10], halign: 'right' },
        11: { cellWidth: apColW[11], halign: 'right' },
        12: { cellWidth: apColW[12], halign: 'left' },
      },
      didParseCell: (data) => {
        const raw = data.row?.raw
        if (!raw || !Array.isArray(raw)) return
        const label = String(raw[0] || '').trim()
        const setRowFill = (rgb) => {
          data.cell.styles.fillColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (label === 'GRAND TOTAL') setRowFill(ROW_COLORS.grandTotal)
        else if (label === 'REGION 1') setRowFill(ROW_COLORS.region)
        else if (label === provLabelAp) setRowFill(ROW_COLORS.province)
        else if (label === label.toUpperCase() && label.length > 0 && !raw[0].toString().startsWith(' ')) setRowFill(ROW_COLORS.city)
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Assistance from LGUs/Agencies detailed table
  // =========================
  if (assistanceLgusDetails && assistanceLgusDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Assistance from LGUs/Agencies', ly)

    const provLabelAl = String(province || 'PROVINCE').toUpperCase()
    const alRows = [...assistanceLgusDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const alByCity = new Map()
    for (const r of alRows) {
      const city = String(r.city || 'Unknown')
      if (!alByCity.has(city)) alByCity.set(city, [])
      alByCity.get(city).push(r)
    }

    const alBody = []
    const alGrandTotalAmt = alRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

    alBody.push({ _kind: 'region', area: 'REGION 1', total: alRows.length, amount: alGrandTotalAmt.toLocaleString() })
    alBody.push({ _kind: 'province', area: provLabelAl, total: alRows.length, amount: alGrandTotalAmt.toLocaleString() })

    for (const [city, list] of Array.from(alByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityAmt = list.reduce((s, r) => s + (Number(r.amount) || 0), 0)
      
      // Only add city row if it's different from the province
      if (city.toUpperCase() !== provLabelAl.toUpperCase()) {
        alBody.push({ _kind: 'city', area: city.toUpperCase(), total: list.length, amount: cityAmt.toLocaleString() })
      }

      for (const r of list) {
        alBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          total: 1,
          type: r.type || r.type_of_assistance || '',
          qty: r.qty ?? r.quantity ?? '',
          unit: r.unit || '',
          cost: (r.cost_per_unit ?? r.costPerUnit) != null ? Number(r.cost_per_unit ?? r.costPerUnit).toLocaleString() : '',
          amount: r.amount != null ? Number(r.amount).toLocaleString() : '',
          source: r.source || r.source_of_assistance || '',
          remarks: r.remarks || '',
        })
      }
    }

    alBody.push({ 
      _kind: 'grand', 
      area: 'GRAND TOTAL', 
      total: alRows.length, 
      amount: alGrandTotalAmt.toLocaleString() 
    })

    const alColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'TOTAL', dataKey: 'total' },
      { header: 'TYPE', dataKey: 'type' },
      { header: 'QTY', dataKey: 'qty' },
      { header: 'UNIT', dataKey: 'unit' },
      { header: 'COST PER UNIT', dataKey: 'cost' },
      { header: 'AMOUNT', dataKey: 'amount' },
      { header: 'SOURCE', dataKey: 'source' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const alDataCols = 7
    const alDataW = landscapeDataColWidth(alDataCols)
    autoTable(doc, {
      startY: ly,
      columns: alColumns,
      body: alBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7, lineWidth: 0.3, lineColor: [0, 0, 0], cellPadding: 1.5, valign: 'top', textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.6, lineColor: [0, 0, 0] },
      didParseCell: (data) => {
        const kind = data.row?.raw?._kind
        if (kind === 'grand' || kind === 'region' || kind === 'province' || kind === 'city') {
          data.cell.styles.fillColor = ROW_COLORS[kind === 'grand' ? 'grandTotal' : kind]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Agriculture Damage detailed table
  // =========================
  if (agricultureDamageDetails && agricultureDamageDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Agriculture Damage', ly)

    const provLabelAd = String(province || 'PROVINCE').toUpperCase()
    const adRows = [...agricultureDamageDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const adByCity = new Map()
    for (const r of adRows) {
      const city = String(r.city || 'Unknown')
      if (!adByCity.has(city)) adByCity.set(city, [])
      adByCity.get(city).push(r)
    }

    const adBody = []
    const sumAd = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0)
    const grandFarmers = sumAd(adRows, 'farmers_affected')
    const grandLoss = adRows.reduce((s, r) => s + Number(r.production_loss_value || r.value_loss || r.cost_of_damage || 0), 0)

    adBody.push({ _kind: 'region', area: 'REGION 1', farmers: grandFarmers, loss: grandLoss.toLocaleString() })
    adBody.push({ _kind: 'province', area: provLabelAd, farmers: grandFarmers, loss: grandLoss.toLocaleString() })

    for (const [city, list] of Array.from(adByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityFarmers = sumAd(list, 'farmers_affected')
      const cityLoss = sumAd(list, 'production_loss_value') || sumAd(list, 'value_loss') || sumAd(list, 'cost_of_damage')
      
      // Only add city row if it's different from the province
      if (city.toUpperCase() !== provLabelAd.toUpperCase()) {
        adBody.push({ _kind: 'city', area: city.toUpperCase(), farmers: cityFarmers, loss: cityLoss.toLocaleString() })
      }

      for (const r of list) {
        adBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          farmers: n(r.farmers_affected),
          area_total: n(r.area_affected || r.area_total).toLocaleString(),
          totally: n(r.area_totally_damaged).toLocaleString(),
          partially: n(r.area_partially_damaged).toLocaleString(),
          loss: n(r.value_loss || r.production_loss_value || r.cost_of_damage).toLocaleString(),
          remarks: r.remarks || '',
        })
      }
    }

    adBody.push({ 
      _kind: 'grand', 
      area: 'GRAND TOTAL', 
      farmers: grandFarmers, 
      loss: grandLoss.toLocaleString() 
    })

    const adColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'FARMERS AFFECTED', dataKey: 'farmers' },
      { header: 'AREA TOTAL', dataKey: 'area_total' },
      { header: 'AREA TOTALLY', dataKey: 'totally' },
      { header: 'AREA PARTIALLY', dataKey: 'partially' },
      { header: 'LOSS VALUE', dataKey: 'loss' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const adDataCols = 6
    const adDataW = landscapeDataColWidth(adDataCols)
    autoTable(doc, {
      startY: ly,
      columns: adColumns,
      body: adBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 6.8, lineWidth: 0.3, lineColor: [0, 0, 0], cellPadding: 1.4, valign: 'top', textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.6, lineColor: [0, 0, 0] },
      didParseCell: (data) => {
        const kind = data.row?.raw?._kind
        if (kind === 'grand' || kind === 'region' || kind === 'province' || kind === 'city') {
          data.cell.styles.fillColor = ROW_COLORS[kind === 'grand' ? 'grandTotal' : kind]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  // =========================
  // LANDSCAPE: Infrastructure Damage detailed table
  // =========================
  if (infrastructureDamageDetails && infrastructureDamageDetails.length > 0) {
    if (!lastLandscapePageNumber) {
      doc.addPage('a4', 'landscape')
      lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
      lastLandscapeY = null
    } else {
      doc.setPage(lastLandscapePageNumber)
    }

    const lPageH = doc.internal.pageSize.getHeight()
    let ly = lastLandscapeY ? lastLandscapeY + 16 : margin
    if (ly + 28 > lPageH - margin) {
      doc.addPage('a4', 'landscape')
      ly = margin
    }

    ly = addLandscapeTitle('Infrastructure Damage', ly)

    const provLabelId = String(province || 'PROVINCE').toUpperCase()
    const idRows = [...infrastructureDamageDetails].filter((r) => r && r.city).sort((a, b) => {
      const c = String(a.city).localeCompare(String(b.city))
      if (c !== 0) return c
      return String(a.barangay || '').localeCompare(String(b.barangay || ''))
    })

    const idByCity = new Map()
    for (const r of idRows) {
      const city = String(r.city || 'Unknown')
      if (!idByCity.has(city)) idByCity.set(city, [])
      idByCity.get(city).push(r)
    }

    const idBody = []
    const sumId = (list, key) => list.reduce((s, r) => s + Number(r[key] || 0), 0)
    const grandCost = idRows.reduce((s, r) => s + Number(r.cost || r.estimated_cost || 0), 0)
    const grandQuantity = idRows.reduce((s, r) => s + Number(r.quantity || 0), 0)

    idBody.push({ _kind: 'region', area: 'REGION 1', cost: grandCost.toLocaleString() })
    idBody.push({ _kind: 'province', area: provLabelId, cost: grandCost.toLocaleString() })

    for (const [city, list] of Array.from(idByCity.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const cityCost = list.reduce((s, r) => s + Number(r.cost || r.estimated_cost || 0), 0)
      
      // Only add city row if it's different from the province
      if (city.toUpperCase() !== provLabelId.toUpperCase()) {
        idBody.push({ _kind: 'city', area: city.toUpperCase(), cost: cityCost.toLocaleString() })
      }

      for (const r of list) {
        idBody.push({
          _kind: 'detail',
          area: `   ${r.barangay || ''}`.trimEnd(),
          infra: r.infrastructure_name || r.infra_name || '',
          type: r.type || r.infra_type || '',
          classification: r.damage_description || r.classification || '',
          quantity: r.quantity || '',
          cost: n(r.cost || r.estimated_cost).toLocaleString(),
          remarks: r.remarks || '',
        })
      }
    }

    idBody.push({ 
      _kind: 'grand', 
      area: 'GRAND TOTAL', 
      cost: grandCost.toLocaleString() 
    })

    const idColumns = [
      { header: 'REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', dataKey: 'area' },
      { header: 'INFRA TYPE', dataKey: 'type' },
      { header: 'INFRASTRUCTURE NAME', dataKey: 'infra' },
      { header: 'DAMAGE DESCRIPTION', dataKey: 'classification' },
      { header: 'QUANTITY', dataKey: 'quantity' },
      { header: 'ESTIMATED COST', dataKey: 'cost' },
      { header: 'REMARKS', dataKey: 'remarks' },
    ]

    const idDataCols = 6
    const idDataW = landscapeDataColWidth(idDataCols)
    autoTable(doc, {
      startY: ly,
      columns: idColumns,
      body: idBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7, lineWidth: 0.3, lineColor: [0, 0, 0], cellPadding: 1.5, valign: 'top', textColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.6, lineColor: [0, 0, 0] },
      didParseCell: (data) => {
        const kind = data.row?.raw?._kind
        if (kind === 'grand' || kind === 'region' || kind === 'province' || kind === 'city') {
          data.cell.styles.fillColor = ROW_COLORS[kind === 'grand' ? 'grandTotal' : kind]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      pageBreak: 'auto',
    })

    lastLandscapePageNumber = doc.internal.getCurrentPageInfo().pageNumber
    lastLandscapeY = doc.lastAutoTable.finalY
  }

  addPageNumbers()

  return doc
}

