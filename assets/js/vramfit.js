// "Will it fit?" — VRAM estimator for LLM inference and fine-tuning.
//
// The formulas are the stable part and are computed exactly:
//   weights   = params × bytes-per-weight
//   KV cache  = 2 × layers × kv_heads × head_dim × context × batch × 2 bytes   (GQA-aware)
//   full FT   ≈ 16 bytes/param of optimizer+grad+master-weight state (Adam, mixed precision)
// Activations/workspace are a coarse estimate and are labelled as such — they
// depend on kernels, attention impl and framework, so treat that slice as ±.
//
// Model architecture figures come from public model configs as known at build
// time; the custom panel lets you override any of them.

(() => {
    // params in billions; hidden, layers, heads, kvHeads from the model config.
    // headDim defaults to hidden/heads unless the config pins it (noted).
    const MODELS = [
        { id: 'llama32-1b',  name: 'Llama 3.2 1B',    params: 1.24,  layers: 16, hidden: 2048, heads: 32, kvHeads: 8 },
        { id: 'llama32-3b',  name: 'Llama 3.2 3B',    params: 3.21,  layers: 28, hidden: 3072, heads: 24, kvHeads: 8 },
        { id: 'llama31-8b',  name: 'Llama 3.1 8B',    params: 8.03,  layers: 32, hidden: 4096, heads: 32, kvHeads: 8 },
        { id: 'llama33-70b', name: 'Llama 3.3 70B',   params: 70.6,  layers: 80, hidden: 8192, heads: 64, kvHeads: 8 },
        { id: 'qwen25-7b',   name: 'Qwen2.5 7B',      params: 7.6,   layers: 28, hidden: 3584, heads: 28, kvHeads: 4 },
        { id: 'qwen25-14b',  name: 'Qwen2.5 14B',     params: 14.8,  layers: 48, hidden: 5120, heads: 40, kvHeads: 8 },
        { id: 'qwen25-32b',  name: 'Qwen2.5 32B',     params: 32.5,  layers: 64, hidden: 5120, heads: 40, kvHeads: 8 },
        { id: 'qwen25-72b',  name: 'Qwen2.5 72B',     params: 72.7,  layers: 80, hidden: 8192, heads: 64, kvHeads: 8 },
        { id: 'mistral-7b',  name: 'Mistral 7B v0.3', params: 7.25,  layers: 32, hidden: 4096, heads: 32, kvHeads: 8 },
        { id: 'gemma2-9b',   name: 'Gemma 2 9B',      params: 9.24,  layers: 42, hidden: 3584, heads: 16, kvHeads: 8 },
        { id: 'gemma2-27b',  name: 'Gemma 2 27B',     params: 27.2,  layers: 46, hidden: 4608, heads: 32, kvHeads: 16 },
        { id: 'phi4-14b',    name: 'Phi-4 14B',       params: 14.7,  layers: 40, hidden: 5120, heads: 40, kvHeads: 10 },
        { id: 'mixtral',     name: 'Mixtral 8x7B (MoE)', params: 46.7, layers: 32, hidden: 4096, heads: 32, kvHeads: 8, moe: true },
        { id: 'custom',      name: 'Custom / other…',  params: 8,     layers: 32, hidden: 4096, heads: 32, kvHeads: 8 },
    ];

    // GPUs: only VRAM (GB) is load-bearing for the calculator.
    const GPUS = [
        { id: 'rtx3090',  name: 'RTX 3090',      vram: 24 },
        { id: 'rtx4090',  name: 'RTX 4090',      vram: 24 },
        { id: 'rtx5090',  name: 'RTX 5090',      vram: 32 },
        { id: 'a6000',    name: 'RTX A6000',     vram: 48 },
        { id: 'l40s',     name: 'L40S',          vram: 48 },
        { id: 'a100-40',  name: 'A100 40GB',     vram: 40 },
        { id: 'a100-80',  name: 'A100 80GB',     vram: 80 },
        { id: 'h100',     name: 'H100 80GB',     vram: 80 },
        { id: 'h200',     name: 'H200 141GB',    vram: 141 },
    ];

    const PRECISION = {
        fp16: { label: 'FP16 / BF16', bpw: 2 },
        int8: { label: 'INT8 / FP8', bpw: 1 },
        int4: { label: 'INT4 / NF4', bpw: 0.5 },
    };

    const TASKS = {
        infer:  'Inference',
        lora:   'LoRA',
        qlora:  'QLoRA',
        full:   'Full fine-tune',
    };

    // Usable fraction of VRAM — you never get the whole card.
    const USABLE = 0.92;
    const GB = 1024 ** 3;

    const state = {
        model: 'llama31-8b',
        precision: 'fp16',
        task: 'infer',
        context: 4096,
        batch: 1,
        gpu: 'rtx3090',
        gradCkpt: true,
        // custom overrides
        params: 8, layers: 32, hidden: 4096, heads: 32, kvHeads: 8,
    };

    const $ = (id) => document.getElementById(id);
    const model = () => MODELS.find((m) => m.id === state.model);
    const gpu = () => GPUS.find((g) => g.id === state.gpu);
    const fmt = (gb) => gb >= 100 ? gb.toFixed(0) : gb.toFixed(1);

    // Effective architecture: custom panel overrides the preset.
    const arch = () => {
        if (state.model === 'custom') {
            return { params: state.params, layers: state.layers, hidden: state.hidden, heads: state.heads, kvHeads: state.kvHeads, moe: false };
        }
        return model();
    };

    function compute() {
        const a = arch();
        const P = a.params * 1e9;
        const headDim = a.hidden / a.heads;
        const kvDim = a.kvHeads * headDim;

        // For QLoRA the frozen base is 4-bit regardless of the precision selector.
        const baseBpw = state.task === 'qlora' ? 0.5 : PRECISION[state.precision].bpw;
        const weights = P * baseBpw;

        // KV cache: 2 (K+V) × layers × kvDim × context × batch × 2 bytes (fp16 cache)
        const kv = 2 * a.layers * kvDim * state.context * state.batch * 2;

        // Optimizer + gradients + master weights.
        let opt = 0;
        if (state.task === 'full') {
            // Adam mixed precision ≈ 16 bytes/param total; subtract the fp16 weights
            // already counted (2 bytes) → ~14 bytes/param of extra state.
            opt = P * 14;
        } else if (state.task === 'lora' || state.task === 'qlora') {
            // Trainable adapters + their Adam state — roughly 1-2% of params.
            opt = P * 0.02 * 16;
        }

        // Activations / workspace — coarse. Scales with context, hidden, batch.
        // Gradient checkpointing roughly square-roots the training activation cost.
        const actUnit = a.layers * a.hidden * state.context * state.batch * 2;
        let act;
        if (state.task === 'infer') {
            act = actUnit * 0.12;                 // small during decode
        } else {
            act = state.gradCkpt ? actUnit * 0.6 : actUnit * 3.5;
        }

        const parts = {
            weights: weights / GB,
            kv: kv / GB,
            opt: opt / GB,
            act: act / GB,
        };
        parts.total = parts.weights + parts.kv + parts.opt + parts.act;
        return parts;
    }

    function render() {
        const p = compute();
        const g = gpu();
        const perGpu = g.vram * USABLE;
        const nGpu = Math.max(1, Math.ceil(p.total / perGpu));

        $('total').innerHTML = `${fmt(p.total)} <span>GB</span>`;

        const fitsOne = p.total <= perGpu;
        let why = '';
        if (!fitsOne) {
            if (p.weights > perGpu) why = " — the weights alone overflow one card, so you're sharding the model.";
            else if (p.opt > perGpu * 0.5) why = ' — the optimizer state is what pushes it over; a lighter method would shrink this fast.';
            else if (p.kv > p.weights) why = ' — the KV cache dominates here; a shorter context or smaller batch would bring it down.';
            else why = ' — the total is over one card once everything is counted.';
        }
        $('fits').innerHTML = fitsOne
            ? `Fits on a single <strong>${g.name}</strong> (${g.vram} GB), with ~${fmt(perGpu - p.total)} GB to spare.`
            : `Needs <strong>${nGpu}× ${g.name}</strong> (${g.vram} GB each)${why}`;

        // Stacked bar
        const track = $('bar');
        const seg = (cls, gb) => `<div class="bar-seg ${cls}" style="flex:${Math.max(gb, 0.001)}" title="${fmt(gb)} GB"></div>`;
        track.innerHTML = seg('w', p.weights) + seg('kv', p.kv) + seg('opt', p.opt) + seg('act', p.act);

        $('legend').innerHTML =
            `<span><i class="w"></i>Weights <b>${fmt(p.weights)} GB</b></span>` +
            `<span><i class="kv"></i>KV cache <b>${fmt(p.kv)} GB</b></span>` +
            (p.opt > 0.05 ? `<span><i class="opt"></i>Optimizer + grads <b>${fmt(p.opt)} GB</b></span>` : '') +
            `<span><i class="act"></i>Activations <b>${fmt(p.act)} GB</b> (est.)</span>`;
    }

    // ---------- Controls ----------
    const fill = (sel, items, val) => {
        sel.innerHTML = items.map((i) => `<option value="${i.id || i[0]}">${i.name || i[1]}</option>`).join('');
        sel.value = val;
    };

    const buildSeg = (boxId, map, key) => {
        const box = $(boxId);
        box.innerHTML = '';
        Object.entries(map).forEach(([val, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = typeof label === 'string' ? label : label.label;
            b.setAttribute('aria-pressed', String(state[key] === val));
            b.addEventListener('click', () => {
                state[key] = val;
                box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
                syncCustom();
                render();
            });
            box.appendChild(b);
        });
    };

    const syncCustom = () => {
        $('custom-panel').classList.toggle('open', state.model === 'custom');
        // QLoRA forces the base to 4-bit — reflect that the precision picker is moot.
        $('precision-seg').style.opacity = state.task === 'qlora' ? '.45' : '1';
        $('ckpt-row').style.display = (state.task === 'full' || state.task === 'lora' || state.task === 'qlora') ? '' : 'none';
    };

    fill($('model'), MODELS, state.model);
    fill($('gpu'), GPUS, state.gpu);
    buildSeg('precision-seg', Object.fromEntries(Object.entries(PRECISION).map(([k, v]) => [k, v.label])), 'precision');
    buildSeg('task-seg', TASKS, 'task');

    $('model').addEventListener('change', (e) => {
        state.model = e.target.value;
        const m = model();
        if (m && m.id !== 'custom') { state.params = m.params; state.layers = m.layers; state.hidden = m.hidden; state.heads = m.heads; state.kvHeads = m.kvHeads; }
        ['params', 'layers', 'hidden', 'heads', 'kvHeads'].forEach((k) => { $('c-' + k).value = state[k]; });
        syncCustom(); render();
    });
    $('gpu').addEventListener('change', (e) => { state.gpu = e.target.value; render(); });
    $('context').addEventListener('input', (e) => { state.context = Math.max(1, +e.target.value || 1); render(); });
    $('batch').addEventListener('input', (e) => { state.batch = Math.max(1, +e.target.value || 1); render(); });
    $('ckpt').addEventListener('change', (e) => { state.gradCkpt = e.target.checked; render(); });

    ['params', 'layers', 'hidden', 'heads', 'kvHeads'].forEach((k) => {
        const el = $('c-' + k);
        el.value = state[k];
        el.addEventListener('input', (e) => { state[k] = Math.max(1, +e.target.value || 1); render(); });
    });

    syncCustom();
    render();
})();
