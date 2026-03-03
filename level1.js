// --- 1. Global Variables ---
let scene, camera, renderer, clock, player, playerMixer;
let enemies = [], isGameOver = false, score = 0, ammo = 100, timeLeft = 60;
let moveFwd = false, targetQuat = new THREE.Quaternion();

// Professional Audio Engine Variables
let audioCtx = null;
let shootBuffer = null;

const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');
const shootAudioElement = document.getElementById('shoot-audio');

const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb';
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// --- 2. Force Load Audio into Memory ---
async function loadSoundIntoBuffer() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // HTML tag se source utha kar memory mein save karna
    if (shootAudioElement && !shootBuffer) {
        try {
            const response = await fetch(shootAudioElement.src);
            const arrayBuffer = await response.arrayBuffer();
            shootBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Audio Load Error:", e);
        }
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

// Memory se sound play karne ka function
function playDirectSound() {
    if (audioCtx && shootBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = shootBuffer;
        source.connect(audioCtx.destination);
        source.start(0);
    }
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
            if (gltf.animations.length > 0) mixer.clipAction(gltf.animations[0]).play();
            enemies.push({ mesh: enemy, alive: true, mixer: mixer });
        });
    }

    // Load Player
    loader.load(MODEL_URL, (gltf) => {
        player = gltf.scene;
        player.scale.set(1.8, 1.8, 1.8);
        scene.add(player);
        playerMixer = new THREE.AnimationMixer(player);
        if (gltf.animations.length > 1) playerMixer.clipAction(gltf.animations[1]).play(); 
    });

    setupControls();
    renderer.setAnimationLoop(animate);
}

// --- 4. Animation Loop ---
function animate() {
    const dt = clock.getDelta();
    if (player) {
        player.quaternion.slerp(targetQuat, 0.2); 
        if (playerMixer) playerMixer.update(dt);
        if (moveFwd) {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
            player.position.add(dir.multiplyScalar(0.18)); 
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
            if (isGameOver || !player) return;
            let angle = (window.innerWidth > window.innerHeight) ? e.beta : e.gamma;
            let rotationY = -THREE.MathUtils.degToRad(angle * 3.5); 
            targetQuat.setFromEuler(new THREE.Euler(0, rotationY, 0, 'YXZ'));
        });

        const fireBtn = document.getElementById('fire-btn');
        fireBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (audioCtx) audioCtx.resume(); 
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
    
    // Memory se sound bajana
    playDirectSound();

    ammo--;
    document.getElementById('ammo').innerText = ammo;

    const raycaster = new THREE.Raycaster();
    const shootDir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    raycaster.set(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), shootDir);

    const hits = raycaster.intersectObjects(enemies.filter(e => e.alive).map(e => e.mesh), true);
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
            if (score >= 10) { isGameOver = true; finishGame(true); }
        }
    }
}

function finishGame(win) {
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('result-title').innerText = win ? "MISSION SUCCESS" : "MISSION FAILED";
}

// --- 6. Start Action (Audio Unlock Context) ---
if (startBtn) {
    startBtn.onclick = async () => {
        // Full screen activate
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

        // Audio engine ko zinda karna (Crucial for Mobile)
        await loadSoundIntoBuffer();
        
        startOverlay.style.display = 'none';
        initGame();
    };
}