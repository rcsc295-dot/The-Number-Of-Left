// INPUT — one responsibility; shared systems live on NumberLeft.
(function () {
    'use strict';
    const NL = (globalThis.NumberLeft ||= {});
    class Input {
        constructor() {
            this.physical = new Set();
            this.keys = new Set();
            this.actions = [];
        }

        down(code, repeat, enabled) {
            if (repeat || this.physical.has(code)) {
                return false;
            }
            this.physical.add(code);
            if (enabled) {
                this.keys.add(code);
                const action = { KeyJ: 'take', KeyK: 'give' }[code];
                if (action) {
                    this.actions.push(action);
                }
            }
            return true;
        }

        up(code) {
            this.physical.delete(code);
            this.keys.delete(code);
        }

        clear() {
            this.keys.clear();
            this.actions.length = 0;
        }

        releaseAll() {
            this.clear();
            this.physical.clear();
        }

        get x() {
            return (
                Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
                Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
            );
        }

        get y() {
            return (
                Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
                Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
            );
        }

        endFrame() {
            this.actions.length = 0;
        }
    }
    Object.assign(NL, { Input });
})();
