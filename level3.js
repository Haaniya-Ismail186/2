// --- 1. Global Variables (Exact Level 1 Format) ---
let scene, camera, renderer, clock, player, playerMixer;
let enemies = [], isGameOver = false, score = 0, ammo = 150, timeLeft = 480; 
let moveFwd = false, targetQuat = new THREE.Quaternion();

const shootSound = document.getElementById('shoot-audio');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');

const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb';
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// --- Audio Unlock Flag ---
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked || !shootSound) return;
    shootSound.play().then(() => {
        shootSound.pause();
        shootSound.currentTime = 0;
        audioUnlocked = true;
    }).catch(() => {});
}

// --- 2. Timer Logic ---
function startTimer() {
    const timerEl = document.getElementById('timer');
    const gameTimer = setInterval(() => {
        if (isGameOver) { clearInterval(gameTimer); return; }
        timeLeft--;
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        if (timerEl) timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLeft <= 0) { clearInterval(gameTimer); finishGame(false); }
    }, 1000);
}

// --- 3. Init Game (Mansion Design) ---
function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050000); 
    scene.fog = new THREE.FogExp2(0x1a0000, 0.05);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    scene.add(new THREE.GridHelper(500, 50, 0xff0000, 0x222222));

    const loader = new THREE.GLTFLoader();

    // Mansion Obstacles (Walls)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x440000 });
    for (let i = 0; i < 15; i++) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(15, 8, 1), wallMat);
        wall.position.set((Math.random() - 0.5) * 80, 4, (Math.random() - 0.5) * 80);
        wall.rotation.y = Math.random() * Math.PI;
        scene.add(wall);
    }

    for (let i = 0; i < 35; i++) {
        loader.load(MODEL_URL, (gltf) => {
            const enemy = gltf.scene;
            enemy.scale.set(1.8, 1.8, 1.8);
            enemy.position.set((Math.random() - 0.5) * 85, 0, (Math.random() - 0.5) * 85);
            
            enemy.traverse(child => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.set(0xff0000); 
                }
            });

            scene.add(enemy);
            const mixer = new THREE.AnimationMixer(enemy);
            if (gltf.animations.length > 0) mixer.clipAction(gltf.animations[0]).play();
            enemies.push({ mesh: enemy, alive: true, mixer: mixer });
        });
    }

    loader.load(MODEL_URL, (gltf) => {
        player = gltf.scene;
        player.scale.set(1.8, 1.8, 1.8);
        scene.add(player);
        playerMixer = new THREE.AnimationMixer(player);
        if (gltf.animations.length > 1) playerMixer.clipAction(gltf.animations[1]).play(); 
    });

    setupControls();
    startTimer();
    renderer.setAnimationLoop(animate);
}

// --- 4. Animation Loop ---
function animate() {
    const dt = clock.getDelta();
    if (player) {
        player.quaternion.slerp(targetQuat, 0.1);
        if (playerMixer) playerMixer.update(dt);
        if (moveFwd) {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
            player.position.add(dir.multiplyScalar(0.22));
            player.position.y = 0;
        }
        const camPos = new THREE.Vector3(0, 4.5, 9).applyQuaternion(player.quaternion);
        camera.position.lerp(player.position.clone().add(camPos), 0.1);
        camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
    }
    enemies.forEach(e => { if (e.alive && e.mixer) e.mixer.update(dt); });
    renderer.render(scene, camera);
}

// --- 5. Controls & Shoot ---
function setupControls() {
    if (isMobile) {
        window.addEventListener('deviceorientation', (e) => {
            if (isGameOver) return;
            let rotY = (window.innerWidth > window.innerHeight) ? e.beta : e.gamma;
            let rotationY = -(rotY) * (Math.PI / 180) * 2;
            targetQuat.setFromEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));
        });
        document.getElementById('fire-btn').addEventListener('touchstart', (e) => {
            e.preventDefault(); unlockAudio(); shoot();
        });
        const moveBtn = document.getElementById('move-btn');
        moveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); moveFwd = true; });
        moveBtn.addEventListener('touchend', (e) => { e.preventDefault(); moveFwd = false; });
    } else {
        window.addEventListener('mousemove', (e) => {
            if (isGameOver || !player) return;
            let rotY = -(e.clientX / window.innerWidth - 0.5) * Math.PI * 1.5;
            targetQuat.setFromEuler(new THREE.Euler(0, rotY, 0, 'YXZ'));
        });
        window.addEventListener('mousedown', () => { unlockAudio(); shoot(); });
        window.addEventListener('keydown', (e) => { if(e.code === 'ArrowUp' || e.code === 'KeyW') moveFwd = true; });
        window.addEventListener('keyup', (e) => { if(e.code === 'ArrowUp' || e.code === 'KeyW') moveFwd = false; });
    }
}

function shoot() {
    if (!player || isGameOver || ammo <= 0) return;
    if (shootSound) { shootSound.currentTime = 0; shootSound.play().catch(() => {}); }
    ammo--;
    document.getElementById('ammo').innerText = ammo;

    const raycaster = new THREE.Raycaster();
    const shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    let rayOrigin = player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    raycaster.set(rayOrigin, shootDir);

    const targetMeshes = enemies.filter(e => e.alive).map(e => e.mesh);
    const hits = raycaster.intersectObjects(targetMeshes, true);

    if (hits.length > 0) {
        let hitObject = hits[0].object;
        let enemyRoot = enemies.find(e => {
            let found = false;
            e.mesh.traverse(child => { if (child === hitObject) found = true; });
            return found;
        });

        if (enemyRoot && enemyRoot.alive) {
            enemyRoot.alive = false;
            scene.remove(enemyRoot.mesh);
            score++;
            document.getElementById('enemy-count').innerText = 35 - score;
            if (score >= 35) finishGame(true);
        }
    }
}

// --- 6. Finish Game (WITH LEVEL 4 UNLOCK) ---
function finishGame(win) {
    isGameOver = true;
    document.getElementById('final-kills').innerText = score;
    document.getElementById('final-time').innerText = document.getElementById('timer').innerText;
    document.getElementById('game-over-screen').style.display = 'flex';
    const resultTitle = document.getElementById('result-title');
    
    if (win) {
        resultTitle.innerText = "MISSION SUCCESS";
        // UNLOCK LEVEL 4 HERE
        localStorage.setItem('level4Unlocked', 'true');
    } else {
        resultTitle.innerText = "MISSION FAILED";
    }
    
    resultTitle.style.color = "#ffffff"; 
}

// --- 7. Start Button & Full Screen ---
if (startBtn) {
    startBtn.onclick = () => {
        startOverlay.style.display = 'none';
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        initGame();
    };
}