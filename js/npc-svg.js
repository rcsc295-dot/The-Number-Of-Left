// NPC SVG — original shapes, exported assets and a small pose cache for the existing Canvas renderer.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    const NPC_SVG_ASSETS = {
        father: {
            box: [-16, -32, 32, 34],
            title: 'Father in a tailored jacket'
        },
        mother: {
            box: [-16, -32, 32, 34],
            title: 'Mother with a bob and an A-line coat'
        },
        grandpa: {
            box: [-16, -32, 32, 34],
            title: 'Grandpa with a cap, glasses and a cane'
        },
        grandma: {
            box: [-16, -32, 32, 34],
            title: 'Grandma with a bun, cardigan and handbag'
        },
        'biker-grandma': {
            box: [-28, -32, 56, 34],
            title: 'Biker Grandma riding a cruiser motorcycle'
        },
        'affection-npc': {
            box: [-16, -32, 32, 34],
            title: 'A person gradually filled with warmth'
        }
    };
    const npcArt = new Map();
    const POSES = 8;

    function createNpcSvg(
        key,
        phase = 0,
        coverage = 0.5,
        affectionColour = '#a56352'
    ) {
        // Generation/export is an entry boundary; the renderer only receives validated, decoded images.
        if (
            !Object.hasOwn(NPC_SVG_ASSETS, key) ||
            !Number.isFinite(phase) ||
            !Number.isFinite(coverage) ||
            coverage < 0 ||
            coverage > 1
        )
            throw new RangeError(
                'Invalid NPC SVG key, pose or colour coverage.'
            );
        const { box, title } = NPC_SVG_ASSETS[key];
        const svg = globalThis
            .SVG()
            .size(box[2] * 4, box[3] * 4)
            .viewbox(...box);
        svg.attr({ role: 'img', 'aria-label': title, 'data-asset': key });
        svg.element('title').words(title);
        const ink = '#315247',
            dark = '#233e35',
            paper = '#eee9da';
        const sage = '#87917b',
            silver = '#bcc5b6',
            warm = '#a56352';
        const stride = Math.sin(phase) * 2.2;
        const art = svg.group().id('Artwork').attr({
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        });

        if (key === 'biker-grandma') {
            // All parts share one SVG coordinate space; wheel rotation is visual only.
            for (const [id, x] of [
                ['RearWheel', -17],
                ['FrontWheel', 17]
            ]) {
                const wheel = art
                    .group()
                    .id(id)
                    .attr({
                        transform: `rotate(${(phase * 180) / Math.PI} ${x} -4)`
                    });
                wheel.circle(10).center(x, -4).fill(dark);
                wheel
                    .circle(6.6)
                    .center(x, -4)
                    .fill(paper)
                    .stroke({ color: silver, width: 0.8 });
                wheel
                    .line(x - 3, -4, x + 3, -4)
                    .stroke({ color: sage, width: 0.8 });
                wheel.line(x, -7, x, -1).stroke({ color: sage, width: 0.8 });
                wheel.circle(2).center(x, -4).fill(ink);
            }
            art.path('M-17 -4 L-10 -13 L3 -11 L7 -4 Z')
                .id('Frame')
                .fill('none')
                .stroke({ color: dark, width: 1.5 });
            art.path('M-23 -7 Q-17 -13 -11 -7 M12 -8 Q18 -11 22 -7')
                .id('Fenders')
                .fill('none')
                .stroke({ color: sage, width: 1.8 });
            art.path('M10 -17 L13 -12 L17 -4 M13 -13 L19 -4')
                .id('FrontFork')
                .fill('none')
                .stroke({ color: silver, width: 1.5 });
            art.path('M-20 -1 L3 -1 L7 -3')
                .id('Exhaust')
                .fill('none')
                .stroke({ color: silver, width: 2 });
            const engine = art.group().id('Engine');
            engine
                .path('M-6 -9 L2 -9 L5 -4 L-4 -3 Z')
                .fill(ink)
                .stroke({ color: silver, width: 0.8 });
            for (const y of [-7.5, -5.5])
                engine.line(-4, y, 2, y).stroke({ color: silver, width: 0.8 });
            art.path('M-7 -13 Q0 -17 7 -12 L4 -9 L-5 -10 Z')
                .id('FuelTank')
                .fill(warm)
                .stroke({ color: dark, width: 0.8 });
            art.path('M-15 -14 L-7 -14 L-3 -12 L-12 -12 Z')
                .id('Saddle')
                .fill(dark);
            art.path('M-6 -15 L0 -10 L-2 -5 L3 -5')
                .id('RiderLegs')
                .fill('none')
                .stroke({ color: dark, width: 2.4 });
            art.path('M-9 -23 L-3 -23 L2 -16 L-5 -13 L-10 -16 Z')
                .id('Jacket')
                .fill(ink)
                .stroke({ color: dark, width: 0.8 });
            art.path('M-7 -22 L-3 -16 M-5 -22 L-6 -19')
                .id('JacketLapels')
                .fill('none')
                .stroke({ color: paper, width: 0.8 });
            art.path('M-3 -21 L3 -17 L9 -18')
                .id('RiderArm')
                .fill('none')
                .stroke({ color: ink, width: 2.5 });
            art.path('M8 -18 L12 -18 L13 -14')
                .id('Handlebars')
                .fill('none')
                .stroke({ color: dark, width: 1.2 });
            art.circle(2).center(9, -18).id('Glove').fill(dark);
            art.path('M-7 -26 Q-12 -26 -12 -23 Q-10 -22 -8 -24')
                .id('SilverHair')
                .fill(silver);
            art.circle(6.4)
                .center(-6, -26)
                .id('RiderHead')
                .fill(paper)
                .stroke({ color: ink, width: 0.7 });
            art.path('M-10 -26 Q-10 -31 -6 -31 Q-2 -31 -2 -26 L-5 -25 Z')
                .id('Helmet')
                .fill(ink);
            art.path('M-5 -27 L-1.5 -27 L-2 -25 L-5 -25 Z')
                .id('Visor')
                .fill(silver)
                .stroke({ color: dark, width: 0.5 });
            art.circle(2.3)
                .center(13, -13)
                .id('Headlight')
                .fill(paper)
                .stroke({ color: sage, width: 0.8 });
        } else if (key === 'affection-npc') {
            // The same body is drawn twice. Only the warm layer is clipped, from feet towards head.
            function body(parent) {
                parent
                    .path(
                        `M-1.5 -10 L${-4 - stride} 0 M1.5 -10 L${4 + stride} 0`
                    )
                    .fill('none')
                    .stroke({ width: 2.2 });
                parent
                    .path(
                        `M-3 -18 L${-6 + stride * 0.4} -11 M3 -18 L${6 - stride * 0.4} -11`
                    )
                    .fill('none')
                    .stroke({ width: 1.9 });
                parent
                    .path('M-3 -20 Q0 -21 3 -20 L3 -10 L-3 -10 Z')
                    .stroke('none');
                parent.circle(6.8).center(0, -25).stroke('none');
            }
            const base = art.group().id('Body').fill(ink).stroke(ink);
            body(base);
            const colour = art
                .group()
                .id('ColourBody')
                .fill(affectionColour)
                .stroke(affectionColour);
            body(colour);
            const mask = svg.clip().id('ColourCoverage');
            mask.rect(24, 30 * coverage).move(-10, 1 - 30 * coverage);
            colour.clipWith(mask);
            const track = art.group().id('CoverageScale');
            track.line(11, -29, 11, 0).stroke({ color: silver, width: 0.8 });
            for (const y of [-29, -21.75, -14.5, -7.25, 0])
                track.line(10, y, 12, y).stroke({ color: sage, width: 0.6 });
            if (coverage)
                track
                    .line(11, 0, 11, -29 * coverage)
                    .id('CoverageFill')
                    .stroke({ color: ink, width: 1.5 });
        } else {
            const legs = art
                .group()
                .id('Legs')
                .fill('none')
                .stroke({ color: dark, width: 2.2 });
            legs.path(`M-2 -10 L${-3 - stride} -4 L${-4 - stride} 0`);
            legs.path(`M2 -10 L${3 + stride} -4 L${4 + stride} 0`);
            if (key === 'mother')
                art.path('M-4 -26 Q0 -31 4 -26 L5 -20 L-5 -20 Z')
                    .id('HairBack')
                    .fill(dark);
            if (key === 'grandma')
                art.circle(4)
                    .center(3, -27)
                    .id('HairBun')
                    .fill(silver)
                    .stroke({ color: ink, width: 0.6 });
            art.path('M-1.5 -23 L1.5 -23 L2 -19 L-2 -19 Z')
                .id('Neck')
                .fill(paper)
                .stroke({ color: ink, width: 0.6 });
            art.circle(7)
                .center(0, -25)
                .id('Head')
                .fill(paper)
                .stroke({ color: ink, width: 0.8 });
            if (key === 'father') {
                art.path('M-4 -26 Q-3 -30 2 -28 L4 -26 L0 -27 Z')
                    .id('Hair')
                    .fill(dark);
                art.path('M-4 -21 L-6 -18 L-4 -10 L4 -10 L6 -18 L4 -21 Z')
                    .id('Jacket')
                    .fill(ink);
                art.path('M-2 -21 L0 -14 L2 -21 M0 -14 L0 -10')
                    .id('Lapels')
                    .fill('none')
                    .stroke({ color: paper, width: 0.9 });
                art.path('M-4 -19 L-7 -12 M4 -19 L7 -12')
                    .id('Sleeves')
                    .fill('none')
                    .stroke({ color: ink, width: 2.3 });
                art.line(2, -15, 4, -15)
                    .id('Pocket')
                    .stroke({ color: silver, width: 0.7 });
                art.path('M-7 -12 L-7 -10 M7 -12 L7 -10')
                    .id('Hands')
                    .fill('none')
                    .stroke({ color: paper, width: 1.5 });
            } else if (key === 'mother') {
                art.path('M-4 -26 Q0 -30 4 -26 L3 -23 L1 -27 L-3 -24 Z')
                    .id('HairFront')
                    .fill(dark);
                art.path('M-3 -21 L3 -21 L6 -7 Q0 -5 -6 -7 Z')
                    .id('Coat')
                    .fill(sage)
                    .stroke({ color: ink, width: 0.8 });
                art.path('M-2 -21 L0 -18 L2 -21 M0 -18 L0 -7')
                    .id('CoatSeam')
                    .fill('none')
                    .stroke({ color: paper, width: 0.8 });
                art.path('M-3 -20 L-6 -12 M3 -20 L6 -12')
                    .id('Sleeves')
                    .fill('none')
                    .stroke({ color: ink, width: 2 });
                art.path('M-6 -12 L-6 -10 M6 -12 L6 -10')
                    .id('Hands')
                    .fill('none')
                    .stroke({ color: paper, width: 1.4 });
            } else if (key === 'grandpa') {
                art.path('M-4 -27 Q-3 -31 2 -29 L4 -27 L5 -26 L-4 -26 Z')
                    .id('Cap')
                    .fill(sage)
                    .stroke({ color: ink, width: 0.7 });
                const glasses = art
                    .group()
                    .id('Glasses')
                    .fill('none')
                    .stroke({ color: dark, width: 0.65 });
                glasses.circle(2.3).center(-1.6, -25);
                glasses.circle(2.3).center(1.6, -25);
                glasses.line(-0.5, -25, 0.5, -25);
                art.path('M-3 -21 L3 -21 L4 -10 L-4 -10 Z')
                    .id('Waistcoat')
                    .fill(sage)
                    .stroke({ color: ink, width: 0.8 });
                art.path('M-2 -21 L0 -18 L2 -21 M0 -18 L0 -11')
                    .id('WaistcoatSeam')
                    .fill('none')
                    .stroke({ color: paper, width: 0.8 });
                art.path('M-3 -20 L-6 -12 M3 -20 L5 -15 L8 -14')
                    .id('Sleeves')
                    .fill('none')
                    .stroke({ color: ink, width: 1.9 });
                const cane = art.group().id('CaneAndHand');
                cane.path('M7 -13 Q7 -16 9 -15 Q10 -15 10 -13 L10 0')
                    .fill('none')
                    .stroke({ color: dark, width: 1.1 });
                cane.circle(1.8)
                    .center(8, -14)
                    .fill(paper)
                    .stroke({ color: ink, width: 0.5 });
            } else {
                art.path(
                    'M-4 -26 Q-3 -30 1 -28 Q4 -28 4 -24 L2 -25 L0 -27 L-3 -24 Z'
                )
                    .id('SilverHair')
                    .fill(silver)
                    .stroke({ color: ink, width: 0.5 });
                art.path('M-3 -15 L3 -15 L5 -4 L-5 -4 Z')
                    .id('Skirt')
                    .fill(dark);
                art.path('M-4 -21 Q0 -19 4 -21 L5 -11 L-5 -11 Z')
                    .id('Cardigan')
                    .fill(sage)
                    .stroke({ color: ink, width: 0.8 });
                art.line(0, -19, 0, -11)
                    .id('CardiganSeam')
                    .stroke({ color: paper, width: 0.9 });
                art.path('M-4 -19 L-7 -11 M4 -19 L6 -14 L8 -13')
                    .id('Sleeves')
                    .fill('none')
                    .stroke({ color: ink, width: 2 });
                const bag = art.group().id('Handbag');
                bag.path('M6 -10 Q6 -15 9 -13 L10 -10')
                    .fill('none')
                    .stroke({ color: dark, width: 0.9 });
                bag.path('M5 -10 L11 -10 L12 -5 Q8 -3 4 -5 Z')
                    .fill(warm)
                    .stroke({ color: dark, width: 0.8 });
                bag.circle(1.4).center(8, -13).fill(paper);
            }
        }
        return svg.svg();
    }

    async function prepareNpcArt() {
        const pending = [];
        for (const [key, spec] of Object.entries(NPC_SVG_ASSETS)) {
            const entry = { box: spec.box, frames: [], colourFrames: [] };
            npcArt.set(key, entry);
            for (let pose = 0; pose < POSES; pose++) {
                for (const coverage of key === 'affection-npc' ? [0, 1] : [0]) {
                    const image = new Image();
                    const frames = coverage ? entry.colourFrames : entry.frames;
                    frames[pose] = image;
                    pending.push(
                        new Promise((resolve, reject) => {
                            image.onload = resolve;
                            image.onerror = () =>
                                reject(
                                    new Error(
                                        `Could not decode ${key} SVG pose ${pose}.`
                                    )
                                );
                            image.src =
                                'data:image/svg+xml;charset=utf-8,' +
                                encodeURIComponent(
                                    createNpcSvg(
                                        key,
                                        (pose * Math.PI * 2) / POSES,
                                        coverage,
                                        NL.CONFIG.AFFECTION_PERSON.COLOUR
                                    )
                                );
                        })
                    );
                }
            }
        }
        await Promise.all(pending);
    }

    function drawNpcSvg(ctx, view, reducedMotion) {
        const key = view.data.template.svgAsset;
        const art = npcArt.get(key);
        const pose =
            !reducedMotion && view.moving
                ? Math.floor(
                      ((((view.step % (Math.PI * 2)) + Math.PI * 2) %
                          (Math.PI * 2)) /
                          (Math.PI * 2)) *
                          POSES
                  )
                : 0;
        ctx.save();
        if (key === 'biker-grandma') {
            const direction =
                view.data.follow.remaining > 0
                    ? view.data.follow.vx
                    : view.tx - view.x;
            if (direction < 0) ctx.scale(-1, 1);
        }
        ctx.drawImage(art.frames[pose], ...art.box);
        if (key === 'affection-npc') {
            const coverage = reducedMotion
                ? NL.clamp(view.data.strength / 100, 0, 1)
                : view.visual.colourCoverage;
            ctx.beginPath();
            ctx.rect(-16, 1 - 30 * coverage, 32, 30 * coverage);
            ctx.clip();
            ctx.drawImage(art.colourFrames[pose], ...art.box);
        }
        ctx.restore();
    }
    Object.assign(NL, {
        NPC_SVG_ASSETS,
        createNpcSvg,
        prepareNpcArt,
        drawNpcSvg
    });
})();
