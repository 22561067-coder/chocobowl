import { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import './App.css';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const W = 1000;
const H = 650;
const COUNT = 18;
const CENTER_X = W / 2;
const CENTER_Y = H / 2;
const TRAY = { x: CENTER_X, y: CENTER_Y, w: 440, h: 440 };
const BOWL = { x: CENTER_X, y: CENTER_Y, r: 44 };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function App() {
  const canvasRef = useRef(null);
  const mouseRef = useRef(0);
  const gameRef = useRef(null);
  const lockUntilRef = useRef(0);
  const [steering, setSteering] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const engine = Engine.create({ gravity: { x: 0, y: 0.32 } });
    const balls = [];
    // Four complete sides. No obstacles, gaps, or invisible ramps.
    const walls = Array.from({ length: 4 }, () =>
      Bodies.rectangle(TRAY.x, TRAY.y, TRAY.w, 9, {
        isStatic: true, friction: 0.7, restitution: 0.12,
      })
    );
    // Fixed bowl collider: never rotated with the container.
    const bowlWalls = [
      Bodies.rectangle(BOWL.x - 35, BOWL.y + 12, 53, 9, { isStatic: true, angle: 0.38 }),
      Bodies.rectangle(BOWL.x + 35, BOWL.y + 12, 53, 9, { isStatic: true, angle: -0.38 }),
    ];
    Composite.add(engine.world, bowlWalls);
    for (let i = 0; i < COUNT; i++) {
      const side = i < COUNT / 2 ? -1 : 1;
      const slot = i % (COUNT / 2);
      // Spawn in the left and right compartments, never above the bowl.
      const spawnX = TRAY.x + side * (96 + (slot % 3) * 24);
      const spawnY = TRAY.y - 112 + Math.floor(slot / 3) * 38;
      const ball = Bodies.circle(spawnX, spawnY, 17, {
        restitution: 0.38, friction: 0.32, frictionStatic: 0.48, frictionAir: 0.002,
        density: 0.0018, slop: 0.03,
      });
      ball.plugin.index = i;
      balls.push(ball);
    }
    Composite.add(engine.world, [...walls, ...balls]);
    const game = { engine, balls, walls, bowlWalls, angle: 0, collected: new Set(), lastMouse: 0, particles: [], pulse: 0 };
    const unlockAt = performance.now() + 2000;
    lockUntilRef.current = unlockAt;
    mouseRef.current = 0;
    gameRef.current = game;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(500, 250, 40, 500, 325, 620);
      g.addColorStop(0, '#493028'); g.addColorStop(1, '#211713');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f1d6b30a';
      for (let x = 25; x < W; x += 30) for (let y = 25; y < H; y += 30) { ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fill(); }
      ctx.save(); ctx.translate(TRAY.x,TRAY.y); ctx.rotate(game.angle);
      ctx.shadowColor = '#0009'; ctx.shadowBlur = 35; ctx.shadowOffsetY = 15;
      const tin = ctx.createLinearGradient(-220,-220,220,220);
      tin.addColorStop(0,'#c19d72'); tin.addColorStop(.35,'#f1d7a5'); tin.addColorStop(.6,'#8d6946'); tin.addColorStop(1,'#d8b786');
      ctx.fillStyle = tin; ctx.beginPath(); ctx.roundRect(-232,-232,464,464,24); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#35221c'; ctx.beginPath(); ctx.roundRect(-215,-215,430,430,12); ctx.fill();
      const base = ctx.createLinearGradient(-210,-210,210,210);
      base.addColorStop(0,'#674636'); base.addColorStop(1,'#3b2921');
      ctx.fillStyle = base; ctx.beginPath(); ctx.roundRect(-206,-206,412,412,10); ctx.fill();
      ctx.strokeStyle = '#e8c39566'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-225,-225,450,450,18); ctx.stroke();
      ctx.strokeStyle = '#d1a37425'; ctx.beginPath(); ctx.roundRect(-193,-193,386,386,6); ctx.stroke();
      for (const x of [-219,219]) for (const y of [-219,219]) { ctx.fillStyle='#65492f'; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f2d3a5'; ctx.fillRect(x-2,y-1,4,1); }
      ctx.restore();

      // The bowl stays still while the container rotates.
      ctx.save(); ctx.translate(BOWL.x, BOWL.y);
      ctx.fillStyle = '#d8c3a6';
      ctx.beginPath(); ctx.ellipse(0, 8, 48, 27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#75523e';
      ctx.beginPath(); ctx.ellipse(0, 0, 44, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3c261e';
      ctx.beginPath(); ctx.ellipse(0, 3, 36, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f1d9b8'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, 0, 45, 16, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      for (const ball of balls) {
        if (game.collected.has(ball.id)) continue;
        const p = ball.position;
        const grad = ctx.createRadialGradient(p.x - 6, p.y - 8, 2, p.x, p.y, 19);
        const milk = ball.plugin.index % 3 === 0;
        grad.addColorStop(0, milk ? '#d9a977' : '#b68160'); grad.addColorStop(.45, milk ? '#98613c' : '#6c3b25'); grad.addColorStop(1, '#28140e');
        ctx.shadowColor='#13090399'; ctx.shadowBlur=5; ctx.shadowOffsetY=4;
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur=0; ctx.shadowOffsetY=0;
        ctx.strokeStyle = '#28120e'; ctx.lineWidth = 1; ctx.stroke();
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ball.angle);
        ctx.fillStyle='#ffe1b840'; ctx.beginPath(); ctx.ellipse(-5,-7,5,2.4,-.5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#24110b44'; ctx.beginPath(); ctx.arc(1,1,12,.4,2); ctx.stroke(); ctx.restore();
      }
      if (game.pulse > 0) {
        ctx.strokeStyle = 'rgba(244,207,146,' + game.pulse + ')'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.ellipse(BOWL.x,BOWL.y,48+(1-game.pulse)*35,19+(1-game.pulse)*14,0,0,Math.PI*2); ctx.stroke();
      }
      for (const particle of game.particles) {
        ctx.globalAlpha=Math.max(0,particle.life); ctx.fillStyle=particle.color;
        ctx.beginPath(); ctx.arc(particle.x,particle.y,particle.r,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    let raf = 0;
    let last = performance.now();
    function tick(now) {
      const dt = Math.min((now - last) / 16.667, 2);
      last = now;
      const input = now < unlockAt ? 0 : mouseRef.current;
      const edge = Math.pow(Math.abs(input), 1.6) * Math.sign(input);
      const targetAngle = edge * Math.PI * 2;
      const prevAngle = game.angle;
      game.angle += (targetAngle - game.angle) * Math.min(.075 * dt, 1);
      const angularSpeed = (game.angle - prevAngle) / Math.max(dt, .1);
      // Rotate the tray about the exact fixed center shared with the bowl.
      const local = [
        [0, -TRAY.h / 2, 0],
        [0, TRAY.h / 2, 0],
        [-TRAY.w / 2, 0, Math.PI / 2],
        [TRAY.w / 2, 0, Math.PI / 2],
      ];
      walls.forEach((wall, i) => {
        const [lx, ly, baseAngle] = local[i];
        const c = Math.cos(game.angle), s = Math.sin(game.angle);
        Body.setPosition(wall, { x: TRAY.x + lx * c - ly * s, y: TRAY.y + lx * s + ly * c });
        Body.setAngle(wall, baseAngle + game.angle);
      });
      // Rotation gives the balls tangential momentum. This helps balls at the
      // bottom rise when the tray is deliberately spun, without random bouncing.
      const spin = clamp(angularSpeed, -0.13, 0.13);
      if (Math.abs(spin) > 0.008) {
        for (const ball of balls) {
          if (game.collected.has(ball.id)) continue;
          const dx = ball.position.x - TRAY.x;
          const dy = ball.position.y - TRAY.y;
          const tangentialX = -dy * spin * 0.018;
          const tangentialY = dx * spin * 0.018;
          Body.setVelocity(ball, {
            x: clamp(ball.velocity.x + tangentialX, -15, 15),
            y: clamp(ball.velocity.y + tangentialY, -15, 15),
          });
        }
      }
      Engine.update(engine, 1000 / 60 * Math.min(dt, 1.5));
      for (const ball of balls) {
        if (game.collected.has(ball.id)) continue;
        const p = ball.position;
        // Bowl capture area: narrow enough to require steering, wide enough to be playable.
        if (Math.abs(p.x - BOWL.x) < 22 && p.y > BOWL.y - 7 && p.y < BOWL.y + 20) {
          game.collected.add(ball.id);
          Composite.remove(engine.world, ball);
          const next = game.collected.size;
          game.pulse = 1;
          for (let i=0; i<12; i++) { const a=i/12*Math.PI*2; game.particles.push({x:BOWL.x,y:BOWL.y,vx:Math.cos(a)*2.5,vy:Math.sin(a)*2.5-1,r:2+i%2,life:1,color:i%2?'#e1ba7a':'#a86c48'}); }
          setScore(next);
        }
        // Recover a ball if it escapes far beyond the tray.
        if (p.y > H + 130 || p.y < -130 || p.x < -150 || p.x > W + 150) {
          Body.setPosition(ball, { x: TRAY.x + (ball.plugin.index % 2 ? 115 : -115), y: TRAY.y - 95 });
          Body.setVelocity(ball, { x: 0, y: 0 });
        }
      }
      game.pulse = Math.max(0,game.pulse - .035 * dt);
      game.particles = game.particles.filter(p => p.life > 0);
      for (const p of game.particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += .08*dt; p.life -= .025*dt; }
      draw();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); Events.off(engine); Composite.clear(engine.world, false); Engine.clear(engine); gameRef.current = null; };
  }, []);

  function steer(value) {
    if (performance.now() < lockUntilRef.current) return;
    mouseRef.current = clamp(value, -1, 1);
    setSteering(Math.round(mouseRef.current * 100));
  }
  function handlePointerMove(e) {
    if (e.pointerType === 'touch' && !e.buttons) return;
    const rect = e.currentTarget.getBoundingClientRect();
    steer(((e.clientX - rect.left) / rect.width - .5) * 2);
  }
  return (
    <main className="game-page">
      <header className="game-heading"><h1>CHOCOBOWL</h1><div className="score" aria-live="polite"><span>SCORE</span><strong key={score}>{String(score).padStart(2,'0')}<small> / {COUNT}</small></strong><div className="score-meter"><span style={{width:score/COUNT*100+'%'}}/></div></div></header>
      <div className="game-area" onPointerDown={e => { if(e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId); handlePointerMove(e); }} onPointerMove={handlePointerMove} onPointerLeave={() => steer(0)} onPointerUp={e => {if(e.pointerType !== 'mouse') steer(0);}} onPointerCancel={() => steer(0)}>
        <canvas ref={canvasRef} width={W} height={H} role="img" aria-label="통을 돌려 초코볼을 중앙 그릇에 담는 게임" />
      </div>
      <div className="controls"><input aria-label="통 회전" type="range" min="-100" max="100" value={steering} onChange={e => steer(Number(e.target.value)/100)} /></div>
    </main>
  );
}
