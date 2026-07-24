// Fine-tuning method explorer.
// Data checked against primary sources (papers, HF PEFT/TRL docs, LLaMA-Factory
// and Unsloth repos) in a July 2026 research pass. Claims that no primary source
// supports have been removed rather than softened.

(() => {
    const CATEGORIES = {
        core: 'Core adaptation',
        adapters: 'Adapters & LoRA variants',
        optimization: 'Memory & speed',
        alignment: 'Alignment & RL',
        distributed: 'Distributed & multi-GPU',
        legacy: 'Largely superseded',
    };

    const METHODS = [
        // ---------- Core adaptation ----------
        {
            id: 'lora', category: 'core', name: 'LoRA', fullName: 'Low-Rank Adaptation',
            tags: ['Start here', 'Standard'], frameworks: ['HF PEFT', 'LLaMA-Factory', 'Unsloth'],
            description: 'The default. Freezes the base model and trains small rank-decomposition matrices alongside it. Everything below is a variation on this idea.',
            visual: '\u{1F9CA} Frozen base + \u26A1 trainable adapters (A\u00D7B)',
            pros: ['Low memory', 'Adapters are megabytes, not gigabytes', 'No inference cost once merged'],
            cons: ['Rank caps how much it can learn', 'Can trail full fine-tuning on hard reasoning tasks'],
            bestFor: 'Almost every first attempt. Start here and only move on if it falls short.',
            technical: 'W = W0 + BA, where rank r sets capacity.',
        },
        {
            id: 'qlora', category: 'core', name: 'QLoRA', fullName: 'Quantized LoRA',
            tags: ['Memory saver'], frameworks: ['HF PEFT', 'LLaMA-Factory', 'Unsloth'],
            description: 'LoRA on a 4-bit base model. The paper fine-tuned a 65B model on a single 48 GB GPU while preserving 16-bit task performance.',
            visual: '\u{1F4E6} 4-bit frozen base + \u26A1 adapters',
            pros: ['Fits far larger models on one card', 'Task performance close to 16-bit LoRA'],
            cons: ['Slower than LoRA — weights are dequantized on the fly', 'Parity was measured on benchmarks like MMLU, not long-context or multilingual work'],
            bestFor: '7B-13B on a 24 GB consumer card. A 70B run still needs roughly 41-52 GB, so a 48 GB workstation card, not a 3090.',
            technical: 'NF4 quantization + double quantization + paged optimizers.',
        },
        {
            id: 'full', category: 'core', name: 'Full fine-tuning', fullName: 'Full Parameter Tuning',
            tags: ['Max quality', 'Heavy'], frameworks: ['LLaMA-Factory', 'Unsloth', 'torchtune'],
            description: 'Updates every parameter. Still the ceiling on quality when you can afford it.',
            visual: '\u{1F9E0} Every weight updated',
            pros: ['No rank bottleneck', 'Best results on continued pre-training'],
            cons: ['Needs many times the model size in VRAM', 'Slow', 'A full checkpoint per run'],
            bestFor: 'Continued pre-training, or task tuning when you have multi-GPU capacity.',
            technical: 'Standard backprop. Optimizer state dominates memory, not the weights.',
        },
        {
            id: 'freeze', category: 'core', name: 'Freeze-tuning', fullName: 'Partial-layer Tuning',
            tags: ['Simple'], frameworks: ['LLaMA-Factory'],
            description: 'Unfreeze only the last N blocks and train those. Crude compared with LoRA, but it needs no extra machinery.',
            visual: '\u{1F9CA} Frozen lower layers + \u{1F525} trainable top',
            pros: ['No adapter code or merge step', 'Predictable memory'],
            cons: ['Coarser control than LoRA', 'Produces full-size checkpoints for the trained layers'],
            bestFor: 'Light domain shifts, or when adapters are awkward to deploy.',
            technical: 'Sets requires_grad = False below a chosen layer index.',
        },

        // ---------- Adapters & LoRA variants ----------
        {
            id: 'dora', category: 'adapters', name: 'DoRA', fullName: 'Weight-Decomposed Low-Rank Adaptation',
            tags: ['Higher accuracy'], frameworks: ['HF PEFT', 'LLaMA-Factory'],
            description: 'Splits the weight update into magnitude and direction. Direction is handled by ordinary LoRA, magnitude by a separate learnable parameter. Helps most at low rank.',
            visual: '\u{1F4CF} Magnitude + \u{1F9ED} direction',
            pros: ['Beats LoRA at low ranks', 'Less sensitive to the rank you pick'],
            cons: ['Meaningfully slower to train — reported overheads range from about 10% to 2x, so measure it', 'Linear and Conv layers only'],
            bestFor: 'When LoRA underfits and you would rather not raise the rank.',
            technical: 'W = m \u00B7 (V / ||V||) + BA. Merge the weights before serving to avoid the overhead.',
        },
        {
            id: 'rslora', category: 'adapters', name: 'rsLoRA', fullName: 'Rank-Stabilized LoRA',
            tags: ['One flag'], frameworks: ['HF PEFT', 'LLaMA-Factory', 'Unsloth'],
            description: 'Rescales the adapter so high ranks stop destabilizing training. A single boolean, not a separate method.',
            visual: '\u2696\uFE0F Scale by \u221Ar instead of r',
            pros: ['Makes high-rank LoRA usable', 'Free — no extra parameters or time'],
            cons: ['Does nothing noticeable at the low ranks most people use'],
            bestFor: 'Any LoRA run at rank 64 or above.',
            technical: 'Scaling becomes lora_alpha / \u221Ar instead of lora_alpha / r.',
        },
        {
            id: 'pissa', category: 'adapters', name: 'PiSSA', fullName: 'Principal Singular values and Singular vectors Adaptation',
            tags: ['Faster convergence'], frameworks: ['HF PEFT', 'LLaMA-Factory'],
            description: 'An initialization scheme, not a new architecture. Seeds the adapter from the principal singular components of the base weights instead of random noise.',
            visual: '\u{1F4D0} SVD-based initialization',
            pros: ['Converges faster than random init', 'Better loss early in training'],
            cons: ['Up-front SVD cost', 'Changes the base weights, so keep the residual'],
            bestFor: 'Short runs, or when LoRA converges too slowly.',
            technical: "init_lora_weights='pissa' in PEFT. Sits in the same enum as olora, eva, corda and loftq.",
        },
        {
            id: 'loraplus', category: 'adapters', name: 'LoRA+', fullName: 'LoRA Plus',
            tags: ['One hyperparameter'], frameworks: ['HF PEFT', 'LLaMA-Factory'],
            description: 'Trains the B matrix at a higher learning rate than A. Cheap fix for runs where the loss plateaus.',
            visual: '\u26A1 Fast B + \u{1F422} slow A',
            pros: ['Better on harder tasks', 'Costs nothing extra'],
            cons: ['One more ratio to tune'],
            bestFor: 'When LoRA loss stalls and the rank is not the problem.',
            technical: '\u03B7_B = \u03BB \u00B7 \u03B7_A, typically \u03BB = 16.',
        },
        {
            id: 'loftq', category: 'adapters', name: 'LoftQ', fullName: 'LoRA-Fine-Tuning-Aware Quantization',
            tags: ['Low bit'], frameworks: ['HF PEFT', 'LLaMA-Factory'],
            description: 'Quantizes the base model and initializes the adapter to cancel the resulting error, instead of quantizing and hoping.',
            visual: '\u2696\uFE0F Quantize + correct together',
            pros: ['Recovers accuracy that plain 4-bit init loses', 'Helps most at 2-3 bit'],
            cons: ['Extra initialization pass', 'Little benefit at 4-bit where QLoRA is already close'],
            bestFor: 'Sub-4-bit setups where QLoRA degrades.',
            technical: 'Jointly finds Q and A, B minimizing ||W \u2212 (Q + AB)||.',
        },
        {
            id: 'oft', category: 'adapters', name: 'OFT / OFTv2', fullName: 'Orthogonal Fine-Tuning',
            tags: ['Preserves behaviour'], frameworks: ['HF PEFT', 'LLaMA-Factory'],
            description: 'Rotates weights with an orthogonal transform rather than adding a low-rank update, preserving relationships the base model already learned.',
            visual: '\u{1F310} Rotation, not addition',
            pros: ['Keeps base behaviour intact', 'Stable on generative tasks'],
            cons: ['Less community mileage than LoRA'],
            bestFor: 'Subject-driven generation, or when tuning visibly damages general ability.',
            technical: 'Learns an orthogonal R applied as W\u2032 = RW. LLaMA-Factory added OFT and OFTv2 in August 2025.',
        },
        {
            id: 'adalora', category: 'adapters', name: 'AdaLoRA', fullName: 'Adaptive Budget Allocation',
            tags: ['Adaptive rank'], frameworks: ['HF PEFT'],
            description: 'Distributes a fixed rank budget across layers during training, giving more capacity to the layers that need it.',
            visual: '\u{1F4CA} Rank budget reallocated per layer',
            pros: ['No need to guess one rank for every layer', 'Better use of a fixed budget'],
            cons: ['More moving parts than LoRA', 'Adoption well below plain LoRA'],
            bestFor: 'Squeezing quality out of a tight parameter budget.',
            technical: 'SVD-parameterized updates, pruned by importance score during training.',
        },
        {
            id: 'ia3', category: 'adapters', name: 'IA³', fullName: 'Infused Adapter by Inhibiting and Amplifying Inner Activations',
            tags: ['Tiny'], frameworks: ['HF PEFT'],
            description: 'Learns per-channel rescaling vectors for key, value and feed-forward activations. Far fewer parameters than LoRA.',
            visual: '\u{1F39A}\uFE0F Learned scaling vectors',
            pros: ['Extremely small adapters', 'Merges with no inference cost'],
            cons: ['Less capacity than LoRA', 'Rarely the default choice today'],
            bestFor: 'Many task-specific adapters where storage matters more than headroom.',
            technical: 'Element-wise scaling of k, v and FFN activations.',
        },

        // ---------- Memory & speed ----------
        {
            id: 'galore', category: 'optimization', name: 'GaLore', fullName: 'Gradient Low-Rank Projection',
            tags: ['Full FT on one card'], frameworks: ['LLaMA-Factory'],
            description: 'Full fine-tuning with the optimizer state projected to low rank. Projects gradients, not weights, so every parameter still moves.',
            visual: '\u{1F4C9} Low-rank gradient projection',
            pros: ['Full fine-tuning quality without adapters', 'Large optimizer-memory reduction'],
            cons: ['Heavier than QLoRA', 'Projection adds compute'],
            bestFor: 'Full fine-tuning a 7B model on a single high-memory card.',
            technical: 'Projects optimizer states into a periodically recomputed low-rank subspace.',
        },
        {
            id: 'badam', category: 'optimization', name: 'BAdam', fullName: 'Block-wise Adam',
            tags: ['Last resort for OOM'], frameworks: ['LLaMA-Factory'],
            description: 'Optimizes one block of layers at a time so only that block needs optimizer state, cutting peak memory hard.',
            visual: '\u{1F9F1} One block at a time',
            pros: ['Full-parameter updates at very low peak memory', 'Simple idea, no adapters'],
            cons: ['Slower in wall-clock terms — updates are sequential'],
            bestFor: 'Full fine-tuning when even GaLore runs out of memory.',
            technical: 'Block coordinate descent with Adam over layer blocks.',
        },
        {
            id: 'mod', category: 'optimization', name: 'Mixture-of-Depths', fullName: 'MoD Fine-Tuning',
            tags: ['Architectural', 'Niche'], frameworks: ['LLaMA-Factory'],
            description: 'Trains a router that lets easy tokens skip layers, turning a dense model into a dynamic-compute one. An architecture change applied during full fine-tuning.',
            visual: '\u{1F6A6} Router skips layers per token',
            pros: ['Cheaper inference afterwards'],
            cons: ['Changes the architecture, so the result is no longer a drop-in model', 'Adoption far below GaLore or BAdam'],
            bestFor: 'Building a cheaper-to-serve model when you control deployment.',
            technical: 'Router-based token routing, run as a full-SFT recipe.',
        },

        // ---------- Alignment & RL ----------
        {
            id: 'dpo', category: 'alignment', name: 'DPO', fullName: 'Direct Preference Optimization',
            tags: ['Standard'], frameworks: ['TRL', 'LLaMA-Factory', 'Unsloth'],
            description: 'Optimizes preferences directly from chosen/rejected pairs with no reward model and no RL loop. The default alignment step for chat models.',
            visual: '\u{1F44D} chosen vs \u{1F44E} rejected',
            pros: ['Stable and simple', 'No reward model to train'],
            cons: ['Needs paired data', 'Keeps a frozen reference model in memory'],
            bestFor: 'Instruction following and tone, after an SFT pass.',
            technical: 'Maximizes the margin between chosen and rejected under a KL constraint to the reference.',
        },
        {
            id: 'orpo', category: 'alignment', name: 'ORPO', fullName: 'Odds Ratio Preference Optimization',
            tags: ['No SFT stage'], frameworks: ['TRL', 'LLaMA-Factory', 'Unsloth'],
            description: 'Folds preference optimization into SFT with an odds-ratio penalty, so one run replaces the usual SFT-then-DPO pipeline. Distinct from DPO, not a nickname for it.',
            visual: '\u{1F501} SFT and alignment in one pass',
            pros: ['One stage instead of two', 'No reference model needed'],
            cons: ['Experimental in TRL', 'Less battle-tested than DPO'],
            bestFor: 'Aligning a base model when you would rather not run SFT separately.',
            technical: 'SFT loss plus an odds-ratio term penalizing the rejected response.',
        },
        {
            id: 'simpo', category: 'alignment', name: 'SimPO', fullName: 'Simple Preference Optimization',
            tags: ['Reference-free'], frameworks: ['TRL', 'LLaMA-Factory', 'Unsloth'],
            description: 'Preference optimization using average log-probability as the implicit reward, dropping the reference model DPO needs.',
            visual: '\u{1F4CF} Length-normalized reward, no reference',
            pros: ['No reference model, so less memory', 'Reduces length bias'],
            cons: ['Sensitive to its margin hyperparameter'],
            bestFor: 'DPO-style alignment when the reference model will not fit.',
            technical: 'Length-normalized log-prob reward with a target margin. In LLaMA-Factory it is the DPO trainer with pref_loss=simpo.',
        },
        {
            id: 'kto', category: 'alignment', name: 'KTO', fullName: 'Kahneman-Tversky Optimization',
            tags: ['Unpaired data'], frameworks: ['TRL', 'LLaMA-Factory', 'Unsloth'],
            description: 'Aligns from standalone good/bad labels — no pairing required. Much easier data to collect than chosen/rejected pairs.',
            visual: '\u{1F44D} / \u{1F44E} unpaired labels',
            pros: ['Works with thumbs-up/down feedback you already have', 'Competitive with DPO'],
            cons: ['Needs a sensible balance of positive to negative examples'],
            bestFor: 'Production feedback logs, where pairs are rare and thumbs are plentiful.',
            technical: 'Prospect-theory utility over unpaired examples.',
        },
        {
            id: 'grpo', category: 'alignment', name: 'GRPO', fullName: 'Group Relative Policy Optimization',
            tags: ['Reasoning', 'RLVR'], frameworks: ['TRL', 'Unsloth', 'verl'],
            description: 'The RL method behind DeepSeek-R1. Samples a group of completions per prompt and scores each against the group mean, so no critic network is required.',
            visual: '\u{1F3C6} Group-relative scoring, no critic',
            pros: ['No value network to train or hold in memory', 'Strong on verifiable rewards', 'TRL defaults to beta=0, so the reference model is not loaded either'],
            cons: ['Needs many samples per prompt, so generation dominates cost', "Unsloth's headline '80% less VRAM' is their own optimized-kernel figure, not a property of GRPO"],
            bestFor: 'Maths, code and anything with a checkable answer.',
            technical: "Advantage = (reward \u2212 group mean) / group std. Canonical implementation is TRL's GRPOTrainer; Unsloth patches it rather than reimplementing it.",
        },
        {
            id: 'gspo', category: 'alignment', name: 'GSPO', fullName: 'Group Sequence Policy Optimization',
            tags: ['MoE stability'], frameworks: ['TRL'],
            description: "Qwen's variant of GRPO that computes importance ratios per sequence rather than per token. A distinct algorithm, not a rename — it was built to stop MoE runs collapsing.",
            visual: '\u{1F4CF} Sequence-level importance sampling',
            pros: ['Markedly more stable for MoE training', 'Rewards are sequence-level, so the ratio matches them'],
            cons: ["TRL's implementation is GSPO-style rather than bit-exact to the paper"],
            bestFor: 'RL on Mixture-of-Experts models, or when GRPO training destabilizes.',
            technical: 'importance_sampling_level="sequence" in TRL. Paper: arXiv 2507.18071, Qwen Team, July 2025.',
        },
        {
            id: 'ppo', category: 'alignment', name: 'PPO / RLHF', fullName: 'Proximal Policy Optimization',
            tags: ['Classic', 'Displaced'], frameworks: ['TRL', 'LLaMA-Factory', 'verl'],
            description: 'The original RLHF recipe: train a reward model, then optimize the policy against it with a critic. Still runs, but newer critic-free methods have displaced it for most work.',
            visual: '\u{1F3AF} Policy + critic + reward model',
            pros: ['Well understood, still standard in verl and OpenRLHF', 'Works with a learned reward model rather than verifiable rewards'],
            cons: ['Four models in memory at once', 'In TRL it is experimental, has no vLLM support, and is moving to trl.experimental.ppo'],
            bestFor: 'Preference rewards too fuzzy to check programmatically, on a stack built for it.',
            technical: 'Clipped surrogate objective with a value network and KL penalty to the reference.',
        },
        {
            id: 'rloo', category: 'alignment', name: 'RLOO', fullName: 'REINFORCE Leave-One-Out',
            tags: ['Lightweight RL'], frameworks: ['TRL'],
            description: 'REINFORCE with a leave-one-out baseline built from the other samples in the batch. Simpler than PPO, and stable in TRL rather than experimental.',
            visual: '\u{1F501} Baseline from the other samples',
            pros: ['No critic network', 'Stable trainer with vLLM support'],
            cons: ['Less community mileage than GRPO for reasoning work'],
            bestFor: 'A simpler online RL baseline to compare GRPO against.',
            technical: 'Each sample uses the mean reward of the others in its group as its baseline.',
        },

        // ---------- Distributed & multi-GPU ----------
        {
            id: 'ddp', category: 'distributed', name: 'DDP', fullName: 'Distributed Data Parallel',
            tags: ['Start here for 2+ GPUs'], frameworks: ['Accelerate', 'LLaMA-Factory', 'Unsloth', 'Axolotl'],
            description: 'A full copy of the model on every GPU, gradients averaged each step. The simplest way to use more than one card — throughput scales, but memory does not.',
            visual: '\u{1F5C2}\uFE0F Full replica per GPU, gradients all-reduced',
            pros: ['Simplest distributed setup', 'Near-linear throughput scaling', 'Unsloth documents this path specifically'],
            cons: ['The whole model, gradients and optimizer must fit on every single GPU', 'Buys you speed, not capacity'],
            bestFor: 'A model that already fits on one card, when you want the run to finish sooner.',
            technical: 'torchrun or accelerate launch. Axolotl falls back to DDP when neither FSDP nor DeepSpeed is configured.',
        },
        {
            id: 'fsdp2', category: 'distributed', name: 'FSDP2', fullName: 'Fully Sharded Data Parallel v2',
            tags: ['Recommended'], frameworks: ['Accelerate', 'LLaMA-Factory', 'Axolotl', 'torchtune'],
            description: "Shards parameters, gradients and optimizer state across GPUs, so the model no longer has to fit on any single one. PyTorch's recommended path — FSDP1 is deprecated.",
            visual: '\u{1F9E9} Every rank holds a slice of the model',
            pros: ['Trains models far larger than one card holds', 'Per-parameter DTensor sharding handles frozen params, LoRA and NF4 cleanly', 'Native to PyTorch, no extra dependency'],
            cons: ['The largest all-gathered unit plus activations must still fit on one GPU', 'Offload is all-or-nothing — no NVMe tier', 'Accelerate still defaults to FSDP1 unless you set fsdp_version=2'],
            bestFor: 'Full fine-tuning or large-model LoRA across 2-8 GPUs.',
            technical: "Decomposes DDP's all-reduce into reduce-scatter + all-gather. PyTorch deprecated FSDP1 and archived its tutorials; Axolotl marks FSDP1 for removal.",
        },
        {
            id: 'zero', category: 'distributed', name: 'DeepSpeed ZeRO', fullName: 'Zero Redundancy Optimizer, stages 1-3',
            tags: ['Cumulative stages'], frameworks: ['Accelerate', 'LLaMA-Factory', 'Unsloth', 'Axolotl'],
            description: 'Removes redundant state across ranks in three cumulative stages. Stage 1 partitions optimizer state, stage 2 adds gradients, stage 3 adds the parameters themselves.',
            visual: '1\uFE0F\u20E3 optimizer \u2192 2\uFE0F\u20E3 + gradients \u2192 3\uFE0F\u20E3 + parameters',
            pros: ['Finer offload control than FSDP — parameters and optimizer separately', 'Mature and widely deployed', 'Stage 3 reaches the largest models'],
            cons: ['More configuration surface than FSDP', 'Extra dependency', 'Communication cost climbs with each stage'],
            bestFor: 'Large runs where you want to dial memory against speed. Start at stage 1 and escalate only as needed.',
            technical: 'Stage 3 gathers and re-partitions parameters during forward and backward. Roughly comparable to FSDP FULL_SHARD, but not interchangeable with it.',
        },
        {
            id: 'offload', category: 'distributed', name: 'CPU / NVMe offload', fullName: 'ZeRO-Offload and ZeRO-Infinity',
            tags: ['Last resort'], frameworks: ['Accelerate', 'LLaMA-Factory', 'Axolotl'],
            description: 'Pushes optimizer state — and with ZeRO-Infinity, parameters too — out to system RAM or NVMe when VRAM runs out. Buys capacity by spending bandwidth.',
            visual: '\u{1F4BE} GPU \u2192 system RAM \u2192 NVMe',
            pros: ['Fits models the GPUs plainly cannot hold', 'DeepSpeed is the only stack offering an NVMe tier'],
            cons: ['Substantially slower — bandwidth becomes the bottleneck', 'Needs a lot of system RAM: the 70B recipe wants around 107 GB', "PEFT lists CPU-offload memory savings as 'untested'"],
            bestFor: 'When the alternative is not training at all.',
            technical: 'offload_optimizer / offload_param with device: cpu|nvme inside a ZeRO stage config.',
        },
        {
            id: 'fsdpqlora', category: 'distributed', name: 'FSDP + QLoRA', fullName: 'Sharded 4-bit LoRA Training',
            tags: ['70B on 2\u00D724 GB'], frameworks: ['HF PEFT', 'Accelerate', 'TRL', 'Axolotl'],
            description: 'The consumer-rig headline recipe: FSDP sharding plus 4-bit quantization plus LoRA. Answer.AI and bitsandbytes demonstrated 70B fine-tuning on two 24 GB cards.',
            visual: '\u{1F9E9} Sharded + \u{1F4E6} 4-bit + \u26A1 LoRA',
            pros: ['70B LoRA at 19.6 GB per GPU with CPU offload, or 35.6 GB without', 'Replaces what used to take 8\u00D780 GB with FSDP+LoRA', 'Integrated across bitsandbytes, transformers, PEFT and TRL'],
            cons: ['Needs roughly 107 GB of system RAM in the offload configuration', 'Adapter merging inside an FSDP-wrapped model errors — save the adapter and merge separately', 'paged_adamw_8bit fails on checkpoint save; 8-bit QDoRA has known issues'],
            bestFor: 'A 70B-class model on a 2-8 card consumer rig. A demonstrated ceiling, not a comfortable operating point.',
            technical: 'Set bnb_4bit_quant_storage to a float dtype matching the model dtype — FSDP shards float tensors only, and 4-bit weights are normally uint8. Mismatched dtypes wrap each Linear4bit separately.',
        },

        // ---------- Largely superseded ----------
        {
            id: 'softprompt', category: 'legacy', name: 'Soft prompting', fullName: 'Prefix / Prompt / P-Tuning',
            tags: ['Historical'], frameworks: ['HF PEFT'],
            description: 'The pre-LoRA PEFT family: freeze the model and learn continuous vectors prepended to the input or to each layer. Still implemented, rarely chosen now.',
            visual: '\u{1F9EE} Learned vectors prepended to the input',
            pros: ['Very few trainable parameters', 'One frozen base serves many tasks'],
            cons: ['Generally weaker than LoRA at the same budget', 'Eats context window', 'Can be fiddly to train'],
            bestFor: 'Mostly historical interest, or serving very many tasks from one frozen base.',
            technical: 'Prefix tuning adds vectors at every layer; prompt tuning only at the input; P-Tuning v2 is the deep variant.',
        },
    ];

    const FRAMEWORKS = ['HF PEFT', 'TRL', 'Accelerate', 'LLaMA-Factory', 'Unsloth', 'Axolotl'];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    // ---------- Decision wizard ----------
    // Every branch ends at a method, and LoRA is reachable — it is the right
    // answer far more often than anything else here.
    const QUESTIONS = {
        start: {
            text: 'What are you trying to do?',
            options: [
                { label: 'Teach it a task or domain', sub: 'You have example inputs and outputs', next: 'hardware' },
                { label: 'Align it to preferences', sub: 'Tone, safety, choosing better answers', next: 'pref' },
                { label: 'Train reasoning with rewards', sub: 'RL against a scorable objective', next: 'rl' },
            ],
        },
        hardware: {
            text: 'What are you training on?',
            options: [
                { label: 'One GPU', sub: 'A single card of any size', next: 'single' },
                { label: 'Several consumer GPUs', sub: '2-8 cards, 24 GB class', next: 'multi' },
                { label: 'Several large GPUs', sub: '80 GB class, or a proper node', next: 'multibig' },
            ],
        },

        // --- single GPU ---
        single: {
            text: 'How does the model fit on that card?',
            options: [
                { label: 'Comfortably, in 16-bit', sub: 'e.g. 7B-13B on 24 GB', next: 'lorafit' },
                { label: 'Only with a 4-bit base', sub: 'Bigger than the card comfortably holds', pick: 'qlora' },
                { label: 'I need full-FT quality and it is tight', sub: 'Adapters are not enough', next: 'fullft' },
            ],
        },
        lorafit: {
            text: 'Is plain LoRA good enough?',
            options: [
                { label: "Yes, or I haven't tried it yet", sub: 'Start with the default', pick: 'lora' },
                { label: 'It converges too slowly', sub: 'Needs a better starting point', pick: 'pissa' },
                { label: 'The loss plateaus', sub: 'Needs asymmetric learning rates', pick: 'loraplus' },
                { label: 'It underfits at low rank', sub: 'Needs more expressive updates', pick: 'dora' },
            ],
        },
        fullft: {
            text: 'How tight is the memory?',
            options: [
                { label: 'Tight but workable', sub: 'One high-memory card', pick: 'galore' },
                { label: 'Still running out of memory', sub: 'Even with gradient projection', pick: 'badam' },
                { label: 'I can restrict what trains', sub: 'Only the top layers need to move', pick: 'freeze' },
            ],
        },

        // --- several consumer GPUs ---
        multi: {
            text: 'What is stopping you on those cards?',
            options: [
                { label: 'Nothing — the model already fits', sub: 'I just want the run to finish sooner', pick: 'ddp' },
                { label: 'A 70B-class model that will not fit', sub: 'Even 4-bit on one card is not enough', pick: 'fsdpqlora' },
                { label: 'Too big per card, but 4-bit is unwelcome', sub: 'Shard it in 16-bit instead', pick: 'fsdp2' },
                { label: 'Short on memory even after sharding', sub: 'Willing to trade speed for capacity', pick: 'offload' },
            ],
        },

        // --- several large GPUs ---
        multibig: {
            text: 'What are you running on them?',
            options: [
                { label: 'Full fine-tuning, fits per card', sub: 'Replicate and go', pick: 'full' },
                { label: 'Full fine-tuning, too big per card', sub: 'Needs sharding', pick: 'fsdp2' },
                { label: 'Adapters, and I want throughput', sub: 'LoRA across all cards', pick: 'ddp' },
                { label: 'I want fine-grained offload control', sub: 'Separate parameter and optimizer offload', pick: 'zero' },
            ],
        },

        // --- alignment ---
        pref: {
            text: 'What does your preference data look like?',
            options: [
                { label: 'Chosen / rejected pairs', sub: 'The usual A-vs-B comparison', pick: 'dpo' },
                { label: 'Unpaired good / bad labels', sub: 'Thumbs up and down from production', pick: 'kto' },
                { label: 'Pairs, and I want to skip SFT', sub: 'One stage instead of two', pick: 'orpo' },
                { label: 'Pairs, but no room for a reference model', sub: 'Memory is the constraint', pick: 'simpo' },
            ],
        },

        // --- RL ---
        rl: {
            text: 'What does your reward look like?',
            options: [
                { label: 'Checkable — maths, code, tests', sub: 'Verifiable rewards', pick: 'grpo' },
                { label: 'Checkable, but training a big MoE', sub: 'GRPO destabilizes at that scale', pick: 'gspo' },
                { label: 'A learned reward model', sub: 'Preferences too fuzzy to verify', pick: 'ppo' },
                { label: 'I want a simpler baseline', sub: 'Something to compare GRPO against', pick: 'rloo' },
            ],
        },
    };

    const renderWizard = (key) => {
        const q = QUESTIONS[key];
        $('wizard-q').textContent = q.text;
        const wrap = $('wizard-opts');
        wrap.innerHTML = '';
        q.options.forEach((opt) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.innerHTML = `<b>${esc(opt.label)}</b><span>${esc(opt.sub)}</span>`;
            b.addEventListener('click', () => {
                if (opt.next) return renderWizard(opt.next);
                openMethod(opt.pick);
            });
            wrap.appendChild(b);
        });
    };

    $('wizard-reset').addEventListener('click', () => renderWizard('start'));

    // ---------- Filtering ----------
    const state = { search: '', category: 'All', framework: 'All' };

    const buildChips = (containerId, values, key) => {
        const box = $(containerId);
        [['All', 'All'], ...values].forEach(([value, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip';
            b.textContent = label;
            b.setAttribute('aria-pressed', String(state[key] === value));
            b.addEventListener('click', () => {
                state[key] = value;
                box.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
                render();
            });
            box.appendChild(b);
        });
    };

    const render = () => {
        const term = state.search.trim().toLowerCase();
        const list = METHODS.filter((m) => {
            // Search names, prose, tags and the category label — someone typing
            // "multi gpu" should find the distributed entries.
            const haystack = [
                m.name, m.fullName, m.description, m.bestFor,
                CATEGORIES[m.category], m.tags.join(' '), m.frameworks.join(' '),
            ].join(' ').toLowerCase();
            const matchesSearch = !term || term.split(/\s+/).every((w) => haystack.includes(w));
            const matchesCategory = state.category === 'All' || m.category === state.category;
            const matchesFramework = state.framework === 'All' || m.frameworks.includes(state.framework);
            return matchesSearch && matchesCategory && matchesFramework;
        });

        const grid = $('method-grid');
        grid.innerHTML = '';

        $('result-count').textContent = list.length === METHODS.length
            ? `${METHODS.length} methods`
            : `${list.length} of ${METHODS.length} methods`;

        if (!list.length) {
            grid.innerHTML = '<p class="no-results">No method matches that. Try clearing the filters.</p>';
            return;
        }

        list.forEach((m) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'method-card';
            card.setAttribute('aria-haspopup', 'dialog');
            card.innerHTML = `
                <span class="cat">${esc(CATEGORIES[m.category])}</span>
                <h3>${esc(m.name)}</h3>
                <p class="full">${esc(m.fullName)}</p>
                <p>${esc(m.description)}</p>
                <div class="tags">${m.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
                <p class="visual">${esc(m.visual)}</p>`;
            card.addEventListener('click', () => openMethod(m.id, card));
            grid.appendChild(card);
        });
    };

    // ---------- Detail dialog ----------
    const modal = $('modal');
    let lastFocus = null;

    function openMethod(id, trigger) {
        const m = METHODS.find((x) => x.id === id);
        if (!m) return;
        lastFocus = trigger || document.activeElement;

        $('modal-body').innerHTML = `
            <div class="modal-top">
                <div>
                    <p class="eyebrow">${esc(CATEGORIES[m.category])}</p>
                    <h2 id="modal-title">${esc(m.name)}</h2>
                    <p class="full">${esc(m.fullName)}</p>
                </div>
                <button class="icon-btn" id="modal-close" aria-label="Close" type="button">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                </button>
            </div>

            <p class="modal-visual">${esc(m.visual)}</p>
            <p class="modal-desc">${esc(m.description)}</p>

            <div class="verdict">
                <div>
                    <h4>Pros</h4>
                    <ul>${m.pros.map((p) => `<li class="pro"><i class="fas fa-check" aria-hidden="true"></i><span>${esc(p)}</span></li>`).join('')}</ul>
                </div>
                <div>
                    <h4>Cons</h4>
                    <ul>${m.cons.map((c) => `<li class="con"><i class="fas fa-xmark" aria-hidden="true"></i><span>${esc(c)}</span></li>`).join('')}</ul>
                </div>
            </div>

            <dl class="meta-rows">
                <div><dt>Best for</dt><dd>${esc(m.bestFor)}</dd></div>
                <div><dt>How it works</dt><dd><code>${esc(m.technical)}</code></dd></div>
                <div><dt>Frameworks</dt><dd>${m.frameworks.map(esc).join(' · ')}</dd></div>
            </dl>`;

        $('modal-close').addEventListener('click', () => modal.close());
        modal.showModal();
    }

    // Clicking the backdrop closes it.
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
    modal.addEventListener('close', () => { if (lastFocus) lastFocus.focus(); });

    // ---------- Boot ----------
    $('search').addEventListener('input', (e) => { state.search = e.target.value; render(); });
    buildChips('filter-category', Object.entries(CATEGORIES), 'category');
    buildChips('filter-framework', FRAMEWORKS.map((f) => [f, f]), 'framework');
    renderWizard('start');
    render();
})();
