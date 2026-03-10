/**
 * AI Integration - Form Helpers
 *
 * Registers handlers for three overlay-dialogue types:
 *   - items    → Item form (form[name="itemForm"])
 *   - triggers → Trigger form (expression field)
 *   - hosts    → Host form (form[name="hostForm"])
 *
 * NOTE: provider.name is the correct key (not provider.id).
 */
(function() {
    'use strict';

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function waitForDependencies(callback) {
        if (typeof window.AIIntegrationCore !== 'undefined' &&
            typeof window.AIIntegrationInit !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForDependencies(callback), 100);
        }
    }

    function init() {
        const Core = window.AIIntegrationCore;
        const Init = window.AIIntegrationInit;

        Core.loadSettings().then(settings => {

            // ── Items ─────────────────────────────────────────────────────────
            Init.registerHandler('items', (dialog) => {
                if (settings.quick_actions && settings.quick_actions.items) {
                    injectItemHelper(dialog, settings);
                }
            });

            // ── Triggers ──────────────────────────────────────────────────────
            Init.registerHandler('triggers', (dialog) => {
                if (settings.quick_actions && settings.quick_actions.triggers) {
                    injectTriggerHelper(dialog, settings);
                }
            });

            // ── Hosts ─────────────────────────────────────────────────────────
            Init.registerHandler('hosts', (dialog) => {
                if (settings.quick_actions && settings.quick_actions.hosts) {
                    injectHostHelper(dialog, settings);
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }

    // =========================================================================
    // Shared utilities
    // =========================================================================

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

    function round2(v) { return Math.round(v * 100) / 100; }

    function getSeverityName(sev) {
        return ['Not classified', 'Information', 'Warning',
                'Average', 'High', 'Disaster'][parseInt(sev, 10)] || 'Unknown';
    }

    function getSeverityColor(sev) {
        return ['#6b7280','#3b82f6','#f59e0b',
                '#f97316','#ef4444','#7c3aed'][parseInt(sev, 10)] || '#6b7280';
    }

    /** Build a provider <select> — uses p.name (not p.id). */
    function createProviderSelect(settings) {
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:13px;padding:4px 8px;border-radius:4px;' +
            'border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.9);color:#1f1f1f;';

        if (!settings || !settings.providers || !settings.providers.length) {
            const o = document.createElement('option');
            o.value = 'openai';
            o.textContent = 'No providers configured';
            sel.appendChild(o);
            sel.disabled = true;
            return sel;
        }

        settings.providers.forEach(p => {
            const o = document.createElement('option');
            o.value = p.name;   // ← correct key is .name, not .id
            o.textContent = p.name + (p.model ? ' – ' + p.model : '');
            if (p.name === settings.default_provider) o.selected = true;
            sel.appendChild(o);
        });

        return sel;
    }

    function showError(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `<div class="aiintegration-error">${window.AIIntegrationCore.escapeHtml(msg)}</div>`;
    }

    function showResponse(id, text) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `<div class="aiintegration-response">${window.AIIntegrationCore.renderText(text || '')}</div>`;
    }

    // =========================================================================
    // ITEMS
    // Injects "🤖 AI Analysis: [📊 Analyze Item]" bar at top of the Item dialog.
    // Fetches history, linked triggers + computes z-score, then opens the modal.
    // =========================================================================

    function injectItemHelper(dialog, settings) {
        if (dialog.querySelector('.aiintegration-item-helper')) return;

        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;

        const bar = document.createElement('div');
        bar.className = 'aiintegration-item-helper';
        bar.style.cssText = 'margin:0 0 14px;padding:10px 14px;' +
            'background:linear-gradient(135deg,#667eea0d,#764ba20d);' +
            'border:1px solid #e5e7eb;border-radius:6px;' +
            'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        const label = document.createElement('span');
        label.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
        label.textContent = '🤖 AI Analysis:';
        bar.appendChild(label);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '📊 Analyze Item';
        btn.style.cssText = 'padding:0px 8px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border:1px solid #d1d5db;' +
            'border-radius:4px;cursor:pointer;font-size:13px;transition:all 0.2s;';
        btn.addEventListener('click', () => showItemAnalysisModal(dialog, settings));
        bar.appendChild(btn);

        formBody.insertBefore(bar, formBody.firstChild);
    }

    async function showItemAnalysisModal(dialog, settings) {
        const Core = window.AIIntegrationCore;

        // ── Resolve itemid ────────────────────────────────────────────────────
        let itemid = null;
        const hiddenId = dialog.querySelector('input[name="itemid"]') ||
                         dialog.querySelector('input[id="itemid"]');
        if (hiddenId && hiddenId.value) itemid = hiddenId.value;
        if (!itemid) {
            const m = window.location.href.match(/itemid=(\d+)/);
            if (m) itemid = m[1];
        }

        // ── Read form fields ──────────────────────────────────────────────────
        const nameInput  = dialog.querySelector('input[name="name"]')  || dialog.querySelector('#name');
        const keyInput   = dialog.querySelector('input[name="key_"]')  || dialog.querySelector('#key_');
        const typeSelect = dialog.querySelector('select[name="type"]') || dialog.querySelector('#type');

        const itemInfo = {
            itemid: itemid || null,
            name:   nameInput  ? nameInput.value  : '',
            key:    keyInput   ? keyInput.value   : '',
            type:   typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : ''
        };

        // ── Loading modal ─────────────────────────────────────────────────────
        const content = document.createElement('div');
        content.innerHTML = `
            <div style="text-align:center;padding:30px;color:#6b7280;">
                <div style="font-size:24px;margin-bottom:8px;">⏳</div>
                <div>${itemid ? 'Loading history, triggers…' : 'Preparing analysis…'}</div>
                ${!itemid
                    ? '<div style="margin-top:8px;color:#f59e0b;font-size:13px;">⚠ Save the item first for full statistical analysis.</div>'
                    : ''}
            </div>`;

        const providerSelect = createProviderSelect(settings);
        const modal = Core.openModal('📊 AI Item Analysis', content, [], { headerExtra: providerSelect });

        // ── Enrich from Zabbix API ────────────────────────────────────────────
        let enriched = {
            item:          itemInfo,
            statistics:    null,
            trend:         null,
            recentHistory: [],
            triggers:      []
        };

        if (itemid) {
            try {
                const [meta, histResult, trendData, triggers] = await Promise.all([

                    // 1. Item metadata
                    zabbixApi('item.get', {
                        itemids: [itemid],
                        output: ['itemid','name','key_','units','value_type','lastvalue','lastclock']
                    }).then(r => r && r.length ? r[0] : null),

                    // 2. History (float → text fallback)
                    zabbixApi('history.get', {
                        itemids: [itemid], history: 0,
                        sortfield: 'clock', sortorder: 'DESC',
                        limit: 100, output: 'extend'
                    }).then(r => {
                        if (r && r.length) return { values: r };
                        return zabbixApi('history.get', {
                            itemids: [itemid], history: 3,
                            sortfield: 'clock', sortorder: 'DESC',
                            limit: 100, output: 'extend'
                        }).then(r2 => ({ values: r2 || [] }));
                    }),

                    // 3. 30-day trend
                    zabbixApi('trend.get', {
                        itemids: [itemid],
                        time_from: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
                        output: ['clock','value_avg','value_min','value_max'],
                        limit: 720
                    }),

                    // 4. Triggers linked to this item
                    zabbixApi('trigger.get', {
                        itemids: [itemid],
                        output: ['triggerid','description','expression',
                                 'priority','status','value','lastchange','comments'],
                        expandExpression: true,
                        selectFunctions: 'extend'
                    })
                ]);

                // Merge metadata
                if (meta) {
                    enriched.item = Object.assign({}, itemInfo, {
                        name:       meta.name,
                        key:        meta.key_,
                        units:      meta.units,
                        value_type: meta.value_type,
                        lastValue:  meta.lastvalue,
                        lastClock:  meta.lastclock
                            ? new Date(parseInt(meta.lastclock, 10) * 1000).toISOString()
                            : null
                    });
                }

                // Statistics & anomaly detection
                if (histResult && histResult.values.length >= 3) {
                    const nums = histResult.values
                        .map(h => parseFloat(h.value))
                        .filter(v => !isNaN(v));

                    if (nums.length >= 3) {
                        const n    = nums.length;
                        const mean = nums.reduce((a, b) => a + b, 0) / n;
                        const std  = Math.sqrt(
                            nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n
                        );
                        const cur  = parseFloat(enriched.item.lastValue);
                        const z    = (!isNaN(cur) && std > 0)
                            ? round2((cur - mean) / std)
                            : null;
                        const absZ = z !== null ? Math.abs(z) : 0;

                        enriched.statistics = {
                            count:        n,
                            mean:         round2(mean),
                            stddev:       round2(std),
                            min:          round2(Math.min(...nums)),
                            max:          round2(Math.max(...nums)),
                            zscore:       z,
                            anomalyLevel: absZ > 3   ? 'severe'
                                        : absZ > 2.5 ? 'significant'
                                        : absZ > 2   ? 'mild'
                                        : null
                        };
                    }

                    enriched.recentHistory = histResult.values.slice(0, 8).map(h => ({
                        time:  new Date(parseInt(h.clock, 10) * 1000).toISOString(),
                        value: h.value
                    }));
                }

                // Trend direction
                if (trendData && trendData.length >= 6) {
                    const recent = trendData.slice(-24)
                        .map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
                    const prior  = trendData.slice(-48, -24)
                        .map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));

                    if (recent.length && prior.length) {
                        const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
                        const avgP = prior.reduce((a, b) => a + b, 0) / prior.length;
                        const pct  = avgP !== 0 ? ((avgR - avgP) / Math.abs(avgP)) * 100 : 0;
                        enriched.trend = {
                            data_points_30d: trendData.length,
                            direction: pct >  15 ? `⬆ rising (+${round2(pct)}% vs prior 24h)`
                                     : pct < -15 ? `⬇ falling (${round2(pct)}% vs prior 24h)`
                                     : '➡ stable'
                        };
                    }
                }

                // Triggers — normalise
                if (triggers && triggers.length) {
                    enriched.triggers = triggers.map(t => ({
                        id:         t.triggerid,
                        name:       t.description,
                        expression: t.expression,
                        severity:   getSeverityName(t.priority),
                        status:     t.status    === '0' ? 'enabled'  : 'disabled',
                        state:      t.value     === '1' ? 'PROBLEM'  : 'OK',
                        lastChange: t.lastchange
                            ? new Date(parseInt(t.lastchange, 10) * 1000).toISOString()
                            : null,
                        comments:   t.comments || ''
                    }));
                }

            } catch (e) {
                console.warn('AI Integration: item enrichment failed', e);
            }
        }

        // ── Build modal content ───────────────────────────────────────────────
        content.innerHTML = '';

        const s = enriched.statistics;

        // Anomaly badge
        let anomalyHtml = '';
        if (s && s.zscore !== null) {
            const badge = {
                severe:      { bg: '#fef2f2', fg: '#991b1b', label: `🚨 ANOMALY z=${s.zscore}`,   fw: '700' },
                significant: { bg: '#fff7ed', fg: '#9a3412', label: `⚠ HIGH z=${s.zscore}`,       fw: '700' },
                mild:        { bg: '#fffbeb', fg: '#92400e', label: `⚡ ELEVATED z=${s.zscore}`,   fw: '600' }
            }[s.anomalyLevel] || { bg: '#f0fdf4', fg: '#166534', label: `✓ Normal z=${s.zscore}`, fw: '600' };
            anomalyHtml = `<span style="background:${badge.bg};color:${badge.fg};padding:2px 8px;` +
                `border-radius:10px;font-size:12px;font-weight:${badge.fw};margin-left:6px;">${badge.label}</span>`;
        }

        // Summary table
        const tbl = document.createElement('table');
        tbl.className = 'aiintegration-summary-table';
        tbl.innerHTML =
            `<tr><td>Item Name</td><td>${Core.escapeHtml(enriched.item.name || 'N/A')}</td></tr>` +
            `<tr><td>Key</td><td><code>${Core.escapeHtml(enriched.item.key || 'N/A')}</code></td></tr>` +
            (enriched.item.units
                ? `<tr><td>Units</td><td>${Core.escapeHtml(enriched.item.units)}</td></tr>` : '') +
            (enriched.item.lastValue !== undefined
                ? `<tr><td>Last Value</td><td>` +
                  `${Core.escapeHtml(String(enriched.item.lastValue || 'N/A'))}` +
                  (enriched.item.units ? ' ' + Core.escapeHtml(enriched.item.units) : '') +
                  anomalyHtml + `</td></tr>` : '') +
            (s && s.count >= 3
                ? `<tr><td>Mean ± StdDev</td><td>${s.mean} ± ${s.stddev} (${s.count} samples)</td></tr>` +
                  `<tr><td>Range</td><td>${s.min} – ${s.max}</td></tr>` : '') +
            (enriched.trend
                ? `<tr><td>30d Trend</td><td>${Core.escapeHtml(enriched.trend.direction)}</td></tr>` : '');
        content.appendChild(tbl);

        // ── Trigger section ───────────────────────────────────────────────────
        if (enriched.triggers.length > 0) {
            const trigHeader = document.createElement('div');
            trigHeader.style.cssText = 'margin:14px 0 6px;font-weight:700;font-size:13px;color:#374151;';
            trigHeader.textContent = `⚡ Linked Triggers (${enriched.triggers.length})`;
            content.appendChild(trigHeader);

            const trigTable = document.createElement('table');
            trigTable.className = 'aiintegration-summary-table';
            trigTable.style.cssText = 'font-size:12px;';

            const thead = document.createElement('thead');
            thead.innerHTML =
                `<tr style="background:#f3f4f6;">` +
                `<th style="padding:5px 8px;text-align:left;">Name</th>` +
                `<th style="padding:5px 8px;text-align:left;">Severity</th>` +
                `<th style="padding:5px 8px;text-align:left;">State</th>` +
                `<th style="padding:5px 8px;text-align:left;">Expression</th>` +
                `</tr>`;
            trigTable.appendChild(thead);

            const tbody = document.createElement('tbody');
            enriched.triggers.forEach(t => {
                const stateColor = t.state === 'PROBLEM' ? '#dc2626' : '#16a34a';
                const sevColor   = {
                    Disaster: '#7c3aed', High: '#dc2626', Average: '#f97316',
                    Warning: '#eab308', Information: '#3b82f6', 'Not classified': '#6b7280'
                }[t.severity] || '#6b7280';

                const tr = document.createElement('tr');
                tr.innerHTML =
                    `<td style="padding:5px 8px;">${Core.escapeHtml(t.name)}</td>` +
                    `<td style="padding:5px 8px;">` +
                    `<span style="background:${sevColor};color:white;padding:1px 6px;border-radius:8px;font-size:11px;">` +
                    `${Core.escapeHtml(t.severity)}</span></td>` +
                    `<td style="padding:5px 8px;color:${stateColor};font-weight:600;">${t.state}</td>` +
                    `<td style="padding:5px 8px;"><code style="font-size:11px;">${Core.escapeHtml(t.expression)}</code></td>`;
                tbody.appendChild(tr);
            });
            trigTable.appendChild(tbody);
            content.appendChild(trigTable);

        } else if (itemid) {
            // Only show "no triggers" if we actually fetched (i.e. itemid was known)
            const noTrig = document.createElement('div');
            noTrig.style.cssText = 'margin:10px 0;padding:8px 12px;background:#f9fafb;' +
                'border:1px dashed #d1d5db;border-radius:4px;font-size:13px;color:#6b7280;';
            noTrig.textContent = '⚡ No triggers are linked to this item yet.';
            content.appendChild(noTrig);
        }

        // Question textarea
        const qField = document.createElement('div');
        qField.className = 'aiintegration-field';
        qField.innerHTML =
            '<label style="display:block;font-weight:600;font-size:13px;margin:12px 0 4px;">Ask AI:</label>';
        const qArea = document.createElement('textarea');
        qArea.id = 'item_question';
        qArea.rows = 5;
        qArea.style.cssText = 'width:100%;box-sizing:border-box;';
        qArea.value = buildItemQuestion(enriched);
        qField.appendChild(qArea);
        content.appendChild(qField);

        // Super Admin context
        if (settings.is_super_admin) {
            const det = document.createElement('details');
            det.style.marginTop = '10px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;';
            sum.textContent = '🔧 Context JSON (Super Admin)';
            det.appendChild(sum);
            const ctxArea = document.createElement('textarea');
            ctxArea.id = 'item_ctx_json';
            ctxArea.rows = 10;
            ctxArea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:6px;';
            ctxArea.value = JSON.stringify(enriched, null, 2);
            det.appendChild(ctxArea);
            content.appendChild(det);
        }

        const respDiv = document.createElement('div');
        respDiv.id = 'item_resp';
        respDiv.style.display = 'none';
        content.appendChild(respDiv);

        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = (document.getElementById('item_question') || {}).value || '';
                    const provider = providerSelect.value;

                    let ctx = enriched;
                    if (settings.is_super_admin) {
                        const ctxEl = document.getElementById('item_ctx_json');
                        if (ctxEl) {
                            try { ctx = JSON.parse(ctxEl.value || '{}'); }
                            catch (_) { showError('item_resp', 'Invalid JSON in context.'); return; }
                        }
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';

                    Core.callAI(question, ctx, provider)
                        .then(data => {
                            showResponse('item_resp', data.response);
                            btn.disabled = false;
                            btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            showError('item_resp', err.message);
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

    /**
     * Build a pre-filled question embedding statistics AND trigger context.
     * If triggers exist, ask AI to evaluate them; if not, ask AI to suggest them.
     */
    function buildItemQuestion(ctx) {
        const i = ctx.item;
        const s = ctx.statistics;
        const triggers = ctx.triggers;

        let q = `Analyze this Zabbix monitoring item:\n`;
        q += `• Name: ${i.name || 'N/A'}\n`;
        q += `• Key: ${i.key   || 'N/A'}\n`;
        if (i.units)     q += `• Units: ${i.units}\n`;
        if (i.lastValue !== undefined) {
            q += `• Current value: ${i.lastValue}${i.units ? ' ' + i.units : ''}\n`;
        }

        if (s && s.count >= 3) {
            q += `• Historical mean: ${s.mean} ± ${s.stddev} (${s.count} samples)\n`;
            q += `• Range: ${s.min} – ${s.max}\n`;
            if (s.zscore !== null) {
                q += `• Z-score: ${s.zscore} → ${
                    s.anomalyLevel === 'severe'      ? 'SEVERE ANOMALY (>3σ from mean)'    :
                    s.anomalyLevel === 'significant' ? 'significant deviation (>2.5σ)'    :
                    s.anomalyLevel === 'mild'        ? 'mildly elevated (>2σ)'            :
                                                       'within normal range'
                }\n`;
            }
        }

        if (ctx.trend) q += `• 30-day trend: ${ctx.trend.direction}\n`;

        if (triggers && triggers.length > 0) {
            q += `\nLinked triggers (${triggers.length}):\n`;
            triggers.forEach(t => {
                q += `• [${t.severity}] "${t.name}" — currently ${t.state}\n`;
                q += `  Expression: ${t.expression}\n`;
                if (t.comments) q += `  Notes: ${t.comments}\n`;
            });
            q += `\nPlease:\n`;
            q += `1. Explain what this item measures and its operational significance\n`;
            q += `2. Assess whether the current value is normal or warrants attention\n`;
            q += `3. Evaluate each linked trigger — is the expression correct? Are thresholds well-calibrated for the observed data?\n`;
            q += `4. If any trigger is currently in PROBLEM state, explain the likely cause and recommended action\n`;
            q += `5. Suggest any improvements to trigger expressions or thresholds based on the statistical data`;
        } else {
            q += `\nNo triggers are currently linked to this item.\n`;
            q += `\nPlease:\n`;
            q += `1. Explain what this item measures and its operational significance\n`;
            q += `2. Assess whether the current value is normal or warrants attention\n`;
            q += `3. Suggest appropriate trigger thresholds and Zabbix expressions for this item\n`;
            q += `4. Recommend monitoring best practices for this metric`;
        }

        return q;
    }

    // =========================================================================
    // TRIGGERS
    // =========================================================================

    function injectTriggerHelper(dialog, settings) {
        const exprField = dialog.querySelector('textarea[name="expression"]') ||
                          dialog.querySelector('input[name="expression"]');
        if (!exprField) return;
        if (dialog.querySelector('.aiintegration-trigger-helper')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aiintegration-trigger-helper';
        btn.innerHTML = '✨ Generate Trigger with AI';
        btn.style.cssText = 'margin-top:8px;padding:8px 16px;' +
            'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);' +
            'color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
        btn.addEventListener('click', () => showTriggerGeneratorModal(dialog, exprField, settings));
        exprField.parentNode.insertBefore(btn, exprField.nextSibling);
    }

    async function resolveHostForTrigger(dialog) {
        const hidden = dialog.querySelector('input[name="hostid"]') ||
                       dialog.querySelector('input[id="hostid"]');
        if (hidden && hidden.value) {
            const hosts = await zabbixApi('host.get', {
                hostids: [hidden.value], output: ['hostid', 'host', 'name']
            });
            if (hosts && hosts.length) {
                return { hostid: hidden.value, hostname: hosts[0].name || hosts[0].host };
            }
        }
        return null;
    }

    async function showTriggerGeneratorModal(dialog, exprField, settings) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');
        content.innerHTML = `<div style="text-align:center;padding:20px;color:#6b7280;">⏳ Resolving host context…</div>`;

        const providerSelect = createProviderSelect(settings);
        const modal = Core.openModal('✨ AI Trigger Generator', content, [], { headerExtra: providerSelect });

        let hostContext = null;
        let hostItems   = null;
        try {
            hostContext = await resolveHostForTrigger(dialog);
            if (hostContext) {
                hostItems = await zabbixApi('item.get', {
                    hostids: [hostContext.hostid],
                    output: ['itemid', 'name', 'key_', 'units', 'value_type', 'lastvalue'],
                    filter: { status: 0 }, sortfield: 'name', limit: 30
                });
            }
        } catch (e) { /* non-fatal */ }

        content.innerHTML = '';

        const infoBox = document.createElement('div');
        infoBox.style.cssText = 'background:#f0f7ff;padding:12px;border-radius:6px;margin-bottom:14px;font-size:13px;';
        infoBox.innerHTML = '💡 Describe what you want to monitor in plain English.';
        if (hostContext) {
            infoBox.innerHTML += ` <strong>Host: ${Core.escapeHtml(hostContext.hostname)}</strong>`;
        }
        content.appendChild(infoBox);

        const descField = document.createElement('div');
        descField.className = 'aiintegration-field';
        descField.innerHTML =
            '<label style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">What do you want to monitor?</label>';
        const descArea = document.createElement('textarea');
        descArea.id = 'trig_desc'; descArea.rows = 4;
        descArea.style.cssText = 'width:100%;box-sizing:border-box;';
        descArea.placeholder = 'e.g. Alert when CPU usage is above 80% for more than 5 minutes';
        descField.appendChild(descArea);
        content.appendChild(descField);

        const ctxField = document.createElement('div');
        ctxField.className = 'aiintegration-field';
        ctxField.innerHTML =
            '<label style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">Additional context (optional):</label>';
        const ctxArea = document.createElement('textarea');
        ctxArea.id = 'trig_ctx_extra'; ctxArea.rows = 2;
        ctxArea.style.cssText = 'width:100%;box-sizing:border-box;';
        ctxArea.placeholder = 'Severity, business hours, thresholds…';
        ctxField.appendChild(ctxArea);
        content.appendChild(ctxField);

        if (hostItems && hostItems.length) {
            const det = document.createElement('details');
            det.style.marginBottom = '12px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;margin-bottom:6px;';
            sum.textContent = `📋 ${hostItems.length} available items on this host`;
            det.appendChild(sum);
            const itemList = document.createElement('div');
            itemList.style.cssText = 'font-size:12px;font-family:monospace;background:#f9fafb;' +
                'padding:8px;border-radius:4px;max-height:140px;overflow-y:auto;';
            itemList.textContent = hostItems.map(i =>
                `${i.name} [${i.key_}]${i.lastvalue ? ' = ' + i.lastvalue + (i.units || '') : ''}`
            ).join('\n');
            det.appendChild(itemList);
            content.appendChild(det);
        }

        const respDiv = document.createElement('div');
        respDiv.id = 'trig_resp'; respDiv.style.display = 'none';
        content.appendChild(respDiv);

        modal.setActions([
            {
                label: 'Generate',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const desc  = (document.getElementById('trig_desc')      || {}).value || '';
                    const extra = (document.getElementById('trig_ctx_extra') || {}).value || '';
                    const provider = providerSelect.value;

                    if (!desc.trim()) {
                        showError('trig_resp', 'Please describe what you want to monitor.');
                        return;
                    }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Generating…';

                    let question = `Generate a Zabbix trigger expression for:\n\n${desc}`;
                    if (extra) question += `\n\nAdditional context: ${extra}`;
                    if (hostContext) question += `\n\nHost: ${hostContext.hostname}`;
                    if (hostItems && hostItems.length) {
                        question += `\n\nAvailable items:\n` +
                            hostItems.slice(0, 20).map(i =>
                                `- ${i.name} [key: ${i.key_}]${i.units ? ' (' + i.units + ')' : ''}`
                            ).join('\n');
                    }
                    question += `\n\nReturn the Zabbix trigger expression using exact item keys from the list.`;

                    Core.callAI(question, { type: 'trigger_generation', host: hostContext }, provider)
                        .then(data => {
                            showTriggerResult('trig_resp', data.response, exprField, modal);
                            btn.disabled = false; btn.textContent = 'Generate';
                        })
                        .catch(err => {
                            showError('trig_resp', err.message);
                            btn.disabled = false; btn.textContent = 'Generate';
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

    function showTriggerResult(areaId, text, exprField, modal) {
        const Core = window.AIIntegrationCore;
        const area = document.getElementById(areaId);
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = '';

        const resp = document.createElement('div');
        resp.className = 'aiintegration-response';
        resp.innerHTML = Core.renderText(text);
        area.appendChild(resp);

        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'aiintegration-btn aiintegration-btn-primary';
        useBtn.style.marginTop = '10px';
        useBtn.textContent = '✓ Use This Expression';
        useBtn.addEventListener('click', () => {
            const expr = extractTriggerExpression(text);
            if (exprField) {
                exprField.value = expr;
                exprField.dispatchEvent(new Event('change', { bubbles: true }));
                exprField.dispatchEvent(new Event('input',  { bubbles: true }));
            }
            modal.close();
        });
        area.appendChild(useBtn);
    }

    function extractTriggerExpression(text) {
        const m = text.match(/\{[^}]+:[^}]+\.[^}]+\([^)]*\)\s*[><=!]+\s*[\d.]+/);
        return m ? m[0].trim() : text.trim();
    }

    // =========================================================================
    // HOSTS
    // =========================================================================

    function injectHostHelper(dialog, settings) {
        if (dialog.querySelector('.aiintegration-host-helper')) return;

        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;

        const section = document.createElement('div');
        section.className = 'aiintegration-host-helper';
        section.style.cssText = 'margin:0 0 14px;padding:10px 14px;' +
            'background:linear-gradient(135deg,#667eea0d,#764ba20d);' +
            'border:1px solid #e5e7eb;border-radius:6px;' +
            'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        const label = document.createElement('span');
        label.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
        label.textContent = '🤖 AI Analysis:';
        section.appendChild(label);

        [
            { text: '🏥 Host Health',       action: 'health'   },
            { text: '📊 Metrics Summary',    action: 'metrics'  },
            { text: '💡 Optimization Tips',  action: 'optimize' }
        ].forEach(({ text, action }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.style.cssText = 'padding:0px 8px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);' +
                'border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:13px;';
            btn.addEventListener('click', () => showHostAssistantModal(dialog, action, settings));
            section.appendChild(btn);
        });

        formBody.insertBefore(section, formBody.firstChild);
    }

    async function resolveHostFromDialog(dialog) {
        const hidden = dialog.querySelector('input[name="hostid"]') ||
                       dialog.querySelector('input[id="hostid"]');
        if (hidden && hidden.value) return { hostid: hidden.value };

        const urlMatch = window.location.href.match(/hostid=(\d+)/);
        if (urlMatch) return { hostid: urlMatch[1] };

        const nameInput = dialog.querySelector('input[name="host"]') ||
                          dialog.querySelector('input[id="host"]');
        if (nameInput && nameInput.value.trim()) {
            const r = await zabbixApi('host.get', {
                search: { host: nameInput.value.trim() },
                output: ['hostid'], limit: 1
            });
            if (r && r.length) return { hostid: r[0].hostid };
        }
        return null;
    }

    function computeHostHealthScore(problems) {
        if (!problems || !problems.length) return 100;
        const weights = [0, 1, 3, 6, 12, 25];
        const penalty = problems.reduce((acc, p) => acc + (weights[parseInt(p.severity, 10)] || 0), 0);
        return Math.max(0, Math.round(100 - penalty));
    }

    async function showHostAssistantModal(dialog, action, settings) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');
        content.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280;">⏳ Loading host data…</div>`;

        const providerSelect = createProviderSelect(settings);
        const titles = {
            health:   '🏥 Host Health Dashboard',
            metrics:  '📊 Metrics Summary',
            optimize: '💡 Optimization Tips'
        };
        const modal = Core.openModal(
            titles[action] || '🤖 AI Host Assistant', content, [], { headerExtra: providerSelect }
        );

        const hostRef = await resolveHostFromDialog(dialog).catch(() => null);
        if (!hostRef) {
            content.innerHTML = `<div class="aiintegration-error">` +
                `Could not determine the host. Save the host first, then re-open for AI analysis.</div>`;
            modal.setActions([{
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: c => c()
            }]);
            return;
        }

        const [hostDetails, problems, triggers, metrics, incidents] = await Promise.all([
            zabbixApi('host.get', {
                hostids: [hostRef.hostid],
                output: ['hostid', 'host', 'name', 'status'],
                selectGroups: ['name']
            }),
            zabbixApi('problem.get', {
                hostids: [hostRef.hostid],
                output: ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
                sortfield: ['severity', 'clock'], sortorder: 'DESC'
            }),
            zabbixApi('trigger.get', {
                hostids: [hostRef.hostid],
                output: ['triggerid', 'description', 'priority', 'status', 'value', 'lastchange'],
                filter: { status: 0 },
                sortfield: ['priority', 'lastchange'], sortorder: 'DESC', limit: 20
            }),
            zabbixApi('item.get', {
                hostids: [hostRef.hostid],
                output: ['itemid', 'name', 'key_', 'lastvalue', 'units', 'lastclock'],
                filter: { status: 0, state: 0 },
                sortfield: 'lastclock', sortorder: 'DESC', limit: 25
            }),
            zabbixApi('event.get', {
                hostids: [hostRef.hostid], source: 0, object: 0, value: 1,
                time_from: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
                output: ['eventid', 'name', 'severity'], limit: 20
            })
        ]).catch(() => [null, [], [], [], []]);

        const detail       = hostDetails && hostDetails.length ? hostDetails[0] : null;
        const problemList  = problems  || [];
        const triggerList  = triggers  || [];
        const metricList   = metrics   || [];
        const incidentList = incidents || [];
        const hostname     = detail ? (detail.name || detail.host) : 'Unknown';
        const healthScore  = computeHostHealthScore(problemList);

        const enriched = {
            host: {
                hostid: hostRef.hostid,
                name:   hostname,
                groups: detail && detail.groups ? detail.groups.map(g => g.name) : []
            },
            health_score:     healthScore,
            active_problems:  {
                total: problemList.length,
                list:  problemList.slice(0, 10).map(p => ({
                    name:         p.name,
                    severity:     getSeverityName(p.severity),
                    acknowledged: p.acknowledged === '1'
                }))
            },
            triggers_summary: {
                total:  triggerList.length,
                firing: triggerList.filter(t => t.value === '1').length
            },
            recent_metrics: metricList.slice(0, 15).map(i => ({
                name: i.name, key: i.key_, last_value: i.lastvalue, units: i.units
            })),
            incidents_30d: incidentList.length
        };

        content.innerHTML = '';

        const scoreColor = healthScore >= 80 ? '#166534' : healthScore >= 50 ? '#92400e' : '#991b1b';
        const scoreBg    = healthScore >= 80 ? '#f0fdf4' : healthScore >= 50 ? '#fffbeb' : '#fef2f2';

        const scoreEl = document.createElement('div');
        scoreEl.style.cssText =
            `display:flex;align-items:center;gap:14px;padding:12px 16px;` +
            `background:${scoreBg};border-radius:6px;margin-bottom:14px;`;
        scoreEl.innerHTML =
            `<div style="font-size:34px;font-weight:800;color:${scoreColor};">` +
            `${healthScore}<span style="font-size:14px;">/100</span></div>` +
            `<div><div style="font-weight:700;color:${scoreColor};">${Core.escapeHtml(hostname)}</div>` +
            `<div style="font-size:13px;color:#6b7280;">` +
            `${problemList.length} active problem(s) · ${incidentList.length} incident(s) in 30d` +
            `</div></div>`;
        content.appendChild(scoreEl);

        if (problemList.length) {
            const sevBadges = document.createElement('div');
            sevBadges.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
            const sevCounts = {};
            problemList.forEach(p => { sevCounts[p.severity] = (sevCounts[p.severity] || 0) + 1; });
            Object.entries(sevCounts).forEach(([sev, cnt]) => {
                const span = document.createElement('span');
                span.style.cssText =
                    `background:${getSeverityColor(sev)};color:white;` +
                    `padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;`;
                span.textContent = `${getSeverityName(sev)}: ${cnt}`;
                sevBadges.appendChild(span);
            });
            content.appendChild(sevBadges);
        } else {
            const ok = document.createElement('div');
            ok.style.cssText =
                'background:#f0fdf4;color:#166534;padding:8px 12px;' +
                'border-radius:4px;margin-bottom:12px;font-size:13px;';
            ok.textContent = '✓ No active problems';
            content.appendChild(ok);
        }

        if (metricList.length) {
            const det = document.createElement('details');
            det.style.marginBottom = '12px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;';
            sum.textContent = `📈 Recent Metrics (${metricList.length})`;
            det.appendChild(sum);
            const mt = document.createElement('table');
            mt.className = 'aiintegration-summary-table';
            mt.innerHTML = metricList.slice(0, 10).map(i =>
                `<tr><td>${Core.escapeHtml(i.name)}</td>` +
                `<td>${Core.escapeHtml(i.lastvalue || 'N/A')}` +
                `${i.units ? ' ' + Core.escapeHtml(i.units) : ''}</td></tr>`
            ).join('');
            det.appendChild(mt);
            content.appendChild(det);
        }

        const qField = document.createElement('div');
        qField.className = 'aiintegration-field';
        qField.innerHTML =
            '<label style="display:block;font-weight:600;font-size:13px;margin-bottom:4px;">Ask AI:</label>';
        const qArea = document.createElement('textarea');
        qArea.id = 'host_question'; qArea.rows = 4;
        qArea.style.cssText = 'width:100%;box-sizing:border-box;';
        qArea.value = buildHostDefaultQuestion(action, hostname, enriched);
        qField.appendChild(qArea);
        content.appendChild(qField);

        if (settings.is_super_admin) {
            const det = document.createElement('details');
            det.style.marginTop = '12px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;';
            sum.textContent = '🔧 Context JSON (Super Admin)';
            det.appendChild(sum);
            const ctxA = document.createElement('textarea');
            ctxA.id = 'host_ctx_json'; ctxA.rows = 10;
            ctxA.style.cssText =
                'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
            ctxA.value = JSON.stringify(enriched, null, 2);
            det.appendChild(ctxA);
            content.appendChild(det);
        }

        const respDiv = document.createElement('div');
        respDiv.id = 'host_resp'; respDiv.style.display = 'none';
        content.appendChild(respDiv);

        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const q = (document.getElementById('host_question') || {}).value || '';
                    const provider = providerSelect.value;
                    let ctx = enriched;
                    if (settings.is_super_admin) {
                        const el = document.getElementById('host_ctx_json');
                        if (el) {
                            try { ctx = JSON.parse(el.value || '{}'); }
                            catch (_) { showError('host_resp', 'Invalid JSON.'); return; }
                        }
                    }
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';
                    Core.callAI(q, ctx, provider)
                        .then(data => {
                            showResponse('host_resp', data.response);
                            btn.disabled = false; btn.textContent = 'Analyze';
                        })
                        .catch(err => {
                            showError('host_resp', err.message);
                            btn.disabled = false; btn.textContent = 'Analyze';
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

    function buildHostDefaultQuestion(action, hostname, ctx) {
        const base = [
            `Host: ${hostname}`,
            `Health score: ${ctx.health_score}/100`,
            `Active problems: ${ctx.active_problems.total}`,
            `Incidents (30d): ${ctx.incidents_30d}`,
            `Firing triggers: ${ctx.triggers_summary.firing}/${ctx.triggers_summary.total}`
        ].join('\n');

        const prompts = {
            health:
                `Perform a health analysis for this Zabbix host:\n\n${base}\n\n` +
                `1. Interpret the health score\n` +
                `2. Identify critical issues\n` +
                `3. Prioritized action plan\n` +
                `4. Preventive measures`,
            metrics:
                `Analyze metrics for this Zabbix host:\n\n${base}\n\nKey metrics:\n` +
                ctx.recent_metrics.slice(0, 8).map(m =>
                    `- ${m.name}: ${m.last_value || 'N/A'}${m.units ? ' ' + m.units : ''}`
                ).join('\n') +
                `\n\n1. Assess values\n2. Identify anomalies\n3. Suggest improvements`,
            optimize:
                `Provide optimization recommendations for this Zabbix host:\n\n${base}\n\n` +
                `1. Monitoring improvements\n` +
                `2. Alert threshold tuning\n` +
                `3. Missing monitors\n` +
                `4. Best practices`
        };
        return prompts[action] || prompts.health;
    }

})();
