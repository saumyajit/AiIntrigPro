/**
 * AI Integration - Latest Data Page Enhancement
 * Runs ONLY on action=latest.view to prevent bleeding onto Problems / Host Search.
 * Per-row sparkle buttons with Zabbix-API-backed z-score anomaly detection.
 */
(function() {
    'use strict';

    // ── Guard: abort immediately on any page that is NOT Latest Data ──────────
    function isLatestDataPage() {
        return window.location.href.includes('action=latest.view') ||
               document.querySelector('[data-page="latest"]') !== null;
    }

    let settings = null;
    let injectionAttempts = 0;
    const MAX_ATTEMPTS = 20;

    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }

    function init() {
        // Hard stop — do NOT set up observers on other pages
        if (!isLatestDataPage()) {
            return;
        }

        const Core = window.AIIntegrationCore;

        Core.loadSettings().then(loadedSettings => {
            settings = loadedSettings;

            if (!settings.quick_actions || !settings.quick_actions.items) {
                console.log('AI Integration: Latest Data quick actions disabled');
                return;
            }

            if (!settings.providers || settings.providers.length === 0) {
                console.log('AI Integration: No providers enabled');
                return;
            }

            console.log('AI Integration: Latest Data page initialized');
            injectLatestDataButtons();

            // Watch for table refresh (Zabbix auto-refresh replaces tbody)
            const observer = new MutationObserver(() => {
                if (injectionAttempts < MAX_ATTEMPTS) {
                    setTimeout(injectLatestDataButtons, 500);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    // ── Table injection ───────────────────────────────────────────────────────

    function injectLatestDataButtons() {
        const table = document.querySelector('table.list-table.compact-view') ||
            Array.from(document.querySelectorAll('table.list-table')).find(t => {
                if (t.closest('.filter-forms') || t.closest('.filter-container')) return false;
                const r = t.querySelector('tbody tr');
                return r && r.querySelectorAll('td').length > 5;
            });

        if (!table) return;
        if (table.closest('.filter-forms') || table.closest('.filter-container')) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Add "AI" header column once
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.aiintegration-header')) {
            const th = document.createElement('th');
            th.className = 'aiintegration-header';
            th.textContent = 'AI';
            th.style.cssText = 'width:50px;text-align:center;';
            thead.appendChild(th);
        }

        let injected = 0;
        tbody.querySelectorAll('tr').forEach(row => {
            if (row.querySelector('.aiintegration-sparkle-btn')) return;

            const td = document.createElement('td');
            td.style.cssText = 'text-align:center;vertical-align:middle;';

            const btn = createSparkleButton();
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                handleItemAnalysis(row);
            });

            td.appendChild(btn);
            row.appendChild(td);
            injected++;
        });

        if (injected > 0) {
            injectionAttempts++;
            console.log(`AI Integration: Injected ${injected} Latest Data buttons`);
        }
    }

    function createSparkleButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aiintegration-sparkle-btn btn-icon';
        btn.title = 'Analyze with AI';
        btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;transition:all 0.2s ease;display:inline-flex;align-items:center;justify-content:center;';

        const uid = Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <defs>
                    <linearGradient id="spk${uid}" x1="2" y1="2" x2="22" y2="22">
                        <stop offset="0%" style="stop-color:#a855f7"/>
                        <stop offset="100%" style="stop-color:#6366f1"/>
                    </linearGradient>
                </defs>
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                      fill="url(#spk${uid})" stroke="#a855f7" stroke-width="1.5"/>
            </svg>`;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.2)';
            const svg = btn.querySelector('svg');
            if (svg) svg.style.filter = 'drop-shadow(0 0 6px #a855f7)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            const svg = btn.querySelector('svg');
            if (svg) svg.style.filter = '';
        });

        return btn;
    }

    // ── Zabbix API helpers ────────────────────────────────────────────────────

    function zabbixApi(method, params) {
        return fetch('api_jsonrpc.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json-rpc' },
            credentials: 'same-origin',
            body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
        })
            .then(r => r.json())
            .then(d => (d && d.result ? d.result : null))
            .catch(() => null);
    }

    /**
     * Fetch up to `limit` history values.
     * Tries history type 0 (float), falls back to 3 (text / string).
     */
    function fetchHistory(itemid, limit) {
        limit = limit || 100;
        return zabbixApi('history.get', {
            itemids: [itemid], history: 0,
            sortfield: 'clock', sortorder: 'DESC',
            limit, output: 'extend'
        }).then(r => {
            if (r && r.length > 0) return { values: r, type: 'float' };
            return zabbixApi('history.get', {
                itemids: [itemid], history: 3,
                sortfield: 'clock', sortorder: 'DESC',
                limit, output: 'extend'
            }).then(r2 => ({ values: r2 || [], type: 'text' }));
        });
    }

    /** Fetch hourly trend data for the last 30 days. */
    function fetchTrends(itemid) {
        const from = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
        return zabbixApi('trend.get', {
            itemids: [itemid], time_from: from,
            output: ['clock', 'num', 'value_min', 'value_avg', 'value_max'],
            limit: 720
        });
    }

    /** Fetch item metadata. */
    function fetchItemMeta(itemid) {
        return zabbixApi('item.get', {
            itemids: [itemid],
            output: ['itemid', 'name', 'key_', 'units', 'value_type', 'lastvalue', 'lastclock']
        }).then(r => (r && r.length > 0 ? r[0] : null));
    }

    // ── Statistical / anomaly analysis ───────────────────────────────────────

    function computeStats(histValues, currentValue) {
        const nums = (histValues || []).map(h => parseFloat(h.value)).filter(v => !isNaN(v));
        if (nums.length < 3) {
            return { count: nums.length, mean: null, stddev: null,
                     min: null, max: null, zscore: null,
                     isAnomaly: false, anomalyLevel: null };
        }

        const n    = nums.length;
        const mean = nums.reduce((a, b) => a + b, 0) / n;
        const vari = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        const std  = Math.sqrt(vari);
        const min  = Math.min(...nums);
        const max  = Math.max(...nums);

        const cur = parseFloat(currentValue);
        let zscore = null, isAnomaly = false, anomalyLevel = null;

        if (!isNaN(cur) && std > 0) {
            zscore = round2((cur - mean) / std);
            const absZ = Math.abs(zscore);
            if      (absZ > 3)   { isAnomaly = true;  anomalyLevel = 'severe'; }
            else if (absZ > 2.5) { isAnomaly = true;  anomalyLevel = 'significant'; }
            else if (absZ > 2)   {                    anomalyLevel = 'mild'; }
        }

        return { count: n, mean: round2(mean), stddev: round2(std),
                 min: round2(min), max: round2(max),
                 zscore, isAnomaly, anomalyLevel };
    }

    /**
     * Compare last 24h trend avg vs prior 24h to produce a direction string.
     */
    function analyzeTrend(trendPoints) {
        if (!trendPoints || trendPoints.length < 6) return null;

        const recent = trendPoints.slice(-24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
        const prior  = trendPoints.slice(-48, -24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));

        if (!recent.length || !prior.length) return null;

        const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
        const avgP = prior.reduce((a, b) => a + b, 0) / prior.length;

        if (avgP === 0) return 'stable';
        const pct = ((avgR - avgP) / Math.abs(avgP)) * 100;

        if (pct >  15) return `⬆ rising  (+${round2(pct)}% vs prior 24h)`;
        if (pct < -15) return `⬇ falling (${round2(pct)}% vs prior 24h)`;
        return '➡ stable';
    }

    function round2(v) { return Math.round(v * 100) / 100; }

    // ── Extract row data from DOM ─────────────────────────────────────────────

    function extractRowData(row) {
        const cells = row.querySelectorAll('td');

        let itemid = null;
        row.querySelectorAll('a[href*="itemid="]').forEach(a => {
            if (!itemid) {
                const m = a.href.match(/itemid=(\d+)/);
                if (m) itemid = m[1];
            }
        });

        const hostLink = row.querySelector('a[href*="hostid"]');

        return {
            itemid:    itemid || '',
            host:      hostLink ? hostLink.textContent.trim() : '',
            name:      cells[1] ? cells[1].textContent.trim() : (cells[0] ? cells[0].textContent.trim() : ''),
            lastCheck: cells[2] ? cells[2].textContent.trim() : '',
            lastValue: cells[3] ? cells[3].textContent.trim() : '',
            change:    cells[4] ? cells[4].textContent.trim() : ''
        };
    }

    // ── Modal ─────────────────────────────────────────────────────────────────

    async function handleItemAnalysis(row) {
        if (!settings) { alert('AI settings not loaded yet.'); return; }
        const Core = window.AIIntegrationCore;
        const rowData = extractRowData(row);

        // Open modal with loading state immediately so the user sees feedback
        const content = document.createElement('div');
        content.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#6b7280;">
                <div style="font-size:28px;margin-bottom:10px;">⏳</div>
                <div>Fetching history &amp; computing statistics…</div>
                ${rowData.itemid ? '' : '<div style="color:#f59e0b;margin-top:8px;font-size:12px;">⚠ Item ID not found — statistical analysis unavailable.</div>'}
            </div>`;

        const providerSelect = createProviderSelect();
        const modal = Core.openModal('📊 AI Item Analysis', content, [], { headerExtra: providerSelect });

        // Enrich context
        let enriched = { item: rowData, statistics: null, trend: null, recentHistory: [] };

        if (rowData.itemid) {
            try {
                const [meta, histResult, trendData] = await Promise.all([
                    fetchItemMeta(rowData.itemid),
                    fetchHistory(rowData.itemid, 100),
                    fetchTrends(rowData.itemid)
                ]);

                if (meta) {
                    enriched.item = Object.assign({}, rowData, {
                        key: meta.key_, units: meta.units, value_type: meta.value_type
                    });
                }

                if (histResult && histResult.values.length > 0) {
                    enriched.statistics  = computeStats(histResult.values, rowData.lastValue);
                    enriched.recentHistory = histResult.values.slice(0, 10).map(h => ({
                        time: new Date(parseInt(h.clock, 10) * 1000).toISOString(),
                        value: h.value
                    }));
                }

                if (trendData && trendData.length > 0) {
                    enriched.trend = {
                        direction: analyzeTrend(trendData),
                        data_points_30d: trendData.length,
                        latest_avg: trendData[trendData.length - 1]
                            ? trendData[trendData.length - 1].value_avg
                            : null
                    };
                }
            } catch (e) {
                console.warn('AI Integration: enrichment failed', e);
            }
        }

        // Build content
        content.innerHTML = '';

        const s = enriched.statistics;

        // Anomaly badge
        let anomalyHtml = '';
        if (s) {
            if (s.anomalyLevel === 'severe') {
                anomalyHtml = `<span style="background:#fef2f2;color:#991b1b;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;margin-left:6px;">🚨 ANOMALY z=${s.zscore}</span>`;
            } else if (s.anomalyLevel === 'significant') {
                anomalyHtml = `<span style="background:#fff7ed;color:#9a3412;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:700;margin-left:6px;">⚠ HIGH z=${s.zscore}</span>`;
            } else if (s.anomalyLevel === 'mild') {
                anomalyHtml = `<span style="background:#fffbeb;color:#92400e;padding:3px 10px;border-radius:10px;font-size:12px;margin-left:6px;">⚡ ELEVATED z=${s.zscore}</span>`;
            } else if (s.zscore !== null) {
                anomalyHtml = `<span style="background:#f0fdf4;color:#166534;padding:3px 10px;border-radius:10px;font-size:12px;margin-left:6px;">✓ Normal z=${s.zscore}</span>`;
            }
        }

        // Summary table
        const tbl = document.createElement('table');
        tbl.className = 'aiintegration-summary-table';
        tbl.innerHTML =
            `<tr><td>Host</td><td>${Core.escapeHtml(rowData.host  || 'N/A')}</td></tr>` +
            `<tr><td>Item</td><td>${Core.escapeHtml(rowData.name  || 'N/A')}</td></tr>` +
            `<tr><td>Last Value</td><td>${Core.escapeHtml(rowData.lastValue || 'N/A')}${anomalyHtml}</td></tr>` +
            `<tr><td>Last Check</td><td>${Core.escapeHtml(rowData.lastCheck || 'N/A')}</td></tr>` +
            (s && s.count >= 3
                ? `<tr><td>Samples</td><td>${s.count}</td></tr>` +
                  `<tr><td>Mean ± StdDev</td><td>${s.mean} ± ${s.stddev}</td></tr>` +
                  `<tr><td>Range</td><td>${s.min} – ${s.max}</td></tr>`
                : '') +
            (enriched.trend && enriched.trend.direction
                ? `<tr><td>30d Trend</td><td>${Core.escapeHtml(enriched.trend.direction)}</td></tr>`
                : '');
        content.appendChild(tbl);

        // Question field
        const qField = document.createElement('div');
        qField.className = 'aiintegration-field';
        qField.innerHTML = '<label>Ask AI:</label>';
        const qArea = document.createElement('textarea');
        qArea.id = 'ld_question';
        qArea.rows = 4;
        qArea.style.cssText = 'width:100%;box-sizing:border-box;';
        qArea.value = buildDefaultQuestion(rowData, enriched);
        qField.appendChild(qArea);
        content.appendChild(qField);

        // Super Admin context panel
        if (settings.is_super_admin) {
            const det = document.createElement('details');
            det.style.marginTop = '12px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;';
            sum.textContent = '🔧 Context JSON (Super Admin)';
            det.appendChild(sum);
            const ctxArea = document.createElement('textarea');
            ctxArea.id = 'ld_context_json';
            ctxArea.rows = 10;
            ctxArea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
            ctxArea.value = JSON.stringify(enriched, null, 2);
            det.appendChild(ctxArea);
            content.appendChild(det);
        }

        // Response area
        const respDiv = document.createElement('div');
        respDiv.id = 'ld_response';
        respDiv.style.display = 'none';
        content.appendChild(respDiv);

        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = (document.getElementById('ld_question') || {}).value || '';
                    const provider = providerSelect.value;

                    let ctx = enriched;
                    if (settings.is_super_admin) {
                        const ctxEl = document.getElementById('ld_context_json');
                        if (ctxEl) {
                            try { ctx = JSON.parse(ctxEl.value || '{}'); }
                            catch (_) {
                                renderResp('ld_response', null, 'Invalid JSON in context field.');
                                return;
                            }
                        }
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';

                    Core.callAI(question, ctx, provider)
                        .then(data => {
                            renderResp('ld_response', data.response, null);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            renderResp('ld_response', null, err.message);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: close => close()
            }
        ]);
    }

    function renderResp(id, text, errMsg) {
        const Core = window.AIIntegrationCore;
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'block';
        if (errMsg) {
            el.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(errMsg)}</div>`;
        } else {
            el.innerHTML = `<div class="aiintegration-response">${Core.renderText(text || '')}</div>`;
        }
    }

    function buildDefaultQuestion(rowData, ctx) {
        const s = ctx.statistics;
        let q = `Analyze this Zabbix monitoring item:\n`;
        q += `• Host: ${rowData.host}\n`;
        q += `• Item: ${rowData.name}\n`;
        q += `• Current value: ${rowData.lastValue}\n`;

        if (s && s.count >= 3) {
            q += `• Historical mean: ${s.mean}  StdDev: ${s.stddev}  (${s.count} samples)\n`;
            q += `• Range: ${s.min} – ${s.max}\n`;
            if (s.zscore !== null) {
                q += `• Z-score: ${s.zscore} → ${
                    s.anomalyLevel === 'severe'      ? 'SEVERE ANOMALY (>3σ from mean)' :
                    s.anomalyLevel === 'significant' ? 'SIGNIFICANT deviation (>2.5σ)' :
                    s.anomalyLevel === 'mild'        ? 'mildly elevated (>2σ)' :
                                                      'within normal range'
                }\n`;
            }
        }
        if (ctx.trend && ctx.trend.direction) {
            q += `• 30-day trend: ${ctx.trend.direction}\n`;
        }

        q += `\nPlease:\n1. Assess whether the current value is normal or requires attention\n`;
        q += `2. Explain what this metric represents and its significance\n`;
        q += `3. Identify any patterns or concerns from the statistical data\n`;
        q += `4. Provide actionable recommendations`;

        return q;
    }

    // ── Provider select ───────────────────────────────────────────────────────

    function createProviderSelect() {
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:13px;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.9);color:#1f1f1f;';

        if (!settings || !settings.providers || !settings.providers.length) {
            const o = document.createElement('option');
            o.value = 'openai'; o.textContent = 'No providers configured';
            sel.appendChild(o); sel.disabled = true; return sel;
        }

        settings.providers.forEach(p => {
            const o = document.createElement('option');
            o.value = p.name;
            o.textContent = p.name + (p.model ? ' – ' + p.model : '');
            if (p.name === settings.default_provider) o.selected = true;
            sel.appendChild(o);
        });

        return sel;
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
