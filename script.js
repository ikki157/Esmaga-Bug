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
    let bugCreationIntervalMs = 1200;
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

    // --- CONFIGURAÇÕES DO CANVAS DE FUNDO ---
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = '01';
    const fontSize = 16;
    let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

    // --- FUNÇÕES AUXILIARES ---

    // Função para tocar som, reiniciando se já estiver tocando
    function playSound(sound) {
        sound.currentTime = 0;
        sound.play().catch(error => console.log(`Erro ao tocar som: ${error.message}`));
    }

    // Função para desenhar o efeito "Matrix" no fundo
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
    
    // Função "debounce" para otimizar o evento de redimensionar a tela
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- LÓGICA DE CRIAÇÃO E ATUALIZAÇÃO DOS ELEMENTOS DO JOGO ---

    // Cria as partículas de "explosão" ao esmagar um bug
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

    // Atualiza a posição e a vida das partículas
    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            p.vy += 0.1; 
            p.element.style.transform = `translate(${p.x}px, ${p.y}px)`;
            p.element.style.opacity = p.life / 30;
            if (p.life <= 0) {
                p.element.remove();
                particles.splice(i, 1);
            }
        }
    }

    // Cria um bug (normal ou boss) em uma borda aleatória da tela
    function createBug() {
        const isBoss = Math.random() < 0.1 && bugs.filter(b => b.isBoss).length === 0;
        const element = document.createElement('div');
        const edge = Math.floor(Math.random() * 4);
        let x, y;

        if (edge === 0) { x = -80; y = Math.random() * gameScreen.clientHeight; } 
        else if (edge === 1) { x = gameScreen.clientWidth + 80; y = Math.random() * gameScreen.clientHeight; } 
        else if (edge === 2) { y = -80; x = Math.random() * gameScreen.clientWidth; } 
        else { y = gameScreen.clientHeight + 80; x = Math.random() * gameScreen.clientWidth; }

        const bug = {
            element, x, y,
            vx: (gameScreen.clientWidth / 2 - x) / 200 * (Math.random() * 0.4 + 0.6),
            vy: (gameScreen.clientHeight / 2 - y) / 200 * (Math.random() * 0.4 + 0.6),
            isBoss: isBoss,
            health: isBoss ? 5 : 1,
        };
        element.classList.add(isBoss ? 'boss-bug' : 'bug');
        element.style.transform = `translate(${x}px, ${y}px)`;
        element.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique se propague para a tela
            squash(bug);
        });
        bugs.push(bug);
        gameScreen.appendChild(element);
    }
    
    // Move os bugs na tela
    function updateBugs(deltaTime) {
        for (let i = bugs.length - 1; i >= 0; i--) {
            const bug = bugs[i];
            bug.x += bug.vx * deltaTime / 16;
            bug.y += bug.vy * deltaTime / 16;
            bug.element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;

            if (bug.x < -100 || bug.x > gameScreen.clientWidth + 100 || bug.y < -100 || bug.y > gameScreen.clientHeight + 100) {
                bug.element.remove();
                bugs.splice(i, 1);
            }
        }
    }

    // Função chamada ao clicar em um bug
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
        if (timeNow - lastSquashTime < 1500) {
            combo++;
        } else {
            combo = 1;
        }
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

        if (Math.random() < 0.25) {
            createPowerUp(centerX, centerY);
        }
    }

    // --- FUNÇÕES PRINCIPAIS DO JOGO (START, STOP, LOOP) ---

    // Inicia o jogo
    function startGame() {
        isGameRunning = true;
        score = 0;
        combo = 1;
        timeLeft = 60;
        bugCreationIntervalMs = 1200;
        timeToNextDifficultyIncrease = 5000;
        timeToNextBug = 0;

        gameScreen.innerHTML = ''; // Limpa a tela de elementos antigos
        bugs = [];
        powerups = [];
        particles = [];

        scoreDisplay.textContent = score;
        comboDisplay.textContent = `x${combo}`;
        timerDisplay.textContent = timeLeft;
        gameScreen.appendChild(startButton); // Garante que o botão está no lugar certo
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
    
    // Para o jogo
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
    
    // O loop principal do jogo, chamado a cada frame
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
            if (bugCreationIntervalMs > 300) bugCreationIntervalMs -= 50;
            timeToNextDifficultyIncrease = 5000;
        }

        updateBugs(deltaTime);
        updateParticles();
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // Atualiza o cronômetro a cada segundo
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

    // Mostra o High Score salvo
    highscoreDisplay.textContent = highScore;

    // Inicia o jogo ao clicar no botão
    startButton.addEventListener('click', startGame);

    // Redimensiona o canvas de fundo quando a janela muda de tamanho
    window.addEventListener('resize', debounce(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const newColumns = Math.floor(canvas.width / fontSize);
        while (drops.length < newColumns) {
            drops.push(1);
        }
        drops.length = newColumns;
    }, 250));

    // Inicia o efeito Matrix de fundo
    setInterval(drawMatrix, 50);
});