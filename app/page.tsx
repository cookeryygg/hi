"use client";

import { useEffect, useRef, useState } from "react";

type Enemy = {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  nextShot: number;
  muzzleUntil: number;
};

type GameState = {
  x: number;
  y: number;
  dir: number;
  started: boolean;
  victory: boolean;
  defeated: boolean;
  kills: number;
  health: number;
  lastFrame: number;
};

const WORLD = [
  "111111111111",
  "100000000001",
  "101011101101",
  "100010000001",
  "101110111101",
  "100000100001",
  "101010101101",
  "100010000001",
  "101110111101",
  "100000000001",
  "100101000001",
  "111111111111",
];

const TARGETS = [
  { id: 1, x: 5.5, y: 1.5 },
  { id: 2, x: 9.5, y: 3.5 },
  { id: 3, x: 2.5, y: 5.5 },
  { id: 4, x: 8.5, y: 5.5 },
  { id: 5, x: 4.5, y: 9.5 },
  { id: 6, x: 9.5, y: 9.5 },
];

const FOV = Math.PI / 3;
const TOTAL_TARGETS = TARGETS.length;
const START_X = 1.5;
const START_Y = 1.5;

function isOpenFloor(x: number, y: number) {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  return (
    mapY >= 0 &&
    mapY < WORLD.length &&
    mapX >= 0 &&
    mapX < WORLD[mapY].length &&
    WORLD[mapY][mapX] === "0"
  );
}

function nearestOpenSpawn(x: number, y: number, occupied: Set<string>) {
  const options: { x: number; y: number; distance: number }[] = [];

  WORLD.forEach((row, mapY) => {
    [...row].forEach((cell, mapX) => {
      const key = `${mapX},${mapY}`;
      if (cell === "0" && !occupied.has(key)) {
        const spawnX = mapX + 0.5;
        const spawnY = mapY + 0.5;
        options.push({
          x: spawnX,
          y: spawnY,
          distance: Math.hypot(spawnX - x, spawnY - y),
        });
      }
    });
  });

  options.sort((a, b) => a.distance - b.distance);
  return options[0] ?? { x: START_X, y: START_Y };
}

function freshTargets(): Enemy[] {
  const occupied = new Set<string>([`${Math.floor(START_X)},${Math.floor(START_Y)}`]);

  return TARGETS.map((target) => {
    const targetKey = `${Math.floor(target.x)},${Math.floor(target.y)}`;
    const spawn =
      isOpenFloor(target.x, target.y) && !occupied.has(targetKey)
        ? target
        : nearestOpenSpawn(target.x, target.y, occupied);

    occupied.add(`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`);
    return {
      ...target,
      x: spawn.x,
      y: spawn.y,
      alive: true,
      nextShot: 900 + target.id * 310,
      muzzleUntil: 0,
    };
  });
}

