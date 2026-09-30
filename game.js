const canvas = document.getElementById( 'gameCanvas' );
const ctx = canvas.getContext( '2d' );

const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_WIDTH = 76;
const BLOCK_HEIGHT = 24;
const BLOCK_GAP = 4;
const ROW_COLORS = [ 'hotpink', 'magenta', 'red', 'yellow', 'green', 'cyan' ]; // fila 0 (arriba) a fila 5

const BLOCKS_TOP = 60;
const BLOCKS_LEFT = ( canvas.width - ( BLOCK_COLS * BLOCK_WIDTH + ( BLOCK_COLS - 1 ) * BLOCK_GAP ) ) / 2;

const state = {
  screen: 'start',      // 'start' | 'playing' | 'paused' | 'gameover' | 'victory'
  score: 0,
  lives: 3,
  ballAttached: true,    // true = la pelota está pegada a la pala, esperando lanzamiento
  paddle: { x: 350, y: 570, width: 100, height: 14, speed: 6 },
  ball: { x: 400, y: 556, radius: 8, dx: 0, dy: 0, speed: 4 },
  bricks: [],            // { x, y, width, height, color, alive }
};

function buildBricks() {
  const bricks = [];
  for ( let row = 0; row < BLOCK_ROWS; row++ ) {
    for ( let col = 0; col < BLOCK_COLS; col++ ) {
      bricks.push( {
        x: BLOCKS_LEFT + col * ( BLOCK_WIDTH + BLOCK_GAP ),
        y: BLOCKS_TOP + row * ( BLOCK_HEIGHT + BLOCK_GAP ),
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        color: ROW_COLORS[ row ],
        alive: true,
      } );
    }
  }
  return bricks;
}

function clamp( value, min, max ) {
  return Math.min( Math.max( value, min ), max );
}

const keys = { left: false, right: false };

window.addEventListener( 'keydown', ( e ) => {
  if ( state.screen === 'gameover' || state.screen === 'victory' ) {
    resetGame();
    return;
  }

  if ( e.code === 'Space' && state.screen === 'start' ) {
    state.screen = 'playing';
    return;
  }

  if ( e.key === 'p' || e.key === 'P' ) {
    if ( state.screen === 'playing' ) state.screen = 'paused';
    else if ( state.screen === 'paused' ) state.screen = 'playing';
    return;
  }

  if ( state.screen === 'paused' && ( e.key === 'r' || e.key === 'R' ) ) {
    resetGame();
    return;
  }

  if ( e.key === 'ArrowLeft' ) keys.left = true;
  if ( e.key === 'ArrowRight' ) keys.right = true;
  if ( e.code === 'Space' ) launchBall();
} );

window.addEventListener( 'keyup', ( e ) => {
  if ( e.key === 'ArrowLeft' ) keys.left = false;
  if ( e.key === 'ArrowRight' ) keys.right = false;
} );

canvas.addEventListener( 'mousemove', ( e ) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const mouseX = ( e.clientX - rect.left ) * scaleX;
  state.paddle.x = clamp( mouseX - state.paddle.width / 2, 0, canvas.width - state.paddle.width );
} );

canvas.addEventListener( 'click', () => {
  if ( state.screen === 'gameover' || state.screen === 'victory' ) {
    resetGame();
    return;
  }
  launchBall();
} );

function resetGame() {
  state.screen = 'start';
  state.score = 0;
  state.lives = 3;
  state.ballAttached = true;
  state.paddle.x = ( canvas.width - state.paddle.width ) / 2;
  state.ball.dx = 0;
  state.ball.dy = 0;
  state.bricks = buildBricks();
}

function launchBall() {
  if ( !state.ballAttached ) return;
  state.ballAttached = false;
  state.ball.dx = 0;
  state.ball.dy = -state.ball.speed;
}

function updatePaddle() {
  if ( keys.left ) state.paddle.x -= state.paddle.speed;
  if ( keys.right ) state.paddle.x += state.paddle.speed;
  state.paddle.x = clamp( state.paddle.x, 0, canvas.width - state.paddle.width );
}

