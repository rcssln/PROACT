import XLSX from 'xlsx-js-style';

/**
 * Generate a Consolidated Report in Excel format using xlsx-js-style.
 * Optimized for better layout, column widths, and readability.
 */
export function generateConsolidatedExcel({
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
    summaryText = '',
    signatories = {},
}) {
    const workbook = XLSX.utils.book_new();

    // Define standard styles
    const headerStyle = {
        fill: { fgColor: { rgb: "FFFFFF" } }, // White background for PDF-style
        font: { color: { rgb: "000000" }, bold: true, sz: 10 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
            top: { style: "medium", color: { rgb: "000000" } },
            bottom: { style: "medium", color: { rgb: "000000" } },
            left: { style: "medium", color: { rgb: "000000" } },
            right: { style: "medium", color: { rgb: "000000" } }
        }
    };

    const dataStyle = {
        font: { sz: 9 },
        alignment: { vertical: "center", wrapText: true },
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    };

    const titleStyle = {
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "left" },
        fill: { fgColor: { rgb: "FFF380" } } // Light Yellow title bar
    };

    const ROW_COLORS = {
        grandTotal: { rgb: "FFFFA0" }, // Yellow
        region: { rgb: "AAFFF0" },     // Light Cyan/Green
        province: { rgb: "FFDCE6" },   // Light Pink
        city: { rgb: "F0F0F0" },       // Gray
    };

    const boldDataStyle = {
        font: { bold: true, sz: 9 },
        alignment: { vertical: "center", wrapText: true },
        border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        }
    };

    // Helper to format date/time
    const formatDate = (v) => {
        if (!v) return '';
        const d = new Date(v);
        return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-PH', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const formatTime = (v) => {
        if (!v) return '';
        const s = String(v);
        if (s.includes(':')) {
            const [h, m] = s.split(':');
            const hour = parseInt(h, 10);
            if (!isNaN(hour)) {
                const ampm = hour >= 12 ? 'pm' : 'am';
                const h12 = hour % 12 || 12;
                return `${h12}:${m ? m.split(':')[0] : '00'} ${ampm}`;
            }
        }
        return s;
    };

    // Helper to add a sheet with auto-width and title merging
    const addFormattedSheet = (name, data, colWidths = [], merges = [], headerRows = 1) => {
        const sheet = XLSX.utils.aoa_to_sheet(data);

        // Apply styles to cells
        const range = XLSX.utils.decode_range(sheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!sheet[cellRef]) continue;

                const val = String(data[R][C] || '');
                const trimmedVal = val.trim();

                // 1. Detailed report Titles (e.g. "DETAILED REPORT: ...")
                if (R === 0 && val.includes('DETAILED REPORT')) {
                    sheet[cellRef].s = titleStyle;
                    continue;
                }

                // 2. Overview Intro Titles
                if (name === 'Overview' && R < 5) {
                    sheet[cellRef].s = { ...titleStyle, fill: undefined, alignment: { horizontal: "center" } };
                    continue;
                }

                // 3. Section Headers (I. II. III. IV.)
                if (val.startsWith('I. ') || val.startsWith('II. ') || val.startsWith('III. ') || val.startsWith('IV. ')) {
                    sheet[cellRef].s = {
                        ...headerStyle,
                        fill: { fgColor: { rgb: "FFF380" } },
                        alignment: { horizontal: "center" }
                    };
                    continue;
                }

                // 4. Table Headers (multi-row)
                const isHeaderRow = R < headerRows + (data[0][0]?.includes('DETAILED REPORT') ? 1 : 0);
                if (isHeaderRow || val === 'LGU / Municipality' || val === 'Category') {
                    sheet[cellRef].s = headerStyle;
                    continue;
                }

                // 5. Hierarchical Rows (Region, Province, City, Grand Total)
                let rowStyle = { ...dataStyle };
                let isBoldRow = false;

                if (trimmedVal === 'GRAND TOTAL' || (C === 0 && trimmedVal === 'TOTAL')) {
                    rowStyle.fill = { fgColor: ROW_COLORS.grandTotal };
                    isBoldRow = true;
                } else if (trimmedVal === 'REGION 1') {
                    rowStyle.fill = { fgColor: ROW_COLORS.region };
                    isBoldRow = true;
                } else if (trimmedVal === String(province || '').toUpperCase() && trimmedVal !== '') {
                    rowStyle.fill = { fgColor: ROW_COLORS.province };
                    isBoldRow = true;
                } else if (!val.startsWith('   ') && trimmedVal === trimmedVal.toUpperCase() && trimmedVal !== '' && isNaN(trimmedVal)) {
                    // This matches City names in detailed reports
                    rowStyle.fill = { fgColor: ROW_COLORS.city };
                    isBoldRow = true;
                }

                if (isBoldRow) {
                    rowStyle.font = { ...rowStyle.font, bold: true };
                }

                // Apply Indentation for barangay rows (they start with space in our data injection)
                if (val.startsWith('   ')) {
                    rowStyle.alignment = { ...rowStyle.alignment, indent: 1 };
                }

                sheet[cellRef].s = rowStyle;
            }
        }

        // Auto-calculate widths
        if (colWidths.length === 0 && data.length > 0) {
            const cols = [];
            data.forEach(row => {
                row.forEach((cell, i) => {
                    const val = cell ? String(cell).length : 0;
                    if (!cols[i] || val > cols[i]) cols[i] = val;
                });
            });
            sheet['!cols'] = cols.map(w => ({ wch: Math.min(Math.max(w + 2, 10), 50) }));
        } else if (colWidths.length > 0) {
            sheet['!cols'] = colWidths.map(w => ({ wch: w }));
        }

        if (merges.length > 0) {
            sheet['!merges'] = merges;
        }

        XLSX.utils.book_append_sheet(workbook, sheet, name);
        return sheet;
    };

    // --- SHEET 1: OVERVIEW (Summary + Breakdown) ---
    const overviewData = [
        ['REGIONAL DISASTER RISK REDUCTION AND MANAGEMENT COUNCIL 1'],
        [eventName?.toUpperCase() || 'SITUATIONAL REPORT'],
        [province || 'Region 1'],
        [`Situational Report for the Effects of ${eventName || 'the Event'}`],
        [new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })],
        [],
        ['I. EXECUTIVE SUMMARY'],
        [],
    ];

    if (summaryText) {
        summaryText.split('\n').filter(l => l.trim()).forEach(line => overviewData.push([line.trim()]));
    } else {
        overviewData.push(['No executive summary available.']);
    }

    overviewData.push([], ['II. AGGREGATE SUMMARY'], ['Category', 'Grand Total']);

    Object.entries(categoryTotals || {}).forEach(([cat, val]) => {
        const label = formatCategoryLabel(cat);
        let total = (typeof val === 'object' && val !== null) ? (val.total || val.families || 0) : (val || 0);
        overviewData.push([label, total]);
    });

    overviewData.push([], ['III. LGU BREAKDOWN']);
    const lguHead = ['LGU / Municipality', ...Object.keys(categoryTotals).map(formatCategoryLabel)];
    overviewData.push(lguHead);

    cities.forEach(city => {
        overviewData.push([
            city === 'N/A' ? 'All areas' : city,
            ...Object.keys(categoryTotals).map(cat => {
                const val = byCityCategory[city]?.[cat];
                return (typeof val === 'object' && val !== null) ? (val.total || val.families || 0) : (val || 0);
            })
        ]);
    });

    const lguTotalsRow = ['GRAND TOTAL', ...Object.keys(categoryTotals).map(cat => {
        const val = categoryTotals[cat];
        return (typeof val === 'object' && val !== null) ? (val.total || val.families || 0) : (val || 0);
    })];
    overviewData.push([], lguTotalsRow);

    overviewData.push([], ['IV. SIGNATORIES'], ['Role', 'Name / Designation']);
    overviewData.push(['Prepared by:', signatories?.preparedBy?.map(s => s.name).join('; ') || 'N/A']);
    overviewData.push(['Noted by:', signatories?.notedBy ? signatories.notedBy.name : 'N/A']);
    overviewData.push(['Approved by:', signatories?.approvedBy ? signatories.approvedBy.name : 'N/A']);

    // Merges for Overview Sheet
    const overviewMerges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 5 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 5 } },
    ];

    addFormattedSheet('Overview', overviewData, [40, 20, 15, 15, 15, 15], overviewMerges);

    // --- DETAILED SHEETS ---

    // 1. Related Incidents
    if (relatedIncidentsDetails?.length > 0) {
        const header = [
            ['DETAILED REPORT: RELATED INCIDENTS'],
            ['REGION | PROVINCE | CITY / MUNICIPALITY |\nBARANGAY', 'TOTAL', 'TYPE OF INCIDENT', 'DATE OF\nOCCURRENCE', 'TIME OF\nOCCURRENCE', 'DESCRIPTION', 'ACTIONS TAKEN', 'REMARKS', 'STATUS (for flooded areas)']
        ];

        const body = [];
        const grandTotal = relatedIncidentsDetails.length;

        // Add Hierarchical rows
        body.push(['REGION 1', grandTotal, '', '', '', '', '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '', '', '', '', '']);

        const byCity = {};
        relatedIncidentsDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const cityRows = byCity[city];
            body.push([city.toUpperCase(), cityRows.length, '', '', '', '', '', '', '']);
            cityRows.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.type_of_incident || r.incident_type || '',
                    formatDate(r.date_of_occurrence),
                    formatTime(r.time_of_occurrence),
                    r.description || '',
                    r.actions_taken || '',
                    r.remarks || '',
                    r.status || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '', '', '', '', '']);

        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }
        ];

        addFormattedSheet('Related Incidents', [...header, ...body], [40, 10, 20, 18, 15, 25, 25, 25, 20], merges, 2);
    }

    // 2. Affected Population
    if (affectedPopulationDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: AFFECTED POPULATION'],
            [
                'REGION | PROVINCE | CITY/\nMUNICIPALITY | BARANGAY',
                'TOTAL',
                'NO. OF AFFECTED', '', '',
                'No. of ECs', '',
                'Inside Evacuation Centers', '', '', '',
                'Outside Evacuation Centers', '', '', '',
                'TOTAL SERVED\n(Inside + Outside)', '', '', ''
            ],
            ['', '', 'Brgys.', 'Families', 'Persons', 'CUM', 'NOW', 'Families', '', 'Persons', '', 'Families', '', 'Persons', '', 'Families', '', 'Persons', ''],
            ['', '', '', '', '', '', '', 'CUM', 'NOW', 'CUM', 'NOW', 'CUM', 'NOW', 'CUM', 'NOW', 'CUM', 'NOW', 'CUM', 'NOW']
        ];

        const n = (v) => Number(v || 0);
        const sumEc = (list) => ({
            families: list.reduce((s, r) => s + n(r.families), 0),
            persons: list.reduce((s, r) => s + n(r.persons), 0),
            ecs_cum: list.reduce((s, r) => s + n(r.ecs_cum), 0),
            ecs_now: list.reduce((s, r) => s + n(r.ecs_now), 0),
            in_fam_cum: list.reduce((s, r) => s + n(r.inside_families_cum), 0),
            in_fam_now: list.reduce((s, r) => s + n(r.inside_families_now), 0),
            in_per_cum: list.reduce((s, r) => s + n(r.inside_persons_cum), 0),
            in_per_now: list.reduce((s, r) => s + n(r.inside_persons_now), 0),
            out_fam_cum: list.reduce((s, r) => s + n(r.outside_families_cum), 0),
            out_fam_now: list.reduce((s, r) => s + n(r.outside_families_now), 0),
            out_per_cum: list.reduce((s, r) => s + n(r.outside_persons_cum), 0),
            out_per_now: list.reduce((s, r) => s + n(r.outside_persons_now), 0)
        });

        const makeRow = (label, stats) => [
            label, stats.families, stats.brgys || 0, stats.families, stats.persons, stats.ecs_cum, stats.ecs_now,
            stats.in_fam_cum, stats.in_fam_now, stats.in_per_cum, stats.in_per_now,
            stats.out_fam_cum, stats.out_fam_now, stats.out_per_cum, stats.out_per_now,
            (stats.in_fam_cum + stats.out_fam_cum), (stats.in_fam_now + stats.out_fam_now),
            (stats.in_per_cum + stats.out_per_cum), (stats.in_per_now + stats.out_per_now)
        ];

        const allStats = sumEc(affectedPopulationDetails);
        allStats.brgys = new Set(affectedPopulationDetails.map(r => `${r.city}||${r.barangay}`)).size;

        const body = [];
        body.push(makeRow('REGION 1', allStats));
        body.push(makeRow(String(province || '').toUpperCase(), allStats));

        const byCity = {};
        affectedPopulationDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            const cityStats = sumEc(list);
            cityStats.brgys = new Set(list.map(r => r.barangay)).size;
            body.push(makeRow(city.toUpperCase(), cityStats));

            list.forEach(r => {
                const rStats = sumEc([r]);
                rStats.brgys = 1;
                body.push(makeRow(`   ${r.barangay || ''}`, rStats));
            });
        });

        body.push(makeRow('GRAND TOTAL', allStats));

        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }, // Title
            { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } }, // Area
            { s: { r: 1, c: 1 }, e: { r: 3, c: 1 } }, // Total
            { s: { r: 1, c: 2 }, e: { r: 1, c: 4 } }, // Affected
            { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } }, // ECs
            { s: { r: 1, c: 7 }, e: { r: 1, c: 10 } }, // Inside
            { s: { r: 1, c: 11 }, e: { r: 1, c: 14 } }, // Outside
            { s: { r: 1, c: 15 }, e: { r: 1, c: 18 } }, // Served

            { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } }, // Brgys
            { s: { r: 2, c: 3 }, e: { r: 3, c: 3 } }, // Fam
            { s: { r: 2, c: 4 }, e: { r: 3, c: 4 } }, // Per
            { s: { r: 2, c: 5 }, e: { r: 3, c: 5 } }, // CUM
            { s: { r: 2, c: 6 }, e: { r: 3, c: 6 } }, // NOW

            { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } }, // In Fam
            { s: { r: 2, c: 9 }, e: { r: 2, c: 10 } }, // In Per
            { s: { r: 2, c: 11 }, e: { r: 2, c: 12 } }, // Out Fam
            { s: { r: 2, c: 13 }, e: { r: 2, c: 14 } }, // Out Per
            { s: { r: 2, c: 15 }, e: { r: 2, c: 16 } }, // Served Fam
            { s: { r: 2, c: 17 }, e: { r: 2, c: 18 } }  // Served Per
        ];

        addFormattedSheet('Affected Population', [...head, ...body], [40, 10, 10, 10, 10, 8, 8, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10], merges, 4);
    }

    // 3. Roads and Bridges
    if (roadsAndBridgesDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: ROADS AND BRIDGES'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'TYPE', 'CLASSIFICATION', 'ROAD SECTION/BRIDGE', 'STATUS', 'DATE REPORTED\n(passable)', 'TIME REPORTED\n(passable)', 'DATE REPORTED\n(not passable)', 'TIME REPORTED\n(not passable)', 'REMARKS']
        ];

        const body = [];
        const grandTotal = roadsAndBridgesDetails.length;

        body.push(['REGION 1', grandTotal, '', '', '', '', '', '', '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '', '', '', '', '', '', '']);

        const byCity = {};
        roadsAndBridgesDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            body.push([city.toUpperCase(), list.length, '', '', '', '', '', '', '', '', '']);
            list.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.type || '',
                    r.classification || '',
                    r.road_section_bridge || r.road_section || '',
                    r.status || '',
                    formatDate(r.date_reported_passable),
                    formatTime(r.time_reported_passable),
                    formatDate(r.date_reported_not_passable),
                    formatTime(r.time_reported_not_passable),
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '', '', '', '', '', '', '']);

        addFormattedSheet('Roads and Bridges', [...head, ...body], [40, 10, 12, 15, 25, 12, 18, 15, 18, 15, 25], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }], 1);
    }

    // Generic helper for status-style reports (Power, Water, Comm)
    const addLandscapeStatusSheet = (name, details) => {
        if (!details || details.length === 0) return;

        const head = [
            [`DETAILED REPORT: ${name.toUpperCase()}`],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'TYPE', 'SERVICE PROVIDER', 'DATE OF\nINTERRUPTION', 'TIME OF\nINTERRUPTION', 'DATE\nRESTORED', 'TIME\nRESTORED', 'REMARKS', 'STATUS']
        ];

        const body = [];
        const grandTotal = details.length;

        body.push(['REGION 1', grandTotal, '', '', '', '', '', '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '', '', '', '', '', '']);

        const byCity = {};
        details.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            body.push([city.toUpperCase(), list.length, '', '', '', '', '', '', '', '']);
            list.forEach(r => {
                const dateInter = r.date_of_interruption || r.date_interruption;
                const timeInter = r.time_of_interruption || r.time_interruption;
                const dateRestor = r.date_restored || r.date_restoration;
                const timeRestor = r.time_restored || r.time_restoration;

                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.type || (name === 'Power' ? 'Interruption' : ''),
                    r.service_provider || r.telecompany || '',
                    formatDate(dateInter),
                    formatTime(timeInter),
                    formatDate(dateRestor),
                    formatTime(timeRestor),
                    r.remarks || '',
                    r.status || r.status_of_communication || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '', '', '', '', '', '']);

        addFormattedSheet(name, [...head, ...body], [40, 10, 15, 20, 18, 15, 18, 15, 25, 12], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }], 1);
    };

    addLandscapeStatusSheet('Power', powerDetails);
    addLandscapeStatusSheet('Water Supply', waterSupplyDetails);
    addLandscapeStatusSheet('Communication Lines', communicationLinesDetails);

    // 7. Damaged Houses
    if (damagedHousesDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: DAMAGED HOUSES'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'TOTALLY', 'PARTIALLY', 'TOTAL', 'AMOUNT (PHP)']
        ];

        const body = [];
        const totallyAll = damagedHousesDetails.reduce((s, r) => s + Number(r.totally_damaged || 0), 0);
        const partiallyAll = damagedHousesDetails.reduce((s, r) => s + Number(r.partially_damaged || 0), 0);
        const grandTotal = totallyAll + partiallyAll;

        body.push(['REGION 1', grandTotal, totallyAll, partiallyAll, grandTotal, '']);
        body.push([String(province || '').toUpperCase(), grandTotal, totallyAll, partiallyAll, grandTotal, '']);

        const byCity = {};
        damagedHousesDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            const totallyCity = list.reduce((s, r) => s + Number(r.totally_damaged || 0), 0);
            const partiallyCity = list.reduce((s, r) => s + Number(r.partially_damaged || 0), 0);
            const cityTotal = totallyCity + partiallyCity;

            body.push([city.toUpperCase(), cityTotal, totallyCity, partiallyCity, cityTotal, '']);
            list.forEach(r => {
                const totally = Number(r.totally_damaged || 0);
                const partially = Number(r.partially_damaged || 0);
                body.push([
                    `   ${r.barangay || ''}`,
                    (totally + partially),
                    totally,
                    partially,
                    (totally + partially),
                    ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, totallyAll, partiallyAll, grandTotal, '']);

        addFormattedSheet('Damaged Houses', [...head, ...body], [40, 10, 15, 15, 15, 20], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }], 1);
    }

    // 8. Class Suspension
    if (classSuspensionDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: CLASS SUSPENSION'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'LEVEL FROM', 'LEVEL TO', 'TYPE', 'DATE OF\nSUSPENSION', 'TIME OF\nSUSPENSION', 'DATE\nRESUMED', 'TIME\nRESUMED', 'REMARKS']
        ];

        const body = [];
        const grandTotal = classSuspensionDetails.length;

        body.push(['REGION 1', grandTotal, '', '', '', '', '', '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '', '', '', '', '', '']);

        const byCity = {};
        classSuspensionDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            body.push([city.toUpperCase(), list.length, '', '', '', '', '', '', '', '']);
            list.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.level_from || '',
                    r.level_to || '',
                    r.type || '',
                    formatDate(r.date_of_suspension),
                    formatTime(r.time_of_suspension),
                    formatDate(r.date_resumed),
                    formatTime(r.time_resumed),
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '', '', '', '', '', '']);

        addFormattedSheet('Class Suspension', [...head, ...body], [40, 10, 15, 15, 15, 18, 15, 18, 15, 25], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }], 1);
    }

    // 9. Work Suspension
    if (workSuspensionDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: WORK SUSPENSION'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'TYPE', 'DATE OF\nSUSPENSION', 'TIME OF\nSUSPENSION', 'DATE\nRESUMED', 'TIME\nRESUMED', 'REMARKS']
        ];

        const body = [];
        const grandTotal = workSuspensionDetails.length;

        body.push(['REGION 1', grandTotal, '', '', '', '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '', '', '', '']);

        const byCity = {};
        workSuspensionDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            body.push([city.toUpperCase(), list.length, '', '', '', '', '', '']);
            list.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.type || '',
                    formatDate(r.date_of_suspension),
                    formatTime(r.time_of_suspension),
                    formatDate(r.date_resumed),
                    formatTime(r.time_resumed),
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '', '', '', '']);

        addFormattedSheet('Work Suspension', [...head, ...body], [40, 10, 15, 18, 15, 18, 15, 25], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }], 1);
    }

    // 10. Declaration of State of Calamity
    if (stateOfCalamityDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: DECLARATION OF STATE OF CALAMITY'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL', 'RESOLUTION NUMBER', 'RESOLUTION DATE', 'REMARKS']
        ];

        const body = [];
        const grandTotal = stateOfCalamityDetails.length;

        body.push(['REGION 1', grandTotal, '', '', '']);
        body.push([String(province || '').toUpperCase(), grandTotal, '', '', '']);

        const byCity = {};
        stateOfCalamityDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            body.push([city.toUpperCase(), list.length, '', '', '']);
            list.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    1,
                    r.resolution_number || '',
                    r.resolution_date || '',
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', grandTotal, '', '', '']);

        addFormattedSheet('State of Calamity', [...head, ...body], [40, 10, 20, 20, 30], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }], 1);
    }

    // 11. Pre-emptive Evacuation
    if (preEmptiveEvacuationDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: PRE-EMPTIVE EVACUATION'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'TOTAL FAMILIES', 'TOTAL PERSONS (Est.)', 'REMARKS']
        ];

        const body = [];
        const familiesAll = preEmptiveEvacuationDetails.reduce((s, r) => s + Number(r.families || 0), 0);
        const personsAll = familiesAll * 5;

        body.push(['REGION 1', familiesAll, personsAll, '']);
        body.push([String(province || '').toUpperCase(), familiesAll, personsAll, '']);

        const byCity = {};
        preEmptiveEvacuationDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            const famCity = list.reduce((s, r) => s + Number(r.families || 0), 0);
            const perCity = famCity * 5;
            body.push([city.toUpperCase(), famCity, perCity, '']);
            list.forEach(r => {
                const fam = Number(r.families || 0);
                body.push([
                    `   ${r.barangay || ''}`,
                    fam,
                    fam * 5,
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', familiesAll, personsAll, '']);

        addFormattedSheet('Pre-emptive Evac', [...head, ...body], [40, 15, 18, 30], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }], 1);
    }

    // 12. Assistance Provided
    if (assistanceProvidedDetails?.length > 0) {
        const head = [
            ['DETAILED REPORT: ASSISTANCE PROVIDED'],
            ['REGION | PROVINCE | CITY /\nMUNICIPALITY | BARANGAY', 'FAMILIES ASSISTED', 'COST OF ASSISTANCE (PHP)', 'REMARKS']
        ];

        const body = [];
        const familiesAll = assistanceProvidedDetails.reduce((s, r) => s + Number(r.no_families_assisted || 0), 0);
        const costAll = assistanceProvidedDetails.reduce((s, r) => s + Number(r.fnfi_amount || 0), 0);

        body.push(['REGION 1', familiesAll, costAll, '']);
        body.push([String(province || '').toUpperCase(), familiesAll, costAll, '']);

        const byCity = {};
        assistanceProvidedDetails.forEach(r => {
            const city = r.city || 'Unknown';
            if (!byCity[city]) byCity[city] = [];
            byCity[city].push(r);
        });

        Object.keys(byCity).sort().forEach(city => {
            const list = byCity[city];
            const famCity = list.reduce((s, r) => s + Number(r.no_families_assisted || 0), 0);
            const costCity = list.reduce((s, r) => s + Number(r.fnfi_amount || 0), 0);
            body.push([city.toUpperCase(), famCity, costCity, '']);
            list.forEach(r => {
                body.push([
                    `   ${r.barangay || ''}`,
                    Number(r.no_families_assisted || 0),
                    Number(r.fnfi_amount || 0),
                    r.remarks || ''
                ]);
            });
        });

        body.push(['GRAND TOTAL', familiesAll, costAll, '']);

        addFormattedSheet('Assistance Provided', [...head, ...body], [40, 18, 22, 30], [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }], 1);
    }

    return workbook;
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
    };
    return CATEGORY_LABELS[cat] || cat;
}
