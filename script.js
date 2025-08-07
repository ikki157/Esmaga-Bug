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

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const letters = '01';
const fontSize = 16;
let drops = Array(Math.floor(canvas.width / fontSize)).fill(1);

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

function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(error => console.log(`Error playing sound: ${error}`));
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

function createParticles(x, y, count) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        gameScreen.appendChild(p);
        const particle = {
            element: p,
            x,
            y,
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

function createBug() {
    const isBoss = Math.random() < 0.1 && bugs.filter(b => b.isBoss).length === 0;
    const element = document.createElement('div');
    const edge = Math.floor(Math.random() * 4);
    let x, y;

    if (edge === 0) { x = -80; y = Math.random() * gameScreen.clientHeight; } 
    else if (edge === 1) { x = gameScreen.clientWidth; y = Math.random() * gameScreen.clientHeight; } 
    else if (edge === 2) { y = -80; x = Math.random() * gameScreen.clientWidth; } 
    else { y = gameScreen.clientHeight; x = Math.random() * gameScreen.clientWidth; }

    const bug = {
        element, x, y,
        vx: (gameScreen.clientWidth / 2 - x) / 200 * (Math.random() * 0.5 + 0.5),
        vy: (gameScreen.clientHeight / 2 - y) / 200 * (Math.random() * 0.5 + 0.5),
        isBoss: isBoss,
        health: isBoss ? 5 : 1,
    };
    element.classList.add(isBoss ? 'boss-bug' : 'bug');
    element.style.transform = `translate(${x}px, ${y}px)`;
    element.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        squash(bug);
    });
    bugs.push(bug);
    gameScreen.appendChild(element);
}

function squash(bug) {
    if (!isGameRunning) return;

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
    scoreDisplay.classList.add('popping');
    setTimeout(() => scoreDisplay.classList.remove('popping'), 300);
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

function createPowerUp(x, y) {
    const element = document.createElement('div');
    element.classList.add('powerup');
    const type = Math.random() > 0.5 ? 'pull-request' : 'debugger';
    element.dataset.type = type;
    element.style.transform = `translate(${x - 22}px, ${y - 22}px)`;
    
    const powerup = { element, life: 300 };
    element.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        activatePowerUp(powerup);
    });

    powerups.push(powerup);
    gameScreen.appendChild(element);
}

function activatePowerUp(powerup) {
    if (!isGameRunning) return;
    playSound(sounds.powerup);
    const type = powerup.element.dataset.type;

    if (type === 'pull-request') {
        bugs.forEach(bug => {
            const centerX = bug.x + bug.element.offsetWidth / 2;
            const centerY = bug.y + bug.element.offsetHeight / 2;
            createParticles(centerX, centerY, 10);
            bug.element.remove();
        });
        bugs = [];
        score += 50 * combo;
    } else if (type === 'debugger') {
        timeLeft += 5;
        timerDisplay.textContent = timeLeft;
    }
    
    powerup.element.remove();
    powerups = powerups.filter(p => p !== powerup);
}

function updateBugs(deltaTime) {
    for (let i = bugs.length - 1; i >= 0; i--) {
        const bug = bugs[i];
        bug.x += bug.vx * deltaTime / 16;
        bug.y += bug.vy * deltaTime / 16;
        bug.element.style.transform = `translate(${bug.x}px, ${bug.y}px)`;

        if (bug.x < -100 || bug.x > gameScreen.clientWidth + 20 || bug.y < -100 || bug.y > gameScreen.clientHeight + 20) {
            bug.element.remove();
            bugs.splice(i, 1);
        }
    }
}

function updatePowerups(deltaTime) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.life -= deltaTime / 16;
        if (p.life <= 0) {
            p.element.remove();
            powerups.splice(i, 1);
        }
    }
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
        if (bugCreationIntervalMs > 300) bugCreationIntervalMs -= 50;
        timeToNextDifficultyIncrease = 5000;
    }

    updateBugs(deltaTime);
    updatePowerups(deltaTime);
    updateParticles();
    
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

function startGame() {
    isGameRunning = true;
    score = 0;
    combo = 1;
    timeLeft = 60;
    bugCreationIntervalMs = 1200;
    timeToNextDifficultyIncrease = 5000;
    timeToNextBug = 0;

    bugs.forEach(b => b.element.remove());
    powerups.forEach(p => p.element.remove());
    particles.forEach(p => p.element.remove());
    bugs = [];
    powerups = [];
    particles = [];

    scoreDisplay.textContent = score;
    comboDisplay.textContent = `x${combo}`;
    timerDisplay.textContent = timeLeft;
    startButton.style.display = 'none';

    playSound(sounds.start);
    sounds.music.volume = 0.3;
    sounds.music.currentTime = 0;
    sounds.music.play().catch(error => console.log(`Music play failed: ${error}`));

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
    
    setTimeout(() => {
        if (gameScreen.contains(startButton)) {
            startButton.style.display = 'block';
        } else {
            gameScreen.appendChild(startButton);
            startButton.style.display = 'block';
        }
    }, 1000);
}

highscoreDisplay.textContent = highScore;
startButton.addEventListener('click', startGame);

window.addEventListener('resize', debounce(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const newColumns = Math.floor(canvas.width / fontSize);
    while (drops.length < newColumns) {
        drops.push(1);
    }
    drops.length = newColumns;
}, 250));

setInterval(drawMatrix, 50);