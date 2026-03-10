/**
 * AI Integration - Latest Data Page Enhancement
 * Enhanced: Zabbix API history/trends, statistical analysis, z-score anomaly detection,
 *           Super Admin context panel
 */
(function() {
    'use strict';

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
        const Core = window.AIIntegrationCore;

        Core.loadSettings().then(loadedSettings => {
            settings = loadedSettings;

            if (!settings.quick_actions.items) {
                console.log('AI Integration: Latest Data quick actions disabled');
                return;
            }

            if (!settings.providers || settings.providers.length === 0) {
                console.log('AI Integration: No providers enabled');
                return;
            }

            console.log('AI Integration: Latest Data page initialized');

            injectLatestDataButtons();

            const observer = new MutationObserver(() => {
                if (injectionAttempts < MAX_ATTEMPTS) {
                    setTimeout(injectLatestDataButtons, 500);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    function injectLatestDataButtons() {
        const table = document.querySelector('table.list-table.compact-view') ||
            Array.from(document.querySelectorAll('table.list-table')).find(t => {
                const firstRow = t.querySelector('tbody tr');
                return firstRow && firstRow.querySelectorAll('td').length > 5;
            });

        if (!table) {
            console.log('AI Integration: Latest Data table not found');
            return;
        }

        if (table.closest('.filter-forms') || table.closest('.filter-container')) {
            console.log('AI Integration: Skipping filter table');
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Add header
        const thead = table.querySelector('thead tr');
        if (thead && !thead.querySelector('.aiintegration-header')) {
            const th = document.createElement('th');
            th.className = 'aiintegration-header';
            th.textContent = 'IA';
            th.style.width = '50px';
            th.style.textAlign = 'center';
            thead.appendChild(th);
        }

        // Add buttons to rows
        const rows = tbody.querySelectorAll('tr');
        let injected = 0;

        rows.forEach(row => {
            if (row.querySelector('.aiintegration-sparkle-btn')) return;

            const td = document.createElement('td');
            td.className = 'aiintegration-td';
            td.style.textAlign = 'center';

            const btn = createSparkleButton();
            btn.addEventListener('click', (e) => {
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
        btn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 4px;';
        const uid = Date.now() + Math.random().toString(36).slice(2);
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                      fill="url(#sparkle-ld-${uid})" stroke="#a855f7" stroke-width="1.5"/>
                <defs>
                    <linearGradient id="sparkle-ld-${uid}" x1="2" y1="2" x2="22" y2="22">
                        <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
                    </linearGradient>
                </defs>
            </svg>`;
        return btn;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Zabbix API helpers
    // ─────────────────────────────────────────────────────────────────────────

    function callZabbixApi(method, params) {
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
     * Fetch the last `limit` raw history values for an item.
     * Tries value_type 0 (float) first, then 3 (text) as fallback.
     */
    function fetchItemHistory(itemid, limit) {
        limit = limit || 100;
        // Try numeric history first
        return callZabbixApi('history.get', {
            itemids: [itemid],
            history: 0,          // float
            sortfield: 'clock',
            sortorder: 'DESC',
            limit: limit,
            output: 'extend'
        }).then(result => {
            if (result && result.length > 0) return { values: result, valueType: 0 };
            // Fallback: integer history
            return callZabbixApi('history.get', {
                itemids: [itemid],
                history: 3,      // text
                sortfield: 'clock',
                sortorder: 'DESC',
                limit: limit,
                output: 'extend'
            }).then(r2 => ({ values: r2 || [], valueType: 3 }));
        });
    }

    /**
     * Fetch hourly trend data for the last 30 days.
     */
    function fetchItemTrends(itemid) {
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
        return callZabbixApi('trend.get', {
            itemids: [itemid],
            time_from: thirtyDaysAgo,
            output: ['clock', 'num', 'value_min', 'value_avg', 'value_max'],
            limit: 720  // up to 720 hourly points = 30 days
        });
    }

    /**
     * Fetch item metadata (name, key_, units, value_type, itemid).
     */
    function fetchItemMeta(itemid) {
        return callZabbixApi('item.get', {
            itemids: [itemid],
            output: ['itemid', 'name', 'key_', 'units', 'value_type', 'lastvalue', 'lastclock', 'state', 'status']
        }).then(r => (r && r.length > 0 ? r[0] : null));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Statistical analysis
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute mean, stddev, min, max, z-score of the current value,
     * and an anomaly flag.
     */
    function computeStatistics(historyValues, currentValue) {
        const nums = historyValues
            .map(h => parseFloat(h.value))
            .filter(v => !isNaN(v));

        if (nums.length === 0) {
            return { count: 0, mean: null, stddev: null, min: null, max: null, zscore: null, isAnomaly: false };
        }

        const n = nums.length;
        const mean = nums.reduce((a, b) => a + b, 0) / n;
        const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
        const stddev = Math.sqrt(variance);
        const min = Math.min(...nums);
        const max = Math.max(...nums);

        let zscore = null;
        let isAnomaly = false;
        const cur = parseFloat(currentValue);

        if (!isNaN(cur) && stddev > 0) {
            zscore = (cur - mean) / stddev;
            isAnomaly = Math.abs(zscore) > 3; // 3-sigma rule
        }

        return {
            count: n,
            mean: round2(mean),
            stddev: round2(stddev),
            min: round2(min),
            max: round2(max),
            zscore: zscore !== null ? round2(zscore) : null,
            isAnomaly
        };
    }

    /**
     * Derive trend direction from the last N hourly trend points.
     * Returns: 'rising', 'falling', 'stable', or 'insufficient_data'
     */
    function analyzeTrend(trendPoints) {
        if (!trendPoints || trendPoints.length < 6) return 'insufficient_data';

        // Use last 24 points (24 hours) vs previous 24
        const recent = trendPoints.slice(-24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
        const prior  = trendPoints.slice(-48, -24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));

        if (recent.length === 0 || prior.length === 0) return 'insufficient_data';

        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const priorAvg  = prior.reduce((a, b) => a + b, 0) / prior.length;

        if (priorAvg === 0) return 'stable';
        const changePct = ((recentAvg - priorAvg) / Math.abs(priorAvg)) * 100;

        if (changePct > 10)  return `rising (+${round2(changePct)}%)`;
        if (changePct < -10) return `falling (${round2(changePct)}%)`;
        return 'stable';
    }

    function round2(v) {
        return Math.round(v * 100) / 100;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Data extraction from DOM row
    // ─────────────────────────────────────────────────────────────────────────

    function extractItemData(row) {
        const cells = row.querySelectorAll('td');

        // Try to get itemid from a graph/history link
        let itemid = null;
        const links = row.querySelectorAll('a[href*="itemid="]');
        links.forEach(link => {
            if (!itemid) {
                const m = link.href.match(/itemid=(\d+)/);
                if (m) itemid = m[1];
            }
        });

        const hostLink = row.querySelector('a[href*="hostid"]');

        return {
            itemid: itemid || '',
            host: hostLink?.textContent?.trim() || '',
            name: cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '',
            lastCheck: cells[2]?.textContent?.trim() || '',
            lastValue: cells[3]?.textContent?.trim() || '',
            change: cells[4]?.textContent?.trim() || ''
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Analysis handler
    // ─────────────────────────────────────────────────────────────────────────

    function handleItemAnalysis(row) {
        if (!settings) { alert('Settings not loaded'); return; }

        const itemData = extractItemData(row);
        console.log('AI Integration: Item data', itemData);
        showAnalysisModal(itemData);
    }

    async function showAnalysisModal(itemData) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');

        // ── Loading state ──
        content.innerHTML = `
            <div style="text-align:center;padding:30px;color:#6b7280;">
                <div style="font-size:24px;margin-bottom:8px;">⏳</div>
                <div>Loading item data and statistics…</div>
            </div>`;

        const providerSelect = createProviderSelect();
        const modal = Core.openModal('📊 AI Item Analysis', content, [], { headerExtra: providerSelect });

        // ── Fetch enriched context ──
        let enrichedContext = {
            item: itemData,
            statistics: null,
            trend: null,
            recent_history: []
        };

        try {
            let itemMeta = null;
            if (itemData.itemid) {
                const [meta, histResult, trendData] = await Promise.all([
                    fetchItemMeta(itemData.itemid),
                    fetchItemHistory(itemData.itemid, 100),
                    fetchItemTrends(itemData.itemid)
                ]);

                itemMeta = meta;

                if (histResult && histResult.values && histResult.values.length > 0) {
                    const stats = computeStatistics(histResult.values, itemData.lastValue);
                    enrichedContext.statistics = stats;
                    enrichedContext.recent_history = histResult.values.slice(0, 10).map(h => ({
                        time: new Date(parseInt(h.clock, 10) * 1000).toISOString(),
                        value: h.value
                    }));
                }

                if (trendData && trendData.length > 0) {
                    enrichedContext.trend = {
                        direction: analyzeTrend(trendData),
                        points_30d: trendData.length,
                        latest_avg: trendData[trendData.length - 1]?.value_avg
                    };
                }

                if (itemMeta) {
                    enrichedContext.item = Object.assign({}, itemData, {
                        key: itemMeta.key_,
                        units: itemMeta.units,
                        value_type: itemMeta.value_type
                    });
                }
            }
        } catch (e) {
            console.warn('AI Integration: Could not load enriched context', e);
        }

        // ── Build modal content ──
        content.innerHTML = '';

        // Summary table
        const stats = enrichedContext.statistics;
        const anomalyBadge = stats && stats.isAnomaly
            ? '<span style="background:#fef2f2;color:#b91c1c;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;">⚠ ANOMALY (z=' + stats.zscore + ')</span>'
            : (stats && stats.zscore !== null
                ? '<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:10px;font-size:12px;">✓ Normal (z=' + stats.zscore + ')</span>'
                : '');

        const summaryTable = document.createElement('table');
        summaryTable.className = 'aiintegration-summary-table';
        summaryTable.innerHTML = `
            <tr><td>Host:</td><td>${Core.escapeHtml(itemData.host || 'N/A')}</td></tr>
            <tr><td>Item:</td><td>${Core.escapeHtml(itemData.name || 'N/A')}</td></tr>
            <tr><td>Last Value:</td><td>${Core.escapeHtml(itemData.lastValue || 'N/A')} ${anomalyBadge}</td></tr>
            <tr><td>Last Check:</td><td>${Core.escapeHtml(itemData.lastCheck || 'N/A')}</td></tr>
            ${stats && stats.count > 0 ? `
            <tr><td>Mean (${stats.count} pts):</td><td>${stats.mean}</td></tr>
            <tr><td>Std Deviation:</td><td>${stats.stddev}</td></tr>
            <tr><td>Range:</td><td>${stats.min} – ${stats.max}</td></tr>
            ` : ''}
            ${enrichedContext.trend ? `<tr><td>30d Trend:</td><td>${Core.escapeHtml(enrichedContext.trend.direction)}</td></tr>` : ''}
        `;
        content.appendChild(summaryTable);

        // Default question
        const defaultQuestion = buildDefaultQuestion(itemData, enrichedContext);
        const questionField = document.createElement('div');
        questionField.className = 'aiintegration-field';
        questionField.innerHTML = '<label>Ask AI:</label>';
        const questionTextarea = document.createElement('textarea');
        questionTextarea.id = 'ai_question';
        questionTextarea.rows = 4;
        questionTextarea.style.width = '100%';
        questionTextarea.style.boxSizing = 'border-box';
        questionTextarea.value = defaultQuestion;
        questionField.appendChild(questionTextarea);
        content.appendChild(questionField);

        // Super Admin context editor
        if (settings.is_super_admin) {
            const details = document.createElement('details');
            details.className = 'aiintegration-context-toggle';
            const summary = document.createElement('summary');
            summary.textContent = '🔧 Context JSON (Super Admin)';
            details.appendChild(summary);
            const ctxArea = document.createElement('textarea');
            ctxArea.id = 'ai_context_json';
            ctxArea.rows = 10;
            ctxArea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
            ctxArea.value = JSON.stringify(enrichedContext, null, 2);
            details.appendChild(ctxArea);
            content.appendChild(details);
        }

        // Response area
        const responseDiv = document.createElement('div');
        responseDiv.id = 'ai_response_area';
        responseDiv.style.display = 'none';
        content.appendChild(responseDiv);

        // Actions
        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = document.getElementById('ai_question').value;
                    const provider = providerSelect.value;

                    // Resolve context (Super Admin may have edited it)
                    let ctx = enrichedContext;
                    if (settings.is_super_admin) {
                        try {
                            ctx = JSON.parse(document.getElementById('ai_context_json').value || '{}');
                        } catch (e) {
                            const ra = document.getElementById('ai_response_area');
                            ra.style.display = 'block';
                            ra.innerHTML = '<div class="aiintegration-error">Invalid JSON in context.</div>';
                            return;
                        }
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';

                    Core.callAI(question, ctx, provider)
                        .then(data => {
                            const ra = document.getElementById('ai_response_area');
                            ra.style.display = 'block';
                            ra.innerHTML = '<div class="aiintegration-response">' + Core.renderText(data.response || '') + '</div>';
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            const ra = document.getElementById('ai_response_area');
                            ra.style.display = 'block';
                            ra.innerHTML = '<div class="aiintegration-error">' + Core.escapeHtml(err.message) + '</div>';
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: (close) => close()
            }
        ]);
    }

    /**
     * Build a default AI question that includes key statistics.
     */
    function buildDefaultQuestion(itemData, ctx) {
        let q = `Analyze this Zabbix monitoring item:\n`;
        q += `- Host: ${itemData.host}\n`;
        q += `- Item: ${itemData.name}\n`;
        q += `- Current value: ${itemData.lastValue}\n`;

        if (ctx.statistics && ctx.statistics.count > 0) {
            const s = ctx.statistics;
            q += `- Historical mean: ${s.mean}, std dev: ${s.stddev} (${s.count} samples)\n`;
            q += `- Value range: ${s.min} – ${s.max}\n`;
            if (s.zscore !== null) {
                q += `- Z-score: ${s.zscore} (${s.isAnomaly ? 'ANOMALY - value is more than 3 standard deviations from mean' : 'within normal range'})\n`;
            }
        }

        if (ctx.trend) {
            q += `- 30-day trend: ${ctx.trend.direction}\n`;
        }

        q += `\nPlease:\n`;
        q += `1. Assess whether the current value is normal or anomalous\n`;
        q += `2. Explain what the metric represents and its significance\n`;
        q += `3. Identify any patterns or concerns from the trend data\n`;
        q += `4. Provide actionable recommendations if needed`;

        return q;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Provider select helper
    // ─────────────────────────────────────────────────────────────────────────

    function createProviderSelect() {
        const select = document.createElement('select');
        select.id = 'provider_select';
        select.style.cssText = 'font-size:13px;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.9);color:#1f1f1f;';

        if (!settings || !settings.providers || settings.providers.length === 0) {
            const opt = document.createElement('option');
            opt.value = 'openai';
            opt.textContent = 'No providers';
            select.appendChild(opt);
            select.disabled = true;
            return select;
        }

        settings.providers.forEach(provider => {
            const opt = document.createElement('option');
            opt.value = provider.name;   // provider.name is the key (e.g. 'openai', 'anthropic')
            opt.textContent = provider.name + (provider.model ? ' – ' + provider.model : '');
            if (provider.name === settings.default_provider) opt.selected = true;
            select.appendChild(opt);
        });

        return select;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bootstrap
    // ─────────────────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
