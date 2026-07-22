// NetViz UI + canvas
(function () {
  'use strict';

  const { Simulator, DEVICE_DEFAULTS, SPEED_PRESETS, utilColor, utilClass, clamp } = window.NetVizSim;

  const canvas = document.getElementById('net-canvas');
  const ctx = canvas.getContext('2d');
  const sim = new Simulator();

  const els = {
    status: document.getElementById('status-text'),
    fps: document.getElementById('fps-text'),
    play: document.getElementById('btn-play'),
    pause: document.getElementById('btn-pause'),
    spike: document.getElementById('btn-spike'),
    speed: document.getElementById('sim-speed'),
    speedLabel: document.getElementById('sim-speed-label'),
    traffic: document.getElementById('traffic-scale'),
    trafficLabel: document.getElementById('traffic-scale-label'),
    statDevices: document.getElementById('stat-devices'),
    statLinks: document.getElementById('stat-links'),
    statPackets: document.getElementById('stat-packets'),
    statUtil: document.getElementById('stat-util'),
    statHot: document.getElementById('stat-hot'),
    statMbps: document.getElementById('stat-mbps'),
    packetLog: document.getElementById('packet-log'),
    selectionInfo: document.getElementById('selection-info'),
    contextMenu: document.getElementById('context-menu'),
    ctxDelete: document.getElementById('ctx-delete'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    propsForm: document.getElementById('props-form'),
    propsFields: document.getElementById('props-fields'),
    modalTitle: document.getElementById('modal-title'),
    modalCancel: document.getElementById('modal-cancel'),
    loadBackdrop: document.getElementById('load-backdrop'),
    topologyList: document.getElementById('topology-list'),
    loadCancel: document.getElementById('load-cancel'),
  };

  let dragging = null;
  let linkingFrom = null;
  let hoverDevice = null;
  let hoverLink = null;
  let menuPos = { x: 0, y: 0 };
  let lastTs = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let editTarget = null;

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const toolbar = wrap.querySelector('.canvas-toolbar');
    const w = wrap.clientWidth;
    const h = Math.max(480, wrap.clientHeight - (toolbar ? toolbar.offsetHeight : 0));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resizeCanvas);

  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function hitDevice(x, y) {
    for (let i = sim.devices.length - 1; i >= 0; i--) {
      const d = sim.devices[i];
      const dx = x - d.x;
      const dy = y - d.y;
      if (dx * dx + dy * dy <= d.r * d.r) return d;
    }
    return null;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    const nx = x1 + t * dx;
    const ny = y1 + t * dy;
    return Math.hypot(px - nx, py - ny);
  }

  function hitLink(x, y) {
    let best = null;
    let bestDist = 8;
    for (const link of sim.links) {
      const a = sim.getDevice(link.a);
      const b = sim.getDevice(link.b);
      if (!a || !b) continue;
      const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
      if (d < bestDist) {
        bestDist = d;
        best = link;
      }
    }
    return best;
  }

  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    for (const link of sim.links) {
      const a = sim.getDevice(link.a);
      const b = sim.getDevice(link.b);
      if (!a || !b) continue;
      const util = sim.utilization(link);
      const color = utilColor(util);
      const selected = sim.selectedType === 'link' && sim.selectedId === link.id;
      const hover = hoverLink && hoverLink.id === link.id;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = selected || hover ? 5 : 3 + Math.min(3, util * 3);
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (util >= 0.85) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(239,68,68,0.25)';
        ctx.lineWidth = 12;
        ctx.stroke();
      }

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const label = `${Math.round(util * 100)}% · ${Math.round(link.currentTrafficMbps)}/${link.bandwidthMbps} Mbps`;
      ctx.font = '11px IBM Plex Mono, monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(11,18,32,0.82)';
      ctx.fillRect(mx - tw / 2 - 4, my - 16, tw + 8, 16);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my - 8);
    }

    for (const p of sim.packets) {
      const link = sim.getLink(p.linkId);
      if (!link) continue;
      const a = sim.getDevice(link.a);
      const b = sim.getDevice(link.b);
      if (!a || !b) continue;
      const t = p.forward ? p.progress : 1 - p.progress;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const d of sim.devices) {
      const selected = sim.selectedType === 'device' && sim.selectedId === d.id;
      const hover = hoverDevice && hoverDevice.id === d.id;

      drawDeviceShape(d, selected || hover);

      ctx.font = '12px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#e8eefc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.name, d.x, d.y + d.r + 6);

      if (hover || linkingFrom === d.id) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = linkingFrom === d.id ? '#22d3ee' : 'rgba(59,130,246,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

  }

  function drawDeviceShape(d, highlight) {
    const { type, x, y, r, color } = d;
    ctx.save();

    if (highlight) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59,130,246,0.2)';
      ctx.fill();
    }

    if (type === 'router') {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    } else if (type === 'switch') {
      roundRect(x - r, y - r * 0.7, r * 2, r * 1.4, 6);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b1220';
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x + i * 7 - 2, y - 4, 4, 8);
      }
    } else if (type === 'firewall') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(ang);
        const py = y + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px IBM Plex Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FW', x, y);
    } else if (type === 'server') {
      roundRect(x - r * 0.75, y - r, r * 1.5, r * 2, 4);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#0b1220';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y - r * 0.3);
      ctx.lineTo(x + r * 0.55, y - r * 0.3);
      ctx.moveTo(x - r * 0.55, y + r * 0.25);
      ctx.lineTo(x + r * 0.55, y + r * 0.25);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + r * 0.4, y - r * 0.65, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    } else {
      roundRect(x - r * 0.85, y - r * 0.7, r * 1.7, r * 1.2, 3);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(x - r * 0.15, y + r * 0.5, r * 0.3, r * 0.35);
      ctx.fillRect(x - r * 0.5, y + r * 0.8, r, 4);
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function updateSelectionPanel() {
    if (!sim.selectedId) {
      els.selectionInfo.innerHTML = '<p class="hint">Nothing selected.</p>';
      return;
    }
    if (sim.selectedType === 'device') {
      const d = sim.getDevice(sim.selectedId);
      if (!d) return;
      els.selectionInfo.innerHTML = `
        <div class="kv"><span>Type</span><strong>${d.type}</strong></div>
        <div class="kv"><span>Name</span><strong>${escapeHtml(d.name)}</strong></div>
        <div class="kv"><span>Position</span><strong class="mono">${Math.round(d.x)}, ${Math.round(d.y)}</strong></div>
        <p class="hint" style="margin-top:0.6rem">Double-click to rename. Drag the ring to start a link.</p>
      `;
    } else {
      const l = sim.getLink(sim.selectedId);
      if (!l) return;
      const util = sim.utilization(l);
      els.selectionInfo.innerHTML = `
        <div class="kv"><span>Link</span><strong>${escapeHtml(l.name)}</strong></div>
        <div class="kv"><span>Bandwidth</span><strong class="mono">${l.bandwidthMbps} Mbps</strong></div>
        <div class="kv"><span>Baseline traffic</span><strong class="mono">${l.baselineTrafficMbps} Mbps</strong></div>
        <div class="kv"><span>Live traffic</span><strong class="mono">${Math.round(l.currentTrafficMbps)} Mbps</strong></div>
        <div class="kv"><span>Utilization</span><strong class="mono" style="color:${utilColor(util)}">${Math.round(util * 100)}%</strong></div>
        <p class="hint" style="margin-top:0.6rem">Double-click to edit speed / traffic.</p>
      `;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showContextMenu(clientX, clientY, canvasX, canvasY) {
    menuPos = { x: canvasX, y: canvasY };
    const wrap = canvas.parentElement.getBoundingClientRect();
    els.contextMenu.style.left = clientX - wrap.left + 'px';
    els.contextMenu.style.top = clientY - wrap.top + 'px';
    els.contextMenu.classList.remove('hidden');
    const hasSel = !!sim.selectedId;
    els.ctxDelete.classList.toggle('hidden', !hasSel);
  }

  function hideContextMenu() {
    els.contextMenu.classList.add('hidden');
  }

  els.contextMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    hideContextMenu();
    if (action.startsWith('add-')) {
      const type = action.slice(4);
      sim.addDevice(type, menuPos.x, menuPos.y);
      updateSelectionPanel();
    } else if (action === 'delete') {
      if (sim.selectedType === 'device') sim.removeDevice(sim.selectedId);
      else if (sim.selectedType === 'link') sim.removeLink(sim.selectedId);
      updateSelectionPanel();
    }
  });

  function openDeviceModal(device) {
    editTarget = { type: 'device', id: device.id };
    els.modalTitle.textContent = 'Edit Device';
    els.propsFields.innerHTML = `
      <label>Name
        <input name="name" required maxlength="60" value="${escapeHtml(device.name)}"/>
      </label>
    `;
    els.modalBackdrop.classList.remove('hidden');
  }

  function openLinkModal(link) {
    editTarget = { type: 'link', id: link.id };
    els.modalTitle.textContent = 'Edit Link';
    const options = SPEED_PRESETS.map(
      (p) =>
        `<option value="${p.mbps}" ${p.mbps === link.bandwidthMbps ? 'selected' : ''}>${p.label}</option>`
    ).join('');
    els.propsFields.innerHTML = `
      <label>Name
        <input name="name" maxlength="80" value="${escapeHtml(link.name)}"/>
      </label>
      <label>Link speed
        <select name="bandwidth">${options}
          <option value="custom">Custom…</option>
        </select>
      </label>
      <label>Custom bandwidth (Mbps)
        <input name="customBw" type="number" min="1" step="1" value="${link.bandwidthMbps}"/>
      </label>
      <label>Average / baseline traffic (Mbps)
        <input name="baseline" type="number" min="0" step="1" value="${link.baselineTrafficMbps}"/>
      </label>
    `;
    els.modalBackdrop.classList.remove('hidden');
  }

  function closeModal() {
    els.modalBackdrop.classList.add('hidden');
    editTarget = null;
  }

  els.modalCancel.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === els.modalBackdrop) closeModal();
  });

  els.propsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(els.propsForm);
    if (editTarget.type === 'device') {
      const d = sim.getDevice(editTarget.id);
      if (d) d.name = String(fd.get('name') || d.name).trim() || d.name;
    } else {
      const l = sim.getLink(editTarget.id);
      if (l) {
        l.name = String(fd.get('name') || l.name).trim() || l.name;
        let bw = Number(fd.get('bandwidth'));
        if (fd.get('bandwidth') === 'custom' || Number.isNaN(bw)) {
          bw = Number(fd.get('customBw')) || l.bandwidthMbps;
        }
        l.bandwidthMbps = Math.max(1, bw);
        l.baselineTrafficMbps = Math.max(0, Number(fd.get('baseline')) || 0);
        l.currentTrafficMbps = l.baselineTrafficMbps * sim.trafficScale;
      }
    }
    closeModal();
    updateSelectionPanel();
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const p = canvasPoint(e);
    const d = hitDevice(p.x, p.y);
    const l = d ? null : hitLink(p.x, p.y);
    if (d) {
      sim.select('device', d.id);
    } else if (l) {
      sim.select('link', l.id);
    } else {
      sim.clearSelection();
    }
    updateSelectionPanel();
    showContextMenu(e.clientX, e.clientY, p.x, p.y);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    hideContextMenu();
    const p = canvasPoint(e);
    const d = hitDevice(p.x, p.y);
    if (d && e.shiftKey) {
      linkingFrom = d.id;
      sim.select('device', d.id);
      els.status.textContent = `Linking from ${d.name} — click another device`;
      updateSelectionPanel();
      return;
    }
    if (d) {
      if (linkingFrom && linkingFrom !== d.id) {
        sim.addLink(linkingFrom, d.id);
        linkingFrom = null;
        els.status.textContent = 'Link created';
        updateSelectionPanel();
        return;
      }
      sim.select('device', d.id);
      dragging = { id: d.id, ox: p.x - d.x, oy: p.y - d.y };
      updateSelectionPanel();
      return;
    }
    const l = hitLink(p.x, p.y);
    if (l) {
      linkingFrom = null;
      sim.select('link', l.id);
      updateSelectionPanel();
      return;
    }
    linkingFrom = null;
    sim.clearSelection();
    updateSelectionPanel();
    els.status.textContent = 'Right-click canvas to add devices · Shift+click device to start a link';
  });

  canvas.addEventListener('mousemove', (e) => {
    const p = canvasPoint(e);
    hoverDevice = hitDevice(p.x, p.y);
    hoverLink = hoverDevice ? null : hitLink(p.x, p.y);
    canvas.style.cursor = hoverDevice || hoverLink ? 'pointer' : dragging ? 'grabbing' : 'default';

    if (dragging) {
      const d = sim.getDevice(dragging.id);
      if (d) {
        d.x = p.x - dragging.ox;
        d.y = p.y - dragging.oy;
        d.x = clamp(d.x, d.r + 4, canvas.clientWidth - d.r - 4);
        d.y = clamp(d.y, d.r + 4, canvas.clientHeight - d.r - 24);
      }
    }
  });

  window.addEventListener('mouseup', () => {
    dragging = null;
  });

  canvas.addEventListener('dblclick', (e) => {
    const p = canvasPoint(e);
    const d = hitDevice(p.x, p.y);
    if (d) {
      openDeviceModal(d);
      return;
    }
    const l = hitLink(p.x, p.y);
    if (l) openLinkModal(l);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      linkingFrom = null;
      closeModal();
      els.loadBackdrop.classList.add('hidden');
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sim.selectedId) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (sim.selectedType === 'device') sim.removeDevice(sim.selectedId);
      else if (sim.selectedType === 'link') sim.removeLink(sim.selectedId);
      updateSelectionPanel();
    }
  });

  document.addEventListener('click', (e) => {
    if (!els.contextMenu.contains(e.target) && e.target !== canvas) {
      hideContextMenu();
    }
  });

  document.querySelectorAll('.palette-item').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/device-type', el.dataset.type);
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('click', () => {
      const x = canvas.clientWidth / 2 + (Math.random() - 0.5) * 120;
      const y = canvas.clientHeight / 2 + (Math.random() - 0.5) * 120;
      const d = sim.addDevice(el.dataset.type, x, y);
      sim.select('device', d.id);
      updateSelectionPanel();
    });
  });

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/device-type');
    if (!type) return;
    const p = canvasPoint(e);
    const d = sim.addDevice(type, p.x, p.y);
    sim.select('device', d.id);
    updateSelectionPanel();
  });

  els.play.addEventListener('click', () => {
    sim.play();
    els.play.disabled = true;
    els.pause.disabled = false;
  });

  els.pause.addEventListener('click', () => {
    sim.pause();
    els.play.disabled = false;
    els.pause.disabled = true;
  });

  els.spike.addEventListener('click', () => sim.triggerSpike(5000));

  els.speed.addEventListener('input', () => {
    sim.simSpeed = Number(els.speed.value);
    els.speedLabel.textContent = sim.simSpeed.toFixed(2) + '×';
  });

  els.traffic.addEventListener('input', () => {
    sim.trafficScale = Number(els.traffic.value);
    els.trafficLabel.textContent = sim.trafficScale.toFixed(1) + '×';
  });

  document.getElementById('btn-demo').addEventListener('click', () => {
    sim.loadDemo();
    updateSelectionPanel();
    els.status.textContent = 'Demo topology loaded — press Play to animate packets';
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear the entire canvas?')) return;
    sim.reset();
    els.packetLog.innerHTML = '';
    updateSelectionPanel();
    els.play.disabled = false;
    els.pause.disabled = true;
  });

  document.getElementById('btn-clear-log').addEventListener('click', () => {
    sim.log = [];
    els.packetLog.innerHTML = '';
  });

  sim.onLog = (entry) => {
    const div = document.createElement('div');
    div.className = entry.cls;
    div.textContent = `[${entry.t}] ${entry.msg}`;
    els.packetLog.prepend(div);
    while (els.packetLog.children.length > 80) {
      els.packetLog.removeChild(els.packetLog.lastChild);
    }
  };

  sim.onStats = (s) => {
    els.statDevices.textContent = s.devices;
    els.statLinks.textContent = s.links;
    els.statPackets.textContent = s.packets;
    els.statUtil.textContent = Math.round(s.avgUtil * 100) + '%';
    els.statHot.textContent =
      s.hotName === '—' ? '—' : `${s.hotName} (${Math.round(s.hotUtil * 100)}%)`;
    els.statMbps.textContent = Math.round(s.totalMbps).toLocaleString();
  };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  document.getElementById('btn-save').addEventListener('click', async () => {
    const name = prompt('Topology name:', 'My Network');
    if (!name) return;
    const description = prompt('Optional description:', '') || '';
    try {
      const body = {
        name,
        description,
        topologyJson: JSON.stringify(sim.exportState()),
      };
      const saved = await api('/api/topologies', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      sim.addLog(`Saved topology #${saved.id}: ${saved.name}`, 'log-ok');
      els.status.textContent = `Saved as #${saved.id} — ${saved.name}`;
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  });

  document.getElementById('btn-load').addEventListener('click', async () => {
    try {
      const list = await api('/api/topologies');
      els.topologyList.innerHTML = '';
      if (!list.length) {
        els.topologyList.innerHTML = '<p class="hint">No saved topologies yet.</p>';
      } else {
        for (const t of list) {
          const row = document.createElement('div');
          row.className = 'topology-item';
          row.innerHTML = `
            <div>
              <strong>${escapeHtml(t.name)}</strong>
              <div class="meta">#${t.id} · updated ${new Date(t.updatedAt).toLocaleString()}</div>
            </div>
            <div class="actions">
              <button type="button" class="btn tiny primary" data-load="${t.id}">Load</button>
              <button type="button" class="btn tiny ghost" data-del="${t.id}">Delete</button>
            </div>
          `;
          els.topologyList.appendChild(row);
        }
      }
      els.loadBackdrop.classList.remove('hidden');
    } catch (err) {
      alert('Could not list topologies: ' + err.message);
    }
  });

  els.topologyList.addEventListener('click', async (e) => {
    const loadId = e.target.getAttribute('data-load');
    const delId = e.target.getAttribute('data-del');
    if (loadId) {
      try {
        const t = await api('/api/topologies/' + loadId);
        const state = JSON.parse(t.topologyJson);
        sim.importState(state);
        updateSelectionPanel();
        els.loadBackdrop.classList.add('hidden');
        sim.addLog(`Loaded topology: ${t.name}`, 'log-ok');
        els.status.textContent = `Loaded: ${t.name}`;
        els.play.disabled = false;
        els.pause.disabled = true;
      } catch (err) {
        alert('Load failed: ' + err.message);
      }
    }
    if (delId) {
      if (!confirm('Delete this saved topology?')) return;
      try {
        await api('/api/topologies/' + delId, { method: 'DELETE' });
        e.target.closest('.topology-item').remove();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }
  });

  els.loadCancel.addEventListener('click', () => {
    els.loadBackdrop.classList.add('hidden');
  });

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    sim.tick(dt, ts);
    draw();
    updateSelectionPanel();

    fpsAcc += dt;
    fpsFrames += 1;
    if (fpsAcc >= 0.5) {
      const fps = Math.round(fpsFrames / fpsAcc);
      els.fps.textContent = `${fps} fps · ${sim.running ? 'RUNNING' : 'PAUSED'}`;
      fpsAcc = 0;
      fpsFrames = 0;
    }

    requestAnimationFrame(frame);
  }

  resizeCanvas();
  sim.loadDemo();
  updateSelectionPanel();
  requestAnimationFrame(frame);
  els.status.textContent = 'Demo loaded — press Play to animate packets · Shift+click to link devices';
})();
