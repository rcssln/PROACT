import { zipSync, strToU8 } from 'fflate';

/**
 * Generate a Consolidated Report as a ZIP file containing separate CSVs for each category.
 * Each CSV follows the structure of the templates provided in the /CSV directory.
 */
export function generateConsolidatedCsv({
    eventName,
    province,
    cities = [],
    categoryTotals = {},
    byCityCategory = {},
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
    signatories = {},
}) {
    const files = {};
    const provinceName = province || 'Region 1';

    // Helper: escape CSV cell value
    const esc = (v) => {
        const s = String(v ?? '').replace(/\r?\n/g, ' ');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    // Helper: format date as m/d/Y
    const formatDate = (v) => {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };

    // Helper: format time as 24:00 (HH:mm)
    const formatTime = (v) => {
        if (!v) return '';
        const s = String(v);
        if (s.includes(':')) {
            const parts = s.split(':');
            return `${parts[0]}:${parts[1] || '00'}`;
        }
        return s;
    };

    const n = (v) => Number(v || 0);

    const createCsv = (headers, rows) => {
        const content = [
            headers.join(','),
            ...rows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        return strToU8('\uFEFF' + content); // Add BOM
    };

    // 1. DISASTER MONITORING.csv
    const overviewRows = [[
        eventName || '',
        summaryText || '',
        '', 
        ''  
    ]];
    files['DISASTER MONITORING.csv'] = createCsv(['EVENT', 'OVERVIEW', 'DATE FROM', 'DATE ENDED'], overviewRows);

    // 2. Roads and Bridges
    if (roadsAndBridgesDetails?.length > 0) {
        const rbHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TYPE', 'CLASSIFICATION', 'ROAD SECTION/BRIDGE', 'STATUS', 'DATE PASSABLE [m/d/Y]', 'TIME PASSABLE [24:00]', 'DATE NOT PASSABLE [m/d/Y]', 'TIME NOT PASSABLE [24:00]', 'REMARKS'];
        const rbRows = roadsAndBridgesDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.type || '',
            r.classification || '',
            r.road_bridge_name || r.road_section_bridge || r.road_section || '',
            r.status || '',
            formatDate(r.date_passable || r.date_reported_passable),
            formatTime(r.time_passable || r.time_reported_passable),
            formatDate(r.date_not_passable || r.date_reported_not_passable),
            formatTime(r.time_not_passable || r.time_reported_not_passable),
            r.remarks || ''
        ]);
        files['Roads and Bridges-Template.csv'] = createCsv(rbHeaders, rbRows);
    }

    // 3. Power
    if (powerDetails?.length > 0) {
        const powerHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TYPE', 'SERVICE PROVIDER', 'DATE OF INTERRUPTION/ OUTAGE [m/d/Y]', 'TIME OF INTERRUPTION/ OUTAGE [24:00]', 'DATE RESTORED [m/d/Y]', 'TIME RESTORED [24:00]', 'REMARKS'];
        const powerRows = powerDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.type || 'Interruption',
            r.service_provider || '',
            formatDate(r.date_interruption || r.date_of_interruption),
            formatTime(r.time_interruption || r.time_of_interruption),
            formatDate(r.date_restored),
            formatTime(r.time_restored),
            r.remarks || ''
        ]);
        files['Power-Template.csv'] = createCsv(powerHeaders, powerRows);
    }

    // 4. Water Supply
    if (waterSupplyDetails?.length > 0) {
        const waterHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TYPE', 'SERVICE PROVIDER', 'DATE OF INTERRUPTION/ OUTAGE [m/d/Y]', 'TIME OF INTERRUPTION/ OUTAGE [24:00]', 'DATE RESTORED', 'TIME RESTORED', 'REMARKS'];
        const waterRows = waterSupplyDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.type || '',
            r.service_provider || '',
            formatDate(r.date_interruption),
            formatTime(r.time_interruption),
            formatDate(r.date_restored),
            formatTime(r.time_restored),
            r.remarks || ''
        ]);
        files['Water Supply-Template.csv'] = createCsv(waterHeaders, waterRows);
    }

    // 5. Communication Lines
    if (communicationLinesDetails?.length > 0) {
        const commHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TELECOMPANY', 'STATUS OF COMMUNICATION', 'DATE INTERRUPTION [m/d/Y]', 'TIME INTERRUPTION [24:00]', 'DATE RESTORATION [m/d/Y]', 'TIME RESTORATION [24:00]', '2G SITE COUNT', '2G WITH COVERAGE', '2G % OF COVERAGE', '3G SITE COUNT', '3G WITH COVERAGE', '3G % OF COVERAGE', '4G SITE COUNT', '4G WITH COVERAGE', '4G % OF COVERAGE', 'REMARKS'];
        const commRows = communicationLinesDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.telecompany || '',
            r.status_of_communication || r.status || '',
            formatDate(r.date_interruption),
            formatTime(r.time_interruption),
            formatDate(r.date_restoration || r.date_restored),
            formatTime(r.time_restoration || r.time_restored),
            r.site_count_2g || '', r.with_coverage_2g || '', r.pct_coverage_2g || '',
            r.site_count_3g || '', r.with_coverage_3g || '', r.pct_coverage_3g || '',
            r.site_count_4g || '', r.with_coverage_4g || '', r.pct_coverage_4g || '',
            r.remarks || ''
        ]);
        files['Communication Lines-Template.csv'] = createCsv(commHeaders, commRows);
    }

    // 6. Damaged Houses
    if (damagedHousesDetails?.length > 0) {
        const houseHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TOTALLY [number]', 'PARTIALLY [number]', 'GRAND TOTAL [number]', 'AMOUNT [number]', 'REMARKS'];
        const houseRows = damagedHousesDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            n(r.totally_damaged),
            n(r.partially_damaged),
            n(r.totally_damaged) + n(r.partially_damaged),
            n(r.amount_php || r.amount),
            r.remarks || ''
        ]);
        const houseContent = [
            ',,,"NO. OF DAMAGED HOUSES",,,,',
            houseHeaders.map(esc).join(','),
            ...houseRows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        files['Damaged Houses-Template.csv'] = strToU8('\uFEFF' + houseContent);
    }

    // 7. Class Suspension
    if (classSuspensionDetails?.length > 0) {
        const classHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'LEVEL FROM', 'LEVEL TO', 'TYPE', 'DATE OF SUSPENSION [m/d/Y]', 'TIME OF SUSPENSION [24:00]', 'DATE RESUMED [m/d/Y]', 'TIME RESUMED [24:00]', 'REMARKS'];
        const classRows = classSuspensionDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.level_from || '',
            r.level_to || '',
            r.type || '',
            formatDate(r.date_of_suspension),
            formatTime(r.time_of_suspension),
            formatDate(r.date_resumed),
            formatTime(r.time_resumed),
            r.remarks || ''
        ]);
        files['Class Suspension-Template.csv'] = createCsv(classHeaders, classRows);
    }

    // 8. Work Suspension
    if (workSuspensionDetails?.length > 0) {
        const workHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TYPE', 'DATE OF SUSPENSION [m/d/Y]', 'TIME OF SUSPENSION [24:00]', 'DATE RESUMED [m/d/Y]', 'TIME RESUMED [24:00]', 'REMARKS'];
        const workRows = workSuspensionDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.type || '',
            formatDate(r.date_of_suspension),
            formatTime(r.time_of_suspension),
            formatDate(r.date_resumed),
            formatTime(r.time_resumed),
            r.remarks || ''
        ]);
        files['Work Suspension-Template.csv'] = createCsv(workHeaders, workRows);
    }

    // 9. Damage and Losses to Agriculture
    if (agricultureDamageDetails?.length > 0) {
        const agriHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'CLASSIFICATION', 'TYPE', 'NO. OF FARMERS/ FISHERFOLK AFFECTED [number]', 'WITH NO CHANCE OF RECOVERY (TOTALLY DAMAGED) [number]', 'WITH CHANCE OF RECOVERY (PARTIALLY DAMAGED) [number]', 'TOTAL [number]', 'TOTALLY DAMAGED [number]', 'PARTIALLY DAMAGED [number]', 'TOTAL [number]', 'PRODUCTION LOSS IN VOLUME (MT) [number]', 'PRODUCTION LOSS / COST OF DAMAGE IN VALUE (PHP) [number]'];
        const agriRows = agricultureDamageDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.classification || '',
            r.commodity_type || r.type || '',
            n(r.farmers_affected),
            n(r.area_totally_damaged),
            n(r.area_partially_damaged),
            n(r.area_totally_damaged) + n(r.area_partially_damaged),
            n(r.infra_totally_damaged),
            n(r.infra_partially_damaged),
            n(r.infra_totally_damaged) + n(r.infra_partially_damaged),
            n(r.production_loss_volume),
            n(r.value_loss || r.production_loss_value)
        ]);
        const agriContent = [
            ',,,,,,"AFFECTED CROP AREA (HA)",,,"NUMBER OF DAMAGED INFRASTRUCTURE, MACHINERIES, EQUIPMENT",,,,',
            agriHeaders.map(esc).join(','),
            ...agriRows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        files['Damage and Losses to Agriculture (2)-Template.csv'] = strToU8('\uFEFF' + agriContent);
    }

    // 10. Damage to Infrastructure
    if (infrastructureDamageDetails?.length > 0) {
        const infraHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'TYPE', 'CLASSIFICATION', 'INFRASTRUCTURE', 'NUMBER OF DAMAGED', 'UNIT', 'QUANTITY [number]', 'STATUS', 'COST(PHP) [number]', 'REMARKS'];
        const infraRows = infrastructureDamageDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            r.infra_type || r.type || '',
            r.classification || '',
            r.infrastructure_name || r.infrastructure || '',
            n(r.number_of_damaged || 1),
            r.unit || '',
            n(r.quantity),
            r.status || '',
            n(r.cost || r.estimated_cost),
            r.remarks || ''
        ]);
        files['Damage to Infrastructure-Template.csv'] = createCsv(infraHeaders, infraRows);
    }

    // 11. Pre-emptive Evacuation
    if (preEmptiveEvacuationDetails?.length > 0) {
        const peHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'FAMILIES [number]', 'MALE [number]', 'FEMALE [number]', 'TOTAL (Note: If the available data is "Total Persons", please input/encode in this column) [number]', 'REMARKS'];
        const peRows = preEmptiveEvacuationDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            n(r.families),
            n(r.male_count || 0),
            n(r.female_count || 0),
            n(r.persons || r.total || (n(r.families) * 5)),
            r.remarks || ''
        ]);
        files['Pre-emptive Evacuation-Template.csv'] = createCsv(peHeaders, peRows);
    }

    // 12. Assistance Provided to Affected Families
    if (assistanceProvidedDetails?.length > 0) {
        const assistHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'NO. OF FAMILIES AFFECTED [number]', 'NEEDS', 'NO. OF FAMILIES REQUIRING ASSISTANCE [number]', 'QTY [number]', 'UNIT', 'COST PER UNIT [number]', 'AMOUNT [number]', 'SOURCE', 'NO. OF FAMILIES ASSISTED [number]', '% OF FAMILIES ASSISTED [number]', 'REMARKS'];
        const assistRows = assistanceProvidedDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            n(r.no_families_affected),
            r.needs || '',
            n(r.no_families_requiring_assistance),
            n(r.qty || r.quantity),
            r.unit || '',
            n(r.cost_per_unit || r.costPerUnit),
            n(r.amount || r.fnfi_amount),
            r.source || '',
            n(r.no_families_assisted),
            n(r.pct_families_assisted),
            r.remarks || ''
        ]);
        const assistContent = [
            ',,,,,,"F/NFIs PROVIDED",,,,,,,',
            assistHeaders.map(esc).join(','),
            ...assistRows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        files['Assistance Provided to Affected Families-Template.csv'] = strToU8('\uFEFF' + assistContent);
    }

    // 13. Assistance Provided to LGUs and Regional Agencies
    if (assistanceLgusDetails?.length > 0) {
        const assistLguHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'NO. OF FAMILIES AFFECTED [number]', 'NO. OF FAMILIES ASSISTED [number]', 'CLUSTER', 'TYPE', 'QTY [number]', 'UNIT', 'COST PER UNIT [number]', 'AMOUNT [number]', 'SOURCE', 'REMARKS'];
        const assistLguRows = assistanceLgusDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            n(r.no_families_affected),
            n(r.no_families_assisted),
            r.cluster || '',
            r.type || '',
            n(r.qty || r.quantity),
            n(r.no_families_assisted),
            n(r.pct_families_assisted),
            r.remarks || ''
        ]);
        const assistLguContent = [
            ',,,,,"NFIs / Services Provided",,,,,,,',
            assistLguHeaders.map(esc).join(','),
            ...assistLguRows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        files['Assistance Provided to LGUs and Regional Agencies-Template.csv'] = strToU8('\uFEFF' + assistLguContent);
    }

    // 14. Affected Population
    if (affectedPopulationDetails?.length > 0) {
        const apHeaders = ['PROVINCE', 'CITY/ MUNICIPALITY', 'BARANGAY', 'Families [number]', 'Persons [number]', 'CUM [number]', 'NOW [number]', 'Fam. CUM [number]', 'Fam. NOW [number]', 'Per. CUM [number]', 'Per. NOW [number]', 'Fam. CUM [number]', 'Fam. NOW [number]', 'Per. CUM [number]', 'Per. NOW [number]', 'Remarks'];
        const apRows = affectedPopulationDetails.map(r => [
            provinceName,
            r.city || 'none',
            r.barangay || 'none',
            n(r.families),
            n(r.persons),
            n(r.ecs_cum),
            n(r.ecs_now),
            n(r.inside_families_cum),
            n(r.inside_families_now),
            n(r.inside_persons_cum),
            n(r.inside_persons_now),
            n(r.outside_families_cum),
            n(r.outside_families_now),
            n(r.outside_persons_cum),
            n(r.outside_persons_now),
            r.remarks || ''
        ]);
        const apContent = [
            ',,,NO. OF AFFECTED,,NO. OF ECs,,INSIDE EVACUATION CENTERS,,,,OUTSIDE EVACUATION CENTERS,,,,',
            apHeaders.map(esc).join(','),
            ...apRows.map(row => row.map(esc).join(','))
        ].join('\r\n');
        files['Affected Population-Template.csv'] = strToU8('\uFEFF' + apContent);
    }

    // Create the ZIP
    const zipped = zipSync(files);
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Consolidated_Report_${(eventName || 'Event').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ───────── Helpers ─────────

function groupByCity(details) {
    const byCity = {};
    details.forEach(r => {
        const city = r.city || 'Unknown';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(r);
    });
    return byCity;
}

function formatCategoryLabel(cat) {
    const CATEGORY_LABELS = {
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
        assistanceLgus: 'Assistance from LGUs/Agencies',
        agricultureDamage: 'Agriculture Damage',
        infrastructureDamage: 'Infrastructure Damage',
    };
    return CATEGORY_LABELS[cat] || cat;
}
