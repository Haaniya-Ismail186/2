// --- Level Generator for Games Page ---
const levelContainer = document.getElementById('gameLevels');

if (levelContainer) {
    const levelNames = [
        "Training Grounds", "Safe Zone", "Blue Zone Rush", "Loot City", 
        "Sniper Peak", "Bridge Ambush", "Air Drop Hunt", "Desert Storm",
        "Night In Pochinki", "Squad Wipeout", "Final Circle", "Victory Path",
        "Elite Combat", "Legendary Raid", "Chicken Dinner"
    ];

    levelNames.forEach((name, i) => {
        let isLocked = i > 2 ? 'locked' : '';
        let lockIcon = i > 2 ? '<div class="lock-icon">🔒</div>' : '';

        levelContainer.innerHTML += `
            <div class="col-6 col-md-4 col-lg-2">
                <div class="level-card ${isLocked} text-center">
                    ${lockIcon}
                    <h2 class="text-warning">${i+1}</h2>
                    <p class="small fw-bold">${name}</p>
                    <div class="stars text-white-50">★★★</div>
                </div>
            </div>
        `;
    });
}

// --- Navbar Scroll Effect ---
window.addEventListener('scroll', function() {
    let navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('bg-black', 'shadow-lg');
    } else {
        navbar.classList.remove('bg-black');
    }
});

// --- Simple Click Alert for Levels ---
document.addEventListener('click', function(e) {
    if (e.target.closest('.level-card.locked')) {
        alert("This level is locked! Complete previous missions.");
    }
});


// const levelContainer = document.getElementById('gameLevels');

if (levelContainer) {
    const levelNames = [
        "Base Camp", "City Raid", "Supply Drop", "Forest Hunt", "Ruins", 
        "Bridge Fight", "Underground", "Snow Storm", "Final Boss", "Elite I",
        "Elite II", "Master III", "Legendary", "Grand Master", "Champion"
    ];

    levelNames.forEach((name, i) => {
        let isLocked = i > 2 ? 'locked' : '';
        let lockIcon = i > 2 ? '<div style="font-size:20px">🔒</div>' : '';

        levelContainer.innerHTML += `
            <div class="level-card ${isLocked}">
                ${lockIcon}
                <h2 class="text-red">${i+1}</h2>
                <p class="fw-bold">${name}</p>
                <div style="color: #555">★★★</div>
            </div>
        `;
    });
}

// Button par click karne se naye page par redirect
document.querySelector('.upgrade-btn').onclick = function() {
    // Current URL se data le kar level up page par bhejna
    const currentParams = window.location.search;
    window.location.href = "level-up.html" + currentParams;
};

// loop ko 18 tak chalayen
for(let i=0; i < 18; i++) { 
   // Baaki code wahi rahega...
}