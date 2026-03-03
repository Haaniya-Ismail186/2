// --- 1. Variables & State ---
let isGameOver = false, playerHealth = 100, ammo = 250, enemies = [], timeLeft = 480; 
let timerInterval = null, clock = new THREE.Clock();
const move = { fwd: false };
let yaw = 0, pitch = 0;

// Mobile Swipe Look
let lastTouchX = 0, lastTouchY = 0;

// Procedural Sound Setup
const soundSettings = { volume: 1.3, pitch: 950, duration: 0.28 };
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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

// --- 2. Scene & Camera ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050000); 
scene.fog = new THREE.FogExp2(0x1a0000, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 25); 
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const ambient = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambient);
const flash = new THREE.PointLight(0xff0000, 2, 60);
camera.add(flash);
scene.add(camera);

// --- 3. Map Construction ---
function createMap() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x440000 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x660000 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const bounds = [
        { w: 100, h: 10, d: 1, x: 0, z: -50 },
        { w: 100, h: 10, d: 1, x: 0, z: 50 },
        { w: 1, h: 10, d: 100, x: -50, z: 0 },
        { w: 1, h: 10, d: 100, x: 50, z: 0 }
    ];

    bounds.forEach(b => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
        wall.position.set(b.x, 5, b.z);
        scene.add(wall);
    });

    for (let i = 0; i < 15; i++) {
        const wallH = new THREE.Mesh(new THREE.BoxGeometry(15, 8, 0.5), wallMat);
        wallH.position.set((Math.random() - 0.5) * 80, 4, (Math.random() - 0.5) * 80);
        wallH.rotation.y = Math.random() > 0.5 ? 0 : Math.PI / 2;
        scene.add(wallH);

        const box = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), boxMat);
        box.position.set((Math.random() - 0.5) * 70, 1.5, (Math.random() - 0.5) * 70);
        scene.add(box);
    }
}
createMap();

// --- 4. Enemies ---
const loader = new THREE.GLTFLoader();
function spawnEnemies() {
    for (let i = 0; i < 20; i++) {
        loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', (gltf) => {
            const model = gltf.scene;
            model.position.set((Math.random() - 0.5) * 80, 0, (Math.random() - 0.5) * 80);
            model.scale.set(1.8, 1.8, 1.8);
            scene.add(model);

            let mixer = new THREE.AnimationMixer(model);
            const walkAction = mixer.clipAction(gltf.animations[1] || gltf.animations[0]);
            walkAction.play();

            enemies.push({ 
                mesh: model, 
                alive: true, 
                mixer: mixer, 
                speed: 0.05 + Math.random() * 0.03 
            });
        });
    }
}
spawnEnemies();

// --- 5. Controls (PC & Mobile Swipe Fix) ---
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

function shoot() {
    if (isGameOver || ammo <= 0) return;
    ammo--;
    document.getElementById('ammo').innerText = ammo;
    playShootSound();
    
    // Muzzle Flash Effect
    flash.intensity = 10;
    setTimeout(() => flash.intensity = 2, 50);

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
            document.getElementById('enemy-count').innerText = enemies.filter(e => e.alive).length;
            if (enemies.filter(e => e.alive).length === 0) finishGame();
        }
    }
}

// --- 6. Animation ---
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (move.fwd) {
        camera.translateZ(-0.25);
        camera.position.y = 2 + Math.sin(time * 10) * 0.05; // Head bobbing
    }

    enemies.forEach(e => {
        if (e.alive) {
            if (e.mixer) e.mixer.update(delta);
            e.mesh.translateZ(e.speed);
            
            // Boundary Check
            if (Math.abs(e.mesh.position.x) > 48 || Math.abs(e.mesh.position.z) > 48) {
                e.mesh.rotateY(Math.PI);
            }
            if (Math.random() > 0.995) e.mesh.rotateY((Math.random() - 0.5) * 1.5);

            // Dushman se takkar (Damage)
            if (e.mesh.position.distanceTo(camera.position) < 2.5) {
                playerHealth -= 0.5;
                document.getElementById('health').innerText = Math.max(0, Math.floor(playerHealth));
                if (playerHealth <= 0) finishGame();
            }
        }
    });
    renderer.render(scene, camera);
}

// --- 7. Timer & Success Logic ---
function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft <= 0) finishGame();
    }, 1000);
}

function finishGame() {
    if (isGameOver) return;
    isGameOver = true;
    clearInterval(timerInterval);
    document.exitPointerLock();
    
    const remaining = enemies.filter(e => e.alive).length;
    const kills = 20 - remaining;
    
    document.getElementById('final-kills').innerText = kills;
    document.getElementById('final-time').innerText = document.getElementById('timer').innerText;
    
    const title = document.getElementById('result-title');
    const gameOverScreen = document.getElementById('game-over-screen');

    if (kills === 20) {
        title.innerText = "MISSION SUCCESS";
        title.style.color = "#00ff00";
        localStorage.setItem('level4Unlocked', 'true'); 
    } else {
        title.innerText = "MISSION FAILED";
        title.style.color = "#ff0000";
    }
    gameOverScreen.style.display = 'flex';
}

// Mobile Buttons
document.getElementById('move-btn').addEventListener('touchstart', (e) => { e.preventDefault(); unlockAudio(); move.fwd = true; });
document.getElementById('move-btn').addEventListener('touchend', () => move.fwd = false);
document.getElementById('fire-btn').addEventListener('touchstart', (e) => { e.preventDefault(); unlockAudio(); shoot(); });

animate();