function updateBall() {
  const ball = state.ball;
  const paddle = state.paddle;

  if ( state.ballAttached ) {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius;
    return;
  }

  ball.x += ball.dx;
  ball.y += ball.dy;

  // paredes laterales
  if ( ball.x - ball.radius <= 0 ) {
    ball.x = ball.radius;
    ball.dx *= -1;
  } else if ( ball.x + ball.radius >= canvas.width ) {
    ball.x = canvas.width - ball.radius;
    ball.dx *= -1;
  }

  // pared superior
  if ( ball.y - ball.radius <= 0 ) {
    ball.y = ball.radius;
    ball.dy *= -1;
  }

  // colisión con la pala: el ángulo de salida depende del punto de impacto
  const hitsPaddle =
    ball.dy > 0 &&
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width;

  if ( hitsPaddle ) {
    const relativeIntersect = ( ball.x - ( paddle.x + paddle.width / 2 ) ) / ( paddle.width / 2 );
    const maxBounceAngle = Math.PI / 3; // 60°
    const angle = clamp( relativeIntersect, -1, 1 ) * maxBounceAngle;
    ball.dx = ball.speed * Math.sin( angle );
    ball.dy = -ball.speed * Math.cos( angle );
    ball.y = paddle.y - ball.radius;
  }

  // colisión con bloques
  for ( const brick of state.bricks ) {
    if ( !brick.alive ) continue;

    const hitsBrick =
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height;

    if ( !hitsBrick ) continue;

    brick.alive = false;
    state.score += 10;

    const overlapLeft = ball.x + ball.radius - brick.x;
    const overlapRight = brick.x + brick.width - ( ball.x - ball.radius );
    const overlapTop = ball.y + ball.radius - brick.y;
    const overlapBottom = brick.y + brick.height - ( ball.y - ball.radius );
    const minOverlapX = Math.min( overlapLeft, overlapRight );
    const minOverlapY = Math.min( overlapTop, overlapBottom );

    if ( minOverlapX < minOverlapY ) {
      ball.dx *= -1;
    } else {
      ball.dy *= -1;
    }

    break; // un solo bloque por frame
  }

  if ( state.bricks.length > 0 && state.bricks.every( ( b ) => !b.alive ) ) {
    state.screen = 'victory';
  }

  // la pelota cayó por debajo de la pala sin ser golpeada: se pierde una vida
  if ( ball.y - ball.radius > paddle.y + paddle.height ) {
    loseLife();
  }
}

function loseLife() {
  state.lives -= 1;
  state.paddle.x = ( canvas.width - state.paddle.width ) / 2;
  state.ball.dx = 0;
  state.ball.dy = 0;
  state.ballAttached = true;

  if ( state.lives <= 0 ) {
    state.screen = 'gameover';
  }
}

function update() {
  if ( state.screen !== 'playing' ) return;
  updatePaddle();
  updateBall();
}

function draw() {
  ctx.clearRect( 0, 0, canvas.width, canvas.height );

  for ( const brick of state.bricks ) {
    if ( !brick.alive ) continue;
    drawSprite( ctx, `block_${ brick.color }`, brick.x, brick.y, brick.width, brick.height );
  }

  drawSprite( ctx, 'paddle', state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height );
  drawSprite( ctx, 'ball', state.ball.x - state.ball.radius, state.ball.y - state.ball.radius, state.ball.radius * 2, state.ball.radius * 2 );

  if ( state.screen === 'playing' || state.screen === 'paused' ) drawHUD();
  if ( state.screen === 'start' ) drawMessageScreen( 'Arkanoid', 'Presiona Espacio para jugar' );
  if ( state.screen === 'paused' ) drawMessageScreen( 'Pausa', 'Presiona P para reanudar o presiona R para reiniciar' );
  if ( state.screen === 'gameover' ) drawMessageScreen( 'Game Over', 'Presioná una tecla o haz click para reiniciar' );
  if ( state.screen === 'victory' ) drawMessageScreen( '¡Victoria!', 'Presioná una tecla o haz click para reiniciar' );
}

function drawHUD() {
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText( `Puntaje: ${ state.score }`, 16, 28 );
  ctx.textAlign = 'right';
  ctx.fillText( `Vidas: ${ state.lives }`, canvas.width - 16, 28 );
}

function drawMessageScreen( title, subtitle ) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect( 0, 0, canvas.width, canvas.height );

  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.font = '48px sans-serif';
  ctx.fillText( title, canvas.width / 2, canvas.height / 2 - 16 );
  ctx.font = '20px sans-serif';
  ctx.fillText( subtitle, canvas.width / 2, canvas.height / 2 + 24 );
}

function loop() {
  update();
  draw();
  requestAnimationFrame( loop );
}

loadSpritesheet( () => {
  state.bricks = buildBricks();
  loop();
} );
