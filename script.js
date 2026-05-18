const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Dimensiones del canvas
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

// Propiedades de la paleta
const paddleWidth = 10;
const paddleHeight = 100;
const paddleSpeed = 5; // Velocidad de movimiento de las paletas del jugador

const maxScore = 5; // Puntuación máxima para ganar el juego
const ballSpeedIncrease = 0.5; // Cuánto aumenta la velocidad de la pelota por golpe

// Cargar efectos de sonido
const paddleHitSound = new Audio('sounds/paddle_hit.m4a');
const wallHitSound = new Audio('sounds/wall_hit.mp3');
const scoreSound = new Audio('sounds/score.mp3');
const gameOverSound = new Audio('sounds/game_over.mp3');
const backgroundMusic = new Audio('sounds/background_music.mp3'); // Asegúrate de tener este archivo
backgroundMusic.loop = true; // Hacer que la música se repita
backgroundMusic.volume = 0.3; // Volumen inicial por defecto, será sobrescrito por localStorage

// Constantes para el feedback visual de la paleta
const PADDLE_HIT_FLASH_DURATION = 10; // Duración del flash en frames (aprox 0.16 segundos a 60fps)
const PADDLE_FLASH_COLOR = '#FFD700'; // Color de flash (ej. oro)

// Constantes para el feedback visual de la puntuación
const SCORE_FLASH_DURATION = 30; // Duración del flash de puntuación en frames (aprox 0.5 segundos)
const SCORE_FLASH_SIZE_INCREASE = 10; // Cuánto aumenta el tamaño de la fuente durante el flash
const SCORE_FLASH_COLOR = '#FFFFFF'; // Color del flash de puntuación

// Constante para el rastro de la pelota
const BALL_TRAIL_LENGTH = 10; // Número de posiciones anteriores a dibujar en el rastro

// Constantes para el flash de fondo del canvas
const CANVAS_SCORE_FLASH_DURATION = 15; // Duración del flash en frames
const CANVAS_SCORE_FLASH_COLOR = '#00FF00'; // Color del flash (verde neón brillante)


// === Partículas ===
const particles = []; // Array para almacenar las partículas
class Particle {
    constructor(x, y, dx, dy, radius, color, life) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.radius = radius;
        this.color = color;
        this.life = life; // Cuántos frames durará la partícula
        this.initialLife = life;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.life--; // Disminuir tiempo de vida
        // Aplicar una pequeña "gravedad" o desaceleración para que caigan/ralenticen
        this.dy += 0.1; // Pequeña gravedad
        this.dx *= 0.99; // Lenta desaceleración horizontal
    }

    draw() {
        const opacity = this.life / this.initialLife; // La partícula se desvanece con el tiempo
        // Convertir HEX a RGBA para aplicar opacidad
        const r = parseInt(this.color.slice(1,3), 16);
        const g = parseInt(this.color.slice(3,5), 16);
        const b = parseInt(this.color.slice(5,7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * opacity, 0, Math.PI * 2, false); // El radio también disminuye
        ctx.fill();
    }
}
// === Fin Partículas ===

// Configuración de dificultades
const difficultyLevels = {
    easy: { computerPaddleSpeed: 3, aiReactionMargin: 70 }, // Más lenta, más margen
    normal: { computerPaddleSpeed: 4, aiReactionMargin: 50 }, // Velocidad y margen por defecto
    hard: { computerPaddleSpeed: 5, aiReactionMargin: 30 }  // Más rápida, menos margen
};

let currentDifficulty = 'normal'; // Dificultad inicial

// Referencias a los botones de dificultad
const easyBtn = document.getElementById('easyBtn');
const normalBtn = document.getElementById('normalBtn');
const hardBtn = document.getElementById('hardBtn');
const difficultyButtons = [easyBtn, normalBtn, hardBtn];

// Referencias a los botones de modo de juego
const onePlayerBtn = document.getElementById('onePlayerBtn');
const twoPlayersBtn = document.getElementById('twoPlayersBtn');
const gameModeButtons = [onePlayerBtn, twoPlayersBtn];

