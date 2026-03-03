// --- 1. Variables & Game State ---
let isGameOver = false, playerHealth = 100, ammo = 120, enemies = [], timeLeft = 45;
let timerInterval = null, clock = new THREE.Clock();
const move = { fwd: false };
let yaw = 0, pitch = 0;

// Mobile Look (Swipe) Variables
let lastTouchX = 0, lastTouchY = 0;

// Sound Customization (Level 2: Thodi aur bhari awaz)
const soundSettings = { volume: 1.5, pitch: 900, duration: 0.3 };
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 2. Procedural Real Sound (No MP3 needed) ---
function playShootSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * soundSettings.duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(soundSettings.pitch, audioCtx.currentTime);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(soundSettings.volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + soundSettings.duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

function unlockAudio() { if (audioCtx.state === 'suspended') audioCtx.resume(); }

// --- 3. Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050000); 
scene.fog = new THREE.FogExp2(0x1a0000, 0.08); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);
camera.rotation.order = 'YXZ'; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

// --- 4. Lighting & Environment ---
const ambientLight = new THREE.AmbientLight(0xff0000, 0.3); 
scene.add(ambientLight);
const spotLight = new THREE.PointLight(0xffffff, 1.2, 50); 
camera.add(spotLight);
scene.add(camera);

const grid = new THREE.GridHelper(200, 80, 0xff0000, 0x330000);
scene.add(grid);

// --- 5. Character Loading ---
const loader = new THREE.GLTFLoader();
function spawnStalker() {
    loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', (gltf) => {
        const model = gltf.scene;
        model.position.set((Math.random() - 0.5) * 50, 0, (Math.random() * -50) - 15);
        model.scale.set(1.8, 1.8, 1.8);
        scene.add(model);
        let mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[1] || gltf.animations[0]).play();
        enemies.push({ mesh: model, alive: true, mixer: mixer, speed: 0.11 + Math.random() * 0.05 });
    });
}
for (let i = 0; i < 15; i++) spawnStalker();

// --- 6. Controls (PC & Mobile Swipe) ---

// PC Mouse Look
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas && !isGameOver) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-1.4, Math.min(1.4, pitch));
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
});

// Mobile Swipe Movement
canvas.addEventListener('touchstart', (e) => {
    unlockAudio();
    lastTouchX = e.touches[0].pageX;
    lastTouchY = e.touches[0].pageY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (isGameOver) return;
    const deltaX = e.touches[0].pageX - lastTouchX;
    const deltaY = e.touches[0].pageY - lastTouchY;
    
    yaw -= deltaX * 0.006;
    pitch -= deltaY * 0.006;
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    
    lastTouchX = e.touches[0].pageX;
    lastTouchY = e.touches[0].pageY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('mousedown', () => {
    unlockAudio();
    if (!isGameOver) {
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
        if (!timerInterval) startTimer();
        shoot();
    }
});

// --- 7. Shooting Logic ---
function shoot() {
    if (isGameOver || ammo <= 0) return;
    ammo--;
    document.getElementById('ammo').innerText = ammo;
    playShootSound(); // Sound play on fire
    
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const aliveMeshes = enemies.filter(e => e.alive).map(e => e.mesh);
    const hits = ray.intersectObjects(aliveMeshes, true);

    if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj.parent && !aliveMeshes.includes(hitObj)) hitObj = hitObj.parent;
        const target = enemies.find(e => e.mesh === hitObj);
        if (target) {
            target.alive = false;
            scene.remove(target.mesh);
            const remaining = enemies.filter(e => e.alive).length;
            document.getElementById('enemy-count').innerText = remaining;
            if (remaining === 0) finishGame();
        }
    }
}

// --- 8. Game Loop & UI ---
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (move.fwd) {
        camera.translateZ(-0.25); 
        camera.position.y = 1.6 + Math.sin(time * 10) * 0.05; // Head bobbing
    }

    enemies.forEach(e => {
        if (e.alive && e.mesh) {
            e.mesh.lookAt(camera.position.x, 0, camera.position.z);
            e.mesh.translateZ(e.speed);
            if (e.mixer) e.mixer.update(delta);

            if (e.mesh.position.distanceTo(camera.position) < 2.2) {
                playerHealth -= 1.0; 
                document.getElementById('health').innerText = Math.max(0, Math.floor(playerHealth));
                if (playerHealth <= 0) finishGame();
            }
        }
    });
    renderer.render(scene, camera);
}

function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = `0:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
        if (timeLeft <= 0) finishGame();
    }, 1000);
}

function finishGame() {
    if (isGameOver) return;
    isGameOver = true;
    clearInterval(timerInterval);
    document.exitPointerLock();
    
    const remainingEnemies = enemies.filter(e => e.alive).length;
    const kills = 15 - remainingEnemies;
    
    const resultTitle = document.getElementById('result-title');
    const finalKills = document.getElementById('final-kills');
    const finalTime = document.getElementById('final-time');
    const gameOverScreen = document.getElementById('game-over-screen');

    finalKills.innerText = kills;
    finalTime.innerText = document.getElementById('timer').innerText;

    if (kills === 15) {
        resultTitle.innerText = "MISSION SUCCESS";
        resultTitle.style.color = "#00ff00"; 
    } else {
        resultTitle.innerText = "MISSION FAILED"; 
        resultTitle.style.color = "#ff0000"; 
    }
    gameOverScreen.style.display = 'flex';
}

// Mobile Button Listeners
document.getElementById('move-btn').addEventListener('touchstart', (e) => { e.preventDefault(); unlockAudio(); move.fwd = true; });
document.getElementById('move-btn').addEventListener('touchend', () => move.fwd = false);
document.getElementById('fire-btn').addEventListener('touchstart', (e) => { e.preventDefault(); unlockAudio(); shoot(); });

animate();