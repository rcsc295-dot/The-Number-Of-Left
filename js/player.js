// PLAYER — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class Player {
        constructor(c) {
            this.x = c.WIDTH / 2;
            this.y = NL.environment(c).y + 12;
            this.vx = 0;
            this.vy = 0;
            this.step = 0;
            this.moving = false;
            this.heldEncounters = 0;
            this.totalTaken = 0;
            this.moveTarget = null;
            this.isPlayer = true;
            this.opacity = 1;
            this.visual = { ...c.BODY };
        }

        update(dt, input, locked, world) {
            const config = world.c;
            let moveX = input.x;
            let moveY = input.y;
            const keyboardMoving = moveX !== 0 || moveY !== 0;
            if (keyboardMoving) {
                this.moveTarget = null;
            }
            if (locked) {
                this.vx = 0;
                this.vy = 0;
                this.moving = false;
                return;
            }
            if (this.moveTarget) {
                moveX = this.moveTarget.x - this.x;
                moveY = this.moveTarget.y - this.y;
                if (
                    Math.hypot(moveX, moveY) <=
                    Math.max(2, config.PLAYER_SPEED * dt)
                ) {
                    this.x = this.moveTarget.x;
                    this.y = this.moveTarget.y;
                    this.moveTarget = null;
                    this.vx = 0;
                    this.vy = 0;
                    this.moving = false;
                    return;
                }
            }
            const length = Math.hypot(moveX, moveY) || 1;
            const ease = 1 - Math.exp(-config.PLAYER_RESPONSE * dt);
            this.vx = NL.lerp(
                this.vx,
                (moveX / length) * config.PLAYER_SPEED,
                ease
            );
            this.vy = NL.lerp(
                this.vy,
                (moveY / length) * config.PLAYER_SPEED,
                ease
            );
            const bounds = world.bounds;
            this.x = NL.clamp(this.x + this.vx * dt, bounds.left, bounds.right);
            this.y = NL.clamp(this.y + this.vy * dt, bounds.top, bounds.bottom);
            NL.keepInEnvironment(world, this);
            this.moving = Math.hypot(this.vx, this.vy) > 2;
            if (this.moving) {
                this.step += dt * 11;
                world.tutorial.moved = true;
            }
        }
    }
    Object.assign(NL, { Player });
})();
