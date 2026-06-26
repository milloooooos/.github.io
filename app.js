/**
 * DOT 用药时长分析工具
 * 核心应用逻辑
 */
(function () {
    'use strict';

    // ===== State =====
    const state = {
        rawData: [],           // All parsed records
        columns: [],           // Column names
        fieldMap: {            // Field mapping
            patient: '',
            date: '',
            quantity: '',
            name: ''
        },
        filteredPatients: [],  // Patients with purchases in selected period
        patientDetails: [],    // Detailed patient data
        dotResult: null,       // Final DOT result
        currentPage: 1,
        pageSize: 20,
        charts: {}             // Chart instances
    };

    // ===== DOM References =====
    const dom = {
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        selectFileBtn: document.getElementById('selectFileBtn'),
        changeFileBtn: document.getElementById('changeFileBtn'),
        uploadInfo: document.getElementById('uploadInfo'),
        uploadSection: document.getElementById('uploadSection'),
        fileName: document.getElementById('fileName'),
        fileStats: document.getElementById('fileStats'),
        dataStatus: document.getElementById('dataStatus'),
        fieldMapping: document.getElementById('fieldMapping'),
        patientField: document.getElementById('patientField'),
        dateField: document.getElementById('dateField'),
        quantityField: document.getElementById('quantityField'),
        nameField: document.getElementById('nameField'),
        filterSection: document.getElementById('filterSection'),
        startMonth: document.getElementById('startMonth'),
        endMonth: document.getElementById('endMonth'),
        analyzeBtn: document.getElementById('analyzeBtn'),
        resultsSection: document.getElementById('resultsSection'),
        resultPeriod: document.getElementById('resultPeriod'),
        resultPatients: document.getElementById('resultPatients'),
        resultPatientsSub: document.getElementById('resultPatientsSub'),
        resultQuantity: document.getElementById('resultQuantity'),
        resultQuantitySub: document.getElementById('resultQuantitySub'),
        resultDot: document.getElementById('resultDot'),
        detailTableBody: document.getElementById('detailTableBody'),
        pagination: document.getElementById('pagination'),
        exportBtn: document.getElementById('exportBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingText: document.getElementById('loadingText'),
        toast: document.getElementById('toast')
    };

    // ===== Utility Functions =====
    function showLoading(text) {
        dom.loadingText.textContent = text || '正在处理数据...';
        dom.loadingOverlay.classList.add('show');
    }

    function hideLoading() {
        dom.loadingOverlay.classList.remove('show');
    }

    function showToast(msg, type) {
        dom.toast.textContent = msg;
        dom.toast.className = 'toast show ' + (type || '');
        setTimeout(function () {
            dom.toast.classList.remove('show');
        }, 3000);
    }

    function formatDate(d) {
        if (!d) return '-';
        var dt = (d instanceof Date) ? d : new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        var y = dt.getFullYear();
        var m = String(dt.getMonth() + 1).padStart(2, '0');
        var day = String(dt.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    function parseDate(val) {
        if (!val) return null;
        if (val instanceof Date) return val;
        // Try Excel serial date number
        if (typeof val === 'number' && val > 20000 && val < 100000) {
            // Excel date serial: days since 1899-12-30
            var date = new Date(Math.round((val - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) return date;
        }
        var d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        // Try common Chinese formats
        var str = String(val).trim();
        var m = str.match(/^(\d{4})[\/\-\.年](\d{1,2})[\/\-\.月]/);
        if (m) {
            var dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1);
            if (!isNaN(dt.getTime())) return dt;
        }
        return null;
    }

    function getMonthKey(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    function getMonthLabel(monthKey) {
        var parts = monthKey.split('-');
        return parts[0] + '年' + parseInt(parts[1]) + '月';
    }

    function toMonthValue(date) {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    function compareMonthKeys(a, b) {
        return a < b ? -1 : (a > b ? 1 : 0);
    }

    // ===== File Upload =====
    function initUpload() {
        dom.selectFileBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            dom.fileInput.click();
        });

        dom.uploadArea.addEventListener('click', function () {
            dom.fileInput.click();
        });

        dom.fileInput.addEventListener('change', function (e) {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        dom.changeFileBtn.addEventListener('click', function () {
            dom.fileInput.click();
        });

        // Drag & drop
        dom.uploadArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            dom.uploadArea.classList.add('dragover');
        });

        dom.uploadArea.addEventListener('dragleave', function () {
            dom.uploadArea.classList.remove('dragover');
        });

        dom.uploadArea.addEventListener('drop', function (e) {
            e.preventDefault();
            dom.uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    function handleFile(file) {
        var ext = file.name.split('.').pop().toLowerCase();
        showLoading('正在读取文件...');

        if (ext === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: function (results) {
                    processData(results.data, results.meta.fields || []);
                },
                error: function (err) {
                    hideLoading();
                    showToast('CSV解析失败: ' + err.message, 'error');
                }
            });
        } else if (ext === 'xlsx' || ext === 'xls') {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var data = new Uint8Array(e.target.result);
                    var workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    var sheetName = workbook.SheetNames[0];
                    var worksheet = workbook.Sheets[sheetName];
                    var jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });
                    var columns = [];
                    if (jsonData.length > 0) {
                        columns = Object.keys(jsonData[0]);
                    }
                    processData(jsonData, columns);
                } catch (err) {
                    hideLoading();
                    showToast('Excel解析失败: ' + err.message, 'error');
                }
            };
            reader.onerror = function () {
                hideLoading();
                showToast('文件读取失败', 'error');
            };
            reader.readAsArrayBuffer(file);
        } else {
            hideLoading();
            showToast('不支持的文件格式，请上传 .xlsx, .xls 或 .csv 文件', 'error');
        }
    }

    function processData(data, columns) {
        if (!data || data.length === 0) {
            hideLoading();
            showToast('文件中没有数据', 'error');
            return;
        }

        state.rawData = data;
        state.columns = columns;

        // Auto-detect fields
        autoDetectFields();

        // Show file info
        dom.fileName.textContent = dom.fileInput.files[0] ? dom.fileInput.files[0].name : '数据已加载';
        dom.fileStats.textContent = '共 ' + data.length.toLocaleString() + ' 条记录，' + columns.length + ' 个字段';
        dom.uploadInfo.style.display = 'block';
        dom.uploadArea.style.display = 'none';
        dom.dataStatus.textContent = '数据已加载 · ' + data.length.toLocaleString() + ' 条';
        dom.dataStatus.classList.add('active');

        // Show field mapping
        populateFieldSelects();
        dom.fieldMapping.style.display = 'block';

        // Show filter section
        populateMonthSelectors();
        dom.filterSection.style.display = 'block';

        hideLoading();
        showToast('数据加载成功！', 'success');

        // Scroll to filter section
        setTimeout(function () {
            dom.filterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }

    // ===== Field Auto-Detection =====
    function autoDetectFields() {
        var cols = state.columns;

        // Patient ID field - priority keywords
        var patientKeywords = ['会员号', '患者', '病人', '卡号', '会员编号', '患者id', '患者编号', 'member', 'patient', 'customer'];
        state.fieldMap.patient = findColumn(cols, patientKeywords) || cols[0];

        // Date field
        var dateKeywords = ['销售时间', '购药时间', '购买时间', '销售日期', '购药日期', '日期', '时间', 'date', 'time'];
        state.fieldMap.date = findColumn(cols, dateKeywords) || cols[0];

        // Quantity field
        var qtyKeywords = ['销售数量', '购药数量', '数量', '购买数量', '支数', '盒数', 'qty', 'quantity', 'count'];
        state.fieldMap.quantity = findColumn(cols, qtyKeywords) || cols[0];

        // Name field
        var nameKeywords = ['会员姓名', '患者姓名', '姓名', '名称', '病人姓名', 'name'];
        state.fieldMap.name = findColumn(cols, nameKeywords) || '';
    }

    function findColumn(cols, keywords) {
        // First pass: exact match (case-insensitive)
        for (var k = 0; k < keywords.length; k++) {
            for (var i = 0; i < cols.length; i++) {
                if (cols[i].toLowerCase().trim() === keywords[k].toLowerCase()) {
                    return cols[i];
                }
            }
        }
        // Second pass: contains match
        for (var k = 0; k < keywords.length; k++) {
            for (var i = 0; i < cols.length; i++) {
                if (cols[i].toLowerCase().indexOf(keywords[k].toLowerCase()) >= 0) {
                    return cols[i];
                }
            }
        }
        return '';
    }

    function populateFieldSelects() {
        var selects = [
            { el: dom.patientField, value: state.fieldMap.patient },
            { el: dom.dateField, value: state.fieldMap.date },
            { el: dom.quantityField, value: state.fieldMap.quantity },
            { el: dom.nameField, value: state.fieldMap.name }
        ];

        selects.forEach(function (s) {
            s.el.innerHTML = '';
            // Add empty option for optional fields
            if (s.el === dom.nameField) {
                var emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '（不使用）';
                s.el.appendChild(emptyOpt);
            }
            state.columns.forEach(function (col) {
                var opt = document.createElement('option');
                opt.value = col;
                opt.textContent = col;
                s.el.appendChild(opt);
            });
            s.el.value = s.value;
        });
    }

    // ===== Month Selectors =====
    function populateMonthSelectors() {
        var dateField = dom.dateField.value || state.fieldMap.date;
        var monthSet = {};

        state.rawData.forEach(function (row) {
            var rawDate = row[dateField];
            var date = parseDate(rawDate);
            if (date) {
                monthSet[getMonthKey(date)] = true;
            }
        });

        var months = Object.keys(monthSet).sort(compareMonthKeys);
        state.availableMonths = months;

        dom.startMonth.innerHTML = '';
        dom.endMonth.innerHTML = '';

        months.forEach(function (m) {
            var opt1 = document.createElement('option');
            opt1.value = m;
            opt1.textContent = getMonthLabel(m);
            dom.startMonth.appendChild(opt1);

            var opt2 = document.createElement('option');
            opt2.value = m;
            opt2.textContent = getMonthLabel(m);
            dom.endMonth.appendChild(opt2);
        });

        // Default: first month to last month
        if (months.length > 0) {
            dom.startMonth.value = months[0];
            dom.endMonth.value = months[months.length - 1];
        }

        // Ensure start <= end
        dom.startMonth.addEventListener('change', function () {
            if (compareMonthKeys(dom.startMonth.value, dom.endMonth.value) > 0) {
                dom.endMonth.value = dom.startMonth.value;
            }
        });

        dom.endMonth.addEventListener('change', function () {
            if (compareMonthKeys(dom.startMonth.value, dom.endMonth.value) > 0) {
                dom.startMonth.value = dom.endMonth.value;
            }
        });
    }

    // ===== Field Change Listeners =====
    function initFieldListeners() {
        [dom.patientField, dom.dateField, dom.quantityField, dom.nameField].forEach(function (el) {
            el.addEventListener('change', function () {
                state.fieldMap.patient = dom.patientField.value;
                state.fieldMap.date = dom.dateField.value;
                state.fieldMap.quantity = dom.quantityField.value;
                state.fieldMap.name = dom.nameField.value;
                // Repopulate month selectors if date field changed
                if (el === dom.dateField) {
                    populateMonthSelectors();
                }
            });
        });
    }

    // ===== DOT Analysis =====
    function initAnalyze() {
        dom.analyzeBtn.addEventListener('click', analyzeData);
        dom.exportBtn.addEventListener('click', exportCSV);
    }

    function analyzeData() {
        var startMonth = dom.startMonth.value;
        var endMonth = dom.endMonth.value;
        var patientField = dom.patientField.value;
        var dateField = dom.dateField.value;
        var qtyField = dom.quantityField.value;
        var nameField = dom.nameField.value;

        if (!patientField || !dateField || !qtyField) {
            showToast('请确保患者标识、购药时间、购药数量字段都已正确映射', 'error');
            return;
        }

        showLoading('正在计算 DOT 指标...');

        // Use setTimeout to allow UI to update
        setTimeout(function () {
            // Step 1: Find patients with purchases in the selected period
            var patientsInPeriod = {};
            state.rawData.forEach(function (row) {
                var rawDate = row[dateField];
                var date = parseDate(rawDate);
                if (!date) return;

                var monthKey = getMonthKey(date);
                if (compareMonthKeys(monthKey, startMonth) >= 0 && compareMonthKeys(monthKey, endMonth) <= 0) {
                    var pid = String(row[patientField] || '').trim();
                    if (pid) {
                        patientsInPeriod[pid] = true;
                    }
                }
            });

            var uniquePatientIds = Object.keys(patientsInPeriod);
            var uniquePatientCount = uniquePatientIds.length;

            if (uniquePatientCount === 0) {
                hideLoading();
                showToast('所选时间段内没有购药记录', 'error');
                return;
            }

            // Step 2: For those patients, get ALL their purchase records (entire dataset)
            var patientData = {};  // pid -> { name, records: [{date, qty}], totalQty, totalVisits, firstDate, lastDate }

            uniquePatientIds.forEach(function (pid) {
                patientData[pid] = {
                    id: pid,
                    name: '',
                    records: [],
                    totalQty: 0,
                    totalVisits: 0,
                    firstDate: null,
                    lastDate: null
                };
            });

            state.rawData.forEach(function (row) {
                var pid = String(row[patientField] || '').trim();
                if (!patientData[pid]) return;

                var rawDate = row[dateField];
                var date = parseDate(rawDate);
                if (!date) return;

                var qty = parseFloat(row[qtyField]) || 0;

                var pd = patientData[pid];
                pd.records.push({ date: date, qty: qty });
                pd.totalQty += qty;
                pd.totalVisits++;

                if (!pd.firstDate || date < pd.firstDate) {
                    pd.firstDate = date;
                }
                if (!pd.lastDate || date > pd.lastDate) {
                    pd.lastDate = date;
                }

                if (!pd.name && nameField) {
                    pd.name = String(row[nameField] || '').trim();
                }
            });

            // Calculate totals
            var totalQuantity = 0;
            var patientDetails = [];

            Object.values(patientData).forEach(function (pd) {
                totalQuantity += pd.totalQty;
                patientDetails.push(pd);
            });

            // Sort by totalQty descending
            patientDetails.sort(function (a, b) {
                return b.totalQty - a.totalQty;
            });

            var dot = totalQuantity / uniquePatientCount;

            state.dotResult = {
                startMonth: startMonth,
                endMonth: endMonth,
                uniquePatientCount: uniquePatientCount,
                totalQuantity: totalQuantity,
                dot: dot,
                patientDetails: patientDetails
            };

            state.patientDetails = patientDetails;
            state.currentPage = 1;

            // Display results
            displayResults();
            hideLoading();
            showToast('分析完成！', 'success');

            // Scroll to results
            setTimeout(function () {
                dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300);
        }, 100);
    }

    // ===== Display Results =====
    function displayResults() {
        var r = state.dotResult;

        dom.resultsSection.style.display = 'block';

        // Summary cards
        dom.resultPeriod.textContent = getMonthLabel(r.startMonth) + ' ~ ' + getMonthLabel(r.endMonth);
        dom.resultPatients.textContent = r.uniquePatientCount.toLocaleString();
        dom.resultPatientsSub.textContent = '筛选时间段内有购药记录';
        dom.resultQuantity.textContent = r.totalQuantity.toLocaleString();
        dom.resultQuantitySub.textContent = '全时段累计购药总支数';
        dom.resultDot.textContent = r.dot.toFixed(2);

        // Render charts
        renderTrendChart();
        renderDotChart();
        renderDistChart();

        // Render table
        renderTable();
    }

    // ===== Trend Chart =====
    function renderTrendChart() {
        var r = state.dotResult;
        var dateField = dom.dateField.value;
        var qtyField = dom.quantityField.value;
        var patientField = dom.patientField.value;

        // Get patient IDs in result
        var patientIds = {};
        r.patientDetails.forEach(function (pd) {
            patientIds[pd.id] = true;
        });

        // Aggregate by month
        var monthlyData = {};
        state.rawData.forEach(function (row) {
            var pid = String(row[patientField] || '').trim();
            if (!patientIds[pid]) return;

            var date = parseDate(row[dateField]);
            if (!date) return;

            var monthKey = getMonthKey(date);
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { qty: 0, patients: {} };
            }
            monthlyData[monthKey].qty += parseFloat(row[qtyField]) || 0;
            monthlyData[monthKey].patients[pid] = true;
        });

        var months = Object.keys(monthlyData).sort(compareMonthKeys);
        var labels = months.map(getMonthLabel);
        var qtyData = months.map(function (m) { return Math.round(monthlyData[m].qty * 100) / 100; });
        var patientData = months.map(function (m) { return Object.keys(monthlyData[m].patients).length; });

        // Highlight selected period
        var bgColors = months.map(function (m) {
            if (compareMonthKeys(m, r.startMonth) >= 0 && compareMonthKeys(m, r.endMonth) <= 0) {
                return 'rgba(37, 99, 235, 0.7)';
            }
            return 'rgba(148, 163, 184, 0.4)';
        });

        if (state.charts.trend) state.charts.trend.destroy();

        var ctx = document.getElementById('trendChart').getContext('2d');
        state.charts.trend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '购药总支数',
                        data: qtyData,
                        backgroundColor: bgColors,
                        borderColor: bgColors.map(function (c) { return c.replace('0.7', '1').replace('0.4', '0.6'); }),
                        borderWidth: 1,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: '活跃患者数',
                        data: patientData,
                        type: 'line',
                        borderColor: '#ea580c',
                        backgroundColor: 'rgba(234, 88, 12, 0.1)',
                        tension: 0.3,
                        yAxisID: 'y1',
                        pointRadius: 3,
                        pointBackgroundColor: '#ea580c',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        labels: { font: { size: 12 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { font: { size: 11 }, maxRotation: 45 }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: '购药总支数', font: { size: 12 } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: '患者数', font: { size: 12 } },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    // ===== DOT Comparison Chart =====
    function renderDotChart() {
        var r = state.dotResult;

        // Calculate monthly DOT for comparison
        var dateField = dom.dateField.value;
        var qtyField = dom.quantityField.value;
        var patientField = dom.patientField.value;

        // Get patient IDs in result
        var patientIds = {};
        r.patientDetails.forEach(function (pd) {
            patientIds[pd.id] = true;
        });

        // Monthly DOT: for each month, count unique patients and their total quantity in that month
        var monthlyDot = {};
        state.rawData.forEach(function (row) {
            var pid = String(row[patientField] || '').trim();
            if (!patientIds[pid]) return;

            var date = parseDate(row[dateField]);
            if (!date) return;

            var monthKey = getMonthKey(date);
            if (!monthlyDot[monthKey]) {
                monthlyDot[monthKey] = { qty: 0, patients: {} };
            }
            monthlyDot[monthKey].qty += parseFloat(row[qtyField]) || 0;
            monthlyDot[monthKey].patients[pid] = true;
        });

        var months = Object.keys(monthlyDot).sort(compareMonthKeys);
        // Filter to selected period for clarity
        var filteredMonths = months.filter(function (m) {
            return compareMonthKeys(m, r.startMonth) >= 0 && compareMonthKeys(m, r.endMonth) <= 0;
        });

        var labels = filteredMonths.map(getMonthLabel);
        var dotData = filteredMonths.map(function (m) {
            var patientCount = Object.keys(monthlyDot[m].patients).length;
            if (patientCount === 0) return 0;
            return Math.round((monthlyDot[m].qty / patientCount) * 100) / 100;
        });

        if (state.charts.dot) state.charts.dot.destroy();

        var ctx = document.getElementById('dotChart').getContext('2d');
        state.charts.dot = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '月度 DOT',
                    data: dotData,
                    backgroundColor: 'rgba(22, 163, 74, 0.7)',
                    borderColor: 'rgba(22, 163, 74, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return 'DOT: ' + ctx.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { font: { size: 11 }, maxRotation: 45 } },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'DOT 值', font: { size: 12 } }
                    }
                }
            }
        });
    }

    // ===== Distribution Chart =====
    function renderDistChart() {
        var r = state.dotResult;

        // Distribution of purchase quantities per patient
        var buckets = [
            { label: '1支', min: 1, max: 1, count: 0 },
            { label: '2-3支', min: 2, max: 3, count: 0 },
            { label: '4-6支', min: 4, max: 6, count: 0 },
            { label: '7-12支', min: 7, max: 12, count: 0 },
            { label: '13-24支', min: 13, max: 24, count: 0 },
            { label: '25-36支', min: 25, max: 36, count: 0 },
            { label: '37支以上', min: 37, max: Infinity, count: 0 }
        ];

        r.patientDetails.forEach(function (pd) {
            var qty = Math.round(pd.totalQty);
            for (var i = 0; i < buckets.length; i++) {
                if (qty >= buckets[i].min && qty <= buckets[i].max) {
                    buckets[i].count++;
                    break;
                }
            }
        });

        var labels = buckets.map(function (b) { return b.label; });
        var counts = buckets.map(function (b) { return b.count; });
        var colors = [
            'rgba(37, 99, 235, 0.7)',
            'rgba(22, 163, 74, 0.7)',
            'rgba(234, 88, 12, 0.7)',
            'rgba(168, 85, 247, 0.7)',
            'rgba(236, 72, 153, 0.7)',
            'rgba(220, 38, 38, 0.7)',
            'rgba(100, 116, 139, 0.7)'
        ];

        if (state.charts.dist) state.charts.dist.destroy();

        var ctx = document.getElementById('distChart').getContext('2d');
        state.charts.dist = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '患者人数',
                    data: counts,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: colors.map(function (c) { return c.replace('0.7', '1'); }),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var pct = ((ctx.parsed.x / r.uniquePatientCount) * 100).toFixed(1);
                                return ctx.parsed.x + ' 人 (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: '患者人数', font: { size: 12 } }
                    },
                    y: {
                        ticks: { font: { size: 12 } }
                    }
                }
            }
        });
    }

    // ===== Detail Table =====
    function renderTable() {
        var details = state.patientDetails;
        var totalPages = Math.ceil(details.length / state.pageSize);
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        var start = (state.currentPage - 1) * state.pageSize;
        var end = Math.min(start + state.pageSize, details.length);
        var pageData = details.slice(start, end);

        var html = '';
        pageData.forEach(function (pd, i) {
            html += '<tr>';
            html += '<td>' + (start + i + 1) + '</td>';
            html += '<td>' + escapeHtml(pd.id) + '</td>';
            html += '<td>' + escapeHtml(pd.name || '-') + '</td>';
            html += '<td>' + formatDate(pd.firstDate) + '</td>';
            html += '<td>' + formatDate(pd.lastDate) + '</td>';
            html += '<td>' + pd.totalVisits + '</td>';
            html += '<td><strong>' + Math.round(pd.totalQty * 100) / 100 + '</strong></td>';
            html += '</tr>';
        });
        dom.detailTableBody.innerHTML = html;

        // Pagination
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            dom.pagination.innerHTML = '<span class="page-info">共 ' + state.patientDetails.length + ' 条记录</span>';
            return;
        }

        var html = '';
        html += '<button class="page-btn" data-page="1" ' + (state.currentPage === 1 ? 'disabled' : '') + '>首页</button>';
        html += '<button class="page-btn" data-page="' + (state.currentPage - 1) + '" ' + (state.currentPage === 1 ? 'disabled' : '') + '>上一页</button>';

        // Page numbers
        var startPage = Math.max(1, state.currentPage - 2);
        var endPage = Math.min(totalPages, state.currentPage + 2);
        for (var p = startPage; p <= endPage; p++) {
            html += '<button class="page-btn' + (p === state.currentPage ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
        }

        html += '<button class="page-btn" data-page="' + (state.currentPage + 1) + '" ' + (state.currentPage === totalPages ? 'disabled' : '') + '>下一页</button>';
        html += '<button class="page-btn" data-page="' + totalPages + '" ' + (state.currentPage === totalPages ? 'disabled' : '') + '>末页</button>';
        html += '<span class="page-info">第 ' + state.currentPage + '/' + totalPages + ' 页 · 共 ' + state.patientDetails.length + ' 条</span>';

        dom.pagination.innerHTML = html;

        // Bind events
        dom.pagination.querySelectorAll('.page-btn').forEach(function (btn) {
            if (!btn.disabled) {
                btn.addEventListener('click', function () {
                    state.currentPage = parseInt(this.dataset.page);
                    renderTable();
                });
            }
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ===== CSV Export =====
    function exportCSV() {
        if (!state.patientDetails || state.patientDetails.length === 0) {
            showToast('没有可导出的数据', 'error');
            return;
        }

        var r = state.dotResult;
        var rows = [];
        rows.push(['# DOT 分析结果']);
        rows.push(['筛选时间段', getMonthLabel(r.startMonth) + ' ~ ' + getMonthLabel(r.endMonth)]);
        rows.push(['去重患者数', r.uniquePatientCount]);
        rows.push(['累计购药总支数', r.totalQuantity]);
        rows.push(['DOT 值', r.dot.toFixed(2)]);
        rows.push([]);
        rows.push(['序号', '患者标识', '患者姓名', '首次购药时间', '末次购药时间', '购药总次数', '购药总支数']);

        state.patientDetails.forEach(function (pd, i) {
            rows.push([
                i + 1,
                pd.id,
                pd.name || '',
                formatDate(pd.firstDate),
                formatDate(pd.lastDate),
                pd.totalVisits,
                Math.round(pd.totalQty * 100) / 100
            ]);
        });

        var csv = '\uFEFF' + rows.map(function (row) {
            return row.map(function (cell) {
                var s = String(cell);
                if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',');
        }).join('\n');

        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'DOT分析结果_' + r.startMonth + '_' + r.endMonth + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('CSV 导出成功', 'success');
    }

    // ===== Init =====
    function init() {
        initUpload();
        initFieldListeners();
        initAnalyze();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
