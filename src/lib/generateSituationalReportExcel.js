/**
 * Generate RDRRMC-style situational report Excel using xlsx.
 * Exports data to Excel format matching the PDF structure with formatting.
 */
import XLSX from 'xlsx-js-style';

export function generateSituationalReportExcel({
  eventName,
  province,
  period,
  grandTotal,
  categoryTotals,
  byCityCategory,
  cities,
}) {
  const workbook = XLSX.utils.book_new();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  // Main Report Sheet
  const mainData = [
    ['Regional Disaster Risk Reduction and Management Council 1'],
    [eventName || 'TYPHOON'],
    ['Region 1'],
    [`Situational Report for the Effects of ${eventName || 'TYPHOON'} in ${province}`],
    [`${dateStr} ${timeStr}`],
    [],
    [`Period Covered: ${period} | Grand Total Reports: ${grandTotal}`],
    [],
  ];

  // Add all sections to main sheet
  const allSections = [
    createRelatedIncidentsSection(categoryTotals, byCityCategory, cities, province),
    createAffectedPopulationSection(categoryTotals, byCityCategory, cities),
    createRoadsAndBridgesSection(categoryTotals, byCityCategory, cities),
    createPowerSection(categoryTotals, byCityCategory, cities),
    createWaterSupplySection(categoryTotals, byCityCategory, cities),
    createCommunicationLinesSection(categoryTotals, byCityCategory, cities),
    createDamagedHousesSection(categoryTotals, byCityCategory, cities),
    createClassSuspensionSection(categoryTotals, byCityCategory, cities),
    createWorkSuspensionSection(categoryTotals, byCityCategory, cities),
    createStateOfCalamitySection(categoryTotals, byCityCategory, cities),
    createPreEmptiveEvacuationSection(categoryTotals, byCityCategory, cities),
    createAssistanceProvidedSection(categoryTotals, byCityCategory, cities),
  ];

  let currentData = [...mainData];
  for (const section of allSections) {
    currentData.push(...section);
    currentData.push([]); // Add spacing between sections
  }

  // Add footer
  currentData.push([]);
  currentData.push(['Prepared by:', 'Noted by:', 'Approved by:']);
  currentData.push([]);
  currentData.push(['Telephone Number: (072) 619-5624; (072) 607-6528 | Mobile Numbers: 0917-300-5096 (Globe); 0999-221-8715 (Smart)']);
  currentData.push(['E-mail Addresses: region1@ocd.gov.ph; ocdrc1@yahoo.com | Facebook: Civil Defense Ilocos']);
  currentData.push(['Website: www.ocd.gov.ph; www.ndrrmc.gov.ph']);

  const mainSheet = XLSX.utils.aoa_to_sheet(currentData);
  mainSheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Situational Report');

  // Summary Sheet
  const summaryData = [
    ['RDRRMC Region I - Situational Report Summary'],
    [],
    ['Report Information'],
    ['Province', province],
    ['Period Covered', period],
    ['Grand Total Reports', grandTotal],
    ['Generated', `${dateStr} ${timeStr}`],
    [],
    ['Category Breakdown'],
    ['Category', 'Total'],
    ...Object.entries(categoryTotals).map(([cat, total]) => [formatCategoryName(cat), total]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // By LGU Sheet
  const cityHeaders = ['LGU / Municipality', ...Object.keys(categoryTotals).map(formatCategoryName)];
  const cityData = [
    cityHeaders,
    ...cities.map((city) => [
      city === 'N/A' ? 'All areas' : city,
      ...Object.keys(categoryTotals).map((cat) => byCityCategory[city]?.[cat] || 0),
    ]),
  ];

  const citySheet = XLSX.utils.aoa_to_sheet(cityData);
  citySheet['!cols'] = [{ wch: 25 }, ...Array(Object.keys(categoryTotals).length).fill({ wch: 15 })];
  XLSX.utils.book_append_sheet(workbook, citySheet, 'By LGU');

  return workbook;
}

function createRelatedIncidentsSection(categoryTotals, byCityCategory, cities, province) {
  const data = [
    ['RELATED INCIDENTS'],
    [`The following incidents were reported in some areas of ${province}.`],
    [],
    ['PROVINCE', 'Flooded', 'Subsided', 'Receding', 'Fallen Debris/Trees', 'Storm Surge'],
    ['TOTAL', categoryTotals.relatedIncidents || 0, 0, 0, 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.relatedIncidents || 0) > 0) {
      data.push([
        city === 'N/A' ? 'All areas' : city,
        byCityCategory[city]?.relatedIncidents || 0,
        0,
        0,
        0,
        0,
      ]);
    }
  }

  data.push(['Source: PDRRMOs, Ongoing validation of data']);
  return data;
}

function createAffectedPopulationSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['AFFECTED POPULATION'],
    [`A total of ${categoryTotals.affectedPopulation || 0} families or ${(categoryTotals.affectedPopulation || 0) * 5} persons were affected.`],
    [],
    ['PROVINCE', 'BRGY', 'FAMILIES AFFECTED', 'PERSONS AFFECTED', 'NO. OF ECs', 'INSIDE ECs FAMILIES', 'INSIDE ECs PERSONS', 'OUTSIDE ECs FAMILIES', 'OUTSIDE ECs PERSONS'],
    ['TOTAL', '', categoryTotals.affectedPopulation || 0, (categoryTotals.affectedPopulation || 0) * 5, 0, 0, 0, 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.affectedPopulation || 0) > 0) {
      const fam = byCityCategory[city]?.affectedPopulation || 0;
      data.push([city === 'N/A' ? 'All areas' : city, '', fam, fam * 5, 0, 0, 0, 0, 0]);
    }
  }

  data.push(['Source: DSWD FO1']);
  return data;
}

function createRoadsAndBridgesSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['ROADS AND BRIDGES'],
    [`A total of ${categoryTotals.roadsAndBridges || 0} road sections were affected. Below is the current status:`],
    [],
    ['PROVINCE', 'NOT PASSABLE BRIDGES', 'NOT PASSABLE ROADS', 'PASSABLE BRIDGES', 'PASSABLE ROADS'],
    ['GRAND TOTAL', 0, categoryTotals.roadsAndBridges || 0, 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.roadsAndBridges || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, 0, byCityCategory[city]?.roadsAndBridges || 0, 0, 0]);
    }
  }

  data.push(['Source: PDRRMO and DPWH']);
  return data;
}

function createPowerSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['POWER'],
    [`A total of ${categoryTotals.power || 0} cities/municipalities were affected. Below is the current status of power supply:`],
    [],
    ['PROVINCE', 'INTERRUPTED', 'RESTORED'],
    ['GRAND TOTAL', categoryTotals.power || 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.power || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.power || 0, 0]);
    }
  }

  data.push(['Source: PDRRMOs, DOE']);
  return data;
}

function createWaterSupplySection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['WATER SUPPLY'],
    [`A total of ${categoryTotals.waterSupply || 0} cities/municipalities were affected. Below is the current status of water supply:`],
    [],
    ['PROVINCE', 'INTERRUPTED', 'RESTORED'],
    ['GRAND TOTAL', categoryTotals.waterSupply || 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.waterSupply || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.waterSupply || 0, 0]);
    }
  }

  data.push(['Source: PDRRMO Pangasinan / LGU Water Offices']);
  return data;
}

function createCommunicationLinesSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['COMMUNICATION LINES'],
    [`A total of ${categoryTotals.communicationLines || 0} cities/municipalities were affected. Below is the current status of communication lines:`],
    [],
    ['REGION / PROVINCE', 'WITHOUT COMMUNICATION', 'RESTORED COMMUNICATION LINES'],
    ['GRAND TOTAL', categoryTotals.communicationLines || 0, 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.communicationLines || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.communicationLines || 0, 0]);
    }
  }

  data.push(['Source: PDRRMOs']);
  return data;
}

function createDamagedHousesSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['DAMAGED HOUSES'],
    [`A total of ${categoryTotals.damagedHouses || 0} damaged houses are reported.`],
    [],
    ['PROVINCE', 'TOTALLY DAMAGED', 'PARTIALLY DAMAGED', 'TOTAL'],
    ['GRAND TOTAL', categoryTotals.damagedHouses || 0, 0, categoryTotals.damagedHouses || 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.damagedHouses || 0) > 0) {
      const tot = byCityCategory[city]?.damagedHouses || 0;
      data.push([city === 'N/A' ? 'All areas' : city, tot, 0, tot]);
    }
  }

  data.push(['Source: DSWD FO1']);
  return data;
}

function createClassSuspensionSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['CLASS SUSPENSION'],
    ['Classes were suspended in the following areas:'],
    [],
    ['PROVINCE', 'NO. OF CITIES/MUNICIPALITIES WITH SUSPENSION'],
    ['GRAND TOTAL', categoryTotals.classSuspension || 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.classSuspension || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.classSuspension || 0]);
    }
  }

  data.push(['Source: PDRRMOs / DepEd']);
  return data;
}

function createWorkSuspensionSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['WORK SUSPENSION'],
    ['Work were suspended in the following areas:'],
    [],
    ['PROVINCE', 'NO. OF CITIES/MUNICIPALITIES WITH SUSPENSION'],
    ['GRAND TOTAL', categoryTotals.workSuspension || 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.workSuspension || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.workSuspension || 0]);
    }
  }

  data.push(['Source: PDRRMOs']);
  return data;
}

function createStateOfCalamitySection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['DECLARATION OF STATE OF CALAMITY'],
    [`A total of ${categoryTotals.stateOfCalamity || 0} cities/municipalities were declared under the State of Calamity.`],
    [],
    ['PROVINCE', 'NO. OF CITIES / MUNICIPALITIES'],
    ['GRAND TOTAL', categoryTotals.stateOfCalamity || 0],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.stateOfCalamity || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.stateOfCalamity || 0]);
    }
  }

  data.push(['Source: PDRRMOs, LGUs']);
  return data;
}

function createPreEmptiveEvacuationSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['PRE-EMPTIVE EVACUATION'],
    [`A total of ${categoryTotals.preEmptiveEvacuation || 0} families or ${(categoryTotals.preEmptiveEvacuation || 0) * 5} persons were pre-emptively evacuated:`],
    [],
    ['PROVINCE', 'NO. OF FAMILIES', 'NO. OF PERSONS'],
    ['GRAND TOTAL', categoryTotals.preEmptiveEvacuation || 0, (categoryTotals.preEmptiveEvacuation || 0) * 5],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.preEmptiveEvacuation || 0) > 0) {
      const fam = byCityCategory[city]?.preEmptiveEvacuation || 0;
      data.push([city === 'N/A' ? 'All areas' : city, fam, fam * 5]);
    }
  }

  data.push(['Source: PDRRMOs, LGU, DILG']);
  return data;
}

function createAssistanceProvidedSection(categoryTotals, byCityCategory, cities) {
  const data = [
    ['ASSISTANCE PROVIDED TO AFFECTED FAMILIES'],
    ['Below are summary figures for assistance provided to affected families:'],
    [],
    ['PROVINCE', 'NO. OF FAMILIES ASSISTED', '% OF FAMILIES ASSISTED'],
    ['GRAND TOTAL', categoryTotals.assistanceProvided || 0, '0.00'],
  ];

  for (const city of cities) {
    if ((byCityCategory[city]?.assistanceProvided || 0) > 0) {
      data.push([city === 'N/A' ? 'All areas' : city, byCityCategory[city]?.assistanceProvided || 0, '0.00']);
    }
  }

  data.push(['Source: DSWD']);
  return data;
}

function formatCategoryName(cat) {
  const names = {
    relatedIncidents: 'Related Incidents',
    affectedPopulation: 'Affected Population',
    roadsAndBridges: 'Roads and Bridges',
    power: 'Power',
    waterSupply: 'Water Supply',
    communicationLines: 'Communication Lines',
    damagedHouses: 'Damaged Houses',
    classSuspension: 'Class Suspension',
    workSuspension: 'Work Suspension',
    stateOfCalamity: 'Declaration of State of Calamity',
    preEmptiveEvacuation: 'Pre-emptive Evacuation',
    assistanceProvided: 'Assistance Provided',
  };
  return names[cat] || cat;
}
