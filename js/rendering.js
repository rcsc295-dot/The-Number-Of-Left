// RENDERING — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    function stroke(ctx, x1, y1, x2, y2, colour, width) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function drawCharacter(
        ctx,
        v,
        c,
        reducedMotion = false,
        label = undefined
    ) {
        const a = v.visual;
        const d = v.data;
        const level = d?.visualStage || 0;
        const gait = !reducedMotion && v.moving ? Math.sin(v.step) * 2.5 : 0;
        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.scale(a.scale, a.scale);
        ctx.globalAlpha = v.opacity;
        ctx.fillStyle = '#06131135';
        ctx.beginPath();
        ctx.ellipse(0, 2, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (v.isPlayer) {
            ctx.strokeStyle = '#31524770';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(0, 1, 14, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Canvas adaptation of Nicky Case's Peep.walkAnim()/update() (CC0 1.0):
        // https://github.com/ncase/wbwwb/blob/7c68c7e44e66b5be95ebd07d22391de707090397/js/game/Peep.js
        // Keep sway sin(t)*0.1 and reciprocal bounce scaling. Scale the original
        // 10-pixel hop to 2.5 for our smaller figures; preserve our artwork's facing.
        // Transform the whole body/accessory layer; shadows and labels stay anchored.
        ctx.save();
        if (
            v.walk &&
            !reducedMotion &&
            v.state !== 'final' &&
            v.state !== 'farewell'
        ) {
            const walking = v.moving && !v.sitting;
            const t = v.step;
            const rotation = walking ? Math.sin(t) * 0.1 : 0;
            const lift = walking ? Math.abs(Math.sin(t)) * 2.5 : 0;
            ctx.rotate(rotation);
            ctx.scale(v.walk.scale, 1 / v.walk.scale);
            ctx.translate(0, -lift);
        }
        const body = v.isPlayer ? c.PALETTE.ink : a.bodyColor;
        if (d?.template?.svgAsset) {
            NL.drawNpcSvg(ctx, v, reducedMotion);
        } else {
            // Body layer: always a simple human silhouette.
            ctx.save();
            if (v.sitting) {
                ctx.translate(0, 5);
            }
            function bodyLayer(body) {
                stroke(ctx, -1, -9, -4 - gait, v.sitting ? -5 : 0, body, 2.2);
                stroke(ctx, 1, -9, 4 + gait, v.sitting ? -5 : 0, body, 2.2);
                stroke(
                    ctx,
                    0,
                    -18,
                    0,
                    -9,
                    body,
                    a.bodyShape === 'coat' ? 5.5 : 4
                );
                stroke(ctx, -1, -16, -5 + gait * 0.55, -10, body, 1.8);
                stroke(ctx, 1, -16, 5 - gait * 0.55, -10, body, 1.8);
                ctx.fillStyle = body;
                ctx.beginPath();
                ctx.arc(0, -23, 3.2, 0, Math.PI * 2);
                ctx.fill();
            }
            bodyLayer(body);
            // Clothing layer: seam, cuff, then a small panel; head/limbs stay white.
            if (level >= 2 && !d?.template?.progressiveColour) {
                stroke(ctx, -2, -17, 2, -17, a.accentColor, 2);
            }
            if (level >= 4 && !d?.template?.progressiveColour) {
                stroke(ctx, 0, -15, 0, -10, a.accentColor, 3.7);
                stroke(ctx, 3, -11, 5, -11, a.accentColor, 1.8);
            }
            // Hair layer.
            if (a.hairType !== 'none') {
                ctx.strokeStyle = '#d6c9b6';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.arc(
                    0,
                    -23,
                    3.7,
                    Math.PI * 1.03,
                    Math.PI * (a.hairType === 'bob' ? 2.6 : 1.9)
                );
                ctx.stroke();
                if (a.hairType === 'tuft') {
                    stroke(ctx, 0, -26, 2, -28, '#d6c9b6', 1.6);
                }
                if (a.hairType === 'curl') {
                    ctx.beginPath();
                    ctx.arc(3, -25, 2, 0, 5);
                    ctx.stroke();
                }
            }
            // Accessory layer.
            if (a.accessoryType === 'scarf') {
                stroke(ctx, 2, -18, 5, -13, a.accentColor, 2.3);
            }
            if (a.accessoryType === 'bag' || a.accessoryType === 'satchel') {
                stroke(ctx, -2, -17, 5, -10, a.accentColor, 1);
                ctx.fillStyle = a.accentColor;
                ctx.fillRect(4, -12, 4, a.accessoryType === 'bag' ? 6 : 4);
            }
            ctx.restore();
        }
        ctx.restore();
        const number = label === undefined ? d?.encountersLeft : label;
        if (number !== undefined && number !== null) {
            const p = v.feedback ? 1 - v.feedback / c.FEEDBACK_SECONDS : 1;
            ctx.save();
            ctx.translate(0, -37);
            const scale = reducedMotion ? 1 : 1 + Math.sin(p * Math.PI) * 0.24;
            ctx.scale(scale, scale);
            ctx.font = '12px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = c.PALETTE.ink;
            const value =
                label === undefined && d
                    ? NL.displayedEncounters(v, c)
                    : number;
            const text =
                typeof value === 'number' && value >= 1000
                    ? Math.trunc(value).toLocaleString('en-US')
                    : String(value);
            ctx.fillText(
                label === undefined ? text.padStart(2, '0') : text,
                0,
                0
            );
            ctx.restore();
        }
        ctx.restore();
    }

    function drawBackground(ctx, config) {
        const e = NL.environment(config);
        ctx.fillStyle = config.PALETTE.paper;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
        ctx.fillStyle = config.PALETTE.wash;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.rx, e.ry, -0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#31524712';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(e.x - e.rx * 0.9, e.y + e.ry * 0.5);
        ctx.bezierCurveTo(
            e.x - e.rx * 0.55,
            e.y + e.ry * 0.55,
            e.x + e.rx * 0.4,
            e.y - e.ry * 0.5,
            e.x + e.rx * 0.9,
            e.y - e.ry * 0.35
        );
        ctx.stroke();
        ctx.strokeStyle = '#31524725';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.rx * 0.94, e.ry * 0.9, -0.035, 0, Math.PI * 2);
        ctx.stroke();
        for (const [x, y] of [
            [e.x - e.rx * 0.55, e.y + e.ry * 0.35],
            [e.x + e.rx * 0.55, e.y - e.ry * 0.35]
        ]) {
            stroke(ctx, x - 15, y, x + 15, y, '#31524755', 2);
            stroke(ctx, x - 15, y - 5, x + 15, y - 5, '#31524735', 2);
            stroke(ctx, x - 11, y, x - 11, y + 4, '#31524735', 2);
            stroke(ctx, x + 11, y, x + 11, y + 4, '#31524735', 2);
        }
    }

    Object.assign(NL, { stroke, drawCharacter, drawBackground });
})();
