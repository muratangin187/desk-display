const PHOTOS = [
  'photos/01-forest-lake.jpg',
  'photos/02-waterfall.jpg',
  'photos/03-woods.jpg',
  'photos/04-mountains.jpg',
  'photos/05-clouds.jpg',
  'photos/06-sunset-field.jpg',
  'photos/07-desk-minimal.jpg',
  'photos/08-laptop-minimal.jpg',
];

const INTERVALS = [
  { label: '30sn', ms: 30_000 },
  { label: '1dk', ms: 60_000 },
  { label: '5dk', ms: 300_000 },
  { label: '15dk', ms: 900_000 },
];

export function initPhotosView(rootEl) {
  let currentIndex = Number(localStorage.getItem('desk_photo_index') || 0) % PHOTOS.length;
  let intervalMs = Number(localStorage.getItem('desk_photo_interval') || 60_000);
  let isPlaying = localStorage.getItem('desk_photo_playing') !== 'false';
  let activeLayer = 0;
  let hudVisible = false;
  let hudTimer = null;
  let slideTimer = null;

  rootEl.innerHTML = `
    <div class="photos-container" id="photos-container">
      <img class="photo-layer visible" id="photo-layer-0" alt="Desk photo" />
      <img class="photo-layer" id="photo-layer-1" alt="Desk photo" />
      <div class="photo-hud" id="photo-hud">
        <div class="photo-hud-bottom">
          <div class="photo-controls-left">
            <button class="play-btn" id="photo-play-btn" aria-label="Oynat / Duraklat"></button>
            <div class="interval-group" id="photo-intervals">
              ${INTERVALS.map(
                (item) => `
                  <button class="interval-btn ${item.ms === intervalMs ? 'active' : ''}" data-ms="${item.ms}">
                    ${item.label}
                  </button>
                `
              ).join('')}
            </div>
          </div>
          <div class="photo-controls-right">
            <button class="photo-nav-btn" id="photo-prev">‹</button>
            <span class="photo-counter" id="photo-counter">1 / ${PHOTOS.length}</span>
            <button class="photo-nav-btn" id="photo-next">›</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const container = rootEl.querySelector('#photos-container');
  const layers = [rootEl.querySelector('#photo-layer-0'), rootEl.querySelector('#photo-layer-1')];
  const hud = rootEl.querySelector('#photo-hud');
  const playBtn = rootEl.querySelector('#photo-play-btn');
  const counterEl = rootEl.querySelector('#photo-counter');

  function showPhoto(index, instant = false) {
    currentIndex = (index + PHOTOS.length) % PHOTOS.length;
    localStorage.setItem('desk_photo_index', String(currentIndex));
    counterEl.textContent = `${currentIndex + 1} / ${PHOTOS.length}`;

    if (instant) {
      layers[activeLayer].src = PHOTOS[currentIndex];
      layers[activeLayer].classList.add('visible');
      return;
    }

    const nextLayer = 1 - activeLayer;
    const img = layers[nextLayer];
    img.onload = () => {
      img.classList.add('visible');
      layers[activeLayer].classList.remove('visible');
      activeLayer = nextLayer;
    };
    img.src = PHOTOS[currentIndex];
  }

  function renderPlayButton() {
    playBtn.classList.toggle('playing', isPlaying);
    playBtn.innerHTML = isPlaying
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>`;
  }

  function restartSlideshow() {
    clearInterval(slideTimer);
    if (isPlaying) {
      slideTimer = setInterval(() => showPhoto(currentIndex + 1), intervalMs);
    }
  }

  function showHud(autoHide = true) {
    hudVisible = true;
    hud.classList.add('visible');
    clearTimeout(hudTimer);
    if (autoHide) {
      hudTimer = setTimeout(() => {
        hudVisible = false;
        hud.classList.remove('visible');
      }, 4500);
    }
  }

  function hideHud() {
    hudVisible = false;
    hud.classList.remove('visible');
    clearTimeout(hudTimer);
  }

  container.addEventListener('click', (e) => {
    if (e.target.closest('.photo-hud-bottom')) {
      showHud(true);
      return;
    }
    if (hudVisible) {
      hideHud();
    } else {
      showHud(true);
    }
  });

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPlaying = !isPlaying;
    localStorage.setItem('desk_photo_playing', String(isPlaying));
    renderPlayButton();
    restartSlideshow();
    showHud(true);
  });

  rootEl.querySelectorAll('.interval-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      intervalMs = Number(btn.dataset.ms);
      localStorage.setItem('desk_photo_interval', String(intervalMs));
      rootEl.querySelectorAll('.interval-btn').forEach((b) =>
        b.classList.toggle('active', Number(b.dataset.ms) === intervalMs)
      );
      restartSlideshow();
      showHud(true);
    });
  });

  rootEl.querySelector('#photo-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    showPhoto(currentIndex - 1);
    restartSlideshow();
    showHud(true);
  });

  rootEl.querySelector('#photo-next').addEventListener('click', (e) => {
    e.stopPropagation();
    showPhoto(currentIndex + 1);
    restartSlideshow();
    showHud(true);
  });

  showPhoto(currentIndex, true);
  renderPlayButton();
  restartSlideshow();
}
