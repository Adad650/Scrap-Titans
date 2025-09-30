// Utility functions
function gid(id) { return document.getElementById(id); }

function toast(m, ms = 1500) {
  const el = gid('toast');
  el.textContent = m;
  el.style.display = 'block';
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.style.display = 'none', ms);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
//
const EPS = 0.001;

// Input handling
const keys = {};
const mouse = { x: 0, y: 0, down: false };

addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'r') hardRestart();
});

addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

addEventListener('mousedown', () => { mouse.down = true; });
addEventListener('mouseup', () => { mouse.down = false; });
addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

// Audio functions
function beep(f = 440, t = 0.08, type = 'sine', vol = 0.2) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = f;
    gainNode.gain.value = vol;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioCtx.close();
    }, t * 1000);
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

const sfx = {
  jump: () => beep(523, 0.1),
  shoot: () => beep(349, 0.05, 'square'),
  reload: () => beep(392, 0.1, 'sine', 0.1),
  crate: () => beep(784, 0.2, 'sine', 0.3),
  death: () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  },
  level: () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }
};

// Game Configuration
const CONFIG = {
  // Display
  CANVAS: {
    BG_COLOR: '#071019',
    FPS_COLOR: 'white',
    FPS_FONT: '14px monospace',
    FPS_POSITION: { x: -10, y: 20 }
  },
  
  // Game World
  WORLD: {
    GRAVITY: 0.6,
    LEVEL_HEIGHT: 1000,
    SCREEN_SHAKE_DECAY: 0.9
  },
  
  // Player
  PLAYER: {
    START_X: 40,
    START_Y: 0,
    MAX_HEALTH: 100,
    JUMP_FORCE: -10,
    MOVE_SPEED: 5,
    AIR_RESISTANCE: 0.9,
    GROUND_FRICTION: 0.85
  },
  
  // Enemy
  ENEMY: {
    SPAWN_INTERVAL: 5, // seconds
    MAX_ENEMIES: 10,
    TYPES: {
      WALKER: {
        SPEED: 2,
        HEALTH: 30,
        DAMAGE: 10,
        ATTACK_RANGE: 100,
        ATTACK_COOLDOWN: 2,
        SCORE: 100
      },
      JUMPER: {
        SPEED: 1.5,
        JUMP_FORCE: -8,
        HEALTH: 50,
        DAMAGE: 15,
        ATTACK_RANGE: 120,
        ATTACK_COOLDOWN: 3,
        SCORE: 200
      }
    }
  },
  
  // Projectiles
  PROJECTILE: {
    SPEED: 10,
    LIFETIME: 2, // seconds
    PLAYER_COLOR: '#ff6b6b',
    ENEMY_COLOR: '#6bff6b',
    RADIUS: 5
  },
  
  // UI
  UI: {
    HEALTH_BAR_WIDTH: 200,
    HEALTH_BAR_HEIGHT: 20,
    HEALTH_BAR_MARGIN: 20,
    SCORE_POSITION: { x: 20, y: 50 },
    AMMO_POSITION: { x: 20, y: 80 }
  }
};

// Game state
const world = {
  paused: true,
  firstRun: true,
  gravity: CONFIG.WORLD.GRAVITY,
  time: 0,
  hitEffects: [],
  bullets: [],
  enemies: [],
  levelStartX: 0,
  levelLength: 0,
  platforms: [],
  spikes: [],
  crates: [],
  playerBullets: [],
  enemyBullets: [],
  particles: []
};

// Player setup
const player = {
  x: 40, y: 420, w: 26, h: 34,
  vx: 0, vy: 0,
  prevX: 40, prevY: 420,
  onGround: false,
  standingOn: null,
  facing: 1,
  base: { hp: 150, speed: 2.8, armor: 0, firerate: 0, dmg: 12, kbResist: 0 },
  parts: {},
  hp: 200,
  maxHp: 200,
  invincible: false,
  invincibleTimer: 0,
  sprite: null,
  coyote: 0,
  coyoteTime: 0.1,
  jumpVel: -12,
  lowJumpGravity: 0.5,
  stickTimer: 0,
  stickTime: 0.2,
  buffer: 0,
  jumpBuffer: 0.1,
  
  equip: function(p) {
    this.parts[p.slot] = p;
    this.rebuildSprite();
    this.recalc();
  },
  
  unequip: function(slot) {
    delete this.parts[slot];
    this.rebuildSprite();
    this.recalc();
  },
  
  recalc: function() {
    this.maxHp = this.base.hp;
    this.speed = this.base.speed;
    this.armor = this.base.armor;
    this.firerate = this.base.firerate;
    this.dmg = this.base.dmg;
    this.kbResist = this.base.kbResist;
    
    for (const part of Object.values(this.parts)) {
      if (part.stats) {
        for (const [stat, val] of Object.entries(part.stats)) {
          if (stat in this) this[stat] += val;
          if (stat in this.base) this[stat] += val;
        }
      }
    }
    
    this.hp = Math.min(this.hp, this.maxHp);
  }
};

