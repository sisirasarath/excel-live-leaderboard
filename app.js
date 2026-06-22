// State variables
let leaderboardData = [];
let filteredData = [];
let currentTopPlayerId = null;
let isInitialLoad = true;
let pollInterval = 30000; // 30 seconds
let refreshTimer = null;

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSHpBTst-Wrkn67bMHGmLRobrHa0vXxmp81VXfy1QNFYSPwqnMEJmPxjyF_DNGyEinsJDjJqlLYxft0/pub?output=csv';

// DOM Elements
const leaderboardList = document.getElementById('leaderboardList');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const lastUpdatedTime = document.getElementById('lastUpdatedTime');
const searchInput = document.getElementById('searchInput');
const teamFilter = document.getElementById('teamFilter');
const statusFilter = document.getElementById('statusFilter');

// Metrics DOM
const metricTopPlayer = document.getElementById('metricTopPlayer');
const metricTopScore = document.getElementById('metricTopScore');
const metricTotalPlayers = document.getElementById('metricTotalPlayers');
const metricTopTeam = document.getElementById('metricTopTeam');
const metricTeamAvg = document.getElementById('metricTeamAvg');
const metricAvgScore = document.getElementById('metricAvgScore');

// SVG Icons
const icons = {
  trendUp: `<svg class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
  trendDown: `<svg class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  trendStable: `<svg class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
};

/* ==========================================================================
   GOOGLE SHEETS CSV DATA ENGINE
   ========================================================================== */
async function fetchLeaderboardData() {
  updateStatus('syncing', 'Syncing...');
  console.log('Fetching live data from Google Sheets...');
  
  try {
    const cachedBypassUrl = `${SHEET_URL}&t=${Date.now()}`;
    const response = await fetch(cachedBypassUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.data && results.data.length > 0) {
          processRawData(results.data);
          updateStatus('online', 'Live Sheet Active');
          updateTimestamp(new Date());
        } else {
          console.warn('Google Sheet parsed successfully but returned no rows.');
          updateStatus('online', 'Sheet Empty');
        }
      },
      error: function(err) {
        throw new Error(`CSV Parsing error: ${err.message}`);
      }
    });

  } catch (error) {
    console.error('Error fetching/parsing Google Sheet:', error);
    updateStatus('offline', 'Sync Error');
  }
}

// Map, normalize, and rank Google Sheets CSV data
function processRawData(rows) {
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  // 1. Resolve NAME column
  const nameKey = keys.find(k => {
    const l = k.toLowerCase();
    return l === 'name' || l.includes('name') || l.includes('player') || l.includes('user') || l.includes('naam');
  }) || keys[1] || 'NAME';

  // 2. Resolve DEPARTMENT/TEAM column
  const teamKey = keys.find(k => {
    const l = k.toLowerCase();
    return l.includes('dept') || l.includes('department') || l.includes('team') || l.includes('group') || l.includes('club') || l.includes('squad');
  }) || keys[2] || '';

  // 3. Resolve TOTAL score column
  const scoreKey = keys.find(k => {
    const l = k.toLowerCase();
    return l === 'total' || l.includes('total') || l.includes('score') || l.includes('points') || l.includes('score');
  }) || 'TOTAL';

  // 4. Resolve STATUS column
  const statusKey = keys.find(k => k.toLowerCase().includes('status')) || '';

  console.log(`[Smart Feed] Resolved headers -> Name: "${nameKey}", Score: "${scoreKey}", Team: "${teamKey || 'None'}"`);

  // Normalize rows
  let normalizedData = rows.map((row, index) => {
    const nameVal = row[nameKey] ? String(row[nameKey]).trim() : `Player ${index + 1}`;
    
    let scoreVal = 0;
    const rawScore = row[scoreKey];
    if (rawScore !== undefined && rawScore !== null) {
      if (typeof rawScore === 'number') {
        scoreVal = rawScore;
      } else {
        const cleanStr = String(rawScore).trim();
        if (cleanStr.includes('/')) {
          const numPart = cleanStr.split('/')[0].trim();
          scoreVal = parseFloat(numPart) || 0;
        } else {
          const match = cleanStr.match(/[\d.]+/);
          scoreVal = match ? parseFloat(match[0]) : 0;
        }
      }
    }

    const teamVal = teamKey && row[teamKey] ? String(row[teamKey]).trim() : 'General';
    const statusVal = statusKey && row[statusKey] ? String(row[statusKey]).trim() : 'Active';

    return {
      id: `${nameVal}-${teamVal}-${index}`,
      name: nameVal,
      score: scoreVal,
      team: teamVal,
      status: statusVal,
      trend: 'Stable'
    };
  });

  // Filter out headers/empty names
  normalizedData = normalizedData.filter(item => item.name && item.name.toLowerCase() !== 'name');

  // Enforce sorting by TOTAL score descending
  normalizedData.sort((a, b) => b.score - a.score);

  // Assign ranks
  normalizedData = normalizedData.map((item, idx) => {
    item.rank = idx + 1;
    return item;
  });

  leaderboardData = normalizedData;
  calculateMetrics();
  updateTeamFilterDropdown();
  renderLeaderboard();
  
  isInitialLoad = false;
}

// Update UI connection status
function updateStatus(state, label) {
  if (state === 'online') {
    statusIndicator.className = 'status-badge status-online';
    statusText.textContent = label;
  } else if (state === 'syncing') {
    statusIndicator.className = 'status-badge status-online';
    statusIndicator.style.background = 'rgba(245, 158, 11, 0.1)';
    statusIndicator.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    statusIndicator.style.color = 'var(--color-warning)';
    statusText.textContent = label;
  } else {
    statusIndicator.className = 'status-badge status-offline';
    statusIndicator.style.background = '';
    statusIndicator.style.borderColor = '';
    statusIndicator.style.color = '';
    statusText.textContent = label;
  }
}

function updateTimestamp(date) {
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  lastUpdatedTime.textContent = timeStr;
}

/* ==========================================================================
   METRICS CALCULATIONS
   ========================================================================== */
function calculateMetrics() {
  if (leaderboardData.length === 0) {
    metricTopPlayer.textContent = 'None';
    metricTopScore.textContent = 'Score: 0';
    metricTotalPlayers.textContent = '0';
    metricTopTeam.textContent = 'None';
    metricTeamAvg.textContent = 'Average: 0';
    metricAvgScore.textContent = '0';
    return;
  }

  const activePlayers = leaderboardData.filter(p => p.status.toLowerCase() === 'active');
  const playersForStats = activePlayers.length > 0 ? activePlayers : leaderboardData;

  const sorted = [...playersForStats].sort((a, b) => b.score - a.score);
  const topPlayer = sorted[0];

  metricTopPlayer.textContent = topPlayer.name;
  metricTopScore.textContent = `Score: ${topPlayer.score.toLocaleString()}`;

  if (topPlayer.id !== currentTopPlayerId) {
    if (!isInitialLoad && currentTopPlayerId !== null) {
      triggerConfetti(topPlayer.name);
    }
    currentTopPlayerId = topPlayer.id;
  }

  metricTotalPlayers.textContent = leaderboardData.length;

  const totalScore = leaderboardData.reduce((sum, p) => sum + p.score, 0);
  const avgScore = Math.round(totalScore / leaderboardData.length);
  metricAvgScore.textContent = avgScore.toLocaleString();

  const teamStats = {};
  leaderboardData.forEach(p => {
    if (!teamStats[p.team]) {
      teamStats[p.team] = { total: 0, count: 0 };
    }
    teamStats[p.team].total += p.score;
    teamStats[p.team].count += 1;
  });

  let topTeam = 'None';
  let highestTeamAvg = 0;

  Object.keys(teamStats).forEach(team => {
    const avg = Math.round(teamStats[team].total / teamStats[team].count);
    if (avg > highestTeamAvg) {
      highestTeamAvg = avg;
      topTeam = team;
    }
  });

  metricTopTeam.textContent = topTeam;
  metricTeamAvg.textContent = `Avg Score: ${highestTeamAvg.toLocaleString()}`;
}

function updateTeamFilterDropdown() {
  const currentSelection = teamFilter.value;
  const teams = new Set();
  
  leaderboardData.forEach(p => {
    if (p.team) teams.add(p.team);
  });

  teamFilter.innerHTML = '<option value="all">All Teams</option>';
  Array.from(teams).sort().forEach(team => {
    const option = document.createElement('option');
    option.value = team;
    option.textContent = team;
    teamFilter.appendChild(option);
  });

  if (teams.has(currentSelection)) {
    teamFilter.value = currentSelection;
  } else {
    teamFilter.value = 'all';
  }
}

function triggerConfetti(name) {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#ff2233', '#ffffff', '#111111', '#ffd700']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#ff2233', '#ffffff', '#111111', '#ffd700']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

/* ==========================================================================
   FLIP ANIMATED RENDERING ENGINE
   ========================================================================== */
function renderLeaderboard() {
  const searchQuery = searchInput.value.toLowerCase().trim();
  const selectedTeam = teamFilter.value;
  const selectedStatus = statusFilter.value;

  filteredData = leaderboardData.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery);
    const matchesTeam = selectedTeam === 'all' || player.team === selectedTeam;
    
    let matchesStatus = true;
    if (selectedStatus === 'active') {
      matchesStatus = player.status.toLowerCase() === 'active';
    } else if (selectedStatus === 'inactive') {
      matchesStatus = player.status.toLowerCase() === 'inactive';
    }

    return matchesSearch && matchesTeam && matchesStatus;
  });

  // Explicitly arrange by total points descending
  filteredData.sort((a, b) => b.score - a.score);

  const firstRects = {};
  const rows = leaderboardList.querySelectorAll('.leaderboard-row');
  rows.forEach(row => {
    const id = row.dataset.id;
    firstRects[id] = row.getBoundingClientRect().top;
  });

  if (filteredData.length === 0) {
    leaderboardList.innerHTML = `
      <div class="empty-state">
        <p>No players match the search criteria or selected filters.</p>
      </div>
    `;
    return;
  }
  
  const rowElements = filteredData.map((player) => {
    let trendIcon = icons.trendStable;
    let trendClass = 'trend-stable';
    
    let rankBadgeClass = 'rank-badge';
    let podiumClass = '';
    if (player.rank === 1) {
      rankBadgeClass += ' rank-1';
      podiumClass = 'podium-1';
    } else if (player.rank === 2) {
      rankBadgeClass += ' rank-2';
    } else if (player.rank === 3) {
      rankBadgeClass += ' rank-3';
    }

    const initials = player.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const statusText = player.status ? player.status.charAt(0).toUpperCase() + player.status.slice(1).toLowerCase() : 'Active';
    const statusClass = player.status.toLowerCase() === 'inactive' ? 'status-inactive' : 'status-active';

    const div = document.createElement('div');
    div.className = `leaderboard-row ${podiumClass}`;
    div.dataset.id = player.id;
    div.innerHTML = `
      <div class="col-rank">
        <span class="${rankBadgeClass}">${player.rank}</span>
      </div>
      <div class="col-name">
        <div class="avatar avatar-${player.rank <= 3 ? player.rank : 'default'}">${initials}</div>
        <div class="player-details">
          <span class="player-name">${player.name}</span>
        </div>
      </div>
      <div class="col-team">
        <span class="team-badge">${player.team}</span>
      </div>
      <div class="col-status">
        <span class="user-status ${statusClass}">${statusText}</span>
      </div>
      <div class="col-score">
        <span class="player-score">${player.score.toLocaleString()}</span>
      </div>
      <div class="col-trend">
        <span class="trend-indicator ${trendClass}" title="Trend: ${player.trend}">
          ${trendIcon}
        </span>
      </div>
    `;
    return div;
  });

  leaderboardList.innerHTML = '';
  rowElements.forEach(el => leaderboardList.appendChild(el));

  const newRows = leaderboardList.querySelectorAll('.leaderboard-row');
  newRows.forEach(row => {
    const id = row.dataset.id;
    const firstTop = firstRects[id];
    
    if (firstTop !== undefined) {
      const lastTop = row.getBoundingClientRect().top;
      const deltaY = firstTop - lastTop;
      
      if (deltaY !== 0) {
        row.style.transition = 'none';
        row.style.transform = `translateY(${deltaY}px)`;
        
        requestAnimationFrame(() => {
          row.offsetHeight;
          row.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, background-color 0.15s ease, border-color 0.15s ease';
          row.style.transform = '';
        });
      }
    } else {
      row.style.opacity = '0';
      row.style.transform = 'scale(0.95)';
      requestAnimationFrame(() => {
        row.offsetHeight;
        row.style.transition = 'all 0.25s ease';
        row.style.opacity = '1';
        row.style.transform = '';
      });
    }
  });
}

/* ==========================================================================
   INITIALIZATION & AUTO-REFRESH TIMER
   ========================================================================== */
function init() {
  searchInput.addEventListener('input', renderLeaderboard);
  teamFilter.addEventListener('change', renderLeaderboard);
  statusFilter.addEventListener('change', renderLeaderboard);

  // Initial fetch
  fetchLeaderboardData();

  // Polling fetch every 30 seconds
  refreshTimer = setInterval(fetchLeaderboardData, pollInterval);
  
  console.log(`Live sync established. Polling sheet data every 30 seconds.`);
}

window.addEventListener('DOMContentLoaded', init);
