// --- 1. Global Variables ---
let scene, camera, renderer, clock, player, playerMixer;
let enemies = [], isGameOver = false, score = 0, ammo = 100, timeLeft = 60;
let moveFwd = false, targetQuat = new THREE.Quaternion();

const shootSound = document.getElementById('shoot-audio');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');

const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb';
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

// --- 3. Init Game ---
function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    scene.add(new THREE.GridHelper(500, 50, 0x444444, 0x222222));

    const loader = new THREE.GLTFLoader();

    // Load Enemies
    for (let i = 0; i < 10; i++) {
        loader.load(MODEL_URL, (gltf) => {
            const enemy = gltf.scene;
            enemy.scale.set(1.8, 1.8, 1.8);
            enemy.position.set((Math.random() - 0.5) * 40, 0, -(Math.random() * 30 + 10));
            
            enemy.traverse(child => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.set(0xff0000); 
                }
            });

            scene.add(enemy);
            const mixer = new THREE.AnimationMixer(enemy);
            if (gltf.animations.length > 0) {
                mixer.clipAction(gltf.animations[0]).play();
            }
            enemies.push({ mesh: enemy, alive: true, mixer: mixer });
        });
    }

    // Load Player
    loader.load(MODEL_URL, (gltf) => {
        player = gltf.scene;
        player.scale.set(1.8, 1.8, 1.8);
        scene.add(player);
        playerMixer = new THREE.AnimationMixer(player);
        if (gltf.animations.length > 1) {
            playerMixer.clipAction(gltf.animations[1]).play(); 
        }
    });

    setupControls();
    startTimer();
    renderer.setAnimationLoop(animate);
}

// --- 4. Animation Loop ---
function animate() {
    const dt = clock.getDelta();
    
    if (player) {
        player.quaternion.slerp(targetQuat, 0.15); // Gyro speed
        if (playerMixer) playerMixer.update(dt);
        if (moveFwd) {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
            player.position.add(dir.multiplyScalar(0.15));
            player.position.y = 0;
        }
        const camPos = new THREE.Vector3(0, 4.5, 9).applyQuaternion(player.quaternion);
        camera.position.lerp(player.position.clone().add(camPos), 0.1);
        camera.lookAt(player.position.x, player.position.y + 2, player.position.z - 5);
    }

    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].alive && enemies[i].mixer) {
            enemies[i].mixer.update(dt);
        }
    }

    renderer.render(scene, camera);
}

// --- 5. Controls & Shoot ---
function setupControls() {
    if (isMobile) {
        window.addEventListener('deviceorientation', (e) => {
            if (isGameOver || !player) return;
            // Landscape fix for Gyro
            let angle = (window.innerWidth > window.innerHeight) ? e.beta : e.gamma;
            let rotationY = -THREE.MathUtils.degToRad(angle * 2.5); 
            targetQuat.setFromEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));
        });

        document.getElementById('fire-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            shoot();
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
        window.addEventListener('mousedown', shoot);
        window.addEventListener('keydown', (e) => { if(e.code === 'ArrowUp') moveFwd = true; });
        window.addEventListener('keyup', (e) => { if(e.code === 'ArrowUp') moveFwd = false; });
    }
}

function shoot() {
    if (!player || isGameOver || ammo <= 0) return;
    
    // Mobile sound fix
    if (shootSound) {
        shootSound.currentTime = 0;
        shootSound.play().catch(err => console.log("Sound interaction needed"));
    }

    ammo--;
    document.getElementById('ammo').innerText = ammo;

    const raycaster = new THREE.Raycaster();
    const shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    raycaster.set(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), shootDir);

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
            document.getElementById('enemy-count').innerText = 10 - score;
            if (score >= 10) finishGame(true);
        }
    }
}

function finishGame(win) {
    isGameOver = true;
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('result-title').innerText = win ? "MISSION SUCCESS" : "MISSION FAILED";
}

// --- 6. Start Button (Full Screen & Audio Unlock) ---
if (startBtn) {
    startBtn.onclick = () => {
        startOverlay.style.display = 'none';
        
        // Fullscreen fix
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

        // Unlock sound for mobile
        if (shootSound) {
            shootSound.play().then(() => {
                shootSound.pause();
                shootSound.currentTime = 0;
            }).catch(e => {});
        }
        
        initGame();
    };
}