// Initialize player with default equipment
player.equip({ slot: 'torso', name: 'Light Torso', stats: { hp: 50, speed: 0.05 }, art: 'light' });
player.equip({ slot: 'rightArm', name: 'Blaster Arm', stats: { dmg: 14, rof: 7, spread: 0.03, mag: 7, reload: 1.0 }, art: 'blaster' });
player.equip({ slot: 'legs', name: 'Sprinter Legs', stats: { speed: 0.20 }, art: 'sprinter' });

// Game functions
function diff() { return Math.abs(player.x - player.prevX); }
function maxRise() { return Math.sqrt(2 * world.gravity * player.jumpVel * player.jumpVel); }
function adjustNy(y, ny) { return y + (player.onGround ? 0 : Math.min(0, ny - y)); }
function maxHorizontalReach(dy) { return Math.sqrt(2 * player.speed * player.speed * Math.abs(dy) / world.gravity); }
function reachableGap(y, ny) { return Math.abs(ny - y) <= maxRise() && Math.abs(ny - y) <= maxHorizontalReach(Math.abs(ny - y)); }
function canSpawnEnemyOn(p) { return p.y < 400 && p.w > 80 && Math.abs(p.x - player.x) > 200; }

// Enemy types with different behaviors and stats
const ENEMY_TYPES = {
  WALKER: {
    speed: 0.5,
    health: 20,
    damage: 5,
    color: '#ff6b6b',
    size: 24,
    attackRange: 40,
    attackCooldown: 1.5,
    score: 200
  },
  JUMPER: {
    speed: 1.2,
    health: 20,
    damage: 15,
    color: '#ff9e7d',
    size: 20,
    jumpForce: -10,
    jumpCooldown: 2,
    score: 200
  },
  TANK: {
    speed: 0.4,
    health: 100,
    damage: 25,
    color: '#9b59b6',
    size: 32,
    attackRange: 50,
    attackCooldown: 2.5,
    score: 250
  }
};

// UI elements
const ui = {
  hpBar: gid('hpBar'),
  slots: {
    head: gid('slotHead'),
    torso: gid('slotTorso'),
    leftArm: gid('slotLeft'),
    rightArm: gid('slotRight'),
    legs: gid('slotLegs')
  },
  ammo: gid('ammo'),
  score: gid('score'),
  dist: gid('dist'),
  kills: gid('kills'),
  crates: gid('crates'),
  reloadChip: gid('reloadChip')
};

// Game initialization
function initGame() {
  try {
    debugLog('Initializing game...');
    
    // Reset player
    player.x = 40;
    player.y = 420;
    player.vx = 0;
    player.vy = 0;
    player.hp = player.maxHp;
    player.invincible = false;
    player.invincibleTimer = 0;
    
    // Reset world
    world.enemies = [];
    world.bullets = [];
    world.platforms = [];
    world.spikes = [];
    world.crates = [];
    world.time = 0;
    world.score = 0;
    world.distance = 0;
    world.kills = 0;
    world.cratesOpened = 0;
    world.gameOver = false;
    world.paused = false;
    
    // Hide game over screen
    gid('gameOver').style.display = 'none';
    
    // Build the level
    buildLevel();
  
    // Spawn initial enemies
    for (let i = 0; i < 3; i++) {
      spawnEnemy('WALKER', 500 + i * 200, 0);
    }
  
    debugLog('Game initialization complete');
    return true;
  } catch (e) {
    debugLog('Error in initGame: ' + e.message);
    console.error(e);
    return false;
  }
}

// Build the game level
function buildLevel() {
  // Add ground platform
  world.platforms.push({ x: 0, y: 540, w: 5000, h: 60 });
  
  // Add some platforms
  world.platforms.push(
    { x: 200, y: 440, w: 120, h: 20 },
    { x: 400, y: 340, w: 120, h: 20 },
    { x: 600, y: 440, w: 120, h: 20 },
    { x: 800, y: 340, w: 120, h: 20 },
    { x: 1000, y: 440, w: 120, h: 20 },
    { x: 1200, y: 340, w: 120, h: 20 }
  );
  
  // Add some spikes
  world.spikes.push(
    { x: 350, y: 520, w: 20, h: 20 },
    { x: 750, y: 520, w: 20, h: 20 },
    { x: 1150, y: 520, w: 20, h: 20 }
  );
  
  // Add some crates
  world.crates.push(
    { x: 300, y: 380, w: 32, h: 32, type: 'weapon' },
    { x: 700, y: 380, w: 32, h: 32, type: 'armor' },
    { x: 1100, y: 380, w: 32, h: 32, type: 'health' }
  );
  
  // Set level boundaries
  world.levelStartX = 0;
  world.levelLength = 2000;
}

