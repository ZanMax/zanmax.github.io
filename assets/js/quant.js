// Quantization format explorer. Same card+dialog+filter pattern as the
// fine-tuning and inference explorers.

(() => {
    const CATEGORIES = {
        gguf: 'GGUF (llama.cpp family)',
        gpu: 'GPU-native (AWQ/GPTQ/EXL)',
        fp: 'Low-precision floats',
        train: 'Training-time',
    };

    const FORMATS = [
        {
            id: 'q4km', name: 'GGUF Q4_K_M', category: 'gguf', bpw: '~4.8', tags: ['Default', 'Balanced'],
            engines: ['llama.cpp', 'Ollama', 'LM Studio'],
            blurb: 'The default everyone reaches for. K-quant mixing 4- and 6-bit blocks with per-block scales — the best size/quality trade-off for most local models.',
            pros: ['Excellent quality for the size', 'Runs anywhere llama.cpp does — CPU, Metal, CUDA', 'Huge library of ready-made GGUFs'],
            cons: ['Slower than GPU-native formats at high batch', 'Not ideal for serving many concurrent users'],
            bestFor: 'Local single-user inference on any hardware. If unsure, start here.',
        },
        {
            id: 'q5q6', name: 'GGUF Q5_K_M / Q6_K', category: 'gguf', bpw: '~5.7 / ~6.6', tags: ['Higher quality'],
            engines: ['llama.cpp', 'Ollama', 'LM Studio'],
            blurb: 'Step up from Q4 when you have VRAM to spare and want to close the gap to full precision. Q6_K is near-lossless for most uses.',
            pros: ['Very close to FP16 quality', 'Still portable across all llama.cpp backends'],
            cons: ['Bigger, so fewer layers fit on the GPU', 'Diminishing returns over Q4_K_M for many models'],
            bestFor: 'When Q4 quality isn\'t quite enough and the extra gigabytes fit.',
        },
        {
            id: 'q23', name: 'GGUF Q2_K / Q3_K / IQ', category: 'gguf', bpw: '~2.6–3.4', tags: ['Squeeze it in'],
            engines: ['llama.cpp', 'Ollama', 'LM Studio'],
            blurb: 'Low-bit and importance-matrix (IQ) quants for fitting a model that otherwise won\'t. Quality drops noticeably, but a bigger model at Q2 often beats a smaller one at Q4.',
            pros: ['Fits models far above your VRAM', 'IQ variants recover some quality at low bit'],
            cons: ['Visible quality loss, worse on small models', 'IQ quants are slower to run'],
            bestFor: 'Running a 70B on 24 GB when the alternative is not running it.',
        },
        {
            id: 'awq', name: 'AWQ', category: 'gpu', bpw: '4', tags: ['Serving', 'Fast'],
            engines: ['vLLM', 'SGLang', 'LMDeploy'],
            blurb: 'Activation-aware weight quantization to 4-bit. Protects the salient weights that matter most, and is fast on GPU at scale.',
            pros: ['Strong 4-bit quality', 'First-class in vLLM and SGLang', 'Good throughput under concurrency'],
            cons: ['NVIDIA-focused', 'Quantizing a model takes a calibration pass'],
            bestFor: 'Serving a 4-bit model to many users from a GPU.',
        },
        {
            id: 'gptq', name: 'GPTQ', category: 'gpu', bpw: '3–4', tags: ['Serving', 'Established'],
            engines: ['vLLM', 'SGLang', 'LMDeploy', 'text-generation-webui'],
            blurb: 'The original one-shot GPU quantization. Widely supported and reliable, if a little older than AWQ.',
            pros: ['Broad engine support', 'Mature tooling and many pre-quantized models'],
            cons: ['Usually a touch behind AWQ on quality at 4-bit', 'Calibration-dependent'],
            bestFor: 'GPU serving when a GPTQ build already exists for your model.',
        },
        {
            id: 'exl', name: 'EXL2 / EXL3', category: 'gpu', bpw: '2–8 (variable)', tags: ['Consumer GPU'],
            engines: ['ExLlamaV2 / V3', 'text-generation-webui'],
            blurb: 'Variable-bitrate quantization tuned for consumer NVIDIA cards. Set an average bits-per-weight target and it allocates precision where it helps most.',
            pros: ['Best quality-per-bit on a single consumer GPU', 'Fine-grained control of the size/quality dial', 'Fast single-user generation'],
            cons: ['CUDA-focused; not a multi-user serving stack', 'Smaller model library than GGUF'],
            bestFor: 'Squeezing maximum quality out of one 24 GB card for yourself.',
        },
        {
            id: 'fp8', name: 'FP8', category: 'fp', bpw: '8', tags: ['Near-lossless', 'Modern GPU'],
            engines: ['vLLM', 'SGLang', 'TensorRT-LLM', 'LMDeploy'],
            blurb: 'An 8-bit float format with hardware support on Ada, Hopper and Blackwell. Roughly halves memory and doubles throughput with very little quality loss.',
            pros: ['Near-lossless, minimal calibration', 'Hardware-accelerated on modern cards', 'Great for both weights and KV cache'],
            cons: ['Needs Ada/Hopper/Blackwell — no FP8 on the 3090 or A100', 'Only ~2x smaller, not 4x like INT4'],
            bestFor: 'Production serving on 4090/H100-class hardware where quality matters.',
        },
        {
            id: 'fp4', name: 'FP4 / NVFP4 / MXFP4', category: 'fp', bpw: '4', tags: ['Blackwell', 'Newest'],
            engines: ['vLLM', 'SGLang', 'TensorRT-LLM'],
            blurb: '4-bit floating point with native Blackwell acceleration. MXFP4 is what makes models like gpt-oss-120b practical to serve.',
            pros: ['4-bit size with better quality than INT4', 'Hardware-accelerated on Blackwell (5090, B200)'],
            cons: ['Blackwell only — useless on older cards', 'Ecosystem still maturing'],
            bestFor: 'Serving big models on 5090 / B200 hardware.',
        },
        {
            id: 'nf4', name: 'NF4 (QLoRA)', category: 'train', bpw: '4', tags: ['Fine-tuning'],
            engines: ['HF PEFT', 'bitsandbytes', 'Unsloth', 'LLaMA-Factory'],
            blurb: 'NormalFloat4 — the 4-bit format QLoRA freezes the base model into while training LoRA adapters on top. A training format, not a serving one.',
            pros: ['Lets you fine-tune huge models on one card', 'Near-lossless as a frozen training base'],
            cons: ['Slower than a merged FP16 model at inference', 'For training; merge and re-quantize for serving'],
            bestFor: 'The base precision for QLoRA fine-tuning.',
        },
        {
            id: 'int8', name: 'INT8 / LLM.int8()', category: 'fp', bpw: '8', tags: ['Universal'],
            engines: ['bitsandbytes', 'vLLM', 'Most engines'],
            blurb: '8-bit integer quantization that works on essentially every GPU, including Ampere. The safe, universally-supported halving of memory.',
            pros: ['Runs on any CUDA GPU, including the 3090', 'Simple, well-understood, near-lossless'],
            cons: ['Only 2x smaller', 'Slower than FP8 where FP8 hardware exists'],
            bestFor: 'Halving memory on older cards with no FP8 support.',
        },
    ];

    const FRAMEWORKS = ['llama.cpp', 'vLLM', 'SGLang', 'TensorRT-LLM', 'ExLlamaV2 / V3', 'Unsloth'];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const state = { search: '', category: 'All' };

    const buildChips = () => {
        const box = $('filter-category');
        [['All', 'All'], ...Object.entries(CATEGORIES)].forEach(([value, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip';
            b.textContent = label;
            b.setAttribute('aria-pressed', String(state.category === value));
            b.addEventListener('click', () => {
                state.category = value;
                box.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
                render();
            });
            box.appendChild(b);
        });
    };

    const render = () => {
        const term = state.search.trim().toLowerCase();
        const list = FORMATS.filter((f) => {
            const hay = [f.name, f.blurb, CATEGORIES[f.category], f.tags.join(' '), f.engines.join(' '), f.bestFor].join(' ').toLowerCase();
            const matchesSearch = !term || term.split(/\s+/).every((w) => hay.includes(w));
            const matchesCat = state.category === 'All' || f.category === state.category;
            return matchesSearch && matchesCat;
        });

        const grid = $('grid');
        grid.innerHTML = '';
        $('result-count').textContent = list.length === FORMATS.length ? `${FORMATS.length} formats` : `${list.length} of ${FORMATS.length} formats`;
        if (!list.length) { grid.innerHTML = '<p class="no-results">No format matches that.</p>'; return; }

        list.forEach((f) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'method-card';
            card.setAttribute('aria-haspopup', 'dialog');
            card.innerHTML = `
                <span class="cat">${esc(CATEGORIES[f.category])}</span>
                <h3>${esc(f.name)}</h3>
                <p class="full">${esc(f.bpw)} bits/weight</p>
                <p>${esc(f.blurb)}</p>
                <div class="tags">${f.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
            card.addEventListener('click', () => open(f.id, card));
            grid.appendChild(card);
        });
    };

    const modal = $('modal');
    let lastFocus = null;

    function open(id, trigger) {
        const f = FORMATS.find((x) => x.id === id);
        if (!f) return;
        lastFocus = trigger || document.activeElement;
        $('modal-body').innerHTML = `
            <div class="modal-top">
                <div>
                    <p class="eyebrow">${esc(CATEGORIES[f.category])}</p>
                    <h2 id="modal-title">${esc(f.name)}</h2>
                    <p class="full">${esc(f.bpw)} bits per weight</p>
                </div>
                <button class="icon-btn" id="modal-close" aria-label="Close" type="button"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </div>
            <p class="modal-desc">${esc(f.blurb)}</p>
            <div class="verdict">
                <div><h4>Strengths</h4><ul>${f.pros.map((p) => `<li class="pro"><i class="fas fa-check" aria-hidden="true"></i><span>${esc(p)}</span></li>`).join('')}</ul></div>
                <div><h4>Trade-offs</h4><ul>${f.cons.map((c) => `<li class="con"><i class="fas fa-xmark" aria-hidden="true"></i><span>${esc(c)}</span></li>`).join('')}</ul></div>
            </div>
            <dl class="meta-rows">
                <div><dt>Best for</dt><dd>${esc(f.bestFor)}</dd></div>
                <div><dt>Bits per weight</dt><dd>${esc(f.bpw)}</dd></div>
                <div><dt>Runs on</dt><dd>${f.engines.map(esc).join(' · ')}</dd></div>
            </dl>`;
        $('modal-close').addEventListener('click', () => modal.close());
        modal.showModal();
    }

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
    modal.addEventListener('close', () => { if (lastFocus) lastFocus.focus(); });

    $('search').addEventListener('input', (e) => { state.search = e.target.value; render(); });
    buildChips();
    render();
})();
