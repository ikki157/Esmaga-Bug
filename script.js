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
    let score = 0, timeLeft = 60, combo = 1, lastSquashTime = 0;
    let bugCreationIntervalMs = 1200;
    let bugLifetimeMs = 1800;
    let isGameRunning = false;
    let lastTime = 0, timeToNextBug = 0, timeToNextDifficultyIncrease = 5000;
    let bugs = [];
    let highScore = localStorage.getItem('bugSmasherHighScore') || 0;
    let gameLoopId, timerId;
    let screenWidth = 0, screenHeight = 0;

    // --- CONFIGURAÇÕES DO CANVAS DE FUNDO ---
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = '01';
    const fontSize = 16;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

    // --- FUNÇÕES AUXILIARES ---

    /**
     * Toca um arquivo de áudio.
     */
    function playSound(sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.log(`Erro ao tocar som: ${error.message}`));
    }

    /**
     * Desenha um frame da animação de fundo "Matrix".
     */
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
    
    /**
     * Limita a frequência com que uma função pode ser chamada.
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- LÓGICA DO JOGO ---

    /**
     * Gera uma posição aleatória para um objeto dentro dos limites da tela.
     */
    function gerarPosicaoAleatoriaDentroDaCaixa(boxWidth, boxHeight, objectWidth, objectHeight) {
        const maxX = boxWidth - objectWidth;
        const maxY = boxHeight - objectHeight;
        const randomX = Math.floor(Math.random() * maxX);
        const randomY = Math.floor(Math.random() * maxY);
        return { x: randomX, y: randomY };
    }

    /**
     * Cria um novo bug em uma posição aleatória DENTRO da tela.
     */
    function createBug() {
        const isBoss = Math.random() < 0.1 && bugs.filter(b => b.isBoss).length === 0;
        const element = document.createElement('div');
        element.classList.add(isBoss ? 'boss-bug' : 'bug');

        const objectWidth = isBoss ? 70 : 40;
        const objectHeight = isBoss ? 70 : 40;

        const position = gerarPosicaoAleatoriaDentroDaCaixa(screenWidth, screenHeight, objectWidth, objectHeight);
        
        const bug = { 
            element, 
            x: position.x, y: position.y,
            isBoss,
            health: isBoss ? 5 : 1 
        };

        element.style.left = `${bug.x}px`;
        element.style.top = `${bug.y}px`;
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            squash(bug);
        });

        const timeoutId = setTimeout(() => {
            if(bug.element.parentNode) {
                bug.element.remove();
                bugs = bugs.filter(b => b !== bug);
            }
        }, bugLifetimeMs);
        
        bug.timeoutId = timeoutId;
        bugs.push(bug);
        gameScreen.appendChild(element);
    }

    /**
     * Função executada quando um bug é clicado.
     */
    function squash(bug) {
        if (!isGameRunning || !bug.element.parentNode) return;

        clearTimeout(bug.timeoutId);
        bug.health--;
        bug.element.classList.add('hit');
        setTimeout(() => bug.element.classList.remove('hit'), 100);

        if (bug.health > 0) {
            playSound(sounds.bossHit);
            return;
        }
        
        playSound(sounds.squash);
        
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
    }

    // --- FUNÇÕES PRINCIPAIS DE CONTROLE DO JOGO ---

    function startGame() {
        screenWidth = gameScreen.clientWidth;
        screenHeight = gameScreen.clientHeight;

        if (screenWidth === 0 || screenHeight === 0) {
            alert("Erro ao iniciar. Por favor, recarregue a página.");
            return;
        }

        isGameRunning = true;
        score = 0; combo = 1; timeLeft = 60;
        bugCreationIntervalMs = 1200;
        bugLifetimeMs = 1800;
        timeToNextDifficultyIncrease = 5000;
        timeToNextBug = 0;

        gameScreen.innerHTML = '';
        bugs = [];
        
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
        
        bugs.forEach(bug => clearTimeout(bug.timeoutId));

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
            if (bugCreationIntervalMs > 400) bugCreationIntervalMs -= 50;
            if (bugLifetimeMs > 700) bugLifetimeMs -= 50;
            timeToNextDifficultyIncrease = 5000;
        }
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function updateTimer() {
        if (!isGameRunning) return;
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            stopGame();
        } else {
            timerId = setTimeout(updateTimer, 1000);
        }
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
    
    // O setInterval para o fundo é iniciado aqui, garantindo que a função drawMatrix exista.
    setInterval(drawMatrix, 50);
});