let gameMode = 'onePlayer'; // Modo de juego inicial: 'onePlayer' o 'twoPlayers'

// Paleta del jugador (izquierda)
let playerPaddle = {
    x: 0,
    y: (canvasHeight - paddleHeight) / 2, // Centrada verticalmente
    width: paddleWidth,
    height: paddleHeight,
    score: 0,
    dy: 0, // Velocidad de movimiento en Y
    flashTimer: 0, // Timer para el efecto de flash al golpear
    scoreFlashTimer: 0 // Timer para el efecto de flash de puntuación
};

// Paleta de la computadora (derecha)
let computerPaddle = {
    x: canvasWidth - paddleWidth,
    y: (canvasHeight - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    score: 0,
    dy: 0, // Velocidad de movimiento en Y (para la IA simple o Jugador 2)
    flashTimer: 0, // Timer para el efecto de flash al golpear
    scoreFlashTimer: 0 // Timer para el efecto de flash de puntuación
};

// Propiedades de la pelota
let ball = {
    x: canvasWidth / 2,
    y: canvasHeight / 2,
    radius: 7,
    initialSpeed: 5, // Velocidad inicial de la pelota
    speed: 5,
    dx: 5, // Velocidad en X
    dy: 5,  // Velocidad en Y
    trail: [] // Array para almacenar las posiciones del rastro
};

// Estado del juego
let gameState = 'startScreen'; // 'startScreen', 'playing', 'paused', 'gameOver', 'countdown'
let winner = null; // Para almacenar quién ganó
let countdownValue = 3; // Valor inicial de la cuenta regresiva
let countdownTimer = 0; // Temporizador para gestionar el cambio de números en la cuenta regresiva
const COUNTDOWN_DURATION_PER_NUMBER = 60; // Duración de cada número en frames (aprox 1 segundo a 60fps)

// Temporizador para el flash de fondo del canvas
let canvasFlashTimer = 0;

// Referencias a los elementos del overlay
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const overlayButton = document.getElementById('overlayButton');
const volumeSlider = document.getElementById('volumeSlider'); // Referencia al deslizador de volumen
const volumeControlDiv = document.querySelector('.volume-control'); // Referencia al div del control de volumen

// Función para dibujar un rectángulo (usado para paletas y pelota)
function drawRect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
}

// Función para dibujar la pelota
function drawCircle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, false);
    ctx.fill();
}

// Función para reiniciar la pelota en el centro
function resetBall() {
    ball.x = canvasWidth / 2;
    ball.y = canvasHeight / 2;
    // Lanzar la pelota en una dirección horizontal aleatoria al reiniciar
    // y en una dirección vertical aleatoria para más variedad
    ball.dx = (Math.random() < 0.5 ? 1 : -1) * ball.initialSpeed;
    ball.dy = (Math.random() < 0.5 ? 1 : -1) * ball.initialSpeed * 0.5; // Velocidad vertical un poco menor inicialmente

    ball.speed = ball.initialSpeed; // Reiniciar la velocidad de la pelota a la inicial
    ball.trail = []; // Limpiar el rastro de la pelota al reiniciar
}

