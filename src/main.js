import './component.js';

// Create and configure the galton board component
const galtonBoard = document.createElement('galton-board');

// Set custom properties if desired
galtonBoard.width = window.innerWidth;
galtonBoard.height = window.innerHeight;
galtonBoard.pegRows = 12;
galtonBoard.autoSpawn = true;

// Listen to custom events
galtonBoard.addEventListener('ball-spawned', (e) => {
  // console.log(`Ball spawned! Total balls: ${e.detail.totalBalls}`);
});

galtonBoard.addEventListener('reset', () => {
  // console.log('Galton board reset');
});

// Style the component to fill the screen
galtonBoard.style.position = 'fixed';
galtonBoard.style.top = '0';
galtonBoard.style.left = '0';
galtonBoard.style.width = '100vw';
galtonBoard.style.height = '100vh';
galtonBoard.style.zIndex = '1';

// Add to the page
document.body.appendChild(galtonBoard);

// Demo: Add some controls
const controls = document.createElement('div');
controls.style.position = 'fixed';
controls.style.top = '20px';
controls.style.left = '20px';
controls.style.zIndex = '1000';
controls.style.background = 'rgba(255, 255, 255, 0.9)';
controls.style.padding = '15px';
controls.style.borderRadius = '8px';
controls.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
controls.style.fontFamily = 'Arial, sans-serif';

controls.innerHTML = `
  <h3 style="margin: 0 0 10px 0; font-size: 16px;">Galton Board Controls</h3>
  <button id="add-ball" style="margin: 5px; padding: 8px 12px; cursor: pointer;">Add Ball</button>
  <button id="reset" style="margin: 5px; padding: 8px 12px; cursor: pointer;">Reset</button>
  <button id="toggle-spawn" style="margin: 5px; padding: 8px 12px; cursor: pointer;">Toggle Auto-spawn</button>
  <div style="margin-top: 10px; font-size: 14px;">
    <div>Balls: <span id="ball-count">0</span></div>
    <div>Bucket counts: <span id="bucket-counts">[]</span></div>
  </div>
`;

document.body.appendChild(controls);

// Add event listeners for controls
document.getElementById('add-ball').addEventListener('click', () => {
  galtonBoard.addBall();
});

document.getElementById('reset').addEventListener('click', () => {
  galtonBoard.reset();
});

document.getElementById('toggle-spawn').addEventListener('click', () => {
  galtonBoard.autoSpawn = !galtonBoard.autoSpawn;
  document.getElementById('toggle-spawn').textContent = 
    galtonBoard.autoSpawn ? 'Disable Auto-spawn' : 'Enable Auto-spawn';
});

// Update statistics periodically
setInterval(() => {
  document.getElementById('ball-count').textContent = galtonBoard.getBallCount();
  document.getElementById('bucket-counts').textContent = 
    JSON.stringify(galtonBoard.getBucketCounts());
}, 500);

// Handle window resize
window.addEventListener('resize', () => {
  galtonBoard.width = window.innerWidth;
  galtonBoard.height = window.innerHeight;
});

console.log('Galton Board component loaded!');
console.log('Available methods:', {
  addBall: 'galtonBoard.addBall()',
  reset: 'galtonBoard.reset()',
  getBallCount: 'galtonBoard.getBallCount()',
  getBucketCounts: 'galtonBoard.getBucketCounts()'
});