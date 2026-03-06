// --- 1. Global Variables ---
let scene, camera, renderer, clock, player, playerMixer;
let enemies = [], isGameOver = false, score = 0, ammo = 120, timeLeft = 450; 
let moveFwd = false, targetQuat = new THREE.Quaternion();

const shootSound = document.getElementById('shoot-audio');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');
const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb';

// --- 2. Timer ---
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
    scene.background = new THREE.Color(0x020202); 
    scene.fog = new THREE.FogExp2(0x020202, 0.02);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    
    // Mansion Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x330000 });
    for (let i = 0; i < 20; i++) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 2), wallMat);
        wall.position.set((Math.random() - 0.5) * 150, 5, (Math.random() - 0.5) * 150);
        if (i % 2 === 0) wall.rotation.y = Math.PI / 2;
        scene.add(wall);
    }

    const loader = new THREE.GLTFLoader();

    // Spawn 40 Enemies
    for (let i = 0; i < 40; i++) {
        loader.load(MODEL_URL, (gltf) => {
            const enemy = gltf.scene;
            enemy.scale.set(1.5, 1.5, 1.5);
            enemy.position.set((Math.random() - 0.5) * 140, 0, (Math.random() - 0.5) * 140);
            enemy.traverse(child => { if (child.isMesh) child.material.color.set(0xff0000); });
            scene.add(enemy);
            const mixer = new THREE.AnimationMixer(enemy);
            if (gltf.animations.length > 0) mixer.clipAction(gltf.animations[0]).play();
            enemies.push({ mesh: enemy, alive: true, mixer: mixer });
        });
    }

    loader.load(MODEL_URL, (gltf) => {
        player = gltf.scene;
        player.scale.set(1.5, 1.5, 1.5);
        player.traverse(child => { if (child.isMesh) child.material = child.material.clone(); });
        scene.add(player);
        playerMixer = new THREE.AnimationMixer(player);
        if (gltf.animations.length > 1) playerMixer.clipAction(gltf.animations[1]).play();
    });

    setupControls();
    startTimer();
    renderer.setAnimationLoop(animate);
}

// --- 4. Animation & Controls ---
function animate() {
    const dt = clock.getDelta();
    if (player) {
        player.quaternion.slerp(targetQuat, 0.1);
        if (playerMixer) playerMixer.update(dt);
        if (moveFwd) {
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
            player.position.add(dir.multiplyScalar(0.5));
            player.position.y = 0;
        }
        const relCamOffset = new THREE.Vector3(0, 5, 12);
        const camOffset = relCamOffset.applyQuaternion(player.quaternion);
        camera.position.lerp(player.position.clone().add(camOffset), 0.1);
        camera.lookAt(player.position);
    }
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].alive && enemies[i].mixer) enemies[i].mixer.update(dt);
    }
    renderer.render(scene, camera);
}

function setupControls() {
    window.addEventListener('keydown', (e) => { if(e.code === 'ArrowUp' || e.code === 'KeyW') moveFwd = true; });
    window.addEventListener('keyup', (e) => { if(e.code === 'ArrowUp' || e.code === 'KeyW') moveFwd = false; });
    window.addEventListener('mousemove', (e) => {
        let rotY = -(e.clientX / window.innerWidth - 0.5) * Math.PI * 2;
        targetQuat.setFromEuler(new THREE.Euler(0, rotY, 0, 'YXZ'));
    });
    window.addEventListener('mousedown', shoot);
}

// --- 5. Shoot & Audio Trigger ---
function shoot() {
    if (shootSound) { 
        shootSound.currentTime = 0; 
        shootSound.play().catch(() => {}); 
    }

    if (!player || isGameOver || ammo <= 0) return;
    ammo--;
    document.getElementById('ammo').innerText = ammo;
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)), new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion));
    const hits = raycaster.intersectObjects(enemies.filter(e => e.alive).map(e => e.mesh), true);
    
    if (hits.length > 0) {
        let enemyRoot = enemies.find(e => {
            let found = false;
            e.mesh.traverse(child => { if (child === hits[0].object) found = true; });
            return found;
        });
        if (enemyRoot && enemyRoot.alive) {
            enemyRoot.alive = false;
            scene.remove(enemyRoot.mesh);
            score++;
            document.getElementById('enemy-count').innerText = 40 - score;
            if (score >= 40) finishGame(true);
        }
    }
}

function finishGame(win) {
    isGameOver = true;
    if (win) {
        localStorage.setItem('level4Unlocked', 'true');
        alert("MISSION SUCCESS!");
        window.location.href = "level4.html";
    }
    document.getElementById('game-over-screen').style.display = 'flex';
}

startBtn.onclick = () => {
    startOverlay.style.display = 'none';
    if (shootSound) shootSound.play().then(() => shootSound.pause()); // Unlock audio
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    initGame();
};