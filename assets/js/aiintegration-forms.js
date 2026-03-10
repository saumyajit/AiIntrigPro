/**
 * AI Integration - Form Helpers
 * Injects AI assistance into:
 *   • Item form   (overlay-dialogue with form[name="itemForm"])  — NEW
 *   • Trigger form (overlay-dialogue with trigger expression)
 *   • Host form   (overlay-dialogue with form[name="hostForm"])
 */
(function() {
    'use strict';

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

    // ── Shared: Zabbix JSON-RPC helper ───────────────────────────────────────

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

    // ── Shared: provider select widget ───────────────────────────────────────

    function createProviderSelect(settings) {
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:13px;padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.9);color:#1f1f1f;';

        if (!settings || !settings.providers || !settings.providers.length) {
            const o = document.createElement('option');
            o.value = 'openai'; o.textContent = 'No providers';
            sel.appendChild(o); sel.disabled = true; return sel;
        }

        settings.providers.forEach(p => {
            const o = document.createElement('option');
            o.value = p.name;   // provider key, e.g. 'openai', 'anthropic'
            o.textContent = p.name + (p.model ? ' – ' + p.model : '');
            if (p.name === settings.default_provider) o.selected = true;
            sel.appendChild(o);
        });

        return sel;
    }

    function showError(areaId, msg) {
        const Core = window.AIIntegrationCore;
        const el = document.getElementById(areaId);
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `<div class="aiintegration-error">${Core.escapeHtml(msg)}</div>`;
    }

    function showResponse(areaId, text) {
        const Core = window.AIIntegrationCore;
        const el = document.getElementById(areaId);
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `<div class="aiintegration-response">${Core.renderText(text || '')}</div>`;
    }

    // =========================================================================
    // ITEMS — inject AI analysis button into the Item configuration dialog
    // =========================================================================

    function injectItemHelper(dialog, settings) {
        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;
        if (dialog.querySelector('.aiintegration-item-helper')) return;

        const section = document.createElement('div');
        section.className = 'aiintegration-item-helper';
        section.style.cssText = 'margin:0 0 14px;padding:10px 14px;background:linear-gradient(135deg,#667eea0d,#764ba20d);border:1px solid #e5e7eb;border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        const label = document.createElement('span');
        label.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
        label.textContent = '🤖 AI Analysis:';
        section.appendChild(label);

        const analyzeBtn = document.createElement('button');
        analyzeBtn.type = 'button';
        analyzeBtn.textContent = '📊 Analyze Item';
        analyzeBtn.style.cssText = 'padding:6px 14px;background:white;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:13px;transition:all 0.2s;';
        analyzeBtn.addEventListener('click', () => showItemFormAnalysisModal(dialog, settings));
        section.appendChild(analyzeBtn);

        formBody.insertBefore(section, formBody.firstChild);
    }

    async function showItemFormAnalysisModal(dialog, settings) {
        const Core = window.AIIntegrationCore;

        // Resolve itemid from the form
        let itemid = null;
        const hiddenId = dialog.querySelector('input[name="itemid"]') ||
                         dialog.querySelector('input[id="itemid"]');
        if (hiddenId && hiddenId.value) {
            itemid = hiddenId.value;
        }

        // Also try reading itemid from URL
        if (!itemid) {
            const m = window.location.href.match(/itemid=(\d+)/);
            if (m) itemid = m[1];
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div style="text-align:center;padding:30px;color:#6b7280;">
                <div style="font-size:24px;margin-bottom:8px;">⏳</div>
                <div>${itemid ? 'Loading item history…' : 'Preparing analysis…'}</div>
                ${itemid ? '' : '<div style="margin-top:8px;color:#f59e0b;font-size:13px;">Item ID not found — save the item first for statistical analysis.</div>'}
            </div>`;

        const providerSelect = createProviderSelect(settings);
        const modal = Core.openModal('📊 AI Item Analysis', content, [], { headerExtra: providerSelect });

        // Gather item info from form fields
        const nameInput  = dialog.querySelector('input[name="name"]')  || dialog.querySelector('input[id="name"]');
        const keyInput   = dialog.querySelector('input[name="key_"]')  || dialog.querySelector('input[id="key_"]');
        const typeSelect = dialog.querySelector('select[name="type"]') || dialog.querySelector('select[id="type"]');

        let enriched = {
            item: {
                itemid:    itemid || null,
                name:      nameInput  ? nameInput.value  : '',
                key:       keyInput   ? keyInput.value   : '',
                type:      typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : '',
            },
            statistics:    null,
            trend:         null,
            recentHistory: []
        };

        // Fetch history and trends if we have an itemid
        if (itemid) {
            try {
                const [meta, histResult, trendData] = await Promise.all([
                    zabbixApi('item.get', {
                        itemids: [itemid],
                        output: ['itemid', 'name', 'key_', 'units', 'value_type', 'lastvalue', 'lastclock']
                    }).then(r => r && r.length ? r[0] : null),

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

                    zabbixApi('trend.get', {
                        itemids: [itemid],
                        time_from: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
                        output: ['clock', 'value_avg', 'value_min', 'value_max'],
                        limit: 720
                    })
                ]);

                if (meta) {
                    enriched.item = Object.assign({}, enriched.item, {
                        name:       meta.name,
                        key:        meta.key_,
                        units:      meta.units,
                        lastValue:  meta.lastvalue,
                        value_type: meta.value_type
                    });
                }

                if (histResult && histResult.values.length > 0) {
                    const nums = histResult.values.map(h => parseFloat(h.value)).filter(v => !isNaN(v));
                    if (nums.length >= 3) {
                        const n = nums.length;
                        const mean = nums.reduce((a, b) => a + b, 0) / n;
                        const std  = Math.sqrt(nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n);
                        const cur  = parseFloat(enriched.item.lastValue || 0);
                        const z    = std > 0 ? Math.round((cur - mean) / std * 100) / 100 : null;
                        enriched.statistics = {
                            count:        n,
                            mean:         Math.round(mean * 100) / 100,
                            stddev:       Math.round(std  * 100) / 100,
                            min:          Math.min(...nums),
                            max:          Math.max(...nums),
                            zscore:       z,
                            isAnomaly:    z !== null && Math.abs(z) > 3
                        };
                    }
                    enriched.recentHistory = histResult.values.slice(0, 5).map(h => ({
                        time:  new Date(parseInt(h.clock, 10) * 1000).toISOString(),
                        value: h.value
                    }));
                }

                if (trendData && trendData.length > 0) {
                    const recent = trendData.slice(-24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
                    const prior  = trendData.slice(-48, -24).map(t => parseFloat(t.value_avg)).filter(v => !isNaN(v));
                    let direction = 'insufficient data';
                    if (recent.length && prior.length) {
                        const pct = ((recent.reduce((a, b) => a + b, 0) / recent.length) -
                                     (prior.reduce((a, b) => a + b, 0) / prior.length)) /
                                    Math.abs(prior.reduce((a, b) => a + b, 0) / prior.length) * 100;
                        direction = pct > 15 ? `rising (+${Math.round(pct)}%)` :
                                    pct < -15 ? `falling (${Math.round(pct)}%)` : 'stable';
                    }
                    enriched.trend = { direction, data_points_30d: trendData.length };
                }
            } catch (e) {
                console.warn('AI Integration: item form enrichment failed', e);
            }
        }

        // Build modal content
        content.innerHTML = '';

        const s = enriched.statistics;
        let anomalyHtml = '';
        if (s && s.zscore !== null) {
            const absZ = Math.abs(s.zscore);
            if (absZ > 3)   anomalyHtml = `<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;margin-left:6px;">🚨 ANOMALY z=${s.zscore}</span>`;
            else if (absZ > 2) anomalyHtml = `<span style="background:#fffbeb;color:#92400e;padding:2px 8px;border-radius:10px;font-size:12px;margin-left:6px;">⚠ ELEVATED z=${s.zscore}</span>`;
            else anomalyHtml = `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:10px;font-size:12px;margin-left:6px;">✓ Normal z=${s.zscore}</span>`;
        }

        const tbl = document.createElement('table');
        tbl.className = 'aiintegration-summary-table';
        tbl.innerHTML =
            `<tr><td>Item Name</td><td>${Core.escapeHtml(enriched.item.name || 'N/A')}</td></tr>` +
            `<tr><td>Key</td><td>${Core.escapeHtml(enriched.item.key   || 'N/A')}</td></tr>` +
            (enriched.item.lastValue !== undefined
                ? `<tr><td>Last Value</td><td>${Core.escapeHtml(String(enriched.item.lastValue || 'N/A'))}${anomalyHtml}</td></tr>`
                : '') +
            (s && s.count >= 3
                ? `<tr><td>Mean ± StdDev</td><td>${s.mean} ± ${s.stddev}</td></tr>` +
                  `<tr><td>Range</td><td>${s.min} – ${s.max}</td></tr>`
                : '') +
            (enriched.trend ? `<tr><td>30d Trend</td><td>${Core.escapeHtml(enriched.trend.direction)}</td></tr>` : '');
        content.appendChild(tbl);

        // Question textarea
        const qField = document.createElement('div');
        qField.className = 'aiintegration-field';
        qField.innerHTML = '<label>Ask AI:</label>';
        const qArea = document.createElement('textarea');
        qArea.id = 'item_form_question';
        qArea.rows = 4;
        qArea.style.cssText = 'width:100%;box-sizing:border-box;';
        qArea.value = buildItemDefaultQuestion(enriched);
        qField.appendChild(qArea);
        content.appendChild(qField);

        // Super Admin context
        if (settings.is_super_admin) {
            const det = document.createElement('details');
            det.style.marginTop = '12px';
            const sum = document.createElement('summary');
            sum.style.cssText = 'cursor:pointer;font-size:13px;color:#6b7280;';
            sum.textContent = '🔧 Context JSON (Super Admin)';
            det.appendChild(sum);
            const ctxArea = document.createElement('textarea');
            ctxArea.id = 'item_form_ctx';
            ctxArea.rows = 10;
            ctxArea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
            ctxArea.value = JSON.stringify(enriched, null, 2);
            det.appendChild(ctxArea);
            content.appendChild(det);
        }

        const respDiv = document.createElement('div');
        respDiv.id = 'item_form_resp';
        respDiv.style.display = 'none';
        content.appendChild(respDiv);

        modal.setActions([
            {
                label: 'Analyze',
                className: 'aiintegration-btn aiintegration-btn-primary',
                onClick: (close, btn) => {
                    const question = (document.getElementById('item_form_question') || {}).value || '';
                    const provider = providerSelect.value;
                    let ctx = enriched;
                    if (settings.is_super_admin) {
                        const el = document.getElementById('item_form_ctx');
                        if (el) { try { ctx = JSON.parse(el.value || '{}'); } catch (_) { showError('item_form_resp', 'Invalid JSON.'); return; } }
                    }
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';
                    Core.callAI(question, ctx, provider)
                        .then(data => { showResponse('item_form_resp', data.response); btn.disabled = false; btn.textContent = 'Analyze'; })
                        .catch(err  => { showError('item_form_resp', err.message);       btn.disabled = false; btn.textContent = 'Analyze'; });
                }
            },
            {
                label: 'Close',
                className: 'aiintegration-btn aiintegration-btn-secondary',
                onClick: close => close()
            }
        ]);
    }

    function buildItemDefaultQuestion(ctx) {
        const i = ctx.item;
        const s = ctx.statistics;
        let q = `Analyze this Zabbix item:\n• Name: ${i.name || 'N/A'}\n• Key: ${i.key || 'N/A'}\n`;
        if (i.lastValue !== undefined) q += `• Current value: ${i.lastValue}\n`;
        if (s && s.count >= 3) {
            q += `• Historical mean: ${s.mean}  StdDev: ${s.stddev}  (${s.count} samples)\n`;
            q += `• Range: ${s.min} – ${s.max}\n`;
            if (s.zscore !== null) q += `• Z-score: ${s.zscore}  (${s.isAnomaly ? 'ANOMALY' : 'normal'})\n`;
        }
        if (ctx.trend) q += `• 30d trend: ${ctx.trend.direction}\n`;
        q += `\nPlease:\n1. Explain what this item measures and its importance\n`;
        q += `2. Assess whether the current value is within normal range\n`;
        q += `3. Suggest appropriate trigger thresholds\n`;
        q += `4. Recommend monitoring best practices for this metric`;
        return q;
    }

    // =========================================================================
    // TRIGGERS — inject "Generate Trigger with AI" button near expression field
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
        btn.style.cssText = 'margin-top:8px;padding:8px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
        btn.addEventListener('click', () => showTriggerGeneratorModal(dialog, exprField, settings));
        exprField.parentNode.insertBefore(btn, exprField.nextSibling);
    }

    // Resolve the host tied to this trigger dialog
    async function resolveHostForTrigger(dialog) {
        const hidden = dialog.querySelector('input[name="hostid"]') ||
                       dialog.querySelector('input[id="hostid"]');
        if (hidden && hidden.value) {
            const hosts = await zabbixApi('host.get', {
                hostids: [hidden.value], output: ['hostid', 'host', 'name']
            });
            if (hosts && hosts.length) return { hostid: hidden.value, hostname: hosts[0].name || hosts[0].host };
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
        infoBox.innerHTML = '💡 Describe what you want to monitor in plain English — AI will generate the Zabbix trigger expression.';
        if (hostContext) infoBox.innerHTML += ` <strong>Host: ${Core.escapeHtml(hostContext.hostname)}</strong>`;
        content.appendChild(infoBox);

        const descField = document.createElement('div');
        descField.className = 'aiintegration-field';
        descField.innerHTML = '<label>What do you want to monitor?</label>';
        const descArea = document.createElement('textarea');
        descArea.id = 'trig_desc'; descArea.rows = 4;
        descArea.style.cssText = 'width:100%;box-sizing:border-box;';
        descArea.placeholder = 'Example: Alert when CPU usage is above 80% for more than 5 minutes';
        descField.appendChild(descArea);
        content.appendChild(descField);

        const ctxField = document.createElement('div');
        ctxField.className = 'aiintegration-field';
        ctxField.innerHTML = '<label>Additional context (optional):</label>';
        const ctxArea = document.createElement('textarea');
        ctxArea.id = 'trig_ctx'; ctxArea.rows = 2;
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
            itemList.style.cssText = 'font-size:12px;font-family:monospace;background:#f9fafb;padding:8px;border-radius:4px;max-height:140px;overflow-y:auto;';
            itemList.textContent = hostItems.map(i => `${i.name} [${i.key_}]${i.lastvalue ? ' = ' + i.lastvalue + (i.units || '') : ''}`).join('\n');
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
                    const desc = (document.getElementById('trig_desc') || {}).value || '';
                    const extra = (document.getElementById('trig_ctx') || {}).value || '';
                    const provider = providerSelect.value;

                    if (!desc.trim()) { showError('trig_resp', 'Please describe what you want to monitor.'); return; }

                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Generating…';

                    let question = `Generate a Zabbix trigger expression for:\n\n${desc}`;
                    if (extra) question += `\n\nAdditional context: ${extra}`;
                    if (hostContext) question += `\n\nHost: ${hostContext.hostname}`;
                    if (hostItems && hostItems.length) {
                        question += `\n\nAvailable items:\n` +
                            hostItems.slice(0, 20).map(i => `- ${i.name} [key: ${i.key_}]${i.units ? ' (' + i.units + ')' : ''}`).join('\n');
                    }
                    question += `\n\nReturn ONLY the Zabbix trigger expression using exact item keys from the list above where applicable.`;

                    Core.callAI(question, { type: 'trigger_generation', host: hostContext }, provider)
                        .then(data => {
                            showTriggerResult('trig_resp', data.response, exprField, modal);
                            btn.disabled = false; btn.textContent = 'Generate';
                        })
                        .catch(err => { showError('trig_resp', err.message); btn.disabled = false; btn.textContent = 'Generate'; });
                }
            },
            { label: 'Close', className: 'aiintegration-btn aiintegration-btn-secondary', onClick: close => close() }
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
    // HOSTS — inject health dashboard button in host form header
    // =========================================================================

    function injectHostHelper(dialog, settings) {
        const formBody = dialog.querySelector('.overlay-dialogue-body') || dialog;
        if (dialog.querySelector('.aiintegration-host-helper')) return;

        const section = document.createElement('div');
        section.className = 'aiintegration-host-helper';
        section.style.cssText = 'margin:0 0 14px;padding:10px 14px;background:linear-gradient(135deg,#667eea0d,#764ba20d);border:1px solid #e5e7eb;border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';

        const label = document.createElement('span');
        label.style.cssText = 'font-weight:600;font-size:13px;color:#374151;';
        label.textContent = '🤖 AI Analysis:';
        section.appendChild(label);

        [
            { text: '🏥 Host Health',        action: 'health'   },
            { text: '📊 Metrics Summary',     action: 'metrics'  },
            { text: '💡 Optimization Tips',   action: 'optimize' }
        ].forEach(({ text, action }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.style.cssText = 'padding:6px 12px;background:white;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:13px;';
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
            const r = await zabbixApi('host.get', { search: { host: nameInput.value.trim() }, output: ['hostid'], limit: 1 });
            if (r && r.length) return { hostid: r[0].hostid };
        }
        return null;
    }

    function getSeverityName(sev)  { return ['Not classified','Information','Warning','Average','High','Disaster'][parseInt(sev,10)] || 'Unknown'; }
    function getSeverityColor(sev) { return ['#6b7280','#3b82f6','#f59e0b','#f97316','#ef4444','#7c3aed'][parseInt(sev,10)] || '#6b7280'; }

    function computeHostHealthScore(problems) {
        if (!problems || !problems.length) return 100;
        const w = [0, 1, 3, 6, 12, 25];
        const penalty = problems.reduce((acc, p) => acc + (w[parseInt(p.severity, 10)] || 0), 0);
        return Math.max(0, Math.round(100 - penalty));
    }

    async function showHostAssistantModal(dialog, action, settings) {
        const Core = window.AIIntegrationCore;

        const content = document.createElement('div');
        content.innerHTML = `<div style="text-align:center;padding:30px;color:#6b7280;">⏳ Loading host data…</div>`;

        const providerSelect = createProviderSelect(settings);
        const titles = { health: '🏥 Host Health Dashboard', metrics: '📊 Metrics Summary', optimize: '💡 Optimization Tips' };
        const modal = Core.openModal(titles[action] || '🤖 AI Host Assistant', content, [], { headerExtra: providerSelect });

        const hostRef = await resolveHostFromDialog(dialog).catch(() => null);
        if (!hostRef) {
            content.innerHTML = `<div class="aiintegration-error">Could not determine the host. Save the host first, then re-open for AI analysis.</div>`;
            modal.setActions([{ label: 'Close', className: 'aiintegration-btn aiintegration-btn-secondary', onClick: c => c() }]);
            return;
        }

        const [hostDetails, problems, triggers, metrics, incidents] = await Promise.all([
            zabbixApi('host.get', { hostids: [hostRef.hostid], output: ['hostid','host','name','status'], selectGroups: ['name'] }),
            zabbixApi('problem.get', { hostids: [hostRef.hostid], output: ['eventid','name','severity','clock','acknowledged'], sortfield: ['severity','clock'], sortorder: 'DESC' }),
            zabbixApi('trigger.get', { hostids: [hostRef.hostid], output: ['triggerid','description','priority','status','value','lastchange'], filter: { status: 0 }, sortfield: ['priority','lastchange'], sortorder: 'DESC', limit: 20 }),
            zabbixApi('item.get',    { hostids: [hostRef.hostid], output: ['itemid','name','key_','lastvalue','units','lastclock'], filter: { status: 0, state: 0 }, sortfield: 'lastclock', sortorder: 'DESC', limit: 25 }),
            zabbixApi('event.get',   { hostids: [hostRef.hostid], source: 0, object: 0, value: 1, time_from: Math.floor(Date.now()/1000) - 30*24*3600, output: ['eventid','name','severity'], limit: 20 })
        ]).then(r => r).catch(() => [null, [], [], [], []]);

        const detail       = hostDetails && hostDetails.length ? hostDetails[0] : null;
        const problemList  = problems  || [];
        const triggerList  = triggers  || [];
        const metricList   = metrics   || [];
        const incidentList = incidents || [];
        const hostname     = detail ? (detail.name || detail.host) : 'Unknown';
        const healthScore  = computeHostHealthScore(problemList);

        const enriched = {
            host: { hostid: hostRef.hostid, name: hostname, groups: detail && detail.groups ? detail.groups.map(g => g.name) : [] },
            health_score: healthScore,
            active_problems: {
                total: problemList.length,
                list: problemList.slice(0, 10).map(p => ({ name: p.name, severity: getSeverityName(p.severity), acknowledged: p.acknowledged === '1' }))
            },
            triggers_summary: { total: triggerList.length, firing: triggerList.filter(t => t.value === '1').length },
            recent_metrics: metricList.slice(0, 15).map(i => ({ name: i.name, key: i.key_, last_value: i.lastvalue, units: i.units })),
            incidents_30d: incidentList.length
        };

        // Build content
        content.innerHTML = '';

        const scoreColor = healthScore >= 80 ? '#166534' : healthScore >= 50 ? '#92400e' : '#991b1b';
        const scoreBg    = healthScore >= 80 ? '#f0fdf4' : healthScore >= 50 ? '#fffbeb' : '#fef2f2';

        const scoreEl = document.createElement('div');
        scoreEl.style.cssText = `display:flex;align-items:center;gap:14px;padding:12px 16px;background:${scoreBg};border-radius:6px;margin-bottom:14px;`;
        scoreEl.innerHTML = `
            <div style="font-size:34px;font-weight:800;color:${scoreColor};">${healthScore}<span style="font-size:14px;">/100</span></div>
            <div>
                <div style="font-weight:700;color:${scoreColor};">${Core.escapeHtml(hostname)}</div>
                <div style="font-size:13px;color:#6b7280;">${problemList.length} active problem(s) · ${incidentList.length} incident(s) in 30d</div>
            </div>`;
        content.appendChild(scoreEl);

        if (problemList.length) {
            const sevBadges = document.createElement('div');
            sevBadges.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
            const sevCounts = {};
            problemList.forEach(p => { sevCounts[p.severity] = (sevCounts[p.severity] || 0) + 1; });
            Object.entries(sevCounts).forEach(([sev, cnt]) => {
                const span = document.createElement('span');
                span.style.cssText = `background:${getSeverityColor(sev)};color:white;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;`;
                span.textContent = `${getSeverityName(sev)}: ${cnt}`;
                sevBadges.appendChild(span);
            });
            content.appendChild(sevBadges);
        } else {
            const ok = document.createElement('div');
            ok.style.cssText = 'background:#f0fdf4;color:#166534;padding:8px 12px;border-radius:4px;margin-bottom:12px;font-size:13px;';
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
                `<tr><td>${Core.escapeHtml(i.name)}</td><td>${Core.escapeHtml(i.lastvalue||'N/A')}${i.units?' '+Core.escapeHtml(i.units):''}</td></tr>`
            ).join('');
            det.appendChild(mt);
            content.appendChild(det);
        }

        const qField = document.createElement('div');
        qField.className = 'aiintegration-field';
        qField.innerHTML = '<label>Ask AI:</label>';
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
            ctxA.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;margin-top:8px;';
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
                        if (el) { try { ctx = JSON.parse(el.value || '{}'); } catch (_) { showError('host_resp', 'Invalid JSON.'); return; } }
                    }
                    btn.disabled = true;
                    btn.innerHTML = '<span class="aiintegration-loading"></span> Analyzing…';
                    Core.callAI(q, ctx, provider)
                        .then(data => { showResponse('host_resp', data.response); btn.disabled = false; btn.textContent = 'Analyze'; })
                        .catch(err  => { showError('host_resp', err.message);       btn.disabled = false; btn.textContent = 'Analyze'; });
                }
            },
            { label: 'Close', className: 'aiintegration-btn aiintegration-btn-secondary', onClick: close => close() }
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
            health:   `Perform a health analysis:\n\n${base}\n\n1. Interpret the health score\n2. Identify critical issues\n3. Prioritized action plan\n4. Preventive measures`,
            metrics:  `Analyze metrics:\n\n${base}\n\nKey metrics:\n${ctx.recent_metrics.slice(0,8).map(m=>`- ${m.name}: ${m.last_value||'N/A'}${m.units?' '+m.units:''}`).join('\n')}\n\n1. Assess values\n2. Identify anomalies\n3. Suggest improvements`,
            optimize: `Provide optimization recommendations:\n\n${base}\n\n1. Monitoring improvements\n2. Alert threshold tuning\n3. Missing monitors\n4. Best practices`
        };
        return prompts[action] || prompts.health;
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDependencies(init));
    } else {
        waitForDependencies(init);
    }
})();
