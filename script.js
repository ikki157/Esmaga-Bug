/**
 * @file script.js
 * @description Lógica principal para o jogo "Esmaga-Bug", criado para o Software Freedom Day.
 * Este arquivo controla toda a jogabilidade, incluindo o movimento dos bugs, pontuação,
 * power-ups, dificuldade progressiva e efeitos visuais.
 */

// Garante que o script só será executado após o carregamento completo da estrutura HTML.
// Isso evita erros de "elemento não encontrado".
document.addEventListener('DOMContentLoaded', () => {

    // ==================================================================
    // SEÇÃO 1: REFERÊNCIAS AOS ELEMENTOS DO DOM E ÁUDIO
    // Conecta as variáveis do JavaScript com os elementos da página HTML.
    // ==================================================================

    const gameScreen = document.getElementById('game-screen');
    const scoreDisplay = document.getElementById('score-display');
    const highscoreDisplay = document.getElementById('highscore-display');
    const timerDisplay = document.getElementById('timer-display');
    const comboDisplay = document.getElementById('combo-display');
    const startButton = document.getElementById('start-button');
    const gameContainer = document.getElementById('game-container');
    const canvas = document.getElementById('matrix-background');
    const ctx = canvas.getContext('2d');

    const sounds = {
        music: document.getElementById('sound-music'),
        squash: document.getElementById('sound-squash'),
        start: document.getElementById('sound-start'),
        gameOver: document.getElementById('sound-gameover'),
        powerup: document.getElementById('sound-powerup'),
        bossHit: document.getElementById('sound-boss-hit'),
    };

    // ==================================================================
    // SEÇÃO 2: VARIÁVEIS DE ESTADO DO JOGO
    // Controlam o estado atual do jogo (pontuação, tempo, etc.).
    // ==================================================================

    let score = 0, timeLeft = 60, combo = 1, lastSquashTime = 0;
    let bugCreationIntervalMs = 2000; // Começa criando um bug a cada 2 segundos.
    let isGameRunning = false;
    let lastTime = 0, timeToNextBug = 0, timeToNextDifficultyIncrease = 5000;
    
    // Arrays para guardar os elementos ativos na tela.
    let bugs = [], powerups = [], particles = [];
    
    // Armazena a pontuação máxima no navegador do usuário.
    let highScore = localStorage.getItem('bugSmasherHighScore') || 0;
    
    // Identificadores para os loops de animação, para que possam ser parados.
    let gameLoopId, timerId;
    
    // Variável que controla a velocidade dos bugs, aumenta com o tempo.
    let velocidadeAtual = 0.8; 
    
    // Variáveis para guardar as dimensões seguras da tela, evitando erros de timing.
    let screenWidth = 0;
    let screenHeight = 0;

    // --- Configurações do Canvas de Fundo ---
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = '01';
    const fontSize = 16;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);


    // ==================================================================
    // SEÇÃO 3: FUNÇÕES AUXILIARES E EFEITOS
    // Funções de propósito geral usadas em várias partes do jogo.
    // ==================================================================

    /**
     * Toca um arquivo de áudio.
     * @param {HTMLAudioElement} sound - O elemento de áudio a ser tocado.
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
     * Limita a frequência com que uma função pode ser chamada. Usado para o evento 'resize'.
     * @param {Function} func - A função a ser executada.
     * @param {number} wait - O tempo de espera em milissegundos.
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================================================================
    // SEÇÃO 4: LÓGICA DOS ELEMENTOS DO JOGO (BUGS, PARTÍCULAS, POWER-UPS)
    // ==================================================================

    /**
     * Cria partículas de "explosão" na posição de um bug esmagado.
     * @param {number} x - Posição horizontal.
     * @param {number} y - Posição vertical.
     * @param {number} count - Quantidade de partículas a serem criadas.
     */
    function createParticles(x, y, count) {
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.classList.add('particle'); 
            gameScreen.appendChild(p);
            const particle = {
                element: p, x, y,
                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                life: 30,
            };
            particles.push(particle);
        }
    }

    /**
     * Anima e remove as partículas da tela a cada frame.
     */
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
    
    /**
     * Cria um novo bug. Define sua posição de spawn e seu alvo na borda oposta,
     * garantindo que ele atravesse a tela de forma variada.
     */
    function createBug() {
        const isBoss = Math.random() < 0.1 && bugs.filter(b => b.isBoss).length === 0;
        const element = document.createElement('div');
        const edge = Math.floor(Math.random() * 4);
        let spawnX, spawnY, targetX, targetY;

        switch (edge) {
            case 0: // Nasce na Esquerda
                spawnX = -80; spawnY = Math.random() * screenHeight;
                targetX = screenWidth; targetY = Math.random() * screenHeight;
                break;
            case 1: // Nasce na Direita
                spawnX = screenWidth + 80; spawnY = Math.random() * screenHeight;
                targetX = -80; targetY = Math.random() * screenHeight;
                break;
            case 2: // Nasce no Topo
                spawnX = Math.random() * screenWidth; spawnY = -80;
                targetX = Math.random() * screenWidth; targetY = screenHeight;
                break;
            default: // Nasce na Base
                spawnX = Math.random() * screenWidth; spawnY = screenHeight + 80;
                targetX = Math.random() * screenWidth; targetY = -80;
                break;
        }

        const dx = targetX - spawnX;
        const dy = targetY - spawnY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = velocidadeAtual * (isBoss ? 0.7 : 1);
        const vx = (dx / distance) * speed;
        const vy = (dy / distance) * speed;
        
        const bug = { element, x: spawnX, y: spawnY, vx, vy, isBoss, health: isBoss ? 5 : 1 };
        element.classList.add(isBoss ? 'boss-bug' : 'bug');
        element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;
        element.addEventListener('click', (e) => { e.stopPropagation(); squash(bug); });
        bugs.push(bug);
        gameScreen.appendChild(element);
    }
    
    /**
     * Move os bugs na tela a cada frame e os remove se saírem dos limites.
     * @param {number} deltaTime - O tempo desde o último frame, para movimento suave.
     */
    function updateBugs(deltaTime) {
        for (let i = bugs.length - 1; i >= 0; i--) {
            const bug = bugs[i];
            bug.x += bug.vx * (deltaTime / 16);
            bug.y += bug.vy * (deltaTime / 16);
            bug.element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;

            if (bug.x < -100 || bug.x > screenWidth + 100 || bug.y < -100 || bug.y > screenHeight + 100) {
                bug.element.remove();
                bugs.splice(i, 1);
            }
        }
    }

    /**
     * Função executada quando um bug é clicado. Controla a vida, pontuação, combo e chance de power-up.
     * @param {object} bug - O objeto do bug que foi clicado.
     */
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
    }

    // ==================================================================
    // SEÇÃO 5: FUNÇÕES PRINCIPAIS DE CONTROLE DO JOGO
    // Funções que gerenciam o ciclo de vida do jogo (iniciar, parar, loop).
    // ==================================================================

    /**
     * Inicia um novo jogo, resetando todas as variáveis e iniciando os loops.
     */
    function startGame() {
        // Captura as dimensões da tela de forma segura APÓS o clique no botão.
        screenWidth = gameScreen.clientWidth;
        screenHeight = gameScreen.clientHeight;

        if (screenWidth === 0 || screenHeight === 0) {
            alert("Erro ao ler as dimensões da tela. Tente recarregar a página.");
            return;
        }

        isGameRunning = true;
        score = 0; combo = 1; timeLeft = 60;
        bugCreationIntervalMs = 2000;
        velocidadeAtual = 0.8; 
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
    
    /**
     * Para o jogo, limpa os loops e salva a pontuação máxima.
     */
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
    
    /**
     * O "coração" do jogo. Chamado a cada frame para atualizar tudo.
     * @param {number} timestamp - Fornecido pelo requestAnimationFrame para calcular o deltaTime.
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
            if (bugCreationIntervalMs > 500) bugCreationIntervalMs -= 50;
            if (velocidadeAtual < 3.0) velocidadeAtual += 0.05;
            timeToNextDifficultyIncrease = 5000;
        }

        updateBugs(deltaTime);
        updateParticles();
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    /**
     * Atualiza o cronômetro do jogo a cada segundo.
     */
    function updateTimer() {
        if (!isGameRunning) return;
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) { stopGame(); } 
        else { timerId = setTimeout(updateTimer, 1000); }
    }

    // ==================================================================
    // SEÇÃO 6: INICIALIZAÇÃO E EVENT LISTENERS
    // Código que roda uma vez para preparar o jogo e "ouvir" as ações do usuário.
    // ==================================================================

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