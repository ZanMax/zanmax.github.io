(() => {
    'use strict';
    const P = window.FT_PRICES;
    const $ = id => document.getElementById('fc-' + id);
    const number = n => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
    const money = n => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    const range = values => money(values[0]) + '–' + money(values[1]);
    let type = 'text';
    let audioTask = 'transcription';
    let scope = 'tested';
    let customQuantity = false;
    const serviceFor = () => P.getService(type, audioTask);
    function populate(select, options) {
        select.replaceChildren(...options.map(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.label + (item.custom ? ' — custom quote' : '');
            return option;
        }));
    }
    populate($('audio-task'), Object.entries(P.audioModes).map(([id, mode]) => ({ id, ...mode })));
    function setType(next, nextAudioTask = 'transcription') {
        if (!Object.hasOwn(P.services, next)) return;
        type = next;
        audioTask = nextAudioTask;
        customQuantity = false;
        const service = serviceFor();
        $('audio-field').hidden = type !== 'audio';
        $('audio-task').value = audioTask;
        $('quantity').value = service.quantity;
        $('quantity').min = service.step;
        $('quantity').removeAttribute('max');
        $('quantity').step = service.step;
        $('quantity-label').textContent = service.question;
        $('quantity-note').textContent = service.example + ' Choose a preset or enter your own amount.';
        $('type-note').textContent = service.description;
        $('size-field').hidden = service.sizes.length === 0;
        $('size').disabled = service.sizes.length === 0;
        $('size-label').textContent = service.sizeLabel || '';
        populate($('size'), service.sizes);
        $('project-fields').replaceChildren(...service.fields.map(field => {
            const container = document.createElement('div'); container.className = 'fc-field';
            const label = document.createElement('label'); label.htmlFor = 'fc-param-' + field.id; label.textContent = field.label;
            const select = document.createElement('select'); select.id = label.htmlFor; select.dataset.parameter = field.id;
            populate(select, field.options);
            container.append(label, select);
            return container;
        }));
        $('presets').replaceChildren(...service.presets.map(quantity => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'fc-button';
            button.dataset.quantity = quantity;
            button.textContent = number(quantity) + (type === 'audio' ? (audioTask === 'voice' ? ' min' : ' hours') : '');
            return button;
        }));
        const custom = document.createElement('button'); custom.type = 'button'; custom.className = 'fc-button';
        custom.dataset.custom = 'true'; custom.textContent = 'Custom'; custom.setAttribute('aria-controls', 'fc-quantity'); $('presets').append(custom);
        document.querySelectorAll('#fc-types button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === type)));
    }
    function line(label, value) {
        const div = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value; div.append(dt, dd); return div;
    }
    function update() {
        const service = serviceFor(); const data = $('data').value; const sizeId = $('size').value;
        const size = service.sizes.find(tier => tier.id === sizeId);
        const parameters = Object.fromEntries([...$('project-fields').querySelectorAll('select')].map(select => [select.dataset.parameter, select.value]));
        $('data-note').textContent = service.custom ? 'Preparation requirements will be agreed for your project.'
            : data === 'ready' ? 'You supply the examples. Basic checks are included in the service.'
            : data === 'organize' ? 'We clean and organize your existing examples before fine-tuning.' : service.preparation + ' You supply the original material.';
        document.querySelectorAll('#fc-scope button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === scope)));
        const quantity = $('quantity').value.trim() === '' ? NaN : Number($('quantity').value);
        document.querySelectorAll('#fc-presets button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.custom ? customQuantity || !service.presets.includes(quantity) : !customQuantity && Number(button.dataset.quantity) === quantity)));
        try {
            const result = window.FT_MATH.calculate({ type, audioTask, scope, size: sizeId, data, quantity, parameters }, P);
            $('quantity').setAttribute('aria-invalid', 'false'); $('error').hidden = true;
            $('total').classList.toggle('fc-custom', result.custom);
            $('total').textContent = result.custom ? 'Custom quote' : range([result.low, result.high]);
            const choices = service.fields.map(field => field.options.find(option => option.id === parameters[field.id]).label);
            $('summary').textContent = [service.label, size?.label, ...choices, number(quantity) + ' ' + service.unit, P.scopes[scope].label].filter(Boolean).join(' · ');
            $('lines').hidden = result.custom;
            $('lines').replaceChildren(...(result.custom ? [] : [
                line('Fine-tuning service', range(result.work)),
                line('Preparing examples', data === 'ready' ? 'Client supplies examples' : range(result.preparation))
            ]));
            const included = result.custom ? ['Training approach and data review', 'Delivery scope agreed with your quote'] : P.scopes[scope].includes;
            $('included').replaceChildren(...included.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
            // No boilerplate estimate disclaimer. Explain only a custom quote or
            // the explicit assumption when the client does not know model size.
            $('estimate-note').textContent = result.custom ? result.reason
                : result.assumedSmall ? 'This estimate assumes a small text model.' : '';
            $('estimate-note').hidden = !$('estimate-note').textContent;
        } catch (error) {
            $('quantity').setAttribute('aria-invalid', 'true'); $('error').textContent = error.message; $('error').hidden = false;
            $('total').classList.remove('fc-custom'); $('total').textContent = '—'; $('summary').textContent = 'Enter an amount to see your estimate';
            $('lines').replaceChildren(); $('lines').hidden = true; $('included').replaceChildren();
            $('estimate-note').textContent = ''; $('estimate-note').hidden = true;
        }
    }
    $('types').addEventListener('click', event => { const button = event.target.closest('button[data-type]'); if (button) { setType(button.dataset.type); update(); } });
    $('scope').addEventListener('click', event => { const button = event.target.closest('button[data-scope]'); if (button) { scope = button.dataset.scope; update(); } });
    $('presets').addEventListener('click', event => {
        const button = event.target.closest('button'); if (!button) return;
        customQuantity = Boolean(button.dataset.custom); if (customQuantity) $('quantity').focus(); else $('quantity').value = button.dataset.quantity; update();
    });
    $('form').addEventListener('submit', event => event.preventDefault());
    $('form').addEventListener('input', event => {
        if (event.target === $('audio-task')) return;
        if (event.target === $('quantity')) customQuantity = true;
        update();
    });
    $('form').addEventListener('change', event => {
        if (event.target === $('audio-task')) setType('audio', $('audio-task').value);
        update();
    });
    setType('text'); update();
})();
