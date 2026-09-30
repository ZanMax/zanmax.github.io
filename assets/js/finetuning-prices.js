/* Service fees, USD per project.
 * These are benchmark-informed commercial estimates, not market averages.
 * See docs/finetuning-service-pricing.md for scope and evidence. */
(function (root, factory) {
    const data = factory();
    if (typeof module === 'object' && module.exports) module.exports = data;
    else root.FT_PRICES = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const option = (id, label, extra = [0, 0], preparation = 1) => ({ id, label, extra, preparation });
    const custom = (id, label, note) => ({ id, label, custom: true, note });
    const field = (id, label, options) => ({ id, label, options });
    const unknown = option('unknown', 'Not sure · help me choose');
    const languages = field('languages', 'How many languages?', [
        option('one', 'One language'), option('few', '2–3 languages', [.2, .35]),
        custom('many', '4 or more languages', 'We will review language coverage and evaluation needs before quoting.')
    ]);
    const length = field('length', 'How long is each text example?', [
        option('short', 'Short · up to 500 words'), option('medium', 'Medium · 500–2,000 words', [.15, .25], 2),
        option('long', 'Long · 2,000–5,000 words', [.35, .6], 4),
        custom('extended', 'Over 5,000 words', 'Long-document training needs a review of the examples and evaluation plan.')
    ]);
    const services = {
        text: {
            label: 'Text', unit: 'examples', quantity: 2000, estimateLimit: 50000, step: 1, presets: [500, 2000, 10000],
            question: 'How many text examples do you have?',
            description: 'Teach AI to write, answer questions or extract information in the way your business needs.',
            example: 'An example can be a question and answer, a piece of writing, or a completed task.',
            preparation: 'Turn your existing documents into clear examples of the answers or writing you want.',
            packages: [[2000, 3000], [3000, 4000], [6500, 9000]], volume: [.12, .24], organize: [.15, .3], prepare: [.6, 1.2],
            sizeLabel: 'How large is the text model?',
            sizes: [
                option('small', 'Small · up to 14B'), option('medium', 'Medium · over 14B to 40B', [.25, .35]),
                option('large', 'Large · over 40B to 100B', [.8, 1.2]),
                option('xl', 'Extra large · over 100B to 400B', [2, 3]),
                custom('frontier', 'Frontier · over 400B, including 1T+', 'Models over 400B need an individual feasibility review and quote.'), unknown
            ],
            sizeHelp: 'Use total parameters. The starting estimate covers a small model; we can help you choose.',
            fields: [length, languages]
        },
        image: {
            label: 'Image', unit: 'images', quantity: 30, estimateLimit: 1000, step: 1, presets: [15, 30, 100],
            question: 'How many example images do you have?',
            description: 'Create images that follow your visual style, product or character.',
            example: 'Use images that show the style or subject you want AI to learn.',
            preparation: 'Select suitable images from your collection and add descriptions.',
            packages: [[700, 1100], [1200, 2000], [2200, 3500]], volume: [4, 8], organize: [2, 4], prepare: [8, 15],
            sizes: [],
            fields: [
                field('goal', 'What should the model learn?', [
                    option('subject', 'One product or character'), option('style', 'One visual style', [.15, .25]),
                    custom('multiple', 'Multiple products or characters', 'Multiple subjects need a review of the dataset and separate training requirements.')
                ]),
                field('resolution', 'Image detail', [
                    option('standard', 'Standard · up to 1 megapixel'), option('high', 'High detail · up to 2 megapixels', [.25, .45]),
                    custom('specialist', 'Higher resolution or specialist editing', 'High-resolution and specialist editing projects need a separate training plan.')
                ])
            ]
        },
        video: {
            label: 'Videos', unit: 'clips', quantity: 30, estimateLimit: 500, step: 1, presets: [10, 30, 100],
            question: 'How many short video clips do you have?',
            description: 'Create videos that follow your visual style, subject or type of movement.',
            example: 'Count the clips you want to use for training. Choose their typical length in Project details.',
            preparation: 'Select and trim clips from your footage, then add descriptions.',
            packages: [[2500, 4000], [4000, 6500], [6500, 10000]], volume: [15, 30], organize: [5, 10], prepare: [20, 40],
            sizes: [],
            fields: [
                field('goal', 'What should the videos learn?', [option('appearance', 'A subject or visual style'), option('motion', 'A movement or camera effect', [.25, .4])]),
                field('resolution', 'Training video resolution', [
                    option('standard', 'Standard · 480p'), option('hd', 'HD · 720p', [.3, .5]),
                    custom('fullhd', 'Full HD · 1080p or higher', 'Full HD training needs a separate resource estimate.')
                ]),
                field('duration', 'Typical training clip length', [
                    option('short', 'Up to 5 seconds'), option('medium', 'Over 5 to 10 seconds', [.3, .5], 2),
                    custom('long', 'Over 10 seconds', 'Long training clips need a review of motion, frame sampling and resource requirements.')
                ])
            ]
        },
        audio: {
            label: 'Audio · transcription', unit: 'hours of audio', quantity: 10, estimateLimit: 200, step: .1, presets: [1, 10, 50],
            question: 'How many hours of recordings do you have?',
            description: 'Adapt speech recognition to your vocabulary, accents or business.',
            example: 'Ready recordings include matching written transcripts.',
            preparation: 'Transcribe your recordings and match the written text to the audio.',
            packages: [[1500, 2200], [2200, 3500], [3500, 5500]], volume: [35, 65], organize: [35, 65], prepare: [150, 220],
            sizes: [],
            fields: [
                languages, field('recordings', 'What are the recordings like?', [
                    option('clean', 'Clear speech, little background noise'), option('mixed', 'Mixed accents or background noise', [.2, .35], 1.5),
                    custom('difficult', 'Overlapping speakers or very poor audio', 'Difficult recordings need a sample review before we can price preparation and evaluation.')
                ])
            ]
        },
        classifier: {
            label: 'Classifier', unit: 'examples', quantity: 5000, estimateLimit: 100000, step: 1, presets: [1000, 5000, 20000],
            question: 'How many examples do you have to sort?',
            description: 'Automatically sort text into categories — such as support topics, sentiment or spam.',
            example: 'A ready example is a piece of text with its correct category, such as “billing”.',
            preparation: 'Agree the categories and label examples from your existing material.',
            packages: [[800, 1200], [1200, 2000], [2000, 3200]], volume: [.03, .06], organize: [.04, .08], prepare: [.2, .4],
            sizes: [],
            fields: [
                field('categories', 'How many categories?', [
                    option('few', '2–5 categories'), option('medium', '6–20 categories', [.2, .3], 1.25),
                    option('many', '21–50 categories', [.4, .65], 1.5),
                    custom('custom', 'Over 50 categories', 'A large category system needs a review of label coverage and evaluation requirements.')
                ]),
                field('labels', 'How should each example be classified?', [
                    option('single', 'One category per example'), option('multiple', 'Several categories per example', [.2, .35], 1.5),
                    custom('entities', 'Find and label details inside the text', 'Entity extraction needs a separate annotation and evaluation plan.')
                ]), length
            ]
        }
    };
    const audioModes = {
        transcription: { label: 'Speech to text' },
        voice: {
            label: 'Voice conversion', unit: 'minutes of audio', quantity: 30, estimateLimit: 180, step: 1, presets: [10, 30, 60],
            question: 'How many minutes of voice recordings do you have?',
            description: 'Train one voice for speech-to-speech or singing voice conversion.',
            example: 'Use clean recordings of one voice you have permission to use. This is voice conversion, not text-to-speech.',
            preparation: 'Select, trim and clean suitable voice recordings.',
            packages: [[350, 600], [700, 1200], [1200, 2000]], volume: [3, 6], organize: [2, 4], prepare: [5, 10],
            sizes: [], fields: [field('recordings', 'What are the recordings like?', [
                option('clean', 'Clean, isolated voice'), option('mixed', 'Background noise or music to remove', [.2, .35], 1.5),
                custom('difficult', 'Several overlapping voices', 'Separating overlapping voices needs a recording review before quoting.')
            ])]
        },
        speech: { label: 'Text to speech', description: 'Adapt an open speech-generation model to your voice and language. Individually scoped.', example: 'Share the total duration of your available voice recordings.', custom: true, note: 'Speech generation needs a separate quote for the voice, language, recordings and selected model.', sizes: [], fields: [] },
        music: { label: 'Music generation', description: 'Adapt an open music-generation model to your sound. Individually scoped.', example: 'Share the total duration of your available music recordings.', custom: true, note: 'Music fine-tuning needs a separate quote after reviewing the recordings and intended output.', sizes: [], fields: [] }
    };
    function getService(type, audioTask = 'transcription') {
        if (!Object.hasOwn(services, type)) throw new Error('Choose a service.');
        if (type !== 'audio') return services[type];
        if (!Object.hasOwn(audioModes, audioTask)) throw new Error('Choose an audio service.');
        return { ...services.audio, ...audioModes[audioTask], label: 'Audio · ' + audioModes[audioTask].label };
    }
    return {
        services, audioModes, getService,
        scopes: {
            basic: { index: 0, label: 'Fine-tune', includes: ['Model adapted to one agreed task', 'Standard training budget and basic quality checks', 'Model files, example results and usage notes', 'One round of revisions'] },
            tested: { index: 1, label: 'Fine-tune + test', includes: ['Model adapted to one agreed task', 'Standard training and evaluation budget', 'Quality checks on separate examples', 'Model files, results report and usage notes', 'Two rounds of revisions'] },
            handover: { index: 2, label: 'Ready for your team', includes: ['Everything in Fine-tune + test', 'Setup in one agreed environment', 'A guided handover and reusable instructions', 'Two rounds of revisions'] }
        }
    };
});
