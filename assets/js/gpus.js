// GPU comparison for LLM work — NVIDIA, AMD, Intel.
//
// FP16 = peak DENSE tensor/matrix TFLOPS (FP32 accumulate), NOT the 2x
// "sparsity" number vendors headline. Checked against nvidia.com, amd.com and
// intel.com spec pages in July 2026. Both NVIDIA and AMD publish with-sparsity
// headline figures, so the dense value is half — e.g. H100/H200 SXM 989.5 dense
// (1,979 sparse); MI355X 2.5 PFLOPS dense (5.0 sparse); MI300X 1.3 dense (2.61).
// Intel publishes INT8 TOPS rather than dense FP16 for Arc and only relative
// numbers for Gaudi, so those FP16 cells are "—". A few figures without a clean
// vendor dense number (Gaudi, Arc, older SKUs) stay approximate — verify before
// budgeting real money.

(() => {
    const GPUS = [
        // ---------------- NVIDIA · consumer ----------------
        { name: 'RTX 3090',        vendor: 'NVIDIA', arch: 'Ampere',    seg: 'Consumer',    vram: 24,  bw: 936,   fp16: 71,   tdp: 350, lowbit: 'INT8', year: 2020 },
        { name: 'RTX 3090 Ti',     vendor: 'NVIDIA', arch: 'Ampere',    seg: 'Consumer',    vram: 24,  bw: 1008,  fp16: 80,   tdp: 450, lowbit: 'INT8', year: 2022 },
        { name: 'RTX 4080 Super',  vendor: 'NVIDIA', arch: 'Ada',       seg: 'Consumer',    vram: 16,  bw: 736,   fp16: 104,  tdp: 320, lowbit: 'FP8',  year: 2024 },
        { name: 'RTX 4090',        vendor: 'NVIDIA', arch: 'Ada',       seg: 'Consumer',    vram: 24,  bw: 1008,  fp16: 165,  tdp: 450, lowbit: 'FP8',  year: 2022 },
        { name: 'RTX 5080',        vendor: 'NVIDIA', arch: 'Blackwell', seg: 'Consumer',    vram: 16,  bw: 960,   fp16: 112,  tdp: 360, lowbit: 'FP4',  year: 2025 },
        { name: 'RTX 5090',        vendor: 'NVIDIA', arch: 'Blackwell', seg: 'Consumer',    vram: 32,  bw: 1792,  fp16: 210,  tdp: 575, lowbit: 'FP4',  year: 2025 },

        // ---------------- NVIDIA · workstation ----------------
        { name: 'RTX A6000',       vendor: 'NVIDIA', arch: 'Ampere',    seg: 'Workstation', vram: 48,  bw: 768,   fp16: 77,   tdp: 300, lowbit: 'INT8', year: 2020 },
        { name: 'RTX 6000 Ada',    vendor: 'NVIDIA', arch: 'Ada',       seg: 'Workstation', vram: 48,  bw: 960,   fp16: 182,  tdp: 300, lowbit: 'FP8',  year: 2022 },
        { name: 'RTX PRO 6000 Blackwell', vendor: 'NVIDIA', arch: 'Blackwell', seg: 'Workstation', vram: 96, bw: 1792, fp16: 250, tdp: 600, lowbit: 'FP4', year: 2025 },

        // ---------------- NVIDIA · datacenter ----------------
        { name: 'L4',              vendor: 'NVIDIA', arch: 'Ada',       seg: 'Datacenter',  vram: 24,  bw: 300,   fp16: 121,  tdp: 72,  lowbit: 'FP8',  year: 2023 },
        { name: 'L40',             vendor: 'NVIDIA', arch: 'Ada',       seg: 'Datacenter',  vram: 48,  bw: 864,   fp16: 181,  tdp: 300, lowbit: 'FP8',  year: 2022 },
        { name: 'L40S',            vendor: 'NVIDIA', arch: 'Ada',       seg: 'Datacenter',  vram: 48,  bw: 864,   fp16: 362,  tdp: 350, lowbit: 'FP8',  year: 2023 },
        { name: 'A100 40GB',       vendor: 'NVIDIA', arch: 'Ampere',    seg: 'Datacenter',  vram: 40,  bw: 1555,  fp16: 312,  tdp: 400, lowbit: 'INT8', year: 2020 },
        { name: 'A100 80GB',       vendor: 'NVIDIA', arch: 'Ampere',    seg: 'Datacenter',  vram: 80,  bw: 2039,  fp16: 312,  tdp: 400, lowbit: 'INT8', year: 2021 },
        { name: 'H100 PCIe',       vendor: 'NVIDIA', arch: 'Hopper',    seg: 'Datacenter',  vram: 80,  bw: 2000,  fp16: 756,  tdp: 350, lowbit: 'FP8',  year: 2022 },
        { name: 'H100 SXM',        vendor: 'NVIDIA', arch: 'Hopper',    seg: 'Datacenter',  vram: 80,  bw: 3350,  fp16: 989,  tdp: 700, lowbit: 'FP8',  year: 2022 },
        { name: 'H100 NVL',        vendor: 'NVIDIA', arch: 'Hopper',    seg: 'Datacenter',  vram: 94,  bw: 3900,  fp16: 835,  tdp: 400, lowbit: 'FP8',  year: 2023 },
        { name: 'H200 SXM',        vendor: 'NVIDIA', arch: 'Hopper',    seg: 'Datacenter',  vram: 141, bw: 4800,  fp16: 989,  tdp: 700, lowbit: 'FP8',  year: 2024 },
        { name: 'B200',            vendor: 'NVIDIA', arch: 'Blackwell', seg: 'Datacenter',  vram: 192, bw: 8000,  fp16: 2250, tdp: 1000, lowbit: 'FP4', year: 2025 },
        { name: 'B300 (Blackwell Ultra)', vendor: 'NVIDIA', arch: 'Blackwell', seg: 'Datacenter', vram: 288, bw: 8000, fp16: 2250, tdp: 1400, lowbit: 'FP4', year: 2025 },

        // ---------------- AMD · Instinct (CDNA) ----------------
        { name: 'Instinct MI210',  vendor: 'AMD',    arch: 'CDNA2',     seg: 'Datacenter',  vram: 64,  bw: 1638,  fp16: 181,  tdp: 300, lowbit: 'INT8', year: 2022 },
        { name: 'Instinct MI250X', vendor: 'AMD',    arch: 'CDNA2',     seg: 'Datacenter',  vram: 128, bw: 3277,  fp16: 383,  tdp: 560, lowbit: 'INT8', year: 2021 },
        { name: 'Instinct MI300A', vendor: 'AMD',    arch: 'CDNA3',     seg: 'Datacenter',  vram: 128, bw: 5300,  fp16: 981,  tdp: 760, lowbit: 'FP8', year: 2023 },
        { name: 'Instinct MI300X', vendor: 'AMD',    arch: 'CDNA3',     seg: 'Datacenter',  vram: 192, bw: 5300,  fp16: 1307, tdp: 750, lowbit: 'FP8', year: 2023 },
        { name: 'Instinct MI325X', vendor: 'AMD',    arch: 'CDNA3',     seg: 'Datacenter',  vram: 256, bw: 6000,  fp16: 1307, tdp: 1000, lowbit: 'FP8', year: 2024 },
        { name: 'Instinct MI350X', vendor: 'AMD',    arch: 'CDNA4',     seg: 'Datacenter',  vram: 288, bw: 8000,  fp16: 2300, tdp: 1000, lowbit: 'FP4', year: 2025 },
        { name: 'Instinct MI355X', vendor: 'AMD',    arch: 'CDNA4',     seg: 'Datacenter',  vram: 288, bw: 8000,  fp16: 2500, tdp: 1400, lowbit: 'FP4', year: 2025 },

        // ---------------- AMD · Radeon / workstation ----------------
        { name: 'Radeon RX 7900 XTX', vendor: 'AMD', arch: 'RDNA3',     seg: 'Consumer',    vram: 24,  bw: 960,   fp16: 123,  tdp: 355, lowbit: 'INT8', year: 2022 },
        { name: 'Radeon RX 9070 XT',  vendor: 'AMD', arch: 'RDNA4',     seg: 'Consumer',    vram: 16,  bw: 640,   fp16: 97,   tdp: 304, lowbit: 'INT8', year: 2025 },
        { name: 'Radeon PRO W7800',   vendor: 'AMD', arch: 'RDNA3',     seg: 'Workstation', vram: 32,  bw: 576,   fp16: 90,   tdp: 260, lowbit: 'INT8', year: 2023 },
        { name: 'Radeon PRO W7900',   vendor: 'AMD', arch: 'RDNA3',     seg: 'Workstation', vram: 48,  bw: 864,   fp16: 123,  tdp: 295, lowbit: 'INT8', year: 2023 },
        { name: 'Radeon AI PRO R9700', vendor: 'AMD', arch: 'RDNA4',    seg: 'Workstation', vram: 32,  bw: 640,   fp16: 191,  tdp: 300, lowbit: 'INT4', year: 2025 },

        // ---------------- Intel · Gaudi + datacenter ----------------
        { name: 'Gaudi 2',         vendor: 'Intel',  arch: 'Gaudi',     seg: 'Datacenter',  vram: 96,  bw: 2460,  fp16: null, tdp: 600, lowbit: 'FP8', year: 2022 },
        { name: 'Gaudi 3',         vendor: 'Intel',  arch: 'Gaudi',     seg: 'Datacenter',  vram: 128, bw: 3700,  fp16: null, tdp: 900, lowbit: 'FP8', year: 2024 },
        { name: 'Data Center GPU Max 1550', vendor: 'Intel', arch: 'Xe-HPC', seg: 'Datacenter', vram: 128, bw: 3277, fp16: 832, tdp: 600, lowbit: 'INT8', year: 2023 },

        // ---------------- Intel · Arc consumer + Arc Pro workstation ----------------
        { name: 'Arc A770',        vendor: 'Intel',  arch: 'Xe-HPG',    seg: 'Consumer',    vram: 16,  bw: 560,   fp16: null, tdp: 225, lowbit: 'INT8', year: 2022 },
        { name: 'Arc B580',        vendor: 'Intel',  arch: 'Xe2',       seg: 'Consumer',    vram: 12,  bw: 456,   fp16: null, tdp: 190, lowbit: 'INT8', year: 2024 },
        { name: 'Arc Pro B50',     vendor: 'Intel',  arch: 'Xe2',       seg: 'Workstation', vram: 16,  bw: 224,   fp16: null, tdp: 70,  lowbit: 'INT8', year: 2025 },
        { name: 'Arc Pro B60',     vendor: 'Intel',  arch: 'Xe2',       seg: 'Workstation', vram: 24,  bw: 456,   fp16: null, tdp: 200, lowbit: 'INT8', year: 2025 },
        { name: 'Arc Pro B60 Dual', vendor: 'Intel', arch: 'Xe2',       seg: 'Workstation', vram: 48,  bw: 456,   fp16: null, tdp: 300, lowbit: 'INT8', year: 2025 },
    ];

    const VENDORS = ['All', 'NVIDIA', 'AMD', 'Intel'];
    let vendorFilter = 'All';

    // LLM performance score (0-100), a transparent heuristic. LLM decode is
    // memory-bound, so bandwidth is weighted highest, then VRAM (what fits),
    // then dense compute (prefill/training). Cards without a published dense
    // FP16 (Intel) are scored on bandwidth + capacity only, so they may read low.
    const maxBw = Math.max(...GPUS.map((g) => g.bw));
    const maxVram = Math.max(...GPUS.map((g) => g.vram));
    const maxFp16 = Math.max(...GPUS.map((g) => g.fp16 || 0));
    const score = (g) => {
        const nb = g.bw / maxBw, nv = g.vram / maxVram;
        if (g.fp16 == null) return Math.round(100 * (0.6 * nb + 0.4 * nv));
        return Math.round(100 * (0.45 * nb + 0.30 * nv + 0.25 * (g.fp16 / maxFp16)));
    };

    const num = (v) => v == null ? '—' : v.toLocaleString();
    // higher-is-better on all numeric columns except tdp (lower is better).
    const COLS = [
        { key: 'name',   label: 'GPU',              get: (g) => `<span class="name">${g.name}</span><br><span class="tier">${g.vendor} · ${g.arch} · ${g.seg}</span>`, sort: (g) => g.name, txt: true },
        { key: 'score',  label: 'LLM score',        get: (g) => `<span class="score-cell">${score(g)}</span>`, sort: (g) => score(g), best: 'max' },
        { key: 'vram',   label: 'VRAM (GB)',        get: (g) => g.vram,     sort: (g) => g.vram, best: 'max' },
        { key: 'bw',     label: 'Bandwidth (GB/s)', get: (g) => g.bw.toLocaleString(), sort: (g) => g.bw, best: 'max' },
        { key: 'fp16',   label: 'FP16 TFLOPS',      get: (g) => num(g.fp16), sort: (g) => g.fp16 ?? -1, best: 'max' },
        { key: 'lowbit', label: 'Low precision',    get: (g) => g.lowbit,   sort: (g) => g.lowbit, txt: true },
        { key: 'tdp',    label: 'TDP (W)',          get: (g) => g.tdp,      sort: (g) => g.tdp, best: 'min' },
        { key: 'bwpg',   label: 'GB/s per GB',      get: (g) => Math.round(g.bw / g.vram), sort: (g) => g.bw / g.vram, best: 'max' },
        { key: 'year',   label: 'Released',         get: (g) => g.year,     sort: (g) => g.year },
    ];

    let sortKey = 'score';
    let sortDir = -1;

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const buildVendorChips = () => {
        const box = document.getElementById('vendor-filter');
        VENDORS.forEach((v) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip';
            b.textContent = v;
            b.setAttribute('aria-pressed', String(vendorFilter === v));
            b.addEventListener('click', () => {
                vendorFilter = v;
                box.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
                render();
            });
            box.appendChild(b);
        });
    };

    const render = () => {
        const col = COLS.find((c) => c.key === sortKey);
        const rows = GPUS
            .filter((g) => vendorFilter === 'All' || g.vendor === vendorFilter)
            .sort((a, b) => {
                const av = col.sort(a), bv = col.sort(b);
                if (typeof av === 'string') return sortDir * av.localeCompare(bv);
                return sortDir * (av - bv);
            });

        // Best value per highlightable column, among the rows on screen.
        const bests = {};
        COLS.filter((c) => c.best).forEach((c) => {
            const vals = rows.map((g) => c.sort(g)).filter((v) => v != null && v >= 0);
            bests[c.key] = c.best === 'min' ? Math.min(...vals) : Math.max(...vals);
        });
        // top score row overall gets the "Best" badge.
        const topScore = Math.max(...rows.map(score));

        document.getElementById('thead').innerHTML = '<tr>' + COLS.map((c) =>
            `<th data-key="${c.key}">${esc(c.label)}${c.key === sortKey ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`
        ).join('') + '</tr>';

        document.getElementById('tbody').innerHTML = rows.map((g) =>
            `<tr class="${score(g) === topScore ? 'rank1' : ''}">` + COLS.map((c) => {
                const isBest = c.best && c.sort(g) === bests[c.key] && (c.sort(g) != null && c.sort(g) >= 0);
                return `<td class="${isBest ? 'best' : ''}">${c.get(g)}</td>`;
            }).join('') + '</tr>'
        ).join('');
        document.getElementById('row-count').textContent = `${rows.length} of ${GPUS.length} cards · sorted by ${col.label.toLowerCase()}`;

        renderSummary(rows);

        document.querySelectorAll('#thead th').forEach((th) => {
            th.addEventListener('click', () => {
                const k = th.getAttribute('data-key');
                if (k === sortKey) sortDir *= -1;
                else { sortKey = k; sortDir = COLS.find((c) => c.key === k).txt ? 1 : -1; }
                render();
            });
        });
    };

    // "Best in class" summary — recomputed for the current vendor filter.
    const renderSummary = (rows) => {
        const box = document.getElementById('best-summary');
        if (!box) return;
        const topBy = (fn) => rows.reduce((a, b) => fn(b) > fn(a) ? b : a);
        const overall = topBy(score);
        const cap = topBy((g) => g.vram);
        const band = topBy((g) => g.bw);
        const consumer = rows.filter((g) => g.seg === 'Consumer');
        const bestConsumer = consumer.length ? consumer.reduce((a, b) => score(b) > score(a) ? b : a) : null;
        const eff = topBy((g) => g.bw / g.tdp); // bandwidth per watt

        const cell = (label, name, detail) => `<div><dt>${label}</dt><dd>${esc(name)} <small>${esc(detail)}</small></dd></div>`;
        box.innerHTML =
            cell('Top overall', overall.name, `score ${score(overall)}`) +
            cell('Most VRAM', cap.name, `${cap.vram} GB`) +
            cell('Fastest memory', band.name, `${band.bw.toLocaleString()} GB/s`) +
            (bestConsumer ? cell('Best consumer', bestConsumer.name, `${bestConsumer.vram} GB`) : '') +
            cell('Best GB/s per watt', eff.name, `${(eff.bw / eff.tdp).toFixed(1)}`);
    };

    buildVendorChips();
    render();
})();