// Función para reiniciar el juego completo
function resetGame() {
    playerPaddle.score = 0;
    computerPaddle.score = 0;
    playerPaddle.y = (canvasHeight - paddleHeight) / 2;
    computerPaddle.y = (canvasHeight - paddleHeight) / 2;
    resetBall();
    
    // Iniciar la cuenta regresiva en lugar de ir directamente a 'playing'
    gameState = 'countdown'; 
    countdownValue = 3; 
    countdownTimer = COUNTDOWN_DURATION_PER_NUMBER;

    winner = null;
    playerPaddle.dy = 0; // Detener cualquier movimiento inicial de la paleta del jugador 1
    computerPaddle.dy = 0; // Detener cualquier movimiento inicial de la paleta del Jugador 2/IA
    playerPaddle.flashTimer = 0; // Reiniciar timer de flash de paleta
    computerPaddle.flashTimer = 0; // Reiniciar timer de flash de paleta
    playerPaddle.scoreFlashTimer = 0; // Reiniciar timer de flash de puntuación
    computerPaddle.scoreFlashTimer = 0; // Reiniciar timer de flash de puntuación
    canvasFlashTimer = 0; // Reiniciar el temporizador de flash del canvas
    
    // Limpiar partículas existentes
    particles.length = 0; // Vaciar el array de partículas

    // Asegurarse de que los sonidos se puedan reproducir de nuevo si ya se reprodujeron
    paddleHitSound.pause(); paddleHitSound.currentTime = 0;
    wallHitSound.pause(); wallHitSound.currentTime = 0;
    scoreSound.pause(); scoreSound.currentTime = 0;
    gameOverSound.pause(); gameOverSound.currentTime = 0;
    
    backgroundMusic.play().catch(e => console.log("User interaction needed to play music", e)); // Intentar reproducir si no está ya reproduciéndose
    
    applyVolume(volumeSlider.value); // Aplicar el volumen actual al reiniciar el juego
    hideOverlay(); // Ocultar el overlay
}

// Funciones para mostrar u ocultar el overlay
function showOverlay(title, message, buttonText, buttonAction) {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;

    if (buttonText && buttonAction) {
        overlayButton.textContent = buttonText;
        overlayButton.onclick = buttonAction;
        overlayButton.style.display = 'block';
    } else {
        overlayButton.style.display = 'none';
        overlayButton.onclick = null;
    }
    overlay.classList.add('active');
    backgroundMusic.pause(); // Pausar la música cuando el overlay está activo
    volumeControlDiv.style.display = 'flex'; // Mostrar el control de volumen en el overlay
}

function hideOverlay() {
    overlay.classList.remove('active');
    // Reanudar la música solo si el juego está en 'playing' o 'countdown'
    if (gameState === 'playing' || gameState === 'countdown') {
        backgroundMusic.play().catch(e => console.log("User interaction needed to play music", e));
    }
    volumeControlDiv.style.display = 'none'; // Ocultar el control de volumen cuando el overlay no está activo
}

// Funciones para gestionar el volumen
function applyVolume(volume) {
    backgroundMusic.volume = volume;
    paddleHitSound.volume = volume;
    wallHitSound.volume = volume;
    scoreSound.volume = volume;
    gameOverSound.volume = volume;
    volumeSlider.value = volume; // Actualizar el deslizador si el volumen se establece programáticamente
    saveVolume(volume); // Guardar el volumen en localStorage
}

function saveVolume(volume) {
    localStorage.setItem('pongVolume', volume);
}

function loadVolume() {
    const savedVolume = localStorage.getItem('pongVolume');
    if (savedVolume !== null) {
        applyVolume(parseFloat(savedVolume)); // Convertir a float y aplicar
    } else {
        applyVolume(backgroundMusic.volume); // Si no hay volumen guardado, aplicar el predeterminado
    }
}


// Función para establecer la dificultad
function setDifficulty(level) {
    currentDifficulty = level;
    // Actualizar la clase 'active' en los botones
    difficultyButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${level}Btn`).classList.add('active');

    // Si el juego ya está iniciado, reiniciar con la nueva dificultad
    if (gameState === 'playing' || gameState === 'paused' || gameState === 'countdown') {
        resetGame();
    }
}

// Función para establecer el modo de juego
function setGameMode(mode) {
    gameMode = mode;
    // Actualizar la clase 'active' en los botones
    gameModeButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${mode}Btn`).classList.add('active');

    // Si el juego ya está iniciado, reiniciar con el nuevo modo
    if (gameState === 'playing' || gameState === 'paused' || gameState === 'countdown') {
        resetGame();
    }
}

