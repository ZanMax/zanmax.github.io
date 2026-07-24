// The VC Framework — a disciplined process for building software with agentic
// coding CLIs. Content checked July 2026 against primary docs (Claude Code,
// OpenAI Codex, Google Gemini CLI, the MCP spec). The three agents share one
// shape: a terminal CLI, a project-memory file, built-in context management,
// subagents, hooks and native MCP.

(() => {
    const MODES = {
        universal: {
            label: 'The universal loop',
            intro: 'Three CLI agents, one shape. <strong>Claude Code</strong>, <strong>OpenAI Codex</strong> and <strong>Gemini CLI</strong> all run in the terminal, read a per-repo memory file, manage their own context, spawn subagents, fire hooks, and speak MCP. Learn the shape once and it carries across all three.',
            stack: [
                ['Where it runs', 'The terminal'],
                ['Project memory', 'A committed instructions file'],
                ['Live context', '<code>MCP</code> servers, not copy-paste'],
                ['Safety net', 'Git — always'],
            ],
            steps: [
                { h: 'Plan before you touch code', d: "Have the agent read the repo and produce a plan you approve before it edits anything. Every CLI has a plan or read-only mode for exactly this.", p: 'Read the codebase and this feature request. Produce a step-by-step plan and the files you would change. Do not write any code yet — wait for my approval.' },
                { h: 'Break it into atomic tasks', d: 'One reviewable change per task. Small tasks fail cheaply and revert cleanly — the single most important habit.', p: 'Break this plan into a numbered list of atomic tasks. Each task should be one self-contained, reviewable change.' },
                { h: 'Make the tests the guardrail', d: "Write the failing test first, then the code. On every CLI you can enforce this with a hook that blocks the agent from stopping until the suite passes — deterministic, not a polite request.", p: 'Implement task 1. Write a failing test first, then the code to pass it. Run the suite and show me the result before moving on.' },
                { h: 'Commit, then clear', d: "Commit each green task. Then reset the conversation — but with a command (Claude Code's /clear, Codex and Gemini equivalents), not by opening a new window. Auto-compaction handles the long runs.", p: 'Tests pass. Write a conventional commit for this change, then I will clear the context before the next task.' },
                { h: 'Trust Git, not the bot', d: "When it goes wrong — and it will — revert, don't argue. A clean commit per task is what makes that a one-line fix instead of an afternoon.", p: null },
            ],
        },

        claude: {
            label: 'Claude Code',
            intro: "Anthropic's terminal agent, and the tool that originated MCP. <strong>CLAUDE.md</strong> is the memory file, context management lives in built-in commands, and repeatable procedures go in Skills rather than pasted prompts.",
            stack: [
                ['CLI', '<code>claude</code>'],
                ['Memory', '<code>CLAUDE.md</code> via <code>/init</code>'],
                ['Procedures', 'Skills &amp; subagents'],
                ['Control', 'Hooks &amp; plan mode'],
            ],
            steps: [
                { h: 'Initialize the memory file', d: 'CLAUDE.md holds the facts that must always be in context — build and test commands, conventions, gotchas. Generate it with /init, maintain it with /memory.', p: '/init' },
                { h: 'Plan in plan mode', d: 'Enter plan mode with Shift+Tab for anything non-trivial. Claude explores read-only and proposes an approach before it can edit.', p: 'Explore how auth works in this repo, then propose a plan to add password reset. Stay read-only until I approve.' },
                { h: 'Delegate the search to a subagent', d: 'Subagents (Explore, Plan, general-purpose, or your own in .claude/agents/) run in their own context window and return only a summary — so a big investigation never floods the main thread.', p: 'Use the Explore subagent to find every place we validate a session token, and report back just the file list and the pattern.' },
                { h: 'Make good habits deterministic', d: "Move repeatable procedures into Skills. Enforce the non-negotiables with hooks — e.g. a Stop hook that runs the tests and blocks until they pass.", p: 'Add a Stop hook that runs `npm test` and refuses to stop until it is green.' },
                { h: 'Manage context on purpose', d: "/clear resets the conversation but keeps CLAUDE.md. /compact summarizes to free room. /context shows what is eating your window. Use them instead of new terminals.", p: '/context' },
            ],
        },

        codex: {
            label: 'OpenAI Codex',
            intro: "OpenAI's agentic coding tool. The <strong>Codex CLI</strong> is open-source, written in Rust, and reads an <strong>AGENTS.md</strong> file. Same terminal-agent shape as Claude Code, plus a cloud agent and IDE extensions.",
            stack: [
                ['CLI', '<code>codex</code>'],
                ['Memory', '<code>AGENTS.md</code> via <code>/init</code>'],
                ['Live tools', '<code>codex mcp</code>'],
                ['Also', 'IDE ext + cloud agent'],
            ],
            steps: [
                { h: 'Create the AGENTS.md', d: 'The Codex equivalent of CLAUDE.md — per-repo instructions the agent reads on every run. Generate it with /init.', p: '/init' },
                { h: 'Set model and reasoning effort', d: 'Codex gives you explicit control over the model, reasoning effort, and how much it can do without asking. Turn effort up for the hard tasks, down for mechanical ones.', p: 'Use high reasoning effort for this refactor and explain your plan before editing.' },
                { h: 'Wire live context through MCP', d: 'Instead of pasting docs, connect MCP servers with `codex mcp` — GitHub, a database, your docs — and the agent pulls what it needs as tools. Inspect what is connected with the /mcp command.', p: 'codex mcp add <name> --env KEY=value -- <server-command>' },
                { h: 'Keep the loop tight', d: 'Task, test, review the diff, commit. The same atomic discipline as everywhere else — Codex just runs it locally with your permission rules.', p: 'Implement the first task. Show me the diff and the passing test before you touch anything else.' },
                { h: 'Escalate to the cloud agent for parallel work', d: 'Codex Web (chatgpt.com/codex) runs tasks in the cloud, useful for long or parallel jobs while you keep working locally.', p: null },
            ],
        },

        gemini: {
            label: 'Gemini CLI',
            intro: "Google's terminal agent. <strong>Gemini CLI</strong> is open source (launched June 2025), runs a ReAct loop with native MCP, and is backed by the <strong>Gemini 3.x</strong> family with a 1M-token window. Pull files into the prompt with <code>@</code>-mentions; connect live tools over MCP.",
            stack: [
                ['CLI', '<code>gemini</code>'],
                ['Model', 'Gemini 3.x · 1M context'],
                ['Live tools', 'Native <code>MCP</code>'],
                ['Invoke', '<code>@file</code> · MCP via <code>/mcp</code>'],
            ],
            steps: [
                { h: 'Lean on the big context window', d: 'The 1M-token window means Gemini can hold a lot of the codebase at once. Point it at the whole repo for architectural questions rather than pruning by hand.', p: 'Load the whole repo. Where does request validation happen, and what would break if I changed the User model?' },
                { h: 'Bring in files and tools', d: "Reference code inline with @-mentions — @path/to/file pulls a file's contents into the prompt. Connected MCP servers are managed with /mcp and their tools are called in plain language.", p: 'Include @src/auth.ts and, using the connected GitHub server, list the open issues that touch this file.' },
                { h: 'Ground new libraries in search', d: "Gemini's search grounding checks a library against current docs — worth doing before you trust it on a fast-moving dependency.", p: 'Check current docs for this library. Am I using any deprecated methods? Cite what changed.' },
                { h: 'Let the ReAct loop verify itself', d: 'Gemini CLI reasons, acts with a tool, observes, repeats. Ask it to run the tests as part of that loop rather than reporting a change as done.', p: 'Make the change, then run the test suite and iterate until it passes. Report only once it is green.' },
            ],
        },
    };

    // Cross-cutting sections, rendered once.
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const ORDER = ['universal', 'claude', 'codex', 'gemini'];
    let current = 'universal';

    const buildTabs = () => {
        const box = $('mode-tabs');
        ORDER.forEach((key) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('role', 'tab');
            b.textContent = MODES[key].label;
            b.setAttribute('aria-selected', String(key === current));
            b.addEventListener('click', () => { current = key; render(); box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b))); });
            box.appendChild(b);
        });
    };

    const render = () => {
        const m = MODES[current];
        $('mode-intro').innerHTML = m.intro;
        $('mode-stack').innerHTML = m.stack.map(([k, v]) => `<li><div class="k">${esc(k)}</div><div class="v">${v}</div></li>`).join('');
        $('mode-steps').innerHTML = m.steps.map((s) => `
            <li>
                <h4>${esc(s.h)}</h4>
                <p class="desc">${esc(s.d)}</p>
                ${s.p ? `<div class="prompt" role="button" tabindex="0" data-prompt="${esc(s.p)}"><span class="copy"><i class="fas fa-copy" aria-hidden="true"></i></span>${esc(s.p)}</div>` : ''}
            </li>`).join('');
    };

    // Copy-to-clipboard on the prompt boxes (event-delegated).
    const copy = (el) => {
        const text = el.getAttribute('data-prompt');
        navigator.clipboard?.writeText(text).then(() => {
            el.classList.add('copied');
            const hint = el.querySelector('.copy');
            const prev = hint.innerHTML;
            hint.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
            setTimeout(() => { el.classList.remove('copied'); hint.innerHTML = prev; }, 1200);
        });
    };

    $('mode-steps').addEventListener('click', (e) => {
        const box = e.target.closest('.prompt');
        if (box) copy(box);
    });
    $('mode-steps').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const box = e.target.closest('.prompt');
        if (box) { e.preventDefault(); copy(box); }
    });

    buildTabs();
    render();
})();
