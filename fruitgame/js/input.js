// input.js – Hedelmäpeli: näppäimistö ja kosketus
class InputHandler {
    constructor(game) {
        this.game = game;
        this.touchActive = false;   // estää synteettisen mousedownin mobiililla
        this.setupKeyboard();
        this.setupButtons();
        this.setupCanvas();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.key === 'Enter') {
                e.preventDefault();
                this.game.spin();
            } else if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'Backspace') {
                e.preventDefault();
                this.game.exitToStreet();
            }
        });
    }

    setupButtons() {
        const spin = document.getElementById('spin-btn');
        if (spin) {
            spin.addEventListener('click', (e) => {
                e.preventDefault();
                this.game.spin();
            });
        }
        const exit = document.getElementById('exit-btn');
        if (exit) {
            exit.addEventListener('click', (e) => {
                e.preventDefault();
                this.game.exitToStreet();
            });
        }
    }

    /* Koneen klikkaaminen / napauttaminen pyöräyttää */
    setupCanvas() {
        const cv = this.game.canvas;
        cv.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            this.touchActive = true;
            this.game.spin();
            setTimeout(() => { this.touchActive = false; }, 400);
        }, { passive: false });
        cv.addEventListener('mousedown', (e) => {
            if (this.touchActive) return;
            e.preventDefault();
            this.game.spin();
        });
    }
}
