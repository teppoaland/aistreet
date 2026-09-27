// input.js - Näppäimistön ja kosketuksen käsittely

class InputHandler {
    constructor(game) {
        this.game = game;
        this.spaceHeld = false;
        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp': case 'w': case 'W':
                    e.preventDefault();
                    this.dirInput(DIR.UP);
                    break;
                case 'ArrowDown': case 's': case 'S':
                    e.preventDefault();
                    this.dirInput(DIR.DOWN);
                    break;
                case 'ArrowLeft': case 'a': case 'A':
                    e.preventDefault();
                    this.dirInput(DIR.LEFT);
                    break;
                case 'ArrowRight': case 'd': case 'D':
                    e.preventDefault();
                    this.dirInput(DIR.RIGHT);
                    break;
                case ' ':
                    e.preventDefault();
                    this.spaceHeld = true;
                    this.game.spaceAction();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.game.handleConfirm();
                    break;
                case 'r': case 'R':
                    this.game.restartLevel();
                    break;
                case 'p': case 'P':
                    this.game.togglePause();
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                this.spaceHeld = false;
            }
        });
    }

    // Suuntanäppäin: space pohjassa = etäkaivu, muuten liiku
    dirInput(dir) {
        if (this.spaceHeld) {
            this.game.remoteDig(dir);
        } else {
            this.game.movePlayer(dir);
        }
    }

    setupTouch() {
        // Suuntanäppäimet: space pohjassa = etäkaivu, muuten liiku
        const buttons = document.querySelectorAll('.touch-btn[data-dir]');
        const dirMap = {
            'up': DIR.UP,
            'down': DIR.DOWN,
            'left': DIR.LEFT,
            'right': DIR.RIGHT,
        };
        buttons.forEach(btn => {
            const handler = (e) => {
                if (e.cancelable) e.preventDefault();
                this.dirInput(dirMap[btn.dataset.dir]);
            };
            btn.addEventListener('touchstart', handler, { passive: false });
            // Estetään myös touchendin aiheuttamat klikkaukset iOS:lla
            btn.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
            btn.addEventListener('mousedown', handler);
        });

        // Ympyränappi imitoi välilyöntiä: pohjassa = etäkaivu-tila
        const spaceBtn = document.getElementById('space-btn');
        if (spaceBtn) {
            const press = (e) => {
                e.preventDefault();
                this.spaceHeld = true;
                spaceBtn.classList.add('active');
            };
            const release = (e) => {
                e.preventDefault();
                this.spaceHeld = false;
                spaceBtn.classList.remove('active');
            };
            spaceBtn.addEventListener('touchstart', press, { passive: false });
            spaceBtn.addEventListener('mousedown', press);
            spaceBtn.addEventListener('touchend', release);
            spaceBtn.addEventListener('touchcancel', release);
            spaceBtn.addEventListener('mouseup', release);
            spaceBtn.addEventListener('mouseleave', release);
        }
    }
}