import { initMarketsView } from './views/markets.js';
import { initPhotosView } from './views/photos.js';
import { initHackerNewsView } from './views/hackernews.js';

const TOTAL_VIEWS = 3;
let currentView = Number(localStorage.getItem('desk_active_view') || 0);
if (currentView < 0 || currentView >= TOTAL_VIEWS) currentView = 0;

const track = document.getElementById('carousel-track');
const dotsWrap = document.getElementById('page-dots');
const dots = Array.from(dotsWrap.querySelectorAll('.dot'));

initMarketsView(document.getElementById('view-markets'));
initPhotosView(document.getElementById('view-photos'));
const hnController = initHackerNewsView(document.getElementById('view-hn'));

let dotsFadeTimer = null;
function wakeDots() {
  dotsWrap.classList.remove('faded');
  clearTimeout(dotsFadeTimer);
  dotsFadeTimer = setTimeout(() => dotsWrap.classList.add('faded'), 3000);
}

function goToView(index, animate = true) {
  currentView = Math.max(0, Math.min(TOTAL_VIEWS - 1, index));
  localStorage.setItem('desk_active_view', String(currentView));
  track.classList.toggle('dragging', !animate);
  track.style.transform = `translate3d(-${currentView * 100}vw, 0, 0)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === currentView));
  wakeDots();
}

dots.forEach((dot) => {
  dot.addEventListener('click', () => goToView(Number(dot.dataset.index)));
});

// Horizontal swipe navigation across views
let startX = 0;
let startY = 0;
let deltaX = 0;
let isSwiping = false;
let directionLocked = null;

track.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    isSwiping = true;
    directionLocked = null;
  },
  { passive: true }
);

track.addEventListener(
  'touchmove',
  (e) => {
    if (!isSwiping || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!directionLocked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      directionLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }

    if (directionLocked !== 'x') return;

    deltaX = dx;
    const resistance =
      (currentView === 0 && dx > 0) || (currentView === TOTAL_VIEWS - 1 && dx < 0) ? 0.25 : 1;
    const offsetPx = -currentView * window.innerWidth + dx * resistance;
    track.classList.add('dragging');
    track.style.transform = `translate3d(${offsetPx}px, 0, 0)`;
  },
  { passive: true }
);

track.addEventListener('touchend', () => {
  if (!isSwiping) return;
  isSwiping = false;

  if (directionLocked === 'x') {
    const threshold = window.innerWidth * 0.16;
    if (deltaX < -threshold && currentView < TOTAL_VIEWS - 1) {
      goToView(currentView + 1, true);
    } else if (deltaX > threshold && currentView > 0) {
      goToView(currentView - 1, true);
    } else {
      goToView(currentView, true);
    }
  }
  directionLocked = null;
});

window.__deskHandleBack = () => {
  if (currentView === 2 && hnController.isDetailOpen()) {
    hnController.closeDetail();
    return true;
  }
  return false;
};

goToView(currentView, false);