// Update UI elements
function updateUI() {
  // Update health bar
  const hpPercent = (player.hp / player.maxHp) * 100;
  ui.hpBar.style.width = `${Math.max(0, hpPercent)}%`;
  
  // Update ammo counter
  const currentWeapon = player.parts.rightArm || { stats: { mag: 0, ammo: 0 } };
  ui.ammo.textContent = `${currentWeapon.stats.ammo || 0}/${currentWeapon.stats.mag || 0}`;
  
  // Update stats
  ui.score.textContent = world.score;
  ui.dist.textContent = Math.floor(world.distance / 100);
  ui.kills.textContent = world.kills;
  ui.crates.textContent = world.cratesOpened;
  
  // Update equipment slots
  for (const [slot, element] of Object.entries(ui.slots)) {
    if (player.parts[slot]) {
      element.textContent = player.parts[slot].name;
    } else {
      element.textContent = '—';
    }
  }
}

// Game step function - runs every frame
function step(dt) {
  if (world.paused) return;
  
  // Update world time
  world.time += dt;
  world.distance += Math.abs(player.vx) * dt * 10;
  
  // Update player
  updatePlayer(dt);
  
  // Update enemies
  for (const enemy of world.enemies) {
    updateEnemy(enemy, dt);
  }
  
  // Update bullets
  updateBullets(dt);
  
  // Update particles
  updateParticles(dt);
  
  // Update UI
  updateUI();
  
  // Check for win/lose conditions
  if (player.hp <= 0) {
    gameOver();
  }
}

// Update player state
function updatePlayer(dt) {
  // Save previous position
  player.prevX = player.x;
  player.prevY = player.y;
  
  // Handle input
  const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const isJumping = keys[' '] || keys.w || keys.arrowup;
  
  // Apply movement
  if (moveX !== 0) {
    player.vx = moveX * player.speed;
    player.facing = moveX > 0 ? 1 : -1;
  } else {
    player.vx *= 0.9; // Friction
  }
  
  // Apply gravity
  player.vy += world.gravity;
  
  // Jumping
  if (isJumping && player.onGround) {
    player.vy = player.jumpVel;
    player.onGround = false;
    sfx.jump();
  }
  
  // Update position
  player.x += player.vx;
  player.y += player.vy;
  
  // Check collisions
  checkCollisions();
  
  // Update invincibility
  if (player.invincible) {
    player.invincibleTimer -= dt;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
      player.sprite.alpha = 1.0;
    } else {
      // Blink effect
      player.sprite.alpha = (Math.sin(world.time * 10) > 0) ? 0.5 : 0.8;
    }
  }
}