function normalizeAngle(angle: number) {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const enemiesRef = useRef<Enemy[]>(freshTargets());
  const shootRef = useRef<() => void>(() => undefined);
  const draggingAimRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const gameRef = useRef<GameState>({
    x: START_X,
    y: START_Y,
    dir: 0,
    started: false,
    victory: false,
    defeated: false,
    kills: 0,
    health: 100,
    lastFrame: 0,
  });

  const [started, setStarted] = useState(false);
  const [kills, setKills] = useState(0);
  const [health, setHealth] = useState(100);
  const [victory, setVictory] = useState(false);
  const [defeated, setDefeated] = useState(false);
  const [muzzle, setMuzzle] = useState(false);
  const [locked, setLocked] = useState(false);

  const setControl = (code: string, pressed: boolean) => {
    keysRef.current[code] = pressed;
  };

  const requestAim = () => {
    const canvas = canvasRef.current;
    if (canvas && document.pointerLockElement !== canvas) {
      try {
        const result = canvas.requestPointerLock?.();
        if (result && typeof result.catch === "function") {
          void result.catch(() => setLocked(false));
        }
      } catch {
        setLocked(false);
      }
    }
  };

  const startGame = () => {
    gameRef.current.started = true;
    setStarted(true);
    canvasRef.current?.focus({ preventScroll: true });
    requestAim();
  };

  const resetGame = () => {
    gameRef.current = {
      x: START_X,
      y: START_Y,
      dir: 0,
      started: true,
      victory: false,
      defeated: false,
      kills: 0,
      health: 100,
      lastFrame: performance.now(),
    };
    enemiesRef.current = freshTargets();
    setKills(0);
    setHealth(100);
    setVictory(false);
    setDefeated(false);
    setStarted(true);
    canvasRef.current?.focus({ preventScroll: true });
    requestAim();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let muzzleTimer = 0;

    const isWall = (x: number, y: number) => {
      const mapX = Math.floor(x);
      const mapY = Math.floor(y);
      return (
        mapY < 0 ||
        mapY >= WORLD.length ||
        mapX < 0 ||
        mapX >= WORLD[0].length ||
        WORLD[mapY][mapX] === "1"
      );
    };

    const castRay = (angle: number) => {
      const game = gameRef.current;
      const rayX = Math.cos(angle);
      const rayY = Math.sin(angle);
      let distance = 0;
      let previousCellX = Math.floor(game.x);
      let previousCellY = Math.floor(game.y);
      let side = 0;

      while (distance < 20) {
        distance += 0.025;
        const sampleX = game.x + rayX * distance;
        const sampleY = game.y + rayY * distance;
        const cellX = Math.floor(sampleX);
        const cellY = Math.floor(sampleY);
        if (isWall(sampleX, sampleY)) {
          side = cellX !== previousCellX ? 0 : 1;
          break;
        }
        previousCellX = cellX;
        previousCellY = cellY;
      }

      return { distance, side };
    };

    const shoot = () => {
      const game = gameRef.current;
      if (!game.started || game.victory || game.defeated) return;

      setMuzzle(true);
      window.clearTimeout(muzzleTimer);
      muzzleTimer = window.setTimeout(() => setMuzzle(false), 80);

      const wallDistance = castRay(game.dir).distance;
      let bestTarget: Enemy | null = null;
      let bestAngle = Number.POSITIVE_INFINITY;

      for (const enemy of enemiesRef.current) {
        if (!enemy.alive) continue;
        const dx = enemy.x - game.x;
        const dy = enemy.y - game.y;
        const distance = Math.hypot(dx, dy);
        const angle = Math.abs(
          normalizeAngle(Math.atan2(dy, dx) - game.dir),
        );
        const hitWindow = Math.max(0.035, 0.28 / distance);
        if (
          angle < hitWindow &&
          angle < bestAngle &&
          distance < wallDistance + 0.2
        ) {
          bestTarget = enemy;
          bestAngle = angle;
        }
      }

      if (bestTarget) {
        bestTarget.alive = false;
        game.kills += 1;
        setKills(game.kills);
        if (game.kills === TOTAL_TARGETS) {
          game.victory = true;
          setVictory(true);
          if (document.pointerLockElement === canvas) document.exitPointerLock();
        }
      }
    };

    shootRef.current = shoot;

    const movePlayer = (delta: number) => {
      const game = gameRef.current;
      if (!game.started || game.victory || game.defeated) return;

      const moveSpeed = 2.35 * delta;
      const turnSpeed = 1.85 * delta;
      let forward = 0;
      let strafe = 0;

      if (keysRef.current.KeyW || keysRef.current.ArrowUp) forward += 1;
      if (keysRef.current.KeyS || keysRef.current.ArrowDown) forward -= 1;
      if (keysRef.current.KeyA) strafe -= 1;
      if (keysRef.current.KeyD) strafe += 1;
      if (keysRef.current.ArrowLeft || keysRef.current.TurnLeft)
        game.dir -= turnSpeed;
      if (keysRef.current.ArrowRight || keysRef.current.TurnRight)
        game.dir += turnSpeed;

      const moveX =
        Math.cos(game.dir) * forward * moveSpeed +
        Math.cos(game.dir + Math.PI / 2) * strafe * moveSpeed;
      const moveY =
        Math.sin(game.dir) * forward * moveSpeed +
        Math.sin(game.dir + Math.PI / 2) * strafe * moveSpeed;
      const padding = 0.17;

      if (!isWall(game.x + moveX + Math.sign(moveX) * padding, game.y)) {
        game.x += moveX;
      }
      if (!isWall(game.x, game.y + moveY + Math.sign(moveY) * padding)) {
        game.y += moveY;
      }
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(1, Math.floor(rect.width * scale));
      const nextHeight = Math.max(1, Math.floor(rect.height * scale));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
    };

    const hasLineOfSight = (enemy: Enemy) => {
      const game = gameRef.current;
      const dx = game.x - enemy.x;
      const dy = game.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const stepX = dx / distance;
      const stepY = dy / distance;

      for (let step = 0.25; step < distance - 0.2; step += 0.08) {
        if (isWall(enemy.x + stepX * step, enemy.y + stepY * step)) {
          return false;
        }
      }
      return true;
    };

    const updateEnemyFire = (time: number) => {
      const game = gameRef.current;
      if (!game.started || game.victory || game.defeated) return;

      for (const enemy of enemiesRef.current) {
        if (!enemy.alive || time < enemy.nextShot) continue;

        const distance = Math.hypot(enemy.x - game.x, enemy.y - game.y);
        enemy.nextShot = time + 1850 + ((enemy.id * 293) % 900);
        if (distance > 7.25 || !hasLineOfSight(enemy)) continue;

        enemy.muzzleUntil = time + 115;
        game.health = Math.max(0, game.health - 7);
        setHealth(game.health);

        if (game.health === 0) {
          game.defeated = true;
          setDefeated(true);
          if (document.pointerLockElement === canvas) document.exitPointerLock();
          break;
        }
      }
    };

    const renderEnemy = (
      enemy: Enemy,
      width: number,
      height: number,
      depthBuffer: Float32Array,
    ) => {
      const game = gameRef.current;
      const dx = enemy.x - game.x;
      const dy = enemy.y - game.y;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = normalizeAngle(Math.atan2(dy, dx) - game.dir);
      if (Math.abs(relativeAngle) > FOV * 0.72) return;

      const correctedDistance = distance * Math.cos(relativeAngle);
      const screenX =
        width / 2 +
        (Math.tan(relativeAngle) / Math.tan(FOV / 2)) * (width / 2);
      const size = Math.min(height * 0.82, (height * 0.94) / correctedDistance);
      const depthIndex = Math.max(0, Math.min(width - 1, Math.floor(screenX)));
      if (correctedDistance > depthBuffer[depthIndex] + 0.15) return;

      const now = performance.now();
      const bob = Math.sin(now * 0.003 + enemy.id) * size * 0.025;
      const centerY = height / 2 + size * 0.08 + bob;

      context.save();
      context.translate(screenX, centerY);

      // Legs and armored boots.
      context.strokeStyle = "#171717";
      context.lineCap = "round";
      context.lineWidth = Math.max(3, size * 0.085);
      context.beginPath();
      context.moveTo(-size * 0.11, size * 0.2);
      context.lineTo(-size * 0.16, size * 0.44);
      context.moveTo(size * 0.11, size * 0.2);
      context.lineTo(size * 0.16, size * 0.44);
      context.stroke();

      // Torso armor.
      context.shadowColor = "rgba(255, 92, 53, .75)";
      context.shadowBlur = size * 0.16;
      context.fillStyle = "#ff5c35";
      context.strokeStyle = "#171717";
      context.lineWidth = Math.max(2, size * 0.025);
      context.beginPath();
      context.moveTo(-size * 0.24, -size * 0.12);
      context.lineTo(-size * 0.18, size * 0.25);
      context.lineTo(size * 0.18, size * 0.25);
      context.lineTo(size * 0.24, -size * 0.12);
      context.closePath();
      context.fill();
      context.stroke();
      context.shadowBlur = 0;

      // Helmet and visor.
      context.fillStyle = "#171717";
      context.beginPath();
      context.arc(0, -size * 0.29, size * 0.155, Math.PI, 0);
      context.lineTo(size * 0.135, -size * 0.2);
      context.lineTo(-size * 0.135, -size * 0.2);
      context.closePath();
      context.fill();
      context.fillStyle = "#234cff";
      context.fillRect(-size * 0.105, -size * 0.3, size * 0.21, size * 0.055);

      // Arms bracing the rifle.
      context.strokeStyle = "#ff5c35";
      context.lineWidth = Math.max(3, size * 0.065);
      context.beginPath();
      context.moveTo(-size * 0.2, -size * 0.04);
      context.lineTo(-size * 0.05, size * 0.09);
      context.moveTo(size * 0.2, -size * 0.04);
      context.lineTo(size * 0.05, size * 0.09);
      context.stroke();

      // Rifle: stock, receiver, grip, sight, and barrel.
      context.fillStyle = "#2d313b";
      context.strokeStyle = "#090a0d";
      context.lineWidth = Math.max(1.5, size * 0.017);
      context.fillRect(-size * 0.29, size * 0.015, size * 0.43, size * 0.105);
      context.strokeRect(-size * 0.29, size * 0.015, size * 0.43, size * 0.105);
      context.fillStyle = "#111318";
      context.fillRect(size * 0.13, size * 0.045, size * 0.27, size * 0.045);
      context.fillRect(-size * 0.04, size * 0.11, size * 0.065, size * 0.13);
      context.fillStyle = "#8398ff";
      context.fillRect(-size * 0.08, -size * 0.012, size * 0.11, size * 0.03);

      if (enemy.muzzleUntil > now) {
        context.fillStyle = "#fff36b";
        context.shadowColor = "#fff36b";
        context.shadowBlur = size * 0.13;
        context.beginPath();
        context.moveTo(size * 0.4, size * 0.068);
        context.lineTo(size * 0.55, 0);
        context.lineTo(size * 0.49, size * 0.075);
        context.lineTo(size * 0.55, size * 0.15);
        context.closePath();
        context.fill();
        context.shadowBlur = 0;
      }

      // Compact hostile marker.
      context.strokeStyle = "rgba(255, 92, 53, .9)";
      context.lineWidth = Math.max(1, size * 0.012);
      context.beginPath();
      context.moveTo(-size * 0.31, -size * 0.42);
      context.lineTo(-size * 0.2, -size * 0.42);
      context.moveTo(size * 0.2, -size * 0.42);
      context.lineTo(size * 0.31, -size * 0.42);
      context.stroke();
      context.restore();
    };

    const draw = (time: number) => {
      resizeCanvas();
      const game = gameRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const delta = Math.min(0.034, (time - (game.lastFrame || time)) / 1000);
      game.lastFrame = time;
      movePlayer(delta);
      updateEnemyFire(time);
      canvas.dataset.playerX = game.x.toFixed(3);
      canvas.dataset.playerY = game.y.toFixed(3);
      canvas.dataset.playerDirection = game.dir.toFixed(3);
      canvas.dataset.gameStarted = String(game.started);

      const sky = context.createLinearGradient(0, 0, 0, height / 2);
      sky.addColorStop(0, "#234cff");
      sky.addColorStop(1, "#8398ff");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height / 2);

      const floor = context.createLinearGradient(0, height / 2, 0, height);
      floor.addColorStop(0, "#f3f0e8");
      floor.addColorStop(1, "#171717");
      context.fillStyle = floor;
      context.fillRect(0, height / 2, width, height / 2);

      context.strokeStyle = "rgba(23, 23, 23, 0.22)";
      context.lineWidth = 1;
      for (let index = 1; index < 9; index += 1) {
        const y = height / 2 + (height / 2) * Math.pow(index / 9, 1.8);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const depthBuffer = new Float32Array(width);
      depthBuffer.fill(20);
      const stripe = Math.max(2, Math.ceil(width / 620));

      for (let column = 0; column < width; column += stripe) {
        const camera = column / width;
        const rayAngle = game.dir - FOV / 2 + camera * FOV;
        const hit = castRay(rayAngle);
        const correctedDistance = Math.max(
          0.001,
          hit.distance * Math.cos(rayAngle - game.dir),
        );
        const wallHeight = Math.min(height * 1.7, height / correctedDistance);
        const wallTop = height / 2 - wallHeight / 2;
        const shade = Math.max(0.18, 1 - correctedDistance / 13);
        const base = hit.side === 0 ? [35, 76, 255] : [255, 92, 53];
        context.fillStyle = `rgb(${Math.floor(base[0] * shade)}, ${Math.floor(base[1] * shade)}, ${Math.floor(base[2] * shade)})`;
        context.fillRect(column, wallTop, stripe + 1, wallHeight);
        context.fillStyle = `rgba(243, 240, 232, ${Math.max(0.03, shade * 0.12)})`;
        context.fillRect(column, wallTop, 1, wallHeight);
        for (let offset = 0; offset < stripe && column + offset < width; offset += 1) {
          depthBuffer[column + offset] = correctedDistance;
        }
      }

      enemiesRef.current
        .filter((enemy) => enemy.alive)
        .sort(
          (a, b) =>
            Math.hypot(b.x - game.x, b.y - game.y) -
            Math.hypot(a.x - game.x, a.y - game.y),
        )
        .forEach((enemy) => renderEnemy(enemy, width, height, depthBuffer));

      context.fillStyle = "rgba(243, 240, 232, 0.55)";
      context.font = `600 ${Math.max(10, width * 0.012)}px monospace`;
      context.fillText("SECTOR 01 // SIGNAL RANGE", width * 0.03, height * 0.07);

      animationFrame = window.requestAnimationFrame(draw);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }

      const game = gameRef.current;
      if (game.started && !game.victory && !game.defeated && !event.repeat) {
        const step = 0.12;
        let nudgeX = 0;
        let nudgeY = 0;

        if (event.code === "KeyW" || event.code === "ArrowUp") {
          nudgeX = Math.cos(game.dir) * step;
          nudgeY = Math.sin(game.dir) * step;
        } else if (event.code === "KeyS" || event.code === "ArrowDown") {
          nudgeX = -Math.cos(game.dir) * step;
          nudgeY = -Math.sin(game.dir) * step;
        } else if (event.code === "KeyA") {
          nudgeX = Math.cos(game.dir - Math.PI / 2) * step;
          nudgeY = Math.sin(game.dir - Math.PI / 2) * step;
        } else if (event.code === "KeyD") {
          nudgeX = Math.cos(game.dir + Math.PI / 2) * step;
          nudgeY = Math.sin(game.dir + Math.PI / 2) * step;
        } else if (event.code === "ArrowLeft") {
          game.dir -= 0.08;
        } else if (event.code === "ArrowRight") {
          game.dir += 0.08;
        }

        const padding = 0.17;
        if (
          nudgeX !== 0 &&
          !isWall(game.x + nudgeX + Math.sign(nudgeX) * padding, game.y)
        ) {
          game.x += nudgeX;
        }
        if (
          nudgeY !== 0 &&
          !isWall(game.x, game.y + nudgeY + Math.sign(nudgeY) * padding)
        ) {
          game.y += nudgeY;
        }
      }

      keysRef.current[event.code] = true;
      if (event.code === "Space" && !event.repeat) shoot();
      if (event.code === "Enter" && !gameRef.current.started) {
        gameRef.current.started = true;
        setStarted(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current[event.code] = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas && gameRef.current.started) {
        gameRef.current.dir += event.movementX * 0.0022;
      }
    };

    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    const clearKeys = () => {
      keysRef.current = {};
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(muzzleTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, []);

  const handleCanvasClick = () => {
    if (!started) startGame();
    else {
      requestAim();
      shootRef.current();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    draggingAimRef.current = true;
    lastPointerXRef.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      started &&
      document.pointerLockElement !== event.currentTarget &&
      draggingAimRef.current
    ) {
      const movement = event.clientX - lastPointerXRef.current;
      gameRef.current.dir += movement * 0.006;
      lastPointerXRef.current = event.clientX;
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingAimRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <main className="game-page">
      <nav className="nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Hi, back to top">
          hi<span>.</span>
        </a>
        <div className="nav-meta" aria-label="Game status">
          <span>Field test 001</span>
          <span className="nav-dot" aria-hidden="true" />
          <span>Signal active</span>
        </div>
        <a className="nav-link" href="#intel">
          Mission intel <span aria-hidden="true">↘</span>
        </a>
      </nav>

      <section className="game-hero" id="top" aria-labelledby="game-title">
        <div className="game-heading">
          <div>
            <p className="eyebrow">
              <span aria-hidden="true">✦</span> A playable transmission
            </p>
            <h1 id="game-title">
              First <span>contact.</span>
            </h1>
          </div>
          <p className="game-intro">
            Enter the signal maze. Hunt six armed contacts before they drain
            your system. Say hello with your crosshair.
          </p>
        </div>

        <div className="game-shell">
          <div className="viewport-frame">
            <canvas
              ref={canvasRef}
              className="game-canvas"
              onClick={handleCanvasClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={(event) => setControl(event.code, true)}
              onKeyUp={(event) => setControl(event.code, false)}
              tabIndex={0}
              aria-label="First Contact first-person game. Use W A S D to move, drag the mouse or use arrow keys to aim, and click or space to fire."
            />

            <div className="hud" aria-live="polite">
              <div className="hud-chip">
                <span>Hostiles</span>
                <strong>
                  {kills.toString().padStart(2, "0")} / {TOTAL_TARGETS.toString().padStart(2, "0")}
                </strong>
              </div>
              <div className="hud-chip hud-center">
                <span>{locked ? "Aim linked" : "Drag to aim"}</span>
                <strong>HI//01</strong>
              </div>
              <div className="hud-chip hud-right">
                <span>System</span>
                <strong>{health}%</strong>
              </div>
            </div>

            <div className="crosshair" aria-hidden="true">
              <span />
            </div>
            <div className={`blaster ${muzzle ? "is-firing" : ""}`} aria-hidden="true">
              <div className="muzzle-flash" />
              <div className="blaster-barrel"><span /></div>
              <div className="blaster-sight"><span /></div>
              <div className="blaster-receiver">
                <span className="blaster-rail" />
                <span className="blaster-vents" />
                <span className="blaster-display">01</span>
              </div>
              <div className="blaster-grip" />
              <div className="blaster-hand" />
            </div>

            {!started && (
              <div className="game-overlay">
                <p className="overlay-index">READY // PLAYER ONE</p>
                <h2>Enter the signal.</h2>
                <p>WASD to move · Drag or arrows to aim · Click to fire</p>
                <button type="button" onClick={startGame}>
                  Start mission <span aria-hidden="true">→</span>
                </button>
              </div>
            )}

            {victory && (
              <div className="game-overlay victory-overlay">
                <p className="overlay-index">TRANSMISSION COMPLETE</p>
                <h2>Hello received.</h2>
                <p>Six signals found. The world heard you.</p>
                <button type="button" onClick={resetGame}>
                  Play again <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {defeated && (
              <div className="game-overlay defeat-overlay">
                <p className="overlay-index">SIGNAL LOST</p>
                <h2>System offline.</h2>
                <p>The contacts got you first. Reconnect and try again.</p>
                <button type="button" onClick={resetGame}>
                  Reboot mission <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            <div className="touch-controls" aria-label="Touch game controls">
              <div className="touch-cluster">
                <button
                  type="button"
                  aria-label="Turn left"
                  onPointerDown={() => setControl("TurnLeft", true)}
                  onPointerUp={() => setControl("TurnLeft", false)}
                  onPointerCancel={() => setControl("TurnLeft", false)}
                >
                  ←
                </button>
                <div>
                  <button
                    type="button"
                    aria-label="Move forward"
                    onPointerDown={() => setControl("KeyW", true)}
                    onPointerUp={() => setControl("KeyW", false)}
                    onPointerCancel={() => setControl("KeyW", false)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move backward"
                    onPointerDown={() => setControl("KeyS", true)}
                    onPointerUp={() => setControl("KeyS", false)}
                    onPointerCancel={() => setControl("KeyS", false)}
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Turn right"
                  onPointerDown={() => setControl("TurnRight", true)}
                  onPointerUp={() => setControl("TurnRight", false)}
                  onPointerCancel={() => setControl("TurnRight", false)}
                >
                  →
                </button>
              </div>
              <button
                className="fire-button"
                type="button"
                onPointerDown={() => shootRef.current()}
              >
                Fire
              </button>
            </div>
          </div>

          <aside className="mission-rail" aria-label="Mission briefing">
            <div>
              <p className="rail-label">Objective</p>
              <p className="rail-copy">Find and disarm every orange trooper.</p>
            </div>
            <div className="rail-score">
              <span>{kills.toString().padStart(2, "0")}</span>
              <p>Hostiles cleared</p>
            </div>
            <div className="control-list">
              <p className="rail-label">Controls</p>
              <dl>
                <div><dt>Move</dt><dd>W A S D</dd></div>
                <div><dt>Aim</dt><dd>Drag / ← →</dd></div>
                <div><dt>Fire</dt><dd>Click / Space</dd></div>
              </dl>
            </div>
          </aside>
        </div>
      </section>

      <section className="ticker" aria-label="Mission transmission">
        <div>
          <span>Find the hostiles</span><i>✦</i>
          <span>Clear the maze</span><i>✦</i>
          <span>Say hello</span><i>✦</i>
          <span>Find the hostiles</span><i>✦</i>
          <span>Clear the maze</span><i>✦</i>
          <span>Say hello</span><i>✦</i>
        </div>
      </section>

      <section className="intel" id="intel" aria-labelledby="intel-title">
        <p className="section-number">MISSION / 001</p>
        <div>
          <p className="eyebrow dark">The briefing</p>
          <h2 id="intel-title">A first-person hello from the edge of the web.</h2>
        </div>
        <div className="intel-copy">
          <p>
            No downloads. No account. Just a tiny ray-cast world rendered live
            in your browser and six armed contacts waiting in the maze.
          </p>
          <div className="mini-grid">
            <div><strong>06</strong><span>Hostiles</span></div>
            <div><strong>01</strong><span>Maze</span></div>
            <div><strong>∞</strong><span>Retries</span></div>
          </div>
        </div>
      </section>

      <footer>
        <p>Made to say hello loudly.</p>
        <a href="#top">Back to mission ↑</a>
        <p>© 2026</p>
      </footer>
    </main>
  );
}
