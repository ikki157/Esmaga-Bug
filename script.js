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
    let bugCreationIntervalMs = 1200; // Bugs aparecem um pouco mais rápido
    let bugLifetimeMs = 1800; // Tempo que um bug fica na tela antes de sumir
    let isGameRunning = false;
    let lastTime = 0, timeToNextBug = 0, timeToNextDifficultyIncrease = 5000;
    let bugs = [];
    let highScore = localStorage.getItem('bugSmasherHighScore') || 0;
    let gameLoopId, timerId;
    let screenWidth = 0, screenHeight = 0;

    // --- CONFIGURAÇÕES DO CANVAS DE FUNDO ---
    // ... (Seção do canvas permanece igual) ...
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = '01';
    const fontSize = 16;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);
    function drawMatrix() { /* ... */ }

    // --- FUNÇÕES AUXILIARES ---
    function playSound(sound) { /* ... */ }
    function debounce(func, wait) { /* ... */ }

    // ==================================================================
    // SEÇÃO 4: NOVA LÓGICA DO JOGO
    // ==================================================================

    /**
     * Implementação exata da sua lógica para encontrar uma posição aleatória.
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
     * O bug não se move, mas desaparece após um tempo.
     */
    function createBug() {
        const isBoss = Math.random() < 0.1 && bugs.filter(b => b.isBoss).length === 0;
        const element = document.createElement('div');
        element.classList.add(isBoss ? 'boss-bug' : 'bug');

        const objectWidth = isBoss ? 70 : 40;
        const objectHeight = isBoss ? 70 : 40;

        // Usa a nova função para obter uma posição segura
        const position = gerarPosicaoAleatoriaDentroDaCaixa(screenWidth, screenHeight, objectWidth, objectHeight);
        
        const bug = { 
            element, 
            x: position.x, 
            y: position.y,
            isBoss,
            health: isBoss ? 5 : 1 
        };

        element.style.left = `${bug.x}px`;
        element.style.top = `${bug.y}px`;
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            squash(bug);
        });

        // Adiciona um timer para remover o bug se ele não for clicado
        const timeoutId = setTimeout(() => {
            if(bug.element.parentNode) {
                bug.element.remove();
                bugs = bugs.filter(b => b !== bug);
            }
        }, bugLifetimeMs);
        
        // Guarda a referência do timeout para poder cancelar se o bug for clicado
        bug.timeoutId = timeoutId;

        bugs.push(bug);
        gameScreen.appendChild(element);
    }

    /**
     * Função executada quando um bug é clicado.
     */
    function squash(bug) {
        if (!isGameRunning || !bug.element.parentNode) return;

        // Cancela o timer que removeria o bug automaticamente
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

    /**
     * Inicia um novo jogo.
     */
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

        gameScreen.innerHTML = ''; // Limpa a tela
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
    
    /**
     * Para o jogo.
     */
    function stopGame() {
        isGameRunning = false;
        cancelAnimationFrame(gameLoopId);
        clearTimeout(timerId);
        
        // Limpa todos os timeouts de bugs que ainda estão na tela
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
    
    /**
     * O "coração" do jogo, chamado a cada frame.
     */
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
            // A dificuldade agora torna os bugs mais rápidos para aparecer e sumir
            if (bugCreationIntervalMs > 400) bugCreationIntervalMs -= 50;
            if (bugLifetimeMs > 700) bugLifetimeMs -= 50;
            timeToNextDifficultyIncrease = 5000;
        }
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function updateTimer() { /* ...código sem alterações... */ }

    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    highscoreDisplay.textContent = highScore;
    startButton.addEventListener('click', startGame);
    window.addEventListener('resize', debounce(() => { /* ... */ }, 250));
    setInterval(drawMatrix, 50);
});

// O código omitido (...) é idêntico à versão anterior e está incluído no bloco completo acima.
// As principais mudanças foram em createBug, squash e na lógica de dificuldade dentro do gameLoop.