// Check and handle collisions
function checkCollisions() {
  // Check platform collisions
  player.onGround = false;
  
  for (const platform of world.platforms) {
    if (player.x < platform.x + platform.w &&
        player.x + player.w > platform.x &&
        player.y < platform.y + platform.h &&
        player.y + player.h > platform.y) {
      
      // Calculate overlap on each side
      const overlapX = Math.min(
        player.x + player.w - platform.x,
        platform.x + platform.w - player.x
      );
      
      const overlapY = Math.min(
        player.y + player.h - platform.y,
        platform.y + platform.h - player.y
      );
      
      // Resolve collision on the smallest overlap
      if (overlapX < overlapY) {
        if (player.x < platform.x) {
          player.x = platform.x - player.w;
        } else {
          player.x = platform.x + platform.w;
        }
        player.vx = 0;
      } else {
        if (player.y < platform.y) {
          player.y = platform.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else {
          player.y = platform.y + platform.h;
          player.vy = 0;
        }
      }
    }
  }
  
  // Check spike collisions
  for (const spike of world.spikes) {
    if (aabb(player, spike) && !player.invincible) {
      takeDamage(50);
      // Knockback
      player.vx = (player.x < spike.x ? -1 : 1) * 10;
      player.vy = -5;
      break;
    }
  }
  
  // Check crate collisions
  for (let i = world.crates.length - 1; i >= 0; i--) {
    const crate = world.crates[i];
    if (aabb(player, crate)) {
      world.crates.splice(i, 1);
      world.cratesOpened++;
      sfx.crate();
      
      // Apply crate effect
      switch (crate.type) {
        case 'health':
          player.hp = Math.min(player.maxHp, player.hp + 50);
          toast('+50 Health!');
          break;
        case 'weapon':
          // Upgrade weapon
          const weapon = {
            name: 'Upgraded Blaster',
            slot: 'rightArm',
            stats: {
              dmg: 20,
              rof: 10,
              spread: 0.02,
              mag: 12,
              reload: 0.8
            },
            art: 'blaster2'
          };
          player.equip(weapon);
          toast('Weapon Upgraded!');
          break;
        case 'armor':
          // Upgrade armor
          const armor = {
            name: 'Heavy Torso',
            slot: 'torso',
            stats: {
              hp: 100,
              speed: -0.03,
              armor: 10
            },
            art: 'heavy'
          };
          player.equip(armor);
          toast('Armor Upgraded!');
          break;
      }
    }
  }
}

// Handle player taking damage
function takeDamage(amount) {
  if (player.invincible) return;
  
  // Apply armor reduction
  const damage = Math.max(1, amount - (player.armor || 0));
  player.hp -= damage;
  
  // Visual feedback
  player.invincible = true;
  player.invincibleTimer = 1.5;
  
  // Screen shake
  world.shake = 10;
  
  // Sound
  sfx.hit();
  
  // Check for death
  if (player.hp <= 0) {
    player.hp = 0;
    gameOver();
  }
}

// Game over handler
function gameOver() {
  world.paused = true;
  gid('gameOver').style.display = 'flex';
  sfx.death();
}

// Hard restart the game
function hardRestart() {
  gid('gameOver').style.display = 'none';
  initGame();
  world.paused = false;
}

// Debug function to log to both console and screen
function debugLog(message) {
  console.log(message);
  const debugDiv = document.getElementById('debug') || (() => {
    const div = document.createElement('div');
    div.id = 'debug';
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.left = '10px';
    div.style.color = 'white';
    div.style.fontFamily = 'monospace';
    div.style.zIndex = '1000';
    div.style.backgroundColor = 'rgba(0,0,0,0.7)';
    div.style.padding = '10px';
    document.body.appendChild(div);
    return div;
  })();
  
  debugDiv.textContent += message + '\n';
  debugDiv.scrollTop = debugDiv.scrollHeight;
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
  debugLog('Page loaded, initializing game...');
  try {
    // Set up canvas
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Initialize game state
    debugLog('Initializing game state...');
    try {
      initGame();
      debugLog('Game initialized successfully');
    } catch (e) {
      debugLog('Error initializing game: ' + e.message);
      console.error(e);
      return;
    }
    
    // Main game loop
    function gameLoop(timestamp) {
      try {
        if (!world.paused && !world.gameOver) {
          // Calculate delta time
          const deltaTime = (timestamp - lastTime) / 1000;
          lastTime = timestamp;
          
          // Update FPS counter
          frameCount++;
          if (timestamp - lastFpsUpdate >= 1000) {
            fps = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdate));
            frameCount = 0;
            lastFpsUpdate = timestamp;
          }
          
          // Update game state
          step(deltaTime);
          
          // Draw everything
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          draw(ctx);
          
          // Draw FPS
          ctx.fillStyle = CONFIG.CANVAS.FPS_COLOR;
          ctx.font = CONFIG.CANVAS.FPS_FONT;
          ctx.textAlign = 'right';
          ctx.fillText(`FPS: ${fps}`, canvas.width + CONFIG.CANVAS.FPS_POSITION.x, canvas.height + CONFIG.CANVAS.FPS_POSITION.y);
        }
        
        // Request next frame
        requestAnimationFrame(gameLoop);
      } catch (error) {
        console.error('Game loop error:', error);
        // Try to recover by restarting the game
        try {
          world.paused = true;
          alert('An error occurred. The game will try to recover.');
          initGame();
          world.paused = false;
        } catch (e) {
          console.error('Recovery failed:', e);
          alert('Failed to recover from error. Please refresh the page.');
        }
      }
    }
    
    // Start the game loop
    debugLog('Starting game loop...');
    try {
      requestAnimationFrame(gameLoop);
      debugLog('Game loop started');
    } catch (e) {
      debugLog('Error starting game loop: ' + e.message);
      console.error(e);
    }
  } catch (e) {
    debugLog('Error in game initialization: ' + e.message);
    console.error(e);
  }
});
// Draw function
function draw(ctx) {
  if (!ctx) {
    console.error('draw() called without valid context');
    return;
  }
  // Draw background
  ctx.fillStyle = CONFIG.CANVAS.BG_COLOR;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // Draw platforms
  ctx.fillStyle = '#2c3e50';
  for (const platform of world.platforms) {
    // Only draw platforms that are in view
    if (isInView(platform)) {
      ctx.fillRect(
        platform.x - world.cameraX,
        platform.y - world.cameraY,
        platform.w,
        platform.h
      );
    }
  }
  
  // Draw spikes
  ctx.fillStyle = '#e74c3c';
  for (const spike of world.spikes) {
    if (isInView(spike)) {
      ctx.beginPath();
      ctx.moveTo(spike.x - world.cameraX, spike.y + spike.h - world.cameraY);
      ctx.lineTo(spike.x + spike.w / 2 - world.cameraX, spike.y - world.cameraY);
      ctx.lineTo(spike.x + spike.w - world.cameraX, spike.y + spike.h - world.cameraY);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Draw crates
  for (const crate of world.crates) {
    if (isInView(crate)) {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(
        crate.x - world.cameraX,
        crate.y - world.cameraY,
        crate.w,
        crate.h
      );
      
      // Draw crate details based on type
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let label = '';
      switch (crate.type) {
        case 'health': label = 'H'; break;
        case 'weapon': label = 'W'; break;
        case 'armor': label = 'A'; break;
      }
      
      ctx.fillText(
        label,
        crate.x + crate.w / 2 - world.cameraX,
        crate.y + crate.h / 2 - world.cameraY
      );
    }
  }
  
  // Draw player
  if (!player.invincible || Math.floor(world.time * 10) % 2 === 0) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(
      player.x - world.cameraX,
      player.y - world.cameraY,
      player.w,
      player.h
    );
    
    // Draw player direction indicator
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (player.facing > 0) {
      ctx.arc(
        player.x + player.w + 5 - world.cameraX,
        player.y + player.h / 2 - world.cameraY,
        3,
        0,
        Math.PI * 2
      );
    } else {
      ctx.arc(
        player.x - 5 - world.cameraX,
        player.y + player.h / 2 - world.cameraY,
        3,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();
  }
  
  // Draw enemies
  for (const enemy of world.enemies) {
    if (isInView(enemy)) {
      ctx.fillStyle = enemy.type === 'WALKER' ? '#e74c3c' : 
                     enemy.type === 'JUMPER' ? '#e67e22' : '#9b59b6';
      
      ctx.fillRect(
        enemy.x - world.cameraX,
        enemy.y - world.cameraY,
        enemy.w,
        enemy.h
      );
      
      // Draw health bar
      if (enemy.hp < enemy.maxHp) {
        const healthPercent = enemy.hp / enemy.maxHp;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(
          enemy.x - world.cameraX,
          enemy.y - 10 - world.cameraY,
          enemy.w * healthPercent,
          3
        );
        ctx.strokeStyle = '#27ae60';
        ctx.strokeRect(
          enemy.x - world.cameraX,
          enemy.y - 10 - world.cameraY,
          enemy.w,
          3
        );
      }
    }
  }
  
  // Draw bullets
  for (const bullet of world.bullets) {
    ctx.fillStyle = bullet.enemy ? '#e74c3c' : '#f1c40f';
    ctx.beginPath();
    ctx.arc(
      bullet.x - world.cameraX,
      bullet.y - world.cameraY,
      bullet.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  
  // Draw particles
  for (const particle of world.particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.alpha;
    ctx.fillRect(
      particle.x - world.cameraX,
      particle.y - world.cameraY,
      particle.size,
      particle.size
    );
  }
  ctx.globalAlpha = 1;
  
  // Draw screen shake effect
  if (world.shake > 0) {
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * world.shake,
      (Math.random() - 0.5) * world.shake
    );
    world.shake *= 0.9;
    if (world.shake < 0.1) world.shake = 0;
  }
  
  // Draw HUD
  drawHUD(ctx);
  
  // Restore canvas state if we applied screen shake
  if (world.shake > 0) {
    ctx.restore();
  }
}

// Draw HUD elements
function drawHUD(ctx) {
  // Draw health text
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`HP: ${Math.ceil(player.hp)}/${player.maxHp}`, 20, 20);
  
  // Draw score
  ctx.textAlign = 'right';
  ctx.fillText(`Score: ${world.score}`, ctx.canvas.width - 20, 20);
  
  // Draw ammo
  const weapon = player.parts.rightArm;
  if (weapon) {
    ctx.textAlign = 'right';
    ctx.fillText(
      `Ammo: ${weapon.ammo || 0}/${weapon.stats.mag || 0}`,
      ctx.canvas.width - 20,
      45
    );
  }
}

// Check if an object is in the current view
function isInView(obj) {
  return (
    obj.x + obj.w > world.cameraX &&
    obj.x < world.cameraX + ctx.canvas.width &&
    obj.y + obj.h > world.cameraY &&
    obj.y < world.cameraY + ctx.canvas.height
  );
}

// Update camera to follow player
function updateCamera() {
  // Center camera on player with some lookahead
  const targetX = player.x + (player.facing * 100) - (ctx.canvas.width / 2);
  const targetY = player.y - (ctx.canvas.height / 3);
  
  // Smooth camera movement
  world.cameraX += (targetX - world.cameraX) * 0.1;
  world.cameraY += (targetY - world.cameraY) * 0.1;
  
  // Keep camera within level bounds
  world.cameraX = Math.max(0, Math.min(world.levelLength - ctx.canvas.width, world.cameraX));
  world.cameraY = Math.max(0, Math.min(world.levelHeight - ctx.canvas.height, world.cameraY));
}

// Update bullets
function updateBullets(dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const bullet = world.bullets[i];
    
    // Update position
    bullet.x += bullet.vx * dt * 60;
    bullet.y += bullet.vy * dt * 60;
    
    // Check if bullet is out of bounds
    if (bullet.x < 0 || bullet.x > world.levelLength ||
        bullet.y < 0 || bullet.y > world.levelHeight) {
      world.bullets.splice(i, 1);
      continue;
    }
    
    // Check for collisions
    if (bullet.enemy) {
      // Player hit by enemy bullet
      if (aabb(bullet, player) && !player.invincible) {
        takeDamage(bullet.damage);
        world.bullets.splice(i, 1);
      }
    } else {
      // Check if bullet hit an enemy
      let hit = false;
      for (const enemy of world.enemies) {
        if (aabb(bullet, enemy)) {
          enemy.hp -= bullet.damage;
          hit = true;
          
          // Create hit effect
          createHitEffect(
            bullet.x,
            bullet.y,
            bullet.vx > 0 ? 1 : -1,
            bullet.enemy
          );
          
          // Check if enemy is dead
          if (enemy.hp <= 0) {
            world.score += enemy.score || 100;
            world.kills++;
            createExplosion(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
            const index = world.enemies.indexOf(enemy);
            if (index > -1) {
              world.enemies.splice(index, 1);
            }
          }
          
          break;
        }
      }
      
      if (hit) {
        world.bullets.splice(i, 1);
      }
    }
  }
}

// Create hit effect
function createHitEffect(x, y, direction, isEnemy) {
  for (let i = 0; i < 5; i++) {
    world.particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 3 + direction * 2,
      vy: (Math.random() - 0.5) * 3 - 2,
      size: Math.random() * 3 + 1,
      color: isEnemy ? '#ff6b6b' : '#f1c40f',
      alpha: 1,
      life: 1
    });
  }
}

// Create explosion effect
function createExplosion(x, y) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    world.particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color: ['#f1c40f', '#e67e22', '#e74c3c'][Math.floor(Math.random() * 3)],
      alpha: 1,
      life: 1
    });
  }
  
  // Play explosion sound
  sfx.explosion();
}

