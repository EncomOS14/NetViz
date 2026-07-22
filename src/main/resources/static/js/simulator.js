// Packet simulation (canvas drawing is in netviz.js)
(function (global) {
  'use strict';

  const DEVICE_DEFAULTS = {
    router:   { label: 'Router',   color: '#8b5cf6', r: 28 },
    switch:   { label: 'Switch',   color: '#22d3ee', r: 26 },
    firewall: { label: 'Firewall', color: '#f97316', r: 28 },
    server:   { label: 'Server',   color: '#94a3b8', r: 24 },
    pc:       { label: 'PC',       color: '#22c55e', r: 22 },
  };

  // bandwidth presets in Mbps
  const SPEED_PRESETS = [
    { label: '100 Mbps', mbps: 100 },
    { label: '1 Gbps', mbps: 1000 },
    { label: '10 Gbps', mbps: 10000 },
    { label: '25 Gbps', mbps: 25000 },
  ];

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function utilColor(util) {
    if (util >= 0.85) return '#ef4444';
    if (util >= 0.60) return '#eab308';
    return '#22c55e';
  }

  function utilClass(util) {
    if (util >= 0.85) return 'log-hot';
    if (util >= 0.60) return 'log-warn';
    return 'log-ok';
  }

  class Simulator {
    constructor() {
      this.devices = [];
      this.links = [];
      this.packets = [];
      this.running = false;
      this.simSpeed = 1;
      this.trafficScale = 1;
      this.spikeUntil = 0;
      this.selectedId = null;
      this.selectedType = null; // 'device' | 'link'
      this.nextDeviceNum = 1;
      this.log = [];
      this.maxLog = 80;
      this._spawnAccum = 0;
      this.onLog = null;
      this.onStats = null;
    }

    reset() {
      this.devices = [];
      this.links = [];
      this.packets = [];
      this.selectedId = null;
      this.selectedType = null;
      this.nextDeviceNum = 1;
      this.log = [];
      this._spawnAccum = 0;
      this.running = false;
      this.spikeUntil = 0;
    }

    exportState() {
      return {
        devices: this.devices.map((d) => ({ ...d })),
        links: this.links.map((l) => ({ ...l })),
        nextDeviceNum: this.nextDeviceNum,
      };
    }

    importState(state) {
      this.reset();
      if (!state) return;
      this.devices = (state.devices || []).map((d) => ({ ...d }));
      this.links = (state.links || []).map((l) => ({ ...l }));
      this.nextDeviceNum = state.nextDeviceNum || (this.devices.length + 1);
    }

    addDevice(type, x, y, name) {
      const def = DEVICE_DEFAULTS[type] || DEVICE_DEFAULTS.pc;
      const device = {
        id: uid('dev'),
        type,
        name: name || `${def.label}-${this.nextDeviceNum++}`,
        x,
        y,
        r: def.r,
        color: def.color,
      };
      this.devices.push(device);
      this.addLog(`Added ${device.name}`, 'log-info');
      return device;
    }

    removeDevice(id) {
      this.links = this.links.filter((l) => l.a !== id && l.b !== id);
      this.packets = this.packets.filter((p) => {
        const link = this.links.find((l) => l.id === p.linkId);
        return !!link;
      });
      const d = this.devices.find((x) => x.id === id);
      this.devices = this.devices.filter((x) => x.id !== id);
      if (this.selectedId === id) {
        this.selectedId = null;
        this.selectedType = null;
      }
      if (d) this.addLog(`Removed ${d.name}`, 'log-info');
    }

    addLink(aId, bId, bandwidthMbps = 1000, baselineTrafficMbps = 200) {
      if (aId === bId) return null;
      const exists = this.links.some(
        (l) => (l.a === aId && l.b === bId) || (l.a === bId && l.b === aId)
      );
      if (exists) return null;
      const a = this.devices.find((d) => d.id === aId);
      const b = this.devices.find((d) => d.id === bId);
      if (!a || !b) return null;
      const link = {
        id: uid('lnk'),
        a: aId,
        b: bId,
        name: `${a.name}↔${b.name}`,
        bandwidthMbps,
        baselineTrafficMbps,
        currentTrafficMbps: baselineTrafficMbps,
      };
      this.links.push(link);
      this.addLog(`Linked ${a.name} ↔ ${b.name} @ ${bandwidthMbps} Mbps`, 'log-info');
      return link;
    }

    removeLink(id) {
      this.packets = this.packets.filter((p) => p.linkId !== id);
      const l = this.links.find((x) => x.id === id);
      this.links = this.links.filter((x) => x.id !== id);
      if (this.selectedId === id) {
        this.selectedId = null;
        this.selectedType = null;
      }
      if (l) this.addLog(`Removed link ${l.name}`, 'log-info');
    }

    getDevice(id) {
      return this.devices.find((d) => d.id === id);
    }

    getLink(id) {
      return this.links.find((l) => l.id === id);
    }

    select(type, id) {
      this.selectedType = type;
      this.selectedId = id;
    }

    clearSelection() {
      this.selectedType = null;
      this.selectedId = null;
    }

    utilization(link) {
      const bw = Math.max(1, link.bandwidthMbps);
      return clamp(link.currentTrafficMbps / bw, 0, 1.5);
    }

    play() {
      this.running = true;
      this.addLog('Simulation started', 'log-info');
    }

    pause() {
      this.running = false;
      this.addLog('Simulation paused', 'log-info');
    }

    triggerSpike(durationMs = 5000) {
      this.spikeUntil = performance.now() + durationMs;
      this.addLog('⚡ Traffic spike injected (5s)', 'log-warn');
    }

    addLog(msg, cls = 'log-info') {
      const entry = {
        t: new Date().toLocaleTimeString(),
        msg,
        cls,
      };
      this.log.unshift(entry);
      if (this.log.length > this.maxLog) this.log.pop();
      if (this.onLog) this.onLog(entry);
    }

    tick(dt, now) {
      if (!this.running) {
        this._emitStats();
        return;
      }

      const scaledDt = dt * this.simSpeed;
      const spike = now < this.spikeUntil;
      const spikeMul = spike ? 2.8 : 1;

      for (const link of this.links) {
        const target =
          link.baselineTrafficMbps * this.trafficScale * spikeMul;
        const noise = (Math.random() - 0.5) * 0.12 * target;
        link.currentTrafficMbps +=
          (target + noise - link.currentTrafficMbps) * Math.min(1, scaledDt * 2.5);
        link.currentTrafficMbps = Math.max(0, link.currentTrafficMbps);
      }

      this._spawnAccum += scaledDt;
      while (this._spawnAccum >= 0.05) {
        this._spawnAccum -= 0.05;
        this._spawnPackets(0.05);
      }

      const remain = [];
      for (const p of this.packets) {
        const link = this.getLink(p.linkId);
        if (!link) continue;
        const util = this.utilization(link);
        const speedFactor = 1 / (1 + Math.max(0, util - 0.7) * 1.5);
        p.progress += (p.speed * speedFactor * scaledDt);
        if (p.progress >= 1) {
          if (util >= 0.85 && Math.random() < 0.08) {
            this.addLog(`Congestion drop risk on ${link.name}`, 'log-hot');
          }
          continue;
        }
        remain.push(p);
      }
      this.packets = remain;

      if (this.packets.length > 400) {
        this.packets = this.packets.slice(-400);
      }

      this._emitStats();
    }

    _spawnPackets(interval) {
      for (const link of this.links) {
        const util = this.utilization(link);
        const pps = clamp(link.currentTrafficMbps / 40, 0.5, 25) * this.simSpeed;
        const expected = pps * interval;
        let n = Math.floor(expected);
        if (Math.random() < expected - n) n += 1;
        for (let i = 0; i < n; i++) {
          const forward = Math.random() > 0.5;
          this.packets.push({
            id: uid('pkt'),
            linkId: link.id,
            progress: Math.random() * 0.05,
            speed: 0.55 + Math.random() * 0.7,
            forward,
            color: utilColor(util),
            size: 3 + Math.random() * 2,
          });
        }
        if (util >= 0.85 && Math.random() < 0.02) {
          this.addLog(`${link.name} overloaded (${Math.round(util * 100)}%)`, 'log-hot');
        } else if (util >= 0.6 && Math.random() < 0.01) {
          this.addLog(`${link.name} elevated util (${Math.round(util * 100)}%)`, 'log-warn');
        }
      }
    }

    _emitStats() {
      if (!this.onStats) return;
      let totalTraffic = 0;
      let utilSum = 0;
      let hot = null;
      let hotUtil = -1;
      for (const link of this.links) {
        totalTraffic += link.currentTrafficMbps;
        const u = this.utilization(link);
        utilSum += u;
        if (u > hotUtil) {
          hotUtil = u;
          hot = link;
        }
      }
      const avgUtil = this.links.length ? utilSum / this.links.length : 0;
      this.onStats({
        devices: this.devices.length,
        links: this.links.length,
        packets: this.packets.length,
        avgUtil,
        hotName: hot ? hot.name : '—',
        hotUtil: hot ? hotUtil : 0,
        totalMbps: totalTraffic,
      });
    }

    loadDemo() {
      this.reset();
      const r1 = this.addDevice('router', 520, 160, 'Core-R1');
      const fw = this.addDevice('firewall', 520, 300, 'Edge-FW');
      const sw1 = this.addDevice('switch', 280, 300, 'Access-SW1');
      const sw2 = this.addDevice('switch', 760, 300, 'Access-SW2');
      const srv1 = this.addDevice('server', 520, 460, 'App-Server');
      const srv2 = this.addDevice('server', 680, 460, 'DB-Server');
      const pc1 = this.addDevice('pc', 160, 420, 'PC-Alice');
      const pc2 = this.addDevice('pc', 280, 480, 'PC-Bob');
      const pc3 = this.addDevice('pc', 760, 480, 'PC-Carol');
      const pc4 = this.addDevice('pc', 900, 420, 'PC-Dave');

      this.addLink(r1.id, fw.id, 10000, 3200);
      this.addLink(fw.id, sw1.id, 1000, 420);
      this.addLink(fw.id, sw2.id, 1000, 510);
      this.addLink(fw.id, srv1.id, 1000, 680);
      this.addLink(srv1.id, srv2.id, 1000, 720);
      this.addLink(sw1.id, pc1.id, 100, 35);
      this.addLink(sw1.id, pc2.id, 100, 48);
      this.addLink(sw2.id, pc3.id, 100, 55);
      this.addLink(sw2.id, pc4.id, 100, 40);
      this.addLog('Demo topology loaded (campus-style)', 'log-info');
    }
  }

  global.NetVizSim = {
    Simulator,
    DEVICE_DEFAULTS,
    SPEED_PRESETS,
    utilColor,
    utilClass,
    clamp,
  };
})(window);
