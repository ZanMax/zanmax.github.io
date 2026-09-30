/* Service fees and scoped allowances, never a supplier-only bill. */
(function (root, factory) {
    const math = factory();
    if (typeof module === 'object' && module.exports) module.exports = math;
    else root.FT_MATH = math;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    // Avoid adding $50 when floating-point arithmetic lands just above a boundary.
    const round = n => Math.ceil(n / 50 - 1e-9) * 50;
    function calculate(state, prices) {
        const service = prices.getService(state.type, state.audioTask);
        const scope = Object.hasOwn(prices.scopes, state.scope) ? prices.scopes[state.scope] : null;
        if (!scope) throw new Error('Choose a project package.');
        if (!['ready', 'organize', 'prepare'].includes(state.data)) throw new Error('Choose whether your examples are ready.');
        const quantity = state.quantity;
        const units = quantity / service.step;
        if (!Number.isFinite(quantity) || quantity < service.step || !Number.isSafeInteger(Math.round(units)) || Math.abs(units - Math.round(units)) > 1e-6) {
            throw new Error(service.step === 1 ? 'Enter a positive whole number of ' + service.unit + '.' : 'Enter a positive number of audio hours, in steps of 0.1.');
        }
        const size = service.sizes.length ? service.sizes.find(tier => tier.id === state.size) : null;
        if (service.sizes.length && !size) throw new Error('Choose a model capacity.');
        const parameters = state.parameters || {};
        const choices = service.fields.map(field => {
            const selected = field.options.find(option => option.id === (parameters[field.id] ?? field.options[0].id));
            if (!selected) throw new Error('Choose an option for: ' + field.label);
            return selected;
        });
        const reasons = [service, size, ...choices].filter(item => item && item.custom).map(item => item.note);
        if (quantity > service.estimateLimit) reasons.push('Your dataset needs an individual preparation and training plan.');
        if (reasons.length) return { custom: true, reason: [...new Set(reasons)].join(' ') };

        // Project minimum includes the reference dataset; extra volume is explicit.
        const extraQuantity = Math.max(0, quantity - service.quantity);
        const workload = [size, ...choices].filter(Boolean);
        const referenceWork = service.packages[scope.index].map((base, i) => {
            const allowance = workload.reduce((sum, option) => sum + option.extra[i], 0);
            return round((base + extraQuantity * service.volume[i]) * (1 + allowance));
        });
        // Only annotation-related choices affect preparation, never model size.
        const prepFactor = choices.reduce((factor, option) => factor * option.preparation, 1);
        const referencePreparation = state.data === 'ready' ? [0, 0] : service[state.data].map(rate => round(rate * quantity * prepFactor));
        // Workloads beyond the standard project range need individual scoping.
        if (referenceWork[1] + referencePreparation[1] > 50000) return { custom: true, reason: 'This combination exceeds our standard project range. We will review the work and provide a scoped quote.' };
        const work = referenceWork;
        const preparation = referencePreparation;
        const low = work[0] + preparation[0];
        const high = work[1] + preparation[1];
        return { custom: false, low, high, work, preparation, assumedSmall: size?.id === 'unknown' };
    }
    return { calculate };
});