// Update particles
function updateParticles(dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    
    // Update position
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    
    // Apply gravity
    p.vy += 0.1 * dt * 60;
    
    // Update life
    p.life -= 0.02 * dt * 60;
    p.alpha = p.life;
    
    // Remove dead particles
    if (p.life <= 0) {
      world.particles.splice(i, 1);
    }
  }
}

// Fire weapon
function fireWeapon() {
  const weapon = player.parts.rightArm;
  if (!weapon || !weapon.stats) return;
  
  // Check if weapon is ready to fire
  if (weapon.cooldown > 0) return;
  if (weapon.ammo <= 0 && weapon.stats.mag > 0) {
    // Auto-reload if out of ammo
    if (!weapon.reloading) {
      reloadWeapon();
    }
    return;
  }
  
  // Calculate bullet direction (towards mouse)
  const dx = mouse.x + world.cameraX - (player.x + player.w / 2);
  const dy = mouse.y + world.cameraY - (player.y + player.h / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize direction
  const dirX = dx / dist;
  const dirY = dy / dist;
  
  // Add some spread
  const spread = weapon.stats.spread || 0.1;
  const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * spread;
  const speed = 10;
  
  // Create bullet
  world.bullets.push({
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 3,
    damage: weapon.stats.dmg || 10,
    enemy: false
  });
  
  // Update ammo
  if (weapon.stats.mag > 0) {
    weapon.ammo--;
  }
  
  // Set cooldown
  weapon.cooldown = 1 / (weapon.stats.rof || 5);
  
  // Play sound
  sfx.shoot();
  
  // Recoil
  player.vx -= Math.cos(angle) * 0.5;
  player.vy -= Math.sin(angle) * 0.5;
}

// Reload weapon
function reloadWeapon() {
  const weapon = player.parts.rightArm;
  if (!weapon || !weapon.stats || !weapon.stats.mag) return;
  
  if (weapon.reloading) return;
  
  weapon.reloading = true;
  ui.reloadChip.style.display = 'inline-block';
  
  // Play reload sound
  sfx.reload();
  
  // Reload after delay
  setTimeout(() => {
    if (weapon) {
      weapon.ammo = weapon.stats.mag;
      weapon.reloading = false;
      ui.reloadChip.style.display = 'none';
    }
  }, (weapon.stats.reload || 1) * 1000);
}

// Spawn enemy
function spawnEnemy(type, x, y) {
  const enemyType = ENEMY_TYPES[type] || ENEMY_TYPES.WALKER;
  
  const enemy = {
    x: x,
    y: y,
    w: enemyType.size,
    h: enemyType.size,
    vx: 0,
    vy: 0,
    type: type,
    hp: enemyType.health,
    maxHp: enemyType.health,
    damage: enemyType.damage,
    speed: enemyType.speed,
    direction: Math.random() > 0.5 ? 1 : -1,
    state: 'idle', // 'idle', 'walking', 'attacking', 'hurt'
    stateTimer: 0,
    attackCooldown: 0,
    score: enemyType.score || 100
  };
  
  // Add AI behavior based on type
  if (type === 'WALKER') {
    enemy.update = function(dt) {
      // Simple patrolling behavior
      this.vx = this.direction * this.speed;
      
      // Change direction if hitting a wall or edge
      if (this.x <= 0 || this.x + this.w >= world.levelLength) {
        this.direction *= -1;
      }
      
      // Apply gravity
      this.vy += world.gravity;
      
      // Update position
      this.x += this.vx;
      this.y += this.vy;
      
      // Simple collision with platforms
      for (const platform of world.platforms) {
        if (this.x < platform.x + platform.w &&
            this.x + this.w > platform.x &&
            this.y < platform.y + platform.h &&
            this.y + this.h > platform.y) {
          
          // Stop falling when landing on a platform
          if (this.vy > 0 && this.y + this.h < platform.y + platform.h) {
            this.y = platform.y - this.h;
            this.vy = 0;
          }
        }
      }
      
      // Attack player if in range
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 200) {
        // Face player
        this.direction = dx > 0 ? 1 : -1;
        
        // Attack if close enough
        if (dist < 50) {
          if (this.attackCooldown <= 0) {
            // Melee attack
            if (aabb({
              x: this.x + (this.direction > 0 ? this.w : -30),
              y: this.y,
              w: 30,
              h: this.h
            }, player)) {
              player.takeDamage(this.damage);
            }
            
            this.attackCooldown = enemyType.attackCooldown || 1.5;
          }
        }
      }
      
      // Update cooldowns
      if (this.attackCooldown > 0) {
        this.attackCooldown -= dt;
      }
    };
  } else if (type === 'JUMPER') {
    // Jumper AI (jumps towards player)
    enemy.jumpCooldown = 0;
    
    enemy.update = function(dt) {
      // Apply gravity
      this.vy += world.gravity;
      
      // Update position
      this.x += this.vx;
      this.y += this.vy;
      
      // Simple collision with platforms
      let onGround = false;
      for (const platform of world.platforms) {
        if (this.x < platform.x + platform.w &&
            this.x + this.w > platform.x &&
            this.y < platform.y + platform.h &&
            this.y + this.h > platform.y) {
          
          // Stop falling when landing on a platform
          if (this.vy > 0 && this.y + this.h < platform.y + platform.h) {
            this.y = platform.y - this.h;
            this.vy = 0;
            onGround = true;
          }
        }
      }
      
      // Track player
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 300) {
        // Face player
        this.direction = dx > 0 ? 1 : -1;
        
        // Jump towards player
        if (onGround && this.jumpCooldown <= 0) {
          this.vy = -12;
          this.vx = this.direction * 4;
          this.jumpCooldown = enemyType.jumpCooldown || 2;
        }
        
        // Attack if close enough
        if (dist < 40) {
          player.takeDamage(this.damage);
        }
      }
      
      // Update cooldowns
      if (this.jumpCooldown > 0) {
        this.jumpCooldown -= dt;
      }
    };
  } else if (type === 'TANK') {
    // Tank AI (shoots at player)
    enemy.shootCooldown = 0;
    
    enemy.update = function(dt) {
      // Apply gravity
      this.vy += world.gravity;
      
      // Update position
      this.x += this.vx;
      this.y += this.vy;
      
      // Simple collision with platforms
      let onGround = false;
      for (const platform of world.platforms) {
        if (this.x < platform.x + platform.w &&
            this.x + this.w > platform.x &&
            this.y < platform.y + platform.h &&
            this.y + this.h > platform.y) {
          
          // Stop falling when landing on a platform
          if (this.vy > 0 && this.y + this.h < platform.y + platform.h) {
            this.y = platform.y - this.h;
            this.vy = 0;
            onGround = true;
          }
        }
      }
      
      // Track player
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 400) {
        // Face player
        this.direction = dx > 0 ? 1 : -1;
        
        // Shoot at player
        if (this.shootCooldown <= 0) {
          // Calculate direction to player
          const angle = Math.atan2(dy, dx);
          
          // Create bullet
          world.bullets.push({
            x: this.x + this.w / 2,
            y: this.y + this.h / 2,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            radius: 5,
            damage: this.damage,
            enemy: true
          });
          
          this.shootCooldown = enemyType.attackCooldown || 2.5;
          
          // Recoil
          this.vx = -Math.cos(angle) * 2;
          this.vy = -Math.sin(angle) * 2;
        }
      }
      
      // Update cooldowns
      if (this.shootCooldown > 0) {
        this.shootCooldown -= dt;
      }
    };
  }
  
  world.enemies.push(enemy);
  return enemy;
}

