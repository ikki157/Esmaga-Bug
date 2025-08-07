// --- REFERÊNCIAS AOS ELEMENTOS ---
const gameScreen = document.getElementById('game-screen');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const startButton = document.getElementById('start-button');
const hammerEffect = document.getElementById('hammer-effect');
const canvas = document.getElementById('matrix-background');
const ctx = canvas.getContext('2d');

// --- VARIÁVEIS DE CONFIGURAÇÃO E ESTADO DO JOGO ---
let score = 0;
let timeLeft = 60; // Duração do jogo em segundos
let bugCreationIntervalMs = 1000; // Começa criando bugs a cada 1 segundo
let bugLifetimeMs = 2000; // Tempo que um bug fica na tela

let isGameRunning = false;
let gameTimer = null;
let bugCreationTimer = null;
let difficultyTimer = null;
let matrixTimer = null;

// --- EFEITO MATRIX NO FUNDO ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}';
const fontSize = 16;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0F0'; // Cor verde Matrix
    ctx.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}

// --- FUNÇÕES PRINCIPAIS DO JOGO ---

function startGame() {
    // Reset de variáveis
    score = 0;
    timeLeft = 60;
    bugCreationIntervalMs = 1000;
    bugLifetimeMs = 2000;

    scoreDisplay.textContent = score;
    timerDisplay.textContent = timeLeft;
    isGameRunning = true;
    startButton.style.display = 'none';
    gameScreen.innerHTML = ''; // Limpa a tela de elementos antigos

    // Inicia todos os loops do jogo
    gameTimer = setInterval(updateTimer, 1000);
    bugCreationTimer = setInterval(createBug, bugCreationIntervalMs);
    difficultyTimer = setInterval(increaseDifficulty, 5000); // Aumenta a dificuldade a cada 5s
}

function stopGame() {
    isGameRunning = false;
    // Para todos os loops para não consumir recursos
    clearInterval(gameTimer);
    clearInterval(bugCreationTimer);
    clearInterval(difficultyTimer);

    // Exibe a pontuação final
    setTimeout(() => { // Pequeno delay para o jogador ver o último clique
        alert(`Fim de jogo!\nSua pontuação final foi: ${score}`);
        startButton.style.display = 'block';
        startButton.textContent = 'Jogar Novamente';
        gameScreen.appendChild(startButton); // Garante que o botão volte para a tela
    }, 100);
}

function updateTimer() {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 0) {
        stopGame();
    }
}

function increaseDifficulty() {
    if (!isGameRunning) return;

    // Torna a criação de bugs mais rápida
    if (bugCreationIntervalMs > 300) { // Limite mínimo de 0.3s
        bugCreationIntervalMs -= 50;
    }
    // Diminui o tempo de vida do bug
    if (bugLifetimeMs > 1000) { // Limite mínimo de 1s
        bugLifetimeMs -= 100;
    }

    // Reinicia o loop de criação de bugs com o novo intervalo
    clearInterval(bugCreationTimer);
    bugCreationTimer = setInterval(createBug, bugCreationIntervalMs);
}

// --- LÓGICA DOS BUGS E POWER-UPS ---

function createBug() {
    if (!isGameRunning) return;

    const bug = document.createElement('div');
    bug.classList.add('bug');
    const { x, y } = getRandomPosition();
    bug.style.left = `${x}px`;
    bug.style.top = `${y}px`;

    bug.addEventListener('click', squashBug);
    gameScreen.appendChild(bug);

    setTimeout(() => {
        if (bug.parentElement) bug.remove();
    }, bugLifetimeMs);
}

function squashBug() {
    if (!isGameRunning) return;
    score++;
    scoreDisplay.textContent = score;
    this.remove(); // Remove o bug clicado

    // Chance de 15% de dropar um power-up no lugar do bug
    if (Math.random() < 0.15) {
        const rect = this.getBoundingClientRect(); // Pega a posição do bug
        const screenRect = gameScreen.getBoundingClientRect();
        const x = rect.left - screenRect.left;
        const y = rect.top - screenRect.top;
        createPowerUp(x, y);
    }
}

function createPowerUp(x, y) {
    const powerup = document.createElement('div');
    powerup.classList.add('powerup');
    
    // Sorteia qual power-up vai aparecer
    const type = Math.random() > 0.5 ? 'pull-request' : 'debugger';
    powerup.dataset.type = type;

    powerup.style.left = `${x}px`;
    powerup.style.top = `${y}px`;

    powerup.addEventListener('click', activatePowerUp);
    gameScreen.appendChild(powerup);

    // Remove o power-up se não for pego em 5 segundos
    setTimeout(() => {
        if (powerup.parentElement) powerup.remove();
    }, 5000);
}

function activatePowerUp() {
    if (!isGameRunning) return;
    const type = this.dataset.type;

    if (type === 'pull-request') {
        // Remove todos os bugs da tela
        document.querySelectorAll('.bug').forEach(bug => bug.remove());
        score += 10; // Bônus de 10 pontos
        scoreDisplay.textContent = score;
    } else if (type === 'debugger') {
        // Para a criação de bugs por 5 segundos
        clearInterval(bugCreationTimer);
        gameScreen.style.boxShadow = 'inset 0 0 20px 10px #61afef'; // Efeito visual de "congelado"
        setTimeout(() => {
            if (isGameRunning) {
                bugCreationTimer = setInterval(createBug, bugCreationIntervalMs);
                gameScreen.style.boxShadow = 'none';
            }
        }, 5000);
    }
    this.remove(); // Remove o ícone do power-up
}

// --- FUNÇÕES AUXILIARES E EFEITOS ---
function getRandomPosition() {
    const maxX = gameScreen.clientWidth - 50;
    const maxY = gameScreen.clientHeight - 50;
    return { x: Math.random() * maxX, y: Math.random() * maxY };
}

function showHammer(e) {
    // Posiciona a marreta no local do clique
    const rect = gameScreen.getBoundingClientRect();
    hammerEffect.style.left = `${e.clientX - rect.left}px`;
    hammerEffect.style.top = `${e.clientY - rect.top}px`;
    hammerEffect.style.display = 'block';

    // Esconde a marreta rapidamente para criar o efeito "smash"
    setTimeout(() => {
        hammerEffect.style.display = 'none';
    }, 100);
}

// --- INICIALIZAÇÃO E EVENT LISTENERS ---
window.addEventListener('resize', () => { // Faz o canvas se adaptar à tela
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

startButton.addEventListener('click', startGame);
gameScreen.addEventListener('click', showHammer);

// Inicia o efeito Matrix assim que a página carrega
matrixTimer = setInterval(drawMatrix, 33);