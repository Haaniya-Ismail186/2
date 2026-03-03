let isGameOver = false, playerHealth = 100, ammo = 300, enemies = [], timeLeft = 480;
let timerInterval = null, clock = new THREE.Clock();
const move = { fwd: false };
let yaw = 0, pitch = 0, lastTouchX = 0, lastTouchY = 0;

// Setup Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050000);
scene.fog = new THREE.FogExp2(0x1a0000, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 40);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

scene.add(new THREE.AmbientLight(0xff0000, 0.5));
const grid = new THREE.GridHelper(200, 40, 0xff0000, 0x220000);
scene.add(grid);

// City Houses (Level 4 Specific)
const houses = [];
const housePos = [{x:-25, z:-20}, {x:25, z:-20}, {x:-25, z:15}, {x:25, z:15}];
housePos.forEach(pos => {
    const house = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), new THREE.MeshStandardMaterial({color: 0x111111}));
    b.position.y = 6;
    const r = new THREE.Mesh(new THREE.ConeGeometry(8, 5, 4), new THREE.MeshStandardMaterial({color: 0x660000}));
    r.position.y = 14.5;
    house.add(b, r); house.position.set(pos.x, 0, pos.z);
    scene.add(house);
    houses.push(pos);
});

// Controls (Exactly like Level 1-3)
canvas.addEventListener('mousedown', () => {
    canvas.requestPointerLock();
    if (!timerInterval) startTimer();
    shoot();
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        camera.rotation.set(Math.max(-1.4, Math.min(1.4, pitch)), yaw, 0, 'YXZ');
    }
});

// Shooting
function shoot() {
    if (isGameOver || ammo <= 0) return;
    ammo--; document.getElementById('ammo').innerText = ammo;
    
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const aliveMeshes = enemies.filter(e => e.alive).map(e => e.mesh);
    const hits = ray.intersectObjects(aliveMeshes, true);
    
    if (hits.length > 0) {
        let hitObj = hits[0].object;
        while (hitObj.parent && !aliveMeshes.includes(hitObj)) hitObj = hitObj.parent;
        const target = enemies.find(e => e.mesh === hitObj);
        if (target) {
            target.alive = false; scene.remove(target.mesh);
            document.getElementById('enemy-count').innerText = enemies.filter(e=>e.alive).length;
            if (enemies.filter(e=>e.alive).length === 0) finishGame(true);
        }
    }
}

// Enemy AI (Level 4 "Loot City" Logic)
const loader = new THREE.GLTFLoader();
for (let i = 0; i < 12; i++) {
    loader.load('https://threejs.org/examples/models/gltf/Soldier.glb', (gltf) => {
        const model = gltf.scene;
        model.position.set((Math.random() - 0.5) * 80, 0, -60);
        model.scale.set(1.8, 1.8, 1.8);
        scene.add(model);
        let mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[1]).play();
        enemies.push({ 
            mesh: model, alive: true, mixer: mixer, speed: 0.15,
            state: 'GO_TO_HOUSE', target: houses[Math.floor(Math.random()*houses.length)], lootTimer: 0 
        });
    });
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (!isGameOver) {
        if (move.fwd) camera.translateZ(-0.3);
        enemies.forEach(e => {
            if (e.alive) {
                if (e.mixer) e.mixer.update(delta);
                // AI Logic
                if (e.state === 'GO_TO_HOUSE') {
                    e.mesh.lookAt(e.target.x, 0, e.target.z); e.mesh.translateZ(e.speed);
                    if (e.mesh.position.distanceTo(new THREE.Vector3(e.target.x, 0, e.target.z)) < 2.5) e.state = 'LOOTING';
                } else if (e.state === 'LOOTING') {
                    e.lootTimer += delta; if (e.lootTimer > 3) e.state = 'ESCAPING';
                } else if (e.state === 'ESCAPING') {
                    e.mesh.lookAt(e.mesh.position.x, 0, 100); e.mesh.translateZ(e.speed * 1.8);
                    if (e.mesh.position.z > 60) finishGame(false);
                }
            }
        });
    }
    renderer.render(scene, camera);
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60), s = timeLeft % 60;
        document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (timeLeft <= 0) finishGame(false);
    }, 1000);
}

function finishGame(success) {
    isGameOver = true; clearInterval(timerInterval);
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('result-title').innerText = success ? "MISSION SUCCESS" : "MISSION FAILED";
}

// Mobile Buttons
document.getElementById('move-btn').addEventListener('touchstart', (e) => { e.preventDefault(); move.fwd = true; });
document.getElementById('move-btn').addEventListener('touchend', () => move.fwd = false);
document.getElementById('fire-btn').addEventListener('touchstart', (e) => { e.preventDefault(); shoot(); });

animate();