// Initialize camera and world properties
// Initialize world properties
world.cameraX = 0;
world.cameraY = 0;
world.levelHeight = CONFIG.WORLD.LEVEL_HEIGHT;
world.particles = [];
world.shake = 0;

// Game loop variables
let last = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
let fps = 0;

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Initialize game state
function initGame() {
  // Reset player
  player.x = 40;
  player.y = 420;
  player.vx = 0;
  player.vy = 0;
  player.hp = player.maxHp;
  player.invincible = false;
  player.invincibleTimer = 0;
  
  // Reset world
  world.enemies = [];
  world.bullets = [];
  world.platforms = [];
  world.spikes = [];
  world.crates = [];
  world.time = 0;
  world.score = 0;
  world.distance = 0;
  world.kills = 0;
  world.cratesOpened = 0;
  
  // Build the level
  buildLevel();
  
  // Hide game over screen
  gid('gameOver').style.display = 'none';
  
  // Start the game
  world.paused = false;
  last = performance.now();
  requestAnimationFrame(loop);
}

// Main game loop
function loop(t) {
  try {
    // Calculate delta time with upper bound to prevent physics issues
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    
    // Update FPS counter
    frameCount++;
    if (t - lastFpsUpdate > 1000) {
      fps = Math.round((frameCount * 1000) / (t - lastFpsUpdate));
      frameCount = 0;
      lastFpsUpdate = t;
    }
    
    if (!world.paused) {
      // Update game state
      step(dt);
      
      // Update camera
      updateCamera();
    }
    
    // Draw everything
    draw(ctx);
    
    // Continue the loop
    requestAnimationFrame(loop);
    
  } catch (error) {
    console.error('Game loop error:', error);
    // Try to recover by restarting the game
    try {
      world.paused = true;
      alert('An error occurred. The game will try to recover.');
      initGame();
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      // If recovery fails, just stop the game
      world.paused = true;
    }
  }
    last = t;
    
    // Update FPS counter
    frameCount++;
    if (t - lastFpsUpdate > 1000) {
      fps = Math.round((frameCount * 1000) / (t - lastFpsUpdate));
      frameCount = 0;
      lastFpsUpdate = t;
      // Uncomment to log FPS (helpful for debugging)
      // console.log('FPS:', fps);
    }
    
    // Only update game logic if not paused
    if (!world.paused) {
      // Split updates into smaller chunks for stability
      const maxStep = 0.016; // ~60 FPS
      let steps = Math.ceil(dt / maxStep);
      steps = Math.min(5, Math.max(1, steps)); // Limit to prevent freezing
      
      for (let i = 0; i < steps; i++) {
        const stepDt = dt / steps;
        step(stepDt);
        fire(stepDt);
      }
      
      draw();
    }
  } catch (error) {
    console.error('Game loop error:', error);
    // Try to recover by restarting the game
    try {
      world.paused = true;
      alert('An error occurred. The game will try to recover.');
      hardRestart();
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      // If we can't recover, at least keep the game running
      world.paused = true;
    }
  } finally {
    // Always request the next frame, even if there was an error
    requestAnimationFrame(loop);
  }
}

// Initialize with error handling
try {
  world.firstRun = true;
  world.paused = true;
  
  // Add a small delay before starting the game loop
  setTimeout(() => {
    try {
      showScreen('main-menu');
      // Start the game loop with a small delay to ensure everything is loaded
      setTimeout(() => requestAnimationFrame(loop), 100);
    } catch (error) {
      console.error('Initialization error:', error);
      alert('Failed to initialize the game. Please refresh the page.');
    }
  }, 100);
} catch (error) {
  console.error('Fatal initialization error: Please refresh the page', error);
  alert('A fatal error occurred during initialization. Please refresh the page.');
}
