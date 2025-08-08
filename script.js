// Espera o HTML carregar completamente antes de executar o script
document.addEventListener('DOMContentLoaded', () => {

    // --- REFERÊNCIAS AOS ELEMENTOS DO DOM ---
    const gameScreen = document.getElementById('game-screen');
    const scoreDisplay = document.getElementById('score-display');
    const highscoreDisplay = document.getElementById('highscore-display');
    const timerDisplay = document.getElementById('timer-display');
    const comboDisplay = document.getElementById('combo-display');
    const startButton = document.getElementById('start-button');
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('matrix-background');
    const ctx = canvas.getContext('2d');

    // --- REFERÊNCIAS AOS ÁUDIOS ---
    const sounds = {
        music: document.getElementById('sound-music'),
        squash: document.getElementById('sound-squash'),
        start: document.getElementById('sound-start'),
        gameOver: document.getElementById('sound-gameover'),
        powerup: document.getElementById('sound-powerup'),
        bossHit: document.getElementById('sound-boss-hit'),
    };

    // --- VARIÁVEIS DE ESTADO DO JOGO ---
    let score = 0;
    let timeLeft = 60;
    let combo = 1;
    let lastSquashTime = 0;
    let bugCreationIntervalMs = 1800;
    let isGameRunning = false;
    let lastTime = 0;
    let timeToNextBug = 0;
    let timeToNextDifficultyIncrease = 5000;
    let bugs = [];
    let powerups = [];
    let particles = [];
    let highScore = localStorage.getItem('bugSmasherHighScore') || 0;
    let gameLoopId;
    let timerId;
    let velocidadeAtual = 1.2;

    // --- CONFIGURAÇÕES DO CANVAS DE FUNDO ---
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = '01';
    const fontSize = 16;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

    // --- FUNÇÕES AUXILIARES ---
    function playSound(sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.log(`Erro ao tocar som: ${error.message}`));
    }

    function drawMatrix() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0F0';
        ctx.font = `${fontSize}px monospace`;
        for (let i = 0; i < drops.length; i++) {
            const text = letters.charAt(Math.floor(Math.random() * letters.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- LÓGICA DE CRIAÇÃO E ATUALIZAÇÃO DOS ELEMENTOS DO JOGO ---
    function createParticles(x, y, count) {
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.classList.add('particle'); 
            gameScreen.appendChild(p);
            const particle = {
                element: p, x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30,
            };
            particles.push(particle);
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy; p.life--; p.vy += 0.1; 
            p.element.style.transform = `translate(${p.x}px, ${p.y}px)`;
            p.element.style.opacity = p.life / 30;
            if (p.life <= 0) {
                p.element.remove();
                particles.splice(i, 1);
            }
        }
    }
    
    // ==================================================================
    // FUNÇÃO createBug COM LÓGICA DE MOVIMENTO COMPLETAMENTE REFEITA
    // ==================================================================
    function createBug() {
        const isBoss = Math.random() < 0.08 && bugs.filter(b => b.isBoss).length === 0;
        const element = document.createElement('div');
        const edge = Math.floor(Math.random() * 4);
        
        let spawnX, spawnY;
        let targetX, targetY;

        const screenWidth = gameScreen.clientWidth;
        const screenHeight = gameScreen.clientHeight;

        switch (edge) {
            case 0: // Nasce na Esquerda
                spawnX = -80;
                spawnY = Math.random() * screenHeight;
                targetX = screenWidth + 80;
                targetY = Math.random() * screenHeight;
                break;
            case 1: // Nasce na Direita
                spawnX = screenWidth + 80;
                spawnY = Math.random() * screenHeight;
                targetX = -80;
                targetY = Math.random() * screenHeight;
                break;
            case 2: // Nasce no Topo
                spawnX = Math.random() * screenWidth;
                spawnY = -80;
                targetX = Math.random() * screenWidth;
                targetY = screenHeight + 80;
                break;
            default: // Nasce na Base
                spawnX = Math.random() * screenWidth;
                spawnY = screenHeight + 80;
                targetX = Math.random() * screenWidth;
                targetY = -80;
                break;
        }

        // Calcula o vetor de direção normalizado
        const dx = targetX - spawnX;
        const dy = targetY - spawnY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = velocidadeAtual * (isBoss ? 0.7 : 1);
        const vx = (dx / distance) * speed;
        const vy = (dy / distance) * speed;
        
        const bug = {
            element, x: spawnX, y: spawnY, vx, vy, isBoss,
            health: isBoss ? 5 : 1,
        };
        element.classList.add(isBoss ? 'boss-bug' : 'bug');
        element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            squash(bug);
        });
        bugs.push(bug);
        gameScreen.appendChild(element);
    }
    
    function updateBugs(deltaTime) {
        for (let i = bugs.length - 1; i >= 0; i--) {
            const bug = bugs[i];
            bug.x += bug.vx * (deltaTime / 16);
            bug.y += bug.vy * (deltaTime / 16);
            bug.element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;

            if (bug.x < -100 || bug.x > gameScreen.clientWidth + 100 || bug.y < -100 || bug.y > gameScreen.clientHeight + 100) {
                bug.element.remove();
                bugs.splice(i, 1);
            }
        }
    }

    function squash(bug) {
        if (!isGameRunning || !bug.element.parentNode) return;

        bug.health--;
        bug.element.classList.add('hit');
        setTimeout(() => bug.element.classList.remove('hit'), 100);

        if (bug.health > 0) {
            playSound(sounds.bossHit);
            return;
        }
        
        playSound(sounds.squash);
        const centerX = bug.x + bug.element.offsetWidth / 2;
        const centerY = bug.y + bug.element.offsetHeight / 2;
        createParticles(centerX, centerY, bug.isBoss ? 50 : 15);
        
        const timeNow = Date.now();
        if (timeNow - lastSquashTime < 1500) { combo++; } else { combo = 1; }
        lastSquashTime = timeNow;
        
        const points = (bug.isBoss ? 50 : 10) * combo;
        score += points;
        scoreDisplay.textContent = score;
        comboDisplay.textContent = `x${combo}`;
        
        bug.element.remove();
        bugs = bugs.filter(b => b !== bug);
        
        if (bug.isBoss) {
            gameContainer.classList.add('shake');
            setTimeout(() => gameContainer.classList.remove('shake'), 500);
        }

        if (Math.random() < 0.25) { createPowerUp(centerX, centerY); }
    }

    // --- FUNÇÕES PRINCIPAIS DO JOGO (START, STOP, LOOP) ---
    function startGame() {
        isGameRunning = true;
        score = 0; combo = 1; timeLeft = 60;
        bugCreationIntervalMs = 1800;
        velocidadeAtual = 1.2;
        timeToNextDifficultyIncrease = 5000;
        timeToNextBug = 0;

        gameScreen.innerHTML = '';
        bugs = []; powerups = []; particles = [];

        scoreDisplay.textContent = score;
        comboDisplay.textContent = `x${combo}`;
        timerDisplay.textContent = timeLeft;
        gameScreen.appendChild(startButton);
        startButton.style.display = 'none';

        playSound(sounds.start);
        sounds.music.volume = 0.3;
        sounds.music.currentTime = 0;
        sounds.music.play();

        clearTimeout(timerId);
        timerId = setTimeout(updateTimer, 1000);
        
        lastTime = performance.now();
        cancelAnimationFrame(gameLoopId);
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    function stopGame() {
        isGameRunning = false;
        cancelAnimationFrame(gameLoopId);
        clearTimeout(timerId);
        playSound(sounds.gameOver);
        sounds.music.pause();
        
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('bugSmasherHighScore', highScore);
            highscoreDisplay.textContent = highScore;
        }
        
        startButton.style.display = 'block';
    }
    
    function gameLoop(timestamp) {
        if (!isGameRunning) return;
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;

        timeToNextBug -= deltaTime;
        if (timeToNextBug <= 0) {
            createBug();
            timeToNextBug = bugCreationIntervalMs;
        }
        
        timeToNextDifficultyIncrease -= deltaTime;
        if (timeToNextDifficultyIncrease <= 0) {
            if (bugCreationIntervalMs > 400) {
                bugCreationIntervalMs -= 75;
            }
            if (velocidadeAtual < 3.5) {
                velocidadeAtual += 0.1;
            }
            timeToNextDifficultyIncrease = 5000;
        }

        updateBugs(deltaTime);
        updateParticles();
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function updateTimer() {
        if (!isGameRunning) return;
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) { stopGame(); } 
        else { timerId = setTimeout(updateTimer, 1000); }
    }

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    highscoreDisplay.textContent = highScore;
    startButton.addEventListener('click', startGame);
    window.addEventListener('resize', debounce(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const newColumns = Math.floor(canvas.width / fontSize);
        while (drops.length < newColumns) { drops.push(1); }
        drops.length = newColumns;
    }, 250));
    setInterval(drawMatrix, 50);
});