// LLM inference engine explorer.
// Repo URLs were checked against GitHub on 2026-07-21 — several projects had
// moved (Aphrodite -> dphnAI/sonar, llamafile -> mozilla-ai, Nexa -> qualcomm/GenieX,
// PowerInfer -> Tiiny-AI), and two are archived. Links here are the canonical ones.

(() => {
    const CATEGORIES = {
        serving: 'Production serving',
        orchestration: 'Orchestration layers',
        local: 'Local & desktop',
        specialist: 'Specialist & hardware-specific',
        retired: 'Archived or dormant',
    };

    // Facet vocabularies used by the configurator.
    const HW = { nvidia: 'NVIDIA', amd: 'AMD ROCm', apple: 'Apple Silicon', cpu: 'CPU only', intel: 'Intel / other' };
    const SIZES = ['1-3B', '7-8B', '13-14B', '30-34B', '70B', '100B+ / MoE'];

    const ENGINES = [
        // ---------------- Production serving ----------------
        {
            id: 'vllm', name: 'vLLM', category: 'serving', repo: 'vllm-project/vllm',
            license: 'Apache-2.0', status: 'active',
            blurb: 'The de facto default for open-source production serving. Originated PagedAttention, and carries the broadest hardware and quantization coverage of any engine.',
            hw: ['nvidia', 'amd', 'cpu', 'intel'], sizes: [1, 2, 3, 4, 5, 6], cases: ['team', 'production', 'batch'],
            strengths: ['PagedAttention, continuous batching, chunked prefill, prefix caching', 'Speculative decoding: n-gram, EAGLE, Medusa, suffix, DFlash', 'Tensor, pipeline, data, expert and context parallelism', 'Multi-LoRA across dense and MoE layers'],
            limits: ['Hardware support is tiered — TPU, Gaudi, Ascend and Apple live in separate out-of-tree repos that lag core', 'Its own docs call GGUF support "highly experimental and under-optimized"', 'NVFP4/MXFP4 need Blackwell-class GPUs'],
            quant: ['FP8', 'NVFP4', 'MXFP4', 'INT8', 'INT4', 'AWQ', 'GPTQ', 'GGUF (experimental)'],
        },
        {
            id: 'sglang', name: 'SGLang', category: 'serving', repo: 'sgl-project/sglang',
            license: 'Apache-2.0', status: 'active',
            blurb: 'The other top-tier serving framework. Differentiated by RadixAttention prefix caching and a zero-overhead CPU scheduler, with unusually deep non-NVIDIA documentation.',
            hw: ['nvidia', 'amd', 'cpu', 'intel'], sizes: [1, 2, 3, 4, 5, 6], cases: ['team', 'production', 'batch'],
            strengths: ['RadixAttention — best-in-class prefix reuse for RAG and multi-turn', 'Zero-overhead CPU scheduler', 'Prefill-decode disaggregation, speculative decoding, multi-LoRA batching', 'AMD ROCm and Intel Xeon/AMX support is genuine, not nominal — shipped Docker images and tuning guides'],
            limits: ['TPU support runs through the separate, much smaller SGLang-JAX backend', 'Ascend coverage is a subset of the CUDA feature set'],
            quant: ['FP8', 'FP4', 'INT4', 'AWQ', 'GPTQ'],
        },
        {
            id: 'trtllm', name: 'TensorRT-LLM', category: 'serving', repo: 'NVIDIA/TensorRT-LLM',
            license: 'Apache-2.0', status: 'active',
            blurb: "NVIDIA's own serving stack, and the fastest path on NVIDIA silicon if you stay inside their ecosystem. Now PyTorch-native — the old ahead-of-time engine-compilation workflow has been removed.",
            hw: ['nvidia'], sizes: [1, 2, 3, 4, 5, 6], cases: ['production', 'batch'],
            strengths: ['Deepest optimization for Hopper and Blackwell', 'trtllm-serve, PyTorch LLM API, disaggregated serving', 'MXFP4 support makes gpt-oss-120b practical', 'Publishes an explicit feature-combination matrix — nobody else does'],
            limits: ['NVIDIA only. No AMD, Apple or CPU path exists, structurally', 'Features are not freely composable: LoRA is untested with expert parallelism and disaggregation; speculative decoding conflicts with pipeline parallelism', 'No GGUF — consumes ModelOpt/HF checkpoints'],
            quant: ['FP8', 'NVFP4', 'MXFP4', 'W4A16/W4A8 AWQ', 'W4A16/W4A8 GPTQ', 'FP8 KV cache'],
        },
        {
            id: 'lmdeploy', name: 'LMDeploy', category: 'serving', repo: 'InternLM/lmdeploy',
            license: 'Apache-2.0', status: 'active',
            blurb: 'Serving toolkit from the InternLM team, with two backends: TurboMind (C++/CUDA, peak performance) and a PyTorch engine that reaches more accelerators.',
            hw: ['nvidia'], sizes: [1, 2, 3, 4, 5, 6], cases: ['team', 'production'],
            strengths: ['TurboMind is genuinely fast on CUDA', 'Strong 4-bit inference story', 'FP8 KV-cache quantization'],
            limits: ['Its "1.8x faster than vLLM" README claim is undated and unversioned — treat as marketing, not a current benchmark', '"Broader hardware" means Ascend, Maca and Cambricon, not AMD or Apple'],
            quant: ['AWQ', 'INT4', 'INT8', 'FP8 KV cache'],
        },
        {
            id: 'triton', name: 'Triton Inference Server', category: 'serving', repo: 'triton-inference-server/server',
            license: 'BSD-3-Clause', status: 'active',
            blurb: "NVIDIA's general-purpose model server. Not LLM-specific — it fronts many model types and backends, including TensorRT-LLM and vLLM.",
            hw: ['nvidia', 'cpu'], sizes: [1, 2, 3, 4, 5, 6], cases: ['production'],
            strengths: ['One serving layer for LLMs plus vision, embedding and classical models', 'Mature metrics, model versioning and ensembles'],
            limits: ['More moving parts than an LLM-only engine', 'For pure LLM work, vLLM or TensorRT-LLM directly is usually simpler'],
            quant: ['Depends on the backend'],
        },
        {
            id: 'max', name: 'Modular MAX', category: 'serving', repo: 'modular/modular',
            license: 'Custom', status: 'active',
            blurb: 'Modular\'s inference stack, built on the Mojo language. Aims to replace the CUDA-specific kernel layer with a portable one.',
            hw: ['nvidia', 'amd', 'cpu'], sizes: [1, 2, 3, 4, 5], cases: ['team', 'production'],
            strengths: ['Portable kernels across NVIDIA and AMD', 'OpenAI-compatible serving'],
            limits: ['Smaller community than vLLM or SGLang', 'Licence is not a standard OSI one — check terms before commercial use'],
            quant: ['FP8', 'INT4', 'GPTQ'],
        },
        {
            id: 'sonar', name: 'Aphrodite Engine (now Sonar)', category: 'serving', repo: 'dphnAI/sonar',
            license: 'AGPL-3.0', status: 'moved',
            blurb: 'The PygmalionAI serving engine, a vLLM derivative aimed at wide quantization support. The repo has moved and been renamed to Sonar under dphnAI.',
            hw: ['nvidia', 'amd'], sizes: [1, 2, 3, 4, 5], cases: ['team', 'production'],
            strengths: ['Very broad quantization format support', 'OpenAI-compatible API'],
            limits: ['Renamed and relocated — old PygmalionAI/aphrodite-engine links now redirect', 'AGPL licence has implications for hosted commercial use'],
            quant: ['AWQ', 'GPTQ', 'GGUF', 'EXL2', 'FP8', 'Marlin'],
        },

        // ---------------- Orchestration ----------------
        {
            id: 'dynamo', name: 'NVIDIA Dynamo', category: 'orchestration', repo: 'ai-dynamo/dynamo',
            license: 'Apache-2.0', status: 'active', needsBackend: true,
            blurb: 'Not an engine. An orchestration layer that turns vLLM, SGLang or TensorRT-LLM into a coordinated multi-node system. Its own README says a single engine is probably enough for one model on one GPU.',
            hw: ['nvidia'], sizes: [4, 5, 6], cases: ['production'],
            strengths: ['Disaggregated prefill/decode across independently scaled GPU pools', 'KV-aware routing and SLA-based planning', 'KVBM multi-tier KV offload', 'Works across all three major backends'],
            limits: ['Requires a backend engine — it is not an alternative to one', 'Disaggregation needs fast KV transfer; without RDMA, TCP can dominate TTFT', 'Adds no value for small models or short prompts'],
            quant: ['Inherited from the backend'],
        },
        {
            id: 'llmd', name: 'llm-d', category: 'orchestration', repo: 'llm-d/llm-d',
            license: 'Apache-2.0', status: 'active', needsBackend: true,
            blurb: 'Kubernetes-native distributed serving stack, Red Hat-led. Like Dynamo, it schedules and routes across engines rather than running models itself.',
            hw: ['nvidia', 'amd'], sizes: [4, 5, 6], cases: ['production'],
            strengths: ['Prefix-cache-aware and load-aware routing', 'Tiered KV offload to CPU or disk', 'Wide expert parallelism for very large MoE fleets', 'SLO-aware autoscaling'],
            limits: ['Kubernetes required — significant operational overhead', 'Implements no kernels of its own', 'Headline throughput figures are project-run on NVIDIA hardware, so partisan on both sides'],
            quant: ['Inherited from the backend'],
        },
        {
            id: 'rayllm', name: 'Ray Serve LLM', category: 'orchestration', repo: 'ray-project/ray',
            license: 'Apache-2.0', status: 'active', needsBackend: true,
            blurb: "Ray's serving layer for LLMs, wrapping vLLM with autoscaling, multi-model routing and the rest of the Ray ecosystem.",
            hw: ['nvidia', 'amd', 'cpu'], sizes: [2, 3, 4, 5, 6], cases: ['team', 'production', 'batch'],
            strengths: ['Autoscaling and multi-model composition', 'Same cluster can serve and run batch jobs', 'Good fit if you already run Ray'],
            limits: ['Ray itself is a large dependency', 'Another layer to debug when latency goes wrong'],
            quant: ['Inherited from vLLM'],
        },
        {
            id: 'bento', name: 'BentoML / OpenLLM', category: 'orchestration', repo: 'bentoml/OpenLLM',
            license: 'Apache-2.0', status: 'active', needsBackend: true,
            blurb: 'Packaging and deployment layer that turns a model plus an engine into a deployable service, with vLLM as the usual backend.',
            hw: ['nvidia', 'cpu'], sizes: [1, 2, 3, 4, 5], cases: ['team', 'production'],
            strengths: ['Clean packaging and deployment story', 'Cloud-agnostic', 'Good developer ergonomics'],
            limits: ['Abstraction over engines rather than performance work of its own'],
            quant: ['Inherited from the backend'],
        },
        {
            id: 'aibrix', name: 'AIBrix', category: 'orchestration', repo: 'vllm-project/aibrix',
            license: 'Apache-2.0', status: 'active', needsBackend: true,
            blurb: 'Control-plane building blocks for running vLLM at scale on Kubernetes — from the vLLM project itself.',
            hw: ['nvidia'], sizes: [3, 4, 5, 6], cases: ['production'],
            strengths: ['LoRA-aware routing and autoscaling', 'Distributed KV cache', 'First-party to vLLM'],
            limits: ['Kubernetes only', 'Younger than Dynamo or llm-d'],
            quant: ['Inherited from vLLM'],
        },

        // ---------------- Local & desktop ----------------
        {
            id: 'llamacpp', name: 'llama.cpp', category: 'local', repo: 'ggml-org/llama.cpp',
            license: 'MIT', status: 'active',
            blurb: 'The foundation of local inference. Runs on more hardware than anything else, and almost every desktop app below is built on it.',
            hw: ['nvidia', 'amd', 'apple', 'cpu', 'intel'], sizes: [0, 1, 2, 3, 4, 5], cases: ['local', 'edge', 'team'],
            strengths: ['1.5-bit through 8-bit GGUF quantization, plus F16/BF16 and MXFP4', 'Backends: CUDA, Metal, HIP, Vulkan, SYCL, OpenVINO, CANN, OpenCL, WebGPU, Hexagon, RISC-V', 'CPU+GPU hybrid offload — run models larger than your VRAM', 'Ships an OpenAI-compatible server'],
            limits: ['Backend breadth is not backend maturity — WebGPU, Hexagon and CANN lag CUDA and Metal badly', 'Lower throughput than vLLM at high concurrency', 'Note the repo moved to the ggml-org org'],
            quant: ['GGUF Q1.5 through Q8', 'F16', 'BF16', 'MXFP4'],
        },
        {
            id: 'ollama', name: 'Ollama', category: 'local', repo: 'ollama/ollama',
            license: 'MIT', status: 'active',
            blurb: 'The easiest way to run a model locally. One command pulls and serves, with an OpenAI-compatible endpoint. Built on llama.cpp with its own scheduler and model registry.',
            hw: ['nvidia', 'amd', 'apple', 'cpu'], sizes: [0, 1, 2, 3, 4], cases: ['local', 'team', 'edge'],
            strengths: ['Genuinely one-command setup', 'Model registry with sensible defaults', 'Runs as a background service; great developer ergonomics'],
            limits: ['Not built for high-concurrency production serving', 'Abstracts away the tuning knobs llama.cpp exposes'],
            quant: ['GGUF'],
        },
        {
            id: 'lmstudio', name: 'LM Studio', category: 'local', repo: 'lmstudio-ai/lms',
            license: 'MIT (CLI)', status: 'active',
            blurb: 'Desktop GUI for running local models, with a built-in OpenAI-compatible server. The app itself is closed-source; the CLI is open.',
            hw: ['nvidia', 'amd', 'apple', 'cpu'], sizes: [0, 1, 2, 3, 4], cases: ['local'],
            strengths: ['Best GUI for browsing, downloading and chatting with local models', 'Handles both GGUF and MLX on Apple Silicon', 'Good for people who do not want a terminal'],
            limits: ['Desktop app is proprietary', 'Single-user by design'],
            quant: ['GGUF', 'MLX'],
        },
        {
            id: 'jan', name: 'Jan', category: 'local', repo: 'janhq/jan',
            license: 'AGPL-3.0', status: 'active',
            blurb: 'Open-source desktop assistant that runs models locally — positioned as an offline ChatGPT alternative.',
            hw: ['nvidia', 'apple', 'cpu'], sizes: [0, 1, 2, 3], cases: ['local'],
            strengths: ['Fully open source, unlike LM Studio', 'Clean desktop UX', 'Local API server'],
            limits: ['Smaller ecosystem', 'AGPL may matter for redistribution'],
            quant: ['GGUF'],
        },
        {
            id: 'koboldcpp', name: 'KoboldCpp', category: 'local', repo: 'LostRuins/koboldcpp',
            license: 'AGPL-3.0', status: 'active',
            blurb: 'Single-binary llama.cpp distribution with a built-in UI, popular for creative writing and roleplay workloads.',
            hw: ['nvidia', 'amd', 'apple', 'cpu'], sizes: [0, 1, 2, 3, 4], cases: ['local'],
            strengths: ['No install — one executable', 'Strong sampler and context controls', 'Image generation and TTS bundled in'],
            limits: ['Niche audience', 'Not a production server'],
            quant: ['GGUF'],
        },
        {
            id: 'textgen', name: 'text-generation-webui', category: 'local', repo: 'oobabooga/textgen',
            license: 'AGPL-3.0', status: 'moved',
            blurb: 'The long-standing "oobabooga" web UI, supporting multiple loader backends. Repo has been renamed to oobabooga/textgen.',
            hw: ['nvidia', 'amd', 'apple', 'cpu'], sizes: [0, 1, 2, 3, 4], cases: ['local'],
            strengths: ['Swap between llama.cpp, ExLlama and Transformers loaders', 'Extension ecosystem', 'Very configurable'],
            limits: ['Repo renamed from text-generation-webui — update your bookmarks', 'Complexity has grown over time'],
            quant: ['GGUF', 'EXL2', 'GPTQ', 'AWQ'],
        },
        {
            id: 'localai', name: 'LocalAI', category: 'local', repo: 'mudler/LocalAI',
            license: 'MIT', status: 'active',
            blurb: 'Drop-in OpenAI API replacement that runs locally and covers more than text — images, audio and embeddings too.',
            hw: ['nvidia', 'amd', 'apple', 'cpu', 'intel'], sizes: [0, 1, 2, 3, 4], cases: ['local', 'team', 'edge'],
            strengths: ['One API for text, image, audio and embeddings', 'No GPU required', 'Good self-hosting story'],
            limits: ['Jack-of-all-trades — slower than a dedicated LLM engine', 'Many backends to configure'],
            quant: ['GGUF', 'and more per backend'],
        },
        {
            id: 'llamafile', name: 'llamafile', category: 'local', repo: 'mozilla-ai/llamafile',
            license: 'Apache-2.0', status: 'active',
            blurb: 'Packages a model and its runtime into one executable file that runs on multiple OSes without installation. Now under the mozilla-ai org.',
            hw: ['nvidia', 'amd', 'apple', 'cpu'], sizes: [0, 1, 2, 3], cases: ['local', 'edge'],
            strengths: ['A model you can email — genuinely single-file distribution', 'Cross-platform from one binary', 'Strong CPU performance work'],
            limits: ['Awkward for very large models', 'Moved from Mozilla-Ocho to mozilla-ai'],
            quant: ['GGUF'],
        },

        // ---------------- Specialist ----------------
        {
            id: 'mlx', name: 'MLX / mlx-lm', category: 'specialist', repo: 'ml-explore/mlx-lm',
            license: 'MIT', status: 'active',
            blurb: "Apple's own array framework and its LLM layer, built for Apple Silicon unified memory. The fastest path on a Mac.",
            hw: ['apple'], sizes: [0, 1, 2, 3, 4, 5], cases: ['local', 'batch'],
            strengths: ['Built by Apple for M-series unified memory', 'Fine-tuning as well as inference', 'Large models run off unified memory rather than discrete VRAM'],
            limits: ['Apple Silicon only', 'Smaller model ecosystem than GGUF'],
            quant: ['MLX 4-bit', 'MLX 8-bit'],
        },
        {
            id: 'exllama', name: 'ExLlamaV2 / V3', category: 'specialist', repo: 'turboderp-org/exllamav3',
            license: 'MIT', status: 'active',
            blurb: 'Quantized inference tuned for consumer NVIDIA cards. The EXL2/EXL3 formats give unusually good quality per bit at low precision.',
            hw: ['nvidia', 'amd'], sizes: [1, 2, 3, 4], cases: ['local'],
            strengths: ['Best-in-class quality at aggressive quantization on consumer GPUs', 'Fast single-user generation', 'Fine-grained bit-rate control'],
            limits: ['CUDA-focused; ROCm support is secondary', 'Single-user oriented, not a serving stack', 'V2 and V3 coexist — V3 is the current line'],
            quant: ['EXL2', 'EXL3'],
        },
        {
            id: 'mlcllm', name: 'MLC-LLM', category: 'specialist', repo: 'mlc-ai/mlc-llm',
            license: 'Apache-2.0', status: 'active',
            blurb: 'Compiler-driven deployment via TVM — targets browsers, phones and embedded devices as first-class outputs.',
            hw: ['nvidia', 'amd', 'apple', 'intel'], sizes: [0, 1, 2, 3], cases: ['local', 'edge'],
            strengths: ['Runs in a browser through WebGPU', 'iOS and Android deployment', 'Compilation gives real speedups on odd hardware'],
            limits: ['Compilation step adds friction', 'Smaller model coverage than GGUF'],
            quant: ['4-bit group quantization', 'INT4'],
        },
        {
            id: 'ktransformers', name: 'KTransformers', category: 'specialist', repo: 'kvcache-ai/ktransformers',
            license: 'Apache-2.0', status: 'research',
            blurb: 'Runs very large MoE models on modest GPUs by splitting experts between CPU and GPU — hot experts on the GPU, cold ones on the CPU. Self-described as a research project.',
            hw: ['nvidia', 'cpu'], sizes: [5], cases: ['local'],
            strengths: ['DeepSeek-class MoE models on a single consumer GPU plus a lot of system RAM', 'Genuinely novel heterogeneous placement'],
            limits: ['A research project by its own description — not production serving', 'Needs substantial system RAM and fast memory bandwidth', 'Narrow model coverage'],
            quant: ['GGUF', 'INT4'],
        },
        {
            id: 'powerinfer', name: 'PowerInfer', category: 'specialist', repo: 'Tiiny-AI/PowerInfer',
            license: 'MIT', status: 'moved',
            blurb: 'Exploits neuron activation sparsity to keep hot neurons on the GPU and cold ones on the CPU. Repo has moved from SJTU-IPADS to Tiiny-AI.',
            hw: ['nvidia', 'cpu'], sizes: [1, 2, 3, 4], cases: ['local'],
            strengths: ['Large speedups on consumer GPUs for supported models', 'Clever locality-aware design'],
            limits: ['Works only with models exhibiting the right sparsity', 'Repo relocated', 'Research-grade'],
            quant: ['GGUF-derived'],
        },
        {
            id: 'ctranslate2', name: 'CTranslate2', category: 'specialist', repo: 'OpenNMT/CTranslate2',
            license: 'MIT', status: 'active',
            blurb: 'Fast C++ inference for transformer models, strongest on CPU. Powers faster-whisper and a lot of production translation.',
            hw: ['nvidia', 'cpu'], sizes: [0, 1, 2], cases: ['batch', 'edge', 'team'],
            strengths: ['Excellent CPU throughput', 'Very low memory footprint', 'Rock-solid for encoder-decoder and speech models'],
            limits: ['Narrower LLM coverage than llama.cpp', 'Conversion step required'],
            quant: ['INT8', 'INT16', 'FP16'],
        },
        {
            id: 'geniex', name: 'Nexa SDK (now GenieX)', category: 'specialist', repo: 'qualcomm/GenieX',
            license: 'Apache-2.0', status: 'moved',
            blurb: 'On-device inference across CPU, GPU and NPU. Now maintained by Qualcomm as GenieX after the Nexa acquisition.',
            hw: ['cpu', 'apple', 'intel'], sizes: [0, 1, 2], cases: ['edge', 'local'],
            strengths: ['NPU support on Snapdragon devices', 'Multimodal on-device', 'Text, vision and audio in one SDK'],
            limits: ['Repo moved to the qualcomm org and was renamed', 'Best hardware support is Qualcomm silicon'],
            quant: ['GGUF', 'NPU-specific formats'],
        },

        // ---------------- Retired ----------------
        {
            id: 'tgi', name: 'Text Generation Inference', category: 'retired', repo: 'huggingface/text-generation-inference',
            license: 'Apache-2.0', status: 'archived',
            blurb: "Hugging Face's serving engine, and once the standard choice. The repository is now a public archive — do not start new work on it.",
            hw: ['nvidia', 'amd', 'intel'], sizes: [1, 2, 3, 4, 5], cases: [],
            strengths: ['Was well-integrated with the HF ecosystem', 'Still readable as a reference implementation'],
            limits: ['ARCHIVED — read-only, last push March 2026', 'Use vLLM or SGLang instead'],
            quant: ['AWQ', 'GPTQ', 'EETQ', 'FP8'],
        },
        {
            id: 'cortex', name: 'Cortex', category: 'retired', repo: 'janhq/cortex.cpp',
            license: 'Apache-2.0', status: 'archived',
            blurb: 'Local inference engine from the Jan team. The repository is archived; the effort folded back into Jan itself.',
            hw: ['nvidia', 'apple', 'cpu'], sizes: [0, 1, 2, 3], cases: [],
            strengths: ['Was a clean llama.cpp/ONNX/TensorRT abstraction'],
            limits: ['ARCHIVED — use Jan or llama.cpp directly'],
            quant: ['GGUF'],
        },
        {
            id: 'mii', name: 'DeepSpeed-MII', category: 'retired', repo: 'deepspeedai/DeepSpeed-MII',
            license: 'Apache-2.0', status: 'dormant',
            blurb: "Microsoft's low-latency serving layer over DeepSpeed. Not archived, but no meaningful activity since mid-2025.",
            hw: ['nvidia'], sizes: [1, 2, 3, 4], cases: [],
            strengths: ['Introduced blocked KV caching and dynamic SplitFuse'],
            limits: ['DORMANT — last push June 2025', 'The ideas live on in vLLM and SGLang'],
            quant: ['INT8', 'FP16'],
        },
        {
            id: 'gpt4all', name: 'GPT4All', category: 'retired', repo: 'nomic-ai/gpt4all',
            license: 'MIT', status: 'dormant',
            blurb: 'Nomic\'s local desktop app, an early mover in accessible local inference. Little activity since May 2025.',
            hw: ['nvidia', 'apple', 'cpu'], sizes: [0, 1, 2], cases: [],
            strengths: ['Was one of the friendliest on-ramps to local models'],
            limits: ['DORMANT — last push May 2025', 'Use Ollama, Jan or LM Studio instead'],
            quant: ['GGUF'],
        },
    ];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const repoUrl = (e) => `https://github.com/${e.repo}`;

    // ---------- Configurator ----------
    const config = { size: 1, hw: 'nvidia', gpus: '1', use: 'local' };

    const CONTROLS = [
        {
            key: 'size', label: 'Model size',
            options: SIZES.map((s, i) => [String(i), s]),
        },
        {
            key: 'hw', label: 'Hardware',
            options: Object.entries(HW),
        },
        {
            key: 'gpus', label: 'How many GPUs',
            options: [['0', 'None / CPU'], ['1', 'One'], ['2-8', '2-8'], ['many', 'A cluster']],
        },
        {
            key: 'use', label: 'Use case',
            options: [
                ['local', 'Just me, locally'],
                ['team', 'Internal team API'],
                ['production', 'High-throughput production'],
                ['batch', 'Batch / offline'],
                ['edge', 'Edge / embedded'],
            ],
        },
    ];

    const buildControls = () => {
        const wrap = $('config');
        CONTROLS.forEach((c) => {
            const row = document.createElement('div');
            row.className = 'config-row';
            row.innerHTML = `<span class="label">${esc(c.label)}</span>`;
            const group = document.createElement('div');
            group.className = 'config-opts';
            group.setAttribute('role', 'group');
            group.setAttribute('aria-label', c.label);
            c.options.forEach(([value, label]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'chip';
                b.textContent = label;
                b.setAttribute('aria-pressed', String(config[c.key] === value || String(config[c.key]) === value));
                b.addEventListener('click', () => {
                    config[c.key] = value;
                    group.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
                    recommend();
                });
                group.appendChild(b);
            });
            row.appendChild(group);
            wrap.appendChild(row);
        });
    };

    // Score an engine against the current configuration. Returns null if it is
    // disqualified outright, otherwise a score plus the reasons why.
    const score = (e) => {
        if (e.category === 'retired') return null;
        if (!e.hw.includes(config.hw)) return null;

        const sizeIdx = Number(config.size);
        if (!e.sizes.includes(sizeIdx)) return null;
        if (config.use && e.cases.length && !e.cases.includes(config.use)) return null;

        // A cluster orchestrator is noise for one GPU; a single-GPU tool is
        // noise for a cluster.
        if (e.needsBackend && (config.gpus === '0' || config.gpus === '1')) return null;
        if (config.gpus === 'many' && e.category === 'local') return null;
        if (config.gpus === '0' && !e.hw.includes('cpu')) return null;

        let s = 0;
        const why = [];
        if (e.category === 'serving' && (config.use === 'production' || config.use === 'team')) { s += 3; why.push('built for serving'); }
        if (e.category === 'local' && config.use === 'local') { s += 3; why.push('built for local use'); }
        if (e.category === 'specialist' && config.hw === 'apple' && e.hw[0] === 'apple') { s += 4; why.push('native to Apple Silicon'); }
        if (e.category === 'orchestration' && config.gpus === 'many') { s += 3; why.push('coordinates a multi-node fleet'); }
        if (sizeIdx >= 5 && e.sizes.includes(6)) { s += 1; }
        if (config.hw === 'cpu' && e.hw.includes('cpu')) { s += 2; why.push('runs without a GPU'); }
        if (config.gpus === '2-8' && (e.category === 'serving' || e.category === 'orchestration')) { s += 2; why.push('handles multi-GPU'); }
        if (e.status === 'research' || e.status === 'moved') s -= 1;
        return { s, why };
    };

    const recommend = () => {
        const scored = ENGINES
            .map((e) => ({ e, r: score(e) }))
            .filter((x) => x.r)
            .sort((a, b) => b.r.s - a.r.s);

        const box = $('results');
        box.innerHTML = '';

        if (!scored.length) {
            box.innerHTML = '<p class="no-results">Nothing matches that combination. Try loosening the hardware or use case — the full catalogue is below.</p>';
            return;
        }

        scored.slice(0, 4).forEach((x, i) => {
            const card = document.createElement('div');
            card.className = 'rec-card' + (i === 0 ? ' rec-top' : '');
            card.innerHTML = `
                <p class="eyebrow">${i === 0 ? 'Best fit' : 'Also works'}</p>
                <h3>${esc(x.e.name)}${x.e.needsBackend ? ' <span class="status-badge">Needs a backend</span>' : ''}</h3>
                <p>${esc(x.e.blurb)}</p>
                ${x.r.why.length ? `<p class="rec-why">${esc(x.r.why.join(' · '))}</p>` : ''}
                <a class="card-cta" href="${repoUrl(x.e)}" target="_blank" rel="noopener">${esc(x.e.repo)} &rarr;</a>`;
            box.appendChild(card);
        });

        // At cluster scale the engine is only half the answer, and the
        // orchestrators rarely out-rank a serving engine on their own.
        const note = $('rec-note');
        if (config.gpus === 'many') {
            const orch = scored.filter((x) => x.e.needsBackend).map((x) => x.e.name);
            note.textContent = orch.length
                ? `Across a cluster you will want an orchestration layer on top of whichever engine you pick — ${orch.join(', ')}.`
                : '';
        } else {
            note.textContent = '';
        }

        $('rec-count').textContent = `${scored.length} engine${scored.length === 1 ? '' : 's'} fit — top ${Math.min(4, scored.length)} shown`;
    };

    // ---------- Catalogue ----------
    const state = { search: '', category: 'All' };

    const buildCatFilter = () => {
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
                renderCatalogue();
            });
            box.appendChild(b);
        });
    };

    const STATUS_LABEL = { archived: 'Archived', dormant: 'Dormant', moved: 'Repo moved', research: 'Research' };

    const renderCatalogue = () => {
        const term = state.search.trim().toLowerCase();
        const list = ENGINES.filter((e) => {
            const hay = [e.name, e.blurb, e.repo, CATEGORIES[e.category], e.quant.join(' '), e.strengths.join(' ')].join(' ').toLowerCase();
            const matchesSearch = !term || term.split(/\s+/).every((w) => hay.includes(w));
            const matchesCat = state.category === 'All' || e.category === state.category;
            return matchesSearch && matchesCat;
        });

        const grid = $('engine-grid');
        grid.innerHTML = '';
        $('result-count').textContent = list.length === ENGINES.length
            ? `${ENGINES.length} engines`
            : `${list.length} of ${ENGINES.length} engines`;

        if (!list.length) {
            grid.innerHTML = '<p class="no-results">No engine matches that.</p>';
            return;
        }

        list.forEach((e) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'method-card' + (e.category === 'retired' ? ' is-retired' : '');
            card.setAttribute('aria-haspopup', 'dialog');
            card.innerHTML = `
                <span class="cat">${esc(CATEGORIES[e.category])}</span>
                <h3>${esc(e.name)}${STATUS_LABEL[e.status] ? ` <span class="status-badge">${esc(STATUS_LABEL[e.status])}</span>` : ''}</h3>
                <p class="full">${esc(e.repo)}</p>
                <p>${esc(e.blurb)}</p>
                <div class="tags">${e.hw.map((h) => `<span>${esc(HW[h])}</span>`).join('')}</div>`;
            card.addEventListener('click', () => openEngine(e.id, card));
            grid.appendChild(card);
        });
    };

    // ---------- Dialog ----------
    const modal = $('modal');
    let lastFocus = null;

    function openEngine(id, trigger) {
        const e = ENGINES.find((x) => x.id === id);
        if (!e) return;
        lastFocus = trigger || document.activeElement;

        $('modal-body').innerHTML = `
            <div class="modal-top">
                <div>
                    <p class="eyebrow">${esc(CATEGORIES[e.category])}</p>
                    <h2 id="modal-title">${esc(e.name)}</h2>
                    <p class="full">${esc(e.license)} licence${STATUS_LABEL[e.status] ? ` · ${esc(STATUS_LABEL[e.status])}` : ''}</p>
                </div>
                <button class="icon-btn" id="modal-close" aria-label="Close" type="button">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>

            ${e.needsBackend ? '<p class="modal-visual"><strong>Needs a backend engine.</strong> This is an orchestration layer, not an alternative to vLLM or SGLang.</p>' : ''}
            <p class="modal-desc">${esc(e.blurb)}</p>

            <div class="verdict">
                <div>
                    <h4>Strengths</h4>
                    <ul>${e.strengths.map((p) => `<li class="pro"><i class="fas fa-check" aria-hidden="true"></i><span>${esc(p)}</span></li>`).join('')}</ul>
                </div>
                <div>
                    <h4>Limitations</h4>
                    <ul>${e.limits.map((c) => `<li class="con"><i class="fas fa-xmark" aria-hidden="true"></i><span>${esc(c)}</span></li>`).join('')}</ul>
                </div>
            </div>

            <dl class="meta-rows">
                <div><dt>Hardware</dt><dd>${e.hw.map((h) => esc(HW[h])).join(' · ')}</dd></div>
                <div><dt>Quantization</dt><dd>${e.quant.map(esc).join(' · ')}</dd></div>
                <div><dt>Repository</dt><dd><a href="${repoUrl(e)}" target="_blank" rel="noopener">github.com/${esc(e.repo)}</a></dd></div>
            </dl>`;

        $('modal-close').addEventListener('click', () => modal.close());
        modal.showModal();
    }

    modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.close(); });
    modal.addEventListener('close', () => { if (lastFocus) lastFocus.focus(); });

    // ---------- Boot ----------
    $('search').addEventListener('input', (ev) => { state.search = ev.target.value; renderCatalogue(); });
    buildControls();
    buildCatFilter();
    recommend();
    renderCatalogue();
})();