// Función para actualizar el estado del juego (movimientos, colisiones)
function update() {
    if (gameState === 'paused' || gameState === 'startScreen' || gameState === 'gameOver') return; // No actualizar lógica si estamos en estos estados

    // Decrementar flashTimers de las paletas
    if (playerPaddle.flashTimer > 0) playerPaddle.flashTimer--;
    if (computerPaddle.flashTimer > 0) computerPaddle.flashTimer--;

    // Decrementar scoreFlashTimers
    if (playerPaddle.scoreFlashTimer > 0) playerPaddle.scoreFlashTimer--;
    if (computerPaddle.scoreFlashTimer > 0) computerPaddle.scoreFlashTimer--;

    // Decrementar canvasFlashTimer
    if (canvasFlashTimer > 0) canvasFlashTimer--;

    // === Lógica de cuenta regresiva ===
    if (gameState === 'countdown') {
        countdownTimer--;
        if (countdownTimer <= 0) {
            countdownValue--;
            if (countdownValue > 0) {
                countdownTimer = COUNTDOWN_DURATION_PER_NUMBER;
                scoreSound.play(); // Usar el sonido de puntuación para el beep
            } else {
                gameState = 'playing'; // La cuenta regresiva terminó, ¡a jugar!
                scoreSound.play(); // Sonido final de 'GO'
            }
        }
        return; // No ejecutar el resto de la lógica del juego durante el countdown
    }
    // === Fin Lógica de cuenta regresiva ===

    // === Actualizar Partículas ===
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1); // Eliminar partículas muertas
        }
    }
    // === Fin Actualizar Partículas ===

    // Mover la pelota
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Actualizar el rastro de la pelota
    ball.trail.push({ x: ball.x, y: ball.y }); // Añadir la posición actual
    if (ball.trail.length > BALL_TRAIL_LENGTH) {
        ball.trail.shift(); // Eliminar la posición más antigua si el rastro es demasiado largo
    }

    // Colisión de la pelota con los bordes superior e inferior
    if (ball.y + ball.radius > canvasHeight || ball.y - ball.radius < 0) {
        ball.dy = -ball.dy; // Invertir dirección vertical
        wallHitSound.play(); // Reproducir sonido de golpe en la pared
        // === Generar Partículas en golpe de pared ===
        for (let i = 0; i < 5; i++) { // Menos partículas que al anotar
            const speed = Math.random() * 3 + 1;
            const angle = (ball.y + ball.radius > canvasHeight) ? Math.random() * Math.PI : Math.random() * Math.PI + Math.PI; // Dispersión a lo largo del borde
            particles.push(new Particle(ball.x, ball.y, Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() * 2 + 1, '#ADD8E6', 30)); // Azul claro, vida corta
        }
        // === Fin Generar Partículas ===
    }

    // Mover la paleta del jugador 1 (izquierda)
    playerPaddle.y += playerPaddle.dy;

    // Lógica para la paleta de la computadora (o Jugador 2)
    if (gameMode === 'onePlayer') {
        // Lógica de IA existente
        let computerPaddleCenter = computerPaddle.y + computerPaddle.height / 2;
        let ballCenter = ball.y;

        const currentCompSpeed = difficultyLevels[currentDifficulty].computerPaddleSpeed;
        const currentAiMargin = difficultyLevels[currentDifficulty].aiReactionMargin;

        if (ball.dx > 0) { // Solo si la pelota se mueve hacia el lado de la computadora
            if (computerPaddleCenter < ballCenter - currentAiMargin) {
                computerPaddle.dy = currentCompSpeed;
            } else if (computerPaddleCenter > ballCenter + currentAiMargin) {
                computerPaddle.dy = -currentCompSpeed;
            } else {
                computerPaddle.dy = 0;
            }
        } else { // Si la pelota se aleja de la computadora, se queda quieta o vuelve al centro
            if (computerPaddleCenter < canvasHeight / 2 - 10) {
                computerPaddle.dy = currentCompSpeed;
            } else if (computerPaddleCenter > canvasHeight / 2 + 10) {
                computerPaddle.dy = -currentCompSpeed;
            } else {
                computerPaddle.dy = 0;
            }
        }
        computerPaddle.y += computerPaddle.dy;
    } else { // gameMode === 'twoPlayers'
        // La paleta de la computadora es controlada por el Jugador 2
        computerPaddle.y += computerPaddle.dy;
    }


    // Evitar que las paletas se salgan de los límites
    playerPaddle.y = Math.max(0, Math.min(canvasHeight - paddleHeight, playerPaddle.y));
    computerPaddle.y = Math.max(0, Math.min(canvasHeight - paddleHeight, computerPaddle.y));

    // Colisión de la pelota con las paletas
    // Colisión con paleta izquierda (jugador 1)
    if (ball.x - ball.radius < playerPaddle.x + playerPaddle.width &&
        ball.y + ball.radius > playerPaddle.y &&
        ball.y - ball.radius < playerPaddle.y + playerPaddle.height) {
        
        ball.speed += ballSpeedIncrease; // Aumentar velocidad

        // Calcular el punto de colisión relativo al centro de la paleta
        let collidePoint = ball.y - (playerPaddle.y + playerPaddle.height / 2);
        // Normalizar el punto de colisión (valor entre -1 y 1)
        collidePoint = collidePoint / (playerPaddle.height / 2);
        // Calcular el ángulo de rebote (máximo 60 grados o PI/3 radianes)
        let angleRad = collidePoint * Math.PI / 3;

        // Actualizar las velocidades dx y dy manteniendo la magnitud de speed
        ball.dx = ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);

        // Asegurarse de que la pelota rebota en la dirección correcta (hacia la derecha)
        ball.dx = Math.abs(ball.dx); // Siempre va hacia la derecha después de golpear la paleta izquierda
        ball.x = playerPaddle.x + playerPaddle.width + ball.radius; // Asegurar que la pelota no se quede pegada
        paddleHitSound.play(); // Reproducir sonido de golpe de paleta
        playerPaddle.flashTimer = PADDLE_HIT_FLASH_DURATION; // Activar flash
        // === Generar Partículas en golpe de paleta ===
        for (let i = 0; i < 10; i++) { // 10 partículas
            const speed = Math.random() * 4 + 1;
            const angle = Math.random() * (Math.PI / 2) - Math.PI / 4; // Dispersión ligera
            particles.push(new Particle(ball.x, ball.y, Math.cos(angle) * speed * ball.dx/ball.speed, Math.sin(angle) * speed, Math.random() * 2 + 1, PADDLE_FLASH_COLOR, 20)); // Color del flash de paleta
        }
        // === Fin Generar Partículas ===
    }

    // Colisión con paleta derecha (computadora o Jugador 2)
    if (ball.x + ball.radius > computerPaddle.x &&
        ball.y + ball.radius > computerPaddle.y &&
        ball.y - ball.radius < computerPaddle.y + computerPaddle.height) {
        
        ball.speed += ballSpeedIncrease; // Aumentar velocidad

        // Calcular el punto de colisión relativo al centro de la paleta
        let collidePoint = ball.y - (computerPaddle.y + computerPaddle.height / 2);
        // Normalizar el punto de colisión (valor entre -1 y 1)
        collidePoint = collidePoint / (computerPaddle.height / 2);
        // Calcular el ángulo de rebote (máximo 60 grados o PI/3 radianes)
        let angleRad = collidePoint * Math.PI / 3;

        // Actualizar las velocidades dx y dy manteniendo la magnitud de speed
        ball.dx = ball.speed * Math.cos(angleRad);
        ball.dy = ball.speed * Math.sin(angleRad);

        // Asegurarse de que la pelota rebota en la dirección correcta (hacia la izquierda)
        ball.dx = -Math.abs(ball.dx); // Siempre va hacia la izquierda después de golpear la paleta derecha
        ball.x = computerPaddle.x - ball.radius; // Asegurar que la pelota no se quede pegada
        paddleHitSound.play(); // Reproducir sonido de golpe de paleta
        computerPaddle.flashTimer = PADDLE_HIT_FLASH_DURATION; // Activar flash
        // === Generar Partículas en golpe de paleta ===
        for (let i = 0; i < 10; i++) { // 10 partículas
            const speed = Math.random() * 4 + 1;
            const angle = Math.random() * (Math.PI / 2) - Math.PI / 4 + Math.PI; // Dispersión ligera
            particles.push(new Particle(ball.x, ball.y, Math.cos(angle) * speed * ball.dx/ball.speed, Math.sin(angle) * speed, Math.random() * 2 + 1, PADDLE_FLASH_COLOR, 20)); // Color del flash de paleta
        }
        // === Fin Generar Partículas ===
    }

    // Puntuación: Si la pelota pasa una paleta
    if (ball.x < 0) { // La pelota pasó la paleta del jugador 1 (izquierda)
        computerPaddle.score++;
        computerPaddle.scoreFlashTimer = SCORE_FLASH_DURATION; // Activar flash de puntuación
        canvasFlashTimer = CANVAS_SCORE_FLASH_DURATION; // Activar flash de fondo del canvas
        ball.trail = []; // Limpiar el rastro para evitar artefactos visuales
        resetBall(); // Reiniciar la pelota
        scoreSound.play(); // Reproducir sonido de punto
        // Generar Partículas (para el score)
        for (let i = 0; i < 20; i++) { // 20 partículas
            const angle = Math.random() * Math.PI - Math.PI / 2; // Ángulo entre -90 y 90 grados (dispersión hacia la derecha)
            const speed = Math.random() * 5 + 2; // Velocidad aleatoria
            particles.push(new Particle(canvasWidth / 2, canvasHeight / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() * 3 + 2, '#00FF00', 60)); // Verde neón, duran 1 segundo
        }
    } else if (ball.x > canvasWidth) { // La pelota pasó la paleta de la computadora/Jugador 2 (derecha)
        playerPaddle.score++;
        playerPaddle.scoreFlashTimer = SCORE_FLASH_DURATION; // Activar flash de puntuación
        canvasFlashTimer = CANVAS_SCORE_FLASH_DURATION; // Activar flash de fondo del canvas
        ball.trail = []; // Limpiar el rastro para evitar artefactos visuales
        resetBall(); // Reiniciar la pelota
        scoreSound.play(); // Reproducir sonido de punto
        // Generar Partículas (para el score)
        for (let i = 0; i < 20; i++) { // 20 partículas
            const angle = Math.random() * Math.PI + Math.PI / 2; // Ángulo entre 90 y 270 grados (dispersión hacia la izquierda)
            const speed = Math.random() * 5 + 2; // Velocidad aleatoria
            particles.push(new Particle(canvasWidth / 2, canvasHeight / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, Math.random() * 3 + 2, '#00FF00', 60)); // Verde neón, duran 1 segundo
        }
    }

    // Comprobar si hay un ganador
    if (playerPaddle.score >= maxScore) {
        winner = 'Jugador';
        gameState = 'gameOver';
        gameOverSound.play(); // Reproducir sonido de Game Over
        showOverlay(`${winner} GANA!`, 'Presiona ESPACIO para reiniciar o R para volver al menú principal', 'Reiniciar Juego', () => resetGame());
    } else if (computerPaddle.score >= maxScore) {
        // En modo de 2 jugadores, esto sería 'Jugador 2'
        winner = (gameMode === 'onePlayer') ? 'Computadora' : 'Jugador 2';
        gameState = 'gameOver';
        gameOverSound.play(); // Reproducir sonido de Game Over
        showOverlay(`${winner} GANA!`, 'Presiona ESPACIO para reiniciar o R para volver al menú principal', 'Reiniciar Juego', () => resetGame());
    }
}

