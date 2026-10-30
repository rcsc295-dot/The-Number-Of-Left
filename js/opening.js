// OPENING — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class QuoteScene {
        constructor(c) {
            this.c = c;
            this.time = 0;
        }

        get duration() {
            const q = this.c.QUOTE;
            return q.LANDING_FADE + q.HOLD_SECONDS + q.FADE_SECONDS;
        }

        get opacity() {
            const q = this.c.QUOTE;
            return (
                NL.smooth((this.time - q.LANDING_FADE) / q.LANDING_FADE) *
                (1 -
                    NL.smooth(
                        (this.time - q.LANDING_FADE - q.HOLD_SECONDS) /
                            q.FADE_SECONDS
                    ))
            );
        }

        skip() {
            this.time = Math.max(
                this.time,
                this.c.QUOTE.LANDING_FADE + this.c.QUOTE.HOLD_SECONDS
            );
        }

        update(dt) {
            this.time += dt;
        }
    }

    function gameplayDemoFrame(time, config) {
        // Keep the original beats and fade, compressed onto the tutorial clock only.
        time *= 7.5 / config.DEMO_SECONDS;
        const take = NL.smooth((time - 1.8) / 0.7);
        const give = NL.smooth((time - 4.4) / 0.7);
        const approach = NL.smooth((time - 0.6) / 1.0);
        const cross = NL.smooth((time - 2.8) / 1.4);
        const playerX =
            time < 2.8 ? NL.lerp(550, 394, approach) : NL.lerp(394, 736, cross);
        const held = time >= 2.5 && time < 5.1 ? 1 : 0;
        const opacity =
            NL.smooth(time / 0.6) * (1 - NL.smooth((time - 6.6) / (7.5 - 6.6)));
        return {
            playerX,
            held,
            sourceCount: time < 2.5 ? 3 : 2,
            recipientCount: time < 5.1 ? 1 : 2,
            recipientOpacity: NL.lerp(0.32, 1, give),
            take,
            give,
            opacity,
            label:
                time >= 1.3 && time < 2.8
                    ? 'J · TAKE'
                    : time >= 4.1 && time < 5.6
                      ? 'K · GIVE'
                      : '',
            moving: (time > 0.6 && time < 1.6) || (time > 2.8 && time < 4.2)
        };
    }

    function drawGameplayDemo(ctx, time, config, reducedMotion) {
        const demo = gameplayDemoFrame(time, config);
        const phase = (time * 7.5) / config.DEMO_SECONDS;
        // The isolated demonstration keeps its original centered stage.
        NL.drawBackground(ctx, {
            ...config,
            ENVIRONMENT: {
                RADIUS_X: 450,
                RADIUS_Y: 226,
                CENTER_Y: 378 / config.HEIGHT
            }
        });
        // Enlarge this small cast for the demonstration; ordinary gameplay keeps its scale.
        ctx.save();
        ctx.translate(config.WIDTH / 2, config.HEIGHT * 0.55);
        ctx.scale(1.5, 1.5);
        ctx.translate(-550, -400);
        function figure(x, count, opacity, isPlayer = false) {
            return {
                x,
                y: 400,
                opacity,
                isPlayer,
                visual: { ...config.BODY },
                moving: isPlayer && demo.moving,
                step: time * 11,
                feedback: 0,
                data: isPlayer
                    ? undefined
                    : { encountersLeft: count, visualStage: 0 }
            };
        }
        NL.drawCharacter(
            ctx,
            figure(350, demo.sourceCount, 1),
            config,
            reducedMotion
        );
        NL.drawCharacter(
            ctx,
            figure(780, demo.recipientCount, demo.recipientOpacity),
            config,
            reducedMotion
        );
        NL.drawCharacter(
            ctx,
            figure(demo.playerX, null, 1, true),
            config,
            reducedMotion
        );
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = config.PALETTE.ink;
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText(`HELD ${demo.held}`, demo.playerX, 335);
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(demo.label, config.WIDTH / 2, 485);
        let progress = null;
        let fromX;
        let toX;
        let fromY;
        let toY;
        if (phase >= 1.8 && phase < 2.5) {
            progress = demo.take;
            fromX = 350;
            toX = demo.playerX;
            fromY = 355;
            toY = 330;
        } else if (phase >= 4.4 && phase < 5.1) {
            progress = demo.give;
            fromX = demo.playerX;
            toX = 780;
            fromY = 330;
            toY = 355;
        }
        if (progress !== null) {
            ctx.font = '21px Georgia, serif';
            ctx.fillText(
                '1',
                NL.lerp(fromX, toX, progress),
                NL.lerp(fromY, toY, progress) -
                    Math.sin(progress * Math.PI) * 18
            );
        }
        ctx.restore();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 1 - demo.opacity;
        ctx.fillStyle = config.PALETTE.paper;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
        ctx.restore();
    }
    Object.assign(NL, { QuoteScene, gameplayDemoFrame, drawGameplayDemo });
})();
