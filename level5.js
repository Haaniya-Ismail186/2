// --- 1. Global Variables ---
let scene, camera, renderer, clock, player;
let enemies = [], isGameOver = false, score = 0, ammo = 150, timeLeft = 300; 
let isZoomed = false; // Sniper Scope Flag

const shootSound = document.getElementById('shoot-audio');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('start-overlay');

// --- 2. Timer Logic ---
function startTimer() {
    const timerEl = document.getElementById('timer');
    const gameTimer = setInterval(() => {
        if (isGameOver) { clearInterval(gameTimer); return; }
        timeLeft--;
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        if (timerEl) timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLeft <= 0) finishGame(false);
    }, 1000);
}

// --- 3. Init Sniper World ---
function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); 
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.002); // Kam fog taake door tak dikhe

    // Sniper Camera: High Perspective
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    // Player ko pahad ki choti par bithaya (Height: 60)
    camera.position.set(0, 60, 150); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    
    // Valley Floor (Ground niche hai)
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Valley mein Red Grid (Enemy Territory)
    const grid = new THREE.GridHelper(1000, 40, 0xff0000, 0x222222);
    grid.position.y = 0.1;
    scene.add(grid);

    const loader = new THREE.GLTFLoader();

    // --- Enemy Base (Targets in the Valley) ---
    for (let i = 0; i < 80; i++) {
        loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb', (gltf) => {
            const enemy = gltf.scene;
            enemy.scale.set(2, 2, 2);
            // Door door base mein targets spawn kiye
            enemy.position.set((Math.random() - 0.5) * 600, 0, (Math.random() - 0.5) * 600);
            
            enemy.traverse(child => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color.set(0xff0000); 
                }
            });

            scene.add(enemy);
            enemies.push({ mesh: enemy, alive: true });
        });
    }

    setupControls();
    startTimer();
    renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
    });
}

// --- 4. Elite Sniper Mechanics ---
function setupControls() {
    // Mouse movement se aim karna
    window.addEventListener('mousemove', (e) => {
        if (isGameOver) return;
        let rotY = -(e.clientX / window.innerWidth - 0.5) * 2;
        let rotX = -(e.clientY / window.innerHeight - 0.5) * 1;
        camera.rotation.y = rotY;
        camera.rotation.x = rotX;
    });

    // Right Click for Scope (Zoom)
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        isZoomed = !isZoomed;
        // Zoom karne par FOV kam ho jata hai
        camera.fov = isZoomed ? 15 : 75; 
        camera.updateProjectionMatrix();
        // UI crosshair ko bara karne ke liye signal de sakte hain
    });

    window.addEventListener('mousedown', (e) => {
        if(e.button === 0) shoot(); // Left click to fire
    });
}

function shoot() {
    if (isGameOver || ammo <= 0) return;
    
    if (shootSound) { shootSound.currentTime = 0; shootSound.play().catch(() => {}); }
    ammo--;
    document.getElementById('ammo').innerText = ammo;

    // Center of screen (Sniper Crosshair) se Raycast
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

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
            document.getElementById('enemy-count').innerText = 80 - score;
            if (score >= 80) finishGame(true);
        }
    }
}

// --- 5. Finish Game ---
function finishGame(win) {
    isGameOver = true;
    document.getElementById('final-kills').innerText = score;
    document.getElementById('final-time').innerText = document.getElementById('timer').innerText;
    document.getElementById('game-over-screen').style.display = 'flex';
    const title = document.getElementById('result-title');
    title.innerText = win ? "GHOST ELIMINATOR" : "POSITION COMPROMISED";
    title.style.color = win ? "#00ff00" : "#ff0000";
}

// --- 6. Start Trigger ---
startBtn.onclick = () => {
    startOverlay.style.display = 'none';
    initGame();
};