// Función para dibujar todo en el canvas
function draw() {
    // Limpiar el canvas con color de flash si el temporizador está activo
    drawRect(0, 0, canvasWidth, canvasHeight, canvasFlashTimer > 0 ? CANVAS_SCORE_FLASH_COLOR : '#000'); // Fondo negro o flash

    // Dibujar la línea central punteada
    ctx.beginPath();
    ctx.setLineDash([10, 10]); // Patrón de 10px de línea, 10px de espacio
    ctx.moveTo(canvasWidth / 2, 0); // Empieza en el centro superior
    ctx.lineTo(canvasWidth / 2, canvasHeight); // Termina en el centro inferior
    ctx.strokeStyle = '#eee'; // Color de la línea (gris claro)
    ctx.lineWidth = 2; // Grosor de la línea
    ctx.stroke();
    ctx.setLineDash([]); // Restablecer el patrón de línea a sólido para otros dibujos

    // Dibujar paletas (con flash effect)
    drawRect(playerPaddle.x, playerPaddle.y, playerPaddle.width, playerPaddle.height,
             playerPaddle.flashTimer > 0 ? PADDLE_FLASH_COLOR : '#00ff00');
    drawRect(computerPaddle.x, computerPaddle.y, computerPaddle.width, computerPaddle.height,
             computerPaddle.flashTimer > 0 ? PADDLE_FLASH_COLOR : '#00ff00');

    // Dibujar el rastro de la pelota
    for (let i = 0; i < ball.trail.length; i++) {
        const trailPos = ball.trail[i];
        // Calcular la opacidad basada en la posición en el rastro (más antigua = más transparente)
        const opacity = (i + 1) / BALL_TRAIL_LENGTH * 0.5; // Ajustar 0.5 para la opacidad máxima del rastro
        ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`; // Color verde neón con opacidad variable
        ctx.beginPath();
        ctx.arc(trailPos.x, trailPos.y, ball.radius * (i / BALL_TRAIL_LENGTH * 0.7 + 0.3), 0, Math.PI * 2, false); // Tamaño decreciente
        ctx.fill();
    }

    // Dibujar pelota (la pelota principal, encima del rastro)
    drawCircle(ball.x, ball.y, ball.radius, '#00ff00'); // Verde

    // === Dibujar Partículas ===
    for (const particle of particles) {
        particle.draw();
    }
    // === Fin Dibujar Partículas ===

    // Dibujar puntuaciones (con flash effect)
    // Puntuación del Jugador 1
    if (playerPaddle.scoreFlashTimer > 0) {
        ctx.fillStyle = SCORE_FLASH_COLOR;
        ctx.font = `${30 + SCORE_FLASH_SIZE_INCREASE}px Arial`;
    } else {
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px Arial';
    }
    ctx.fillText(playerPaddle.score, canvasWidth / 4, 30);

    // Puntuación de la Computadora/Jugador 2
    if (computerPaddle.scoreFlashTimer > 0) {
        ctx.fillStyle = SCORE_FLASH_COLOR;
        ctx.font = `${30 + SCORE_FLASH_SIZE_INCREASE}px Arial`;
    } else {
        ctx.fillStyle = '#00ff00';
        ctx.font = '30px Arial';
    }
    ctx.fillText(computerPaddle.score, canvasWidth * 3 / 4, 30);

    // === Dibujar la cuenta regresiva ===
    if (gameState === 'countdown') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '100px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(countdownValue, canvasWidth / 2, canvasHeight / 2 + 30); // Centrado verticalmente
        ctx.textAlign = 'left'; // Restaurar para las puntuaciones
    }
    // === Fin Dibujar la cuenta regresiva ===

    // El mensaje de Game Over y otros overlays ahora son gestionados por el div HTML
}

// Función principal del juego
function gameLoop() {
    update(); // Actualizamos la lógica del juego (incluyendo countdown)
    draw(); // Siempre dibujamos, incluso si estamos pausados o en la pantalla de inicio
    requestAnimationFrame(gameLoop);
}

// Para controlar el movimiento de las paletas y el reinicio del juego
document.addEventListener('keydown', e => {
    switch (e.key) {
        case ' ': // Tecla ESPACIO
            e.preventDefault(); // Evitar el desplazamiento de la página
            if (gameState === 'startScreen' || gameState === 'gameOver') {
                resetGame(); // Iniciar o Reiniciar el juego (pasará a 'countdown')
            } else if (gameState === 'playing') {
                gameState = 'paused';
                playerPaddle.dy = 0; // Detener paleta jugador 1
                computerPaddle.dy = 0; // Detener paleta jugador 2/IA
                showOverlay('JUEGO PAUSADO', 'Presiona ESPACIO para reanudar o R para reiniciar', 'Reanudar Juego', () => {
                    gameState = 'playing'; // Reanudar
                    hideOverlay();
                });
            } else if (gameState === 'paused') {
                gameState = 'playing'; // Reanudar
                hideOverlay();
            }
            break;
        case 'r': // Tecla R para reiniciar (desde pausa o game over, al menú principal)
        case 'R':
            if (gameState === 'paused' || gameState === 'gameOver' || gameState === 'countdown') {
                // Reiniciar completamente a la pantalla de inicio
                gameState = 'startScreen';
                setGameMode(gameMode); // Reestablece el modo actual (también llama a resetGame, pero showOverlay lo sobrescribe)
                setDifficulty(currentDifficulty); // Reestablece la dificultad actual
                // La llamada a showOverlay se hace después de setGameMode/setDifficulty
                // para que el resetGame interno no oculte la pantalla de inicio de inmediato
                showOverlay('PONG CLÁSICO', 'Presiona ESPACIO para iniciar el juego', '', null);
            }
            break;
        case 'w':
            if (gameState === 'playing') playerPaddle.dy = -paddleSpeed;
            break;
        case 's':
            if (gameState === 'playing') playerPaddle.dy = paddleSpeed;
            break;
        case 'ArrowUp': // Jugador 2: Tecla flecha arriba
            if (gameState === 'playing' && gameMode === 'twoPlayers') {
                computerPaddle.dy = -paddleSpeed;
            }
            break;
        case 'ArrowDown': // Jugador 2: Tecla flecha abajo
            if (gameState === 'playing' && gameMode === 'twoPlayers') {
                computerPaddle.dy = paddleSpeed;
            }
            break;
    }
});

document.addEventListener('keyup', e => {
    // Si no estamos jugando o estamos en la pantalla de inicio o en countdown, no procesar soltar teclas de movimiento
    if (gameState !== 'playing') return;

    switch (e.key) {
        case 'w':
        case 's':
            playerPaddle.dy = 0; // Detener la paleta del jugador 1
            break;
        case 'ArrowUp': // Jugador 2: Tecla flecha arriba
        case 'ArrowDown': // Jugador 2: Tecla flecha abajo
            if (gameMode === 'twoPlayers') {
                computerPaddle.dy = 0; // Detener la paleta del jugador 2
            }
            break;
    }
});

// Event Listeners para los botones de dificultad
easyBtn.addEventListener('click', () => setDifficulty('easy'));
normalBtn.addEventListener('click', () => setDifficulty('normal'));
hardBtn.addEventListener('click', () => setDifficulty('hard'));

// Event Listeners para los botones de modo de juego
onePlayerBtn.addEventListener('click', () => setGameMode('onePlayer'));
twoPlayersBtn.addEventListener('click', () => setGameMode('twoPlayers'));

// Event Listener para el deslizador de volumen
volumeSlider.addEventListener('input', (e) => {
    applyVolume(e.target.value);
});

// Inicializar el modo de juego y la dificultad (y mostrar pantalla de inicio) al cargar la página
setGameMode(gameMode); // Configura el modo inicial ('onePlayer')
setDifficulty(currentDifficulty); // Configura la dificultad inicial ('normal')
loadVolume(); // Cargar el volumen guardado (si existe) y aplicarlo
showOverlay('PONG CLÁSICO', 'Presiona ESPACIO para iniciar el juego', '', null); // Muestra la pantalla de inicio
gameLoop(); // Inicia el bucle principal del juego (no actualizará el juego hasta que gameState sea 'playing' o 'countdown')