document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES GERAIS DO JOGO ---
    const CONFIG = {
        SURVIVAL_TIME_SECONDS: 60,
        INITIAL_BUG_INTERVAL_MS: 800,
        MIN_BUG_INTERVAL_MS: 250,
        INTERVAL_DECREMENT: 10,
        COMBO_TIMEOUT_MS: 1500,
        BUG_REPRODUCTION_TIME_MS: { min: 5000, max: 7000 },
        BUG_REPRODUCTION_WARNING_MS: 2000, 
        POINTS: { bug: 10, boss: 50 },
        BUG_SIZES: { bug: { w: 50, h: 50 }, boss: { w: 85, h: 85 }, buff: { w: 55, h: 55 } },
        BOSS_HEALTH: 5,
        SPAWN_CHANCE: { buff: 0.1, boss: 0.2 },
        WIN_CONDITION_BUGS_CLEARED: 'win_bugs_cleared' 
    };

    // --- CLASSE PARA GERENCIAR A INTERFACE (UI) ---
    class UI {
        constructor() {
            this.scoreDisplay = document.getElementById('score-display');
            this.highscoreDisplay = document.getElementById('highscore-display');
            this.timerDisplay = document.getElementById('timer-display');
            this.comboDisplay = document.getElementById('combo-display');
            this.buffInventoryDisplay = document.getElementById('buff-inventory');
            this.startButton = document.getElementById('start-button');
            this.gameScreen = document.getElementById('game-screen');
            this.buffEffectOverlay = document.getElementById('buff-effect-overlay');
            this.canvas = document.getElementById('matrix-background');
            this.ctx = this.canvas.getContext('2d');

            this.comboScoreBox = this.comboDisplay.closest('.score-box');
            this.comboBar = document.getElementById('combo-bar');

            this.highscoreDisplay.textContent = localStorage.getItem('bugSmasherHighScore') || 0;
        }

        updateScore(score) { this.scoreDisplay.textContent = score; }
        updateHighscore(highscore) { this.highscoreDisplay.textContent = highscore; }
        updateTimer(timeLeft) { this.timerDisplay.textContent = timeLeft; }
        updateCombo(combo) { this.comboDisplay.textContent = `x${combo}`; }
        updateBuffInventory(count) { this.buffInventoryDisplay.textContent = count; }
        showStartButton() { this.startButton.style.display = 'block'; }
        hideStartButton() { this.startButton.style.display = 'none'; }
        clearScreen() { this.gameScreen.innerHTML = ''; }
        
        showBuffEffect() {
            this.buffEffectOverlay.classList.add('active');
            setTimeout(() => this.buffEffectOverlay.classList.remove('active'), 800);
        }

        resetComboIndicator() {
            this.comboScoreBox.classList.remove('combo-active');
            void this.comboScoreBox.offsetWidth; 
            this.comboScoreBox.style.setProperty('--combo-duration', `${CONFIG.COMBO_TIMEOUT_MS / 1000}s`);
            this.comboScoreBox.classList.add('combo-active');
        }

        clearComboIndicator() {
            this.comboScoreBox.classList.remove('combo-active');
        }
    }

    // --- CLASSE PRINCIPAL DO JOGO ---
    class Game {
        constructor() {
            this.ui = new UI();
            this.sounds = {
                music: document.getElementById('sound-music'),
                squash: document.getElementById('sound-squash'),
                start: document.getElementById('sound-start'),
                gameOver: document.getElementById('sound-gameover'),
                powerup: document.getElementById('sound-powerup'),
                bossHit: document.getElementById('sound-boss-hit'),
                buffUse: document.getElementById('sound-buff-use'),
            };

            // Estado do Jogo
            this.score = 0;
            this.timeLeft = CONFIG.SURVIVAL_TIME_SECONDS;
            this.combo = 1;
            this.buffCount = 0;
            this.highScore = localStorage.getItem('bugSmasherHighScore') || 0;
            
            this.isGameRunning = false;
            this.isBuffActive = false;
            
            this.bugs = [];
            this.powerups = [];

            this.lastSquashTime = 0;
            this.bugCreationIntervalMs = CONFIG.INITIAL_BUG_INTERVAL_MS;
            this.timeToNextBug = 1000;
            this.lastTime = 0;
            this.gameLoopId = null;
            this.timerId = null;

            this.screenWidth = 0;
            this.screenHeight = 0;
            this.screenArea = 0;
            
            this.init();
        }

        init() {
            this.ui.startButton.addEventListener('click', () => this.startGame());
            window.addEventListener('keydown', (e) => {
                if ((e.key === 'd' || e.key === 'D') && this.isGameRunning) {
                    this.useBuff();
                }
            });
            this.initMatrixBackground();
        }

        playSound(sound, volume = 1.0) {
            sound.currentTime = 0;
            sound.volume = volume;
            sound.play().catch(error => console.log(`Erro ao tocar som: ${error.message}`));
        }

        startGame() {
            this.screenWidth = this.ui.gameScreen.clientWidth;
            this.screenHeight = this.ui.gameScreen.clientHeight;
            this.screenArea = this.screenWidth * this.screenHeight;
            
            if (this.screenWidth === 0 || this.screenHeight === 0) {
                alert("Erro ao iniciar. Por favor, recarregue a página.");
                return;
            }

            // Resetar estado
            this.isGameRunning = true;
            this.isBuffActive = false;
            this.score = 0;
            this.combo = 1;
            this.timeLeft = CONFIG.SURVIVAL_TIME_SECONDS;
            this.buffCount = 0;
            this.bugs = [];
            this.powerups = [];
            this.bugCreationIntervalMs = CONFIG.INITIAL_BUG_INTERVAL_MS;
            this.timeToNextBug = 1000;

            // Resetar UI
            this.ui.clearScreen();
            this.ui.updateScore(this.score);
            this.ui.updateCombo(this.combo);
            this.ui.updateTimer(this.timeLeft);
            this.ui.updateBuffInventory(this.buffCount);
            this.ui.hideStartButton();

            // Iniciar sons e loop
            this.playSound(this.sounds.start);
            this.playSound(this.sounds.music, 0.3);
            
            clearTimeout(this.timerId);
            this.timerId = setTimeout(() => this.updateTimer(), 1000);
            
            this.lastTime = performance.now();
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
        }
        
        stopGame(outcome) {
            if (!this.isGameRunning) return;
            this.isGameRunning = false;
            cancelAnimationFrame(this.gameLoopId);
            clearTimeout(this.timerId);
            this.playSound(this.sounds.gameOver);
            this.sounds.music.pause();
            
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('bugSmasherHighScore', this.highScore);
                this.ui.updateHighscore(this.highScore);
            }
            
            if (outcome === 'win') {
                alert(`Você venceu os bugs!\nPontuação final: ${this.score}`);
            } else {
                alert(`Os bugs dominaram o código! Você foi derrotado.\nPontuação final: ${this.score}`);
            }
            this.ui.showStartButton();
        }

        gameLoop(timestamp) {
            if (!this.isGameRunning) return;

            const deltaTime = timestamp - this.lastTime;
            this.lastTime = timestamp;

            if (!this.isBuffActive) {
                // Lógica de spawn
                this.timeToNextBug -= deltaTime;
                if (this.timeToNextBug <= 0) {
                    this.spawnEntity();
                    if (this.bugCreationIntervalMs > CONFIG.MIN_BUG_INTERVAL_MS) {
                        this.bugCreationIntervalMs -= CONFIG.INTERVAL_DECREMENT;
                    }
                    this.timeToNextBug = this.bugCreationIntervalMs;
                }

                // Lógica de reprodução e derrota
                let totalBugArea = 0;
                this.bugs.forEach(bug => {
                    bug.update(deltaTime, () => this.createBug(false, bug)); // Passa a função de criar bug como callback
                    totalBugArea += (bug.width * bug.height);
                });

                if ((totalBugArea / this.screenArea) >= 0.75) {
                    this.stopGame('lose');
                }
            }

            this.gameLoopId = requestAnimationFrame((ts) => this.gameLoop(ts));
        }

        updateTimer() {
            if (!this.isGameRunning || this.isBuffActive) return;
            this.timeLeft--;
            this.ui.updateTimer(this.timeLeft);
            if (this.timeLeft <= 0) {
                this.stopGame('win');
            } else {
                this.timerId = setTimeout(() => this.updateTimer(), 1000);
            }
        }

        spawnEntity() {
            if (this.isBuffActive) return;
            const roll = Math.random();
            if (roll < CONFIG.SPAWN_CHANCE.buff && this.powerups.length === 0) {
                this.createBuff();
            } else if (roll < CONFIG.SPAWN_CHANCE.boss) {
                this.createBug(true);
            } else {
                this.createBug(false);
            }
        }

        createBug(isBoss, parentBug = null) {
            const newBug = new Bug(
                isBoss,
                this.ui.gameScreen,
                (bug) => this.onBugSquash(bug), // Callback para quando o bug é esmagado
                parentBug
            );
            this.bugs.push(newBug);
        }
        
        createBuff() {
            const buff = document.createElement('div');
            buff.classList.add('buff-item');
            const size = CONFIG.BUG_SIZES.buff;
            const position = this.gerarPosicaoAleatoria(size.w, size.h);
            buff.style.left = `${position.x}px`;
            buff.style.top = `${position.y}px`;
            
            buff.addEventListener('click', () => this.collectBuff(buff));
            this.powerups.push(buff);
            this.ui.gameScreen.appendChild(buff);
        }

        collectBuff(buffElement) {
            if (!this.isGameRunning || !buffElement.parentNode) return;
            this.playSound(this.sounds.powerup);
            this.buffCount++;
            this.ui.updateBuffInventory(this.buffCount);
            buffElement.remove();
            this.powerups = this.powerups.filter(p => p !== buffElement);
        }

        useBuff() {
            if (!this.isGameRunning || this.buffCount <= 0 || this.isBuffActive) return;
            this.isBuffActive = true;
            this.buffCount--;
            this.ui.updateBuffInventory(this.buffCount);
            clearTimeout(this.timerId); // Pausa o timer
            this.ui.showBuffEffect();
            this.playSound(this.sounds.buffUse);
            this.vanishNextBug();
        }

        vanishNextBug() {
            if (this.bugs.length === 0) {
                this.endBuffSequence();
                return;
            }
            const bugToVanish = this.bugs.shift();
            bugToVanish.vanish();
            this.playSound(this.sounds.squash);
            this.score += (bugToVanish.isBoss ? CONFIG.POINTS.boss : CONFIG.POINTS.bug) * this.combo;
            this.ui.updateScore(this.score);
            
            setTimeout(() => this.vanishNextBug(), 150);
        }

        endBuffSequence() {
            this.isBuffActive = false;
            // Reinicia o timer
            this.timerId = setTimeout(() => this.updateTimer(), 1000);
        }
        
        onBugSquash(squashedBug) {
            if (!this.isGameRunning) return;
        
            if (squashedBug.health > 0) { 
                this.playSound(this.sounds.bossHit);
                return;
            }
            
            // O bug foi derrotado
            this.playSound(this.sounds.squash);
        
            const timeNow = Date.now();
            if (timeNow - this.lastSquashTime < CONFIG.COMBO_TIMEOUT_MS) {
                this.combo++;
            } else {
                this.combo = 1;
            }
            this.lastSquashTime = timeNow;
        
            const points = (squashedBug.isBoss ? CONFIG.POINTS.boss : CONFIG.POINTS.bug) * this.combo;
            this.score += points;
            
            this.ui.updateScore(this.score);
            this.ui.updateCombo(this.combo);
            
            // Remove o bug da lista do jogo
            this.bugs = this.bugs.filter(b => b !== squashedBug);
        }

        gerarPosicaoAleatoria(objectWidth, objectHeight) {
            if (this.screenWidth <= objectWidth || this.screenHeight <= objectHeight) return { x: 0, y: 0 };
            const maxX = this.screenWidth - objectWidth;
            const maxY = this.screenHeight - objectHeight;
            const randomX = Math.floor(Math.random() * maxX);
            const randomY = Math.floor(Math.random() * maxY);
            return { x: randomX, y: randomY };
        }

        // --- LÓGICA DO MATRIX BACKGROUND ---
        initMatrixBackground() {
            this.ui.canvas.width = window.innerWidth;
            this.ui.canvas.height = window.innerHeight;
            const letters = '01';
            const fontSize = 16;
            let drops = Array(Math.floor(this.ui.canvas.width / fontSize)).fill(1);
            
            const drawMatrix = () => {
                this.ui.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                this.ui.ctx.fillRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
                this.ui.ctx.fillStyle = '#0F0';
                this.ui.ctx.font = `${fontSize}px monospace`;
                for (let i = 0; i < drops.length; i++) {
                    const text = letters.charAt(Math.floor(Math.random() * letters.length));
                    this.ui.ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                    if (drops[i] * fontSize > this.ui.canvas.height && Math.random() > 0.975) {
                        drops[i] = 0;
                    }
                    drops[i]++;
                }
            }

            window.addEventListener('resize', () => {
                 this.ui.canvas.width = window.innerWidth;
                 this.ui.canvas.height = window.innerHeight;
                 const newColumns = Math.floor(this.ui.canvas.width / fontSize);
                 while (drops.length < newColumns) { drops.push(1); }
                 drops.length = newColumns;
            });
            setInterval(drawMatrix, 50);
        }
    }

    // --- CLASSE DO BUG ---
    class Bug {
        constructor(isBoss, gameScreen, onSquashCallback, parentBug = null) {
            this.isBoss = isBoss;
            this.gameScreen = gameScreen;
            this.onSquash = onSquashCallback;
            this.health = isBoss ? CONFIG.BOSS_HEALTH : 1;
            
            const size = isBoss ? CONFIG.BUG_SIZES.boss : CONFIG.BUG_SIZES.bug;
            this.width = size.w;
            this.height = size.h;

            this.element = document.createElement('div');
            this.element.classList.add(isBoss ? 'boss-bug' : 'bug');
            
            let position;
            if (parentBug) { // Se é uma reprodução
                const offsetX = (Math.random() - 0.5) * 200;
                const offsetY = (Math.random() - 0.5) * 200;
                let newX = parentBug.x + offsetX;
                let newY = parentBug.y + offsetY;
                // Garante que não nasça fora da tela
                newX = Math.max(0, Math.min(newX, this.gameScreen.clientWidth - this.width));
                newY = Math.max(0, Math.min(newY, this.gameScreen.clientHeight - this.height));
                position = {x: newX, y: newY};
            } else { // Spawn normal
                position = this.gerarPosicaoAleatoria(this.width, this.height);
            }

            this.x = position.x;
            this.y = position.y;
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
            
            this.timeUntilReproduction = CONFIG.BUG_REPRODUCTION_TIME_MS.min + Math.random() * (CONFIG.BUG_REPRODUCTION_TIME_MS.max - CONFIG.BUG_REPRODUCTION_TIME_MS.min);

            this.element.addEventListener('click', () => this.squash());
            this.gameScreen.appendChild(this.element);
        }
        
        squash() {
            this.health--;
            this.onSquash(this); 

            if (this.health > 0) {
                this.element.classList.add('hit');
                setTimeout(() => this.element.classList.remove('hit'), 100);
            } else {
                this.element.remove();
            }
        }
        
        update(deltaTime, reproduceCallback) {
            this.timeUntilReproduction -= deltaTime;
            if (this.timeUntilReproduction <= 0) {
                reproduceCallback();
                this.timeUntilReproduction = CONFIG.BUG_REPRODUCTION_TIME_MS.min + Math.random() * (CONFIG.BUG_REPRODUCTION_TIME_MS.max - CONFIG.BUG_REPRODUCTION_TIME_MS.min);
            }
        }

        vanish() {
             this.element.classList.add(this.isBoss ? 'boss-bug-vanishing' : 'bug-vanishing');
             setTimeout(() => this.element.remove(), 300);
        }

        gerarPosicaoAleatoria(objectWidth, objectHeight) {
            const screenWidth = this.gameScreen.clientWidth;
            const screenHeight = this.gameScreen.clientHeight;
            if (screenWidth <= objectWidth || screenHeight <= objectHeight) return { x: 0, y: 0 };
            const maxX = screenWidth - objectWidth;
            const maxY = screenHeight - objectHeight;
            return {
                x: Math.floor(Math.random() * maxX),
                y: Math.floor(Math.random() * maxY)
            };
        }
    }

    // --- INICIA O JOGO ---
    new Game();
});