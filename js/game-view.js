// GAME-VIEW — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});

    Object.assign(NL.Game.prototype, {
        renderWorld() {
            const w = this.world;
            const c = this.c;
            const ctx = this.ctx;
            NL.drawBackground(ctx, c);
            if (this.scene === 'world') NL.drawPlaces(ctx, w);
            if (this.endKind === 'six-seven') {
                NL.drawSixSevenEnding(ctx, w, this.reducedMotion);
                return;
            }
            if (w.player.moveTarget && this.playing) {
                const target = w.player.moveTarget;
                ctx.save();
                ctx.strokeStyle = '#31524770';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(target.x, target.y, 8, 4, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            if (w.selected && this.scene === 'world') {
                ctx.strokeStyle = '#31524770';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(
                    w.selected.x,
                    w.selected.y + 2,
                    w.selected.data.kind === 'letter' ? 23 : 17,
                    8,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
            w.drawList.length = 0;
            w.drawList.push(w.player);
            for (const v of w.views.values()) {
                if (!(this.endKind === 'family' && v.data.kind === 'letter')) {
                    w.drawList.push(v);
                }
            }
            w.drawList.sort((a, b) => a.y - b.y);
            for (const v of w.drawList) {
                if (v.data?.kind === 'letter') {
                    NL.drawLetter(ctx, v, c);
                    continue;
                }
                const opacity = v.opacity;
                v.opacity *= NL.clamp(
                    Math.min(
                        v.x + c.RETURN.MARGIN,
                        c.WIDTH + c.RETURN.MARGIN - v.x
                    ) / c.RETURN.MARGIN,
                    0,
                    1
                );
                NL.drawCharacter(ctx, v, c, this.reducedMotion);
                if (
                    v.state === 'farewell' &&
                    v.farewellTime >= 0 &&
                    v.opacity > 0.05
                ) {
                    ctx.save();
                    ctx.globalAlpha = v.opacity;
                    ctx.fillStyle = c.PALETTE.ink;
                    ctx.font = '10px Georgia';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        v.data.relationship === 'FRIEND' ||
                            NL.isBloodRelative(v.data)
                            ? v.data.name
                            : 'Someone',
                        v.x,
                        v.y - 51
                    );
                    ctx.restore();
                }
                v.opacity = opacity;
            }
            if (this.endKind === 'family' && this.scene === 'ending') {
                w.family.render(ctx, this.reducedMotion);
                return;
            }
            const fade = 1 - NL.smooth(w.time / 0.8);
            if (fade > 0 && !this.endKind) {
                ctx.save();
                ctx.globalAlpha = fade;
                ctx.fillStyle = c.PALETTE.paper;
                ctx.fillRect(0, 0, c.WIDTH, c.HEIGHT);
                ctx.restore();
            }
        },

        render() {
            const ctx = this.ctx;
            const c = this.c;
            if (this.scene === 'quote') {
                this.ui['quote-screen'].style.opacity = this.quote.opacity;
                this.ui['title-screen'].hidden =
                    this.quote.time >= this.c.QUOTE.LANDING_FADE;
                this.ui['title-screen'].style.opacity =
                    1 - NL.smooth(this.quote.time / this.c.QUOTE.LANDING_FADE);
            }
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.fillStyle = c.PALETTE.paper;
            ctx.fillRect(0, 0, innerWidth, this.viewportHeight);
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, this.scale);
            if (this.scene === 'demo') {
                NL.drawGameplayDemo(ctx, this.demo.time, c, this.reducedMotion);
            } else if (
                this.scene === 'world' ||
                this.scene === 'ending' ||
                (this.scene === 'end' &&
                    ['time', 'six-seven'].includes(this.endKind))
            ) {
                this.renderWorld();
            } else if (this.scene === 'end') {
                ctx.fillStyle = c.PALETTE.paper;
                ctx.fillRect(0, 0, c.WIDTH, c.HEIGHT);
            }
            const endingFade = this.scene === 'end' ? this.endingFade() : 0;
            this.ui['end-screen'].style.opacity = 1;
            if (endingFade > 0) {
                ctx.save();
                ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
                ctx.globalAlpha = endingFade;
                ctx.fillStyle = c.PALETTE.paper;
                ctx.fillRect(0, 0, innerWidth, this.viewportHeight);
                ctx.restore();
            }
            this.updateHUD();
        }
    });
})();
