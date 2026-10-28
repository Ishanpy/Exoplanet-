/**
 * EXOPLANET ANALYTICS — NASA ARCHIVE RESEARCH PLATFORM
 * Professional aerospace engineering controller for verified exoplanetary composite data.
 * Focuses on high-contrast scientific readability, precise charting, and structured cataloging.
 */

(function () {
  'use strict';

  // Application State
  const state = {
    data: null,
    activeTab: 'overview',
    charts: {},
    explorer: {
      searchQuery: '',
      methodFilter: 'all',
      radiusFilter: 'all',
      sortBy: 'name',
      sortAsc: true,
      currentPage: 1,
      pageSize: 20,
      filteredPlanets: [],
      comparisonList: []
    },
    comparison: {
      scaleMode: 'true', // 'true' for physical linear diameter, 'norm' for uniform comparison
      selectedMetric: 'radius', // 'radius', 'mass', 'period', 'semi_major', 'temp', 'dist'
      showRadar: true,
      tableCollapsed: false,
      assignedColors: ['#0284c7', '#0f766e', '#d97706', '#7c3aed']
    },
    showMovingAverage: true
  };

  // Preset Comparisons
  const PRESETS = {
    '55cnc': ['55 Cnc b', '55 Cnc c', '55 Cnc d', '55 Cnc e'],
    'trappist': ['TRAPPIST-1 b', 'TRAPPIST-1 c', 'TRAPPIST-1 d', 'TRAPPIST-1 e'],
    'giants': ['HD 209458 b', 'WASP-12 b', '51 Peg b', 'HAT-P-7 b'],
    'earthlike': ['Kepler-452 b', 'Kepler-186 f', 'Proxima Cen b', 'Kepler-22 b']
  };

  // Restrained Aerospace Color Palette
  const COLORS = {
    primary: '#0f172a',       // Deep aerospace slate
    secondary: '#0284c7',     // Technical blue
    tertiary: '#475569',      // Neutral slate
    amber: '#d97706',         // Warm trend amber
    teal: '#0f766e',          // Verified teal
    rose: '#be123c',          // Contrast rose
    muted: '#94a3b8',         // Subtle grey
    grid: '#f1f5f9',          // Very faint chart gridline
    textMuted: '#64748b'
  };

  // Discovery Method Colors (Restrained Technical Palette)
  function getMethodColor(method) {
    if (!method) return COLORS.muted;
    if (method.includes('Transit Timing')) return '#7c3aed';
    if (method.includes('Transit')) return '#0f172a';
    if (method.includes('Radial Velocity')) return '#0284c7';
    if (method.includes('Microlensing')) return '#d97706';
    if (method.includes('Imaging')) return '#be123c';
    return '#64748b';
  }

  // Application Bootstrap
  document.addEventListener('DOMContentLoaded', async () => {
    setupHeaderScroll();
    await loadData();
    setupNavigation();
    setupHeroActions();
    setupExplorerControls();
    setupPredictor();
    setupModals();
    renderOverview();
  });

  // Header Scroll State
  function setupHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // Load Verified Dataset
  async function loadData() {
    try {
      if (window.EXOPLANET_DATA) {
        state.data = window.EXOPLANET_DATA;
      } else {
        const resp = await fetch('outputs/dashboard_data.json');
        if (!resp.ok) throw new Error('Network response failure');
        state.data = await resp.json();
      }
    } catch (err) {
      console.error('Failed to load dataset:', err);
      return;
    }

    state.explorer.filteredPlanets = [...state.data.planets];

    // Pre-populate comparison with 55 Cancri system planets
    state.explorer.comparisonList = state.data.planets.filter(p =>
      PRESETS['55cnc'].includes(p.name)
    ).slice(0, 4);

    updateDynamicIndicators();
  }

  // Dynamic Numeric Indicators
  function updateDynamicIndicators() {
    const d = state.data;
    if (!d || !d.summary) return;

    const s = d.summary;
    const formattedTotal = s.total_planets.toLocaleString();

    // Header & Hero Metadata
    setText('badge-planet-count', `${formattedTotal} WORLDS`);
    setText('hero-dynamic-count', formattedTotal);

    // Section 1 Spec Sheet Cells
    setText('kpi-total-planets', formattedTotal);
    setText('kpi-host-stars', s.host_stars_count.toLocaleString());
    setText('kpi-total-methods', s.discovery_methods_count.toString());
    setText('kpi-period-range', `${s.min_year}–${s.max_year}`);
    setText('kpi-completeness', `${s.data_completeness_pct}%`);

    // Catalog Counts
    setText('filter-total-count', formattedTotal);
    setText('filter-matching-count', formattedTotal);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Navigation Controller
  function setupNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  // Hero Actions
  function setupHeroActions() {
    const btnExplore = document.getElementById('btn-hero-explore-data');
    const btnCatalog = document.getElementById('btn-hero-view-catalog');

    if (btnExplore) {
      btnExplore.addEventListener('click', () => {
        switchTab('overview');
        scrollToContent();
      });
    }

    if (btnCatalog) {
      btnCatalog.addEventListener('click', () => {
        switchTab('explorer');
        scrollToContent();
      });
    }
  }

  function scrollToContent() {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive.toString());
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabId}`);
    });

    switch (tabId) {
      case 'overview':
        renderOverview();
        break;
      case 'discovery':
        renderDiscoveryAnalytics();
        break;
      case 'explorer':
        renderPlanetExplorer();
        break;
      case 'characteristics':
        renderPlanetaryPhysics();
        break;
      case 'models':
        renderModelsAndCorrelation();
        break;
      case 'quality':
        renderDataQuality();
        break;
    }
  }

  // Scientific Instrument Chart.js Default Theme (Clean Aerospace White/Light)
  function getScientificChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#475569',
            font: { family: 'Inter', size: 11, weight: '500' },
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#0f172a',
          bodyColor: '#334155',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 2,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          titleFont: { family: 'Inter', size: 12, weight: '600' },
          bodyFont: { family: 'JetBrains Mono', size: 11 }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    };
  }

  // ==========================================================================
  // SECTION 1: OVERVIEW DASHBOARD CHARTS
  // ==========================================================================
  function renderOverview() {
    if (!state.data) return;

    // 1. Discoveries Over Time
    const timelineCtx = document.getElementById('chart-overview-timeline');
    if (timelineCtx && !state.charts['overview-timeline']) {
      const labels = state.data.timeline.map(t => t.year);
      const dataCounts = state.data.timeline.map(t => t.discoveries);

      state.charts['overview-timeline'] = new Chart(timelineCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Confirmed Exoplanets',
            data: dataCounts,
            backgroundColor: '#0f172a',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }

    // 2. Methods Doughnut / Bar
    const methodsCtx = document.getElementById('chart-overview-methods');
    if (methodsCtx && !state.charts['overview-methods']) {
      const topMethods = state.data.methods.slice(0, 5);
      const otherCount = state.data.methods.slice(5).reduce((acc, m) => acc + m.count, 0);
      const labels = [...topMethods.map(m => m.method), 'Other Methods'];
      const data = [...topMethods.map(m => m.count), otherCount];
      const colors = ['#0f172a', '#0284c7', '#d97706', '#be123c', '#7c3aed', '#94a3b8'];

      state.charts['overview-methods'] = new Chart(methodsCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: '#475569', font: { family: 'Inter', size: 11 }, boxWidth: 10 }
            }
          },
          cutout: '70%'
        }
      });
    }

    // 3. Planetary Radius Distribution
    const radiusCtx = document.getElementById('chart-overview-radius');
    if (radiusCtx && !state.charts['overview-radius']) {
      const labels = state.data.distributions.radius.map(b => b.bin_label);
      const counts = state.data.distributions.radius.map(b => b.count);

      state.charts['overview-radius'] = new Chart(radiusCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Planet Count',
            data: counts,
            backgroundColor: '#0284c7',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }

    // 4. Planetary Mass Distribution
    const massCtx = document.getElementById('chart-overview-mass');
    if (massCtx && !state.charts['overview-mass']) {
      const labels = state.data.distributions.mass.map(b => b.bin_label);
      const counts = state.data.distributions.mass.map(b => b.count);

      state.charts['overview-mass'] = new Chart(massCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Planet Count',
            data: counts,
            backgroundColor: '#334155',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  // ==========================================================================
  // SECTION 2: DISCOVERY ANALYTICS CHARTS
  // ==========================================================================
  function renderDiscoveryAnalytics() {
    if (!state.data) return;

    // Detailed Timeline with 3-Year Moving Average
    const detailTimelineCtx = document.getElementById('chart-discovery-timeline-detailed');
    if (detailTimelineCtx && !state.charts['discovery-timeline-detailed']) {
      const labels = state.data.timeline.map(t => t.year);
      const discoveries = state.data.timeline.map(t => t.discoveries);
      const movingAvg = state.data.timeline.map(t => t.moving_avg);

      state.charts['discovery-timeline-detailed'] = new Chart(detailTimelineCtx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              type: 'line',
              label: '3-Year Moving Average',
              data: movingAvg,
              borderColor: COLORS.amber,
              backgroundColor: 'transparent',
              borderWidth: 2,
              pointRadius: 2.5,
              pointBackgroundColor: COLORS.amber,
              tension: 0.25,
              yAxisID: 'y'
            },
            {
              type: 'bar',
              label: 'Annual Confirmed Discoveries',
              data: discoveries,
              backgroundColor: '#0f172a',
              borderRadius: 1,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: {
            legend: {
              labels: { color: '#334155', font: { family: 'Inter', size: 11, weight: '500' } }
            }
          }
        }
      });

      const toggleBtn = document.getElementById('btn-toggle-ma');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          state.showMovingAverage = !state.showMovingAverage;
          toggleBtn.classList.toggle('active', state.showMovingAverage);
          const chart = state.charts['discovery-timeline-detailed'];
          chart.getDatasetMeta(0).hidden = !state.showMovingAverage;
          chart.update();
        });
      }
    }

    // Methods Horizontal Bar Chart
    const methodsBarCtx = document.getElementById('chart-methods-bar');
    if (methodsBarCtx && !state.charts['methods-bar']) {
      const methods = state.data.methods;
      state.charts['methods-bar'] = new Chart(methodsBarCtx, {
        type: 'bar',
        data: {
          labels: methods.map(m => m.method),
          datasets: [{
            label: 'Recorded Discoveries',
            data: methods.map(m => m.count),
            backgroundColor: methods.map(m => getMethodColor(m.method)),
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          indexAxis: 'y',
          plugins: { legend: { display: false } }
        }
      });
    }

    // Facilities Horizontal Bar Chart
    const facBarCtx = document.getElementById('chart-facilities-bar');
    if (facBarCtx && !state.charts['facilities-bar']) {
      const facilities = state.data.facilities;
      state.charts['facilities-bar'] = new Chart(facBarCtx, {
        type: 'bar',
        data: {
          labels: facilities.map(f => f.facility),
          datasets: [{
            label: 'Attributed Exoplanets',
            data: facilities.map(f => f.count),
            backgroundColor: '#0284c7',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          indexAxis: 'y',
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  // ==========================================================================
  // SECTION 3: PLANET EXPLORER & COMPARISON
  // ==========================================================================
  function setupExplorerControls() {
    const searchInput = document.getElementById('explorer-search');
    const methodSelect = document.getElementById('filter-method');
    const radiusSelect = document.getElementById('filter-radius-bin');
    const resetBtn = document.getElementById('btn-reset-filters');

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.explorer.searchQuery = e.target.value.trim().toLowerCase();
        state.explorer.currentPage = 1;
        applyFilters();
      }, 160);
    });

    methodSelect.addEventListener('change', (e) => {
      state.explorer.methodFilter = e.target.value;
      state.explorer.currentPage = 1;
      applyFilters();
    });

    radiusSelect.addEventListener('change', (e) => {
      state.explorer.radiusFilter = e.target.value;
      state.explorer.currentPage = 1;
      applyFilters();
    });

    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      methodSelect.value = 'all';
      radiusSelect.value = 'all';
      state.explorer.searchQuery = '';
      state.explorer.methodFilter = 'all';
      state.explorer.radiusFilter = 'all';
      state.explorer.currentPage = 1;
      applyFilters();
    });

    // Column Sorting
    document.querySelectorAll('#planet-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (state.explorer.sortBy === col) {
          state.explorer.sortAsc = !state.explorer.sortAsc;
        } else {
          state.explorer.sortBy = col;
          state.explorer.sortAsc = true;
        }
        updateSortHeaders();
        applyFilters();
      });
    });

    // Preset comparisons
    document.querySelectorAll('.preset-tab-btn[data-preset]').forEach(pill => {
      pill.addEventListener('click', () => {
        const presetKey = pill.getAttribute('data-preset');
        loadComparisonPreset(presetKey);
      });
    });

    const clearCompBtn = document.getElementById('btn-clear-comparison');
    if (clearCompBtn) {
      clearCompBtn.addEventListener('click', () => {
        state.explorer.comparisonList = [];
        renderComparisonArena();
        renderTableRows();
      });
    }

    setupComparisonControls();
  }

  function updateSortHeaders() {
    document.querySelectorAll('#planet-table th.sortable').forEach(th => {
      const col = th.getAttribute('data-col');
      th.classList.remove('sort-asc', 'sort-desc');
      const icon = th.querySelector('.sort-icon');
      if (col === state.explorer.sortBy) {
        th.classList.add(state.explorer.sortAsc ? 'sort-asc' : 'sort-desc');
        icon.innerHTML = state.explorer.sortAsc ? '&uarr;' : '&darr;';
      } else {
        icon.innerHTML = '&updownarrow;';
      }
    });
  }

  function applyFilters() {
    if (!state.data) return;

    let planets = [...state.data.planets];

    if (state.explorer.searchQuery) {
      const q = state.explorer.searchQuery;
      planets = planets.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.host.toLowerCase().includes(q)
      );
    }

    if (state.explorer.methodFilter !== 'all') {
      planets = planets.filter(p => p.method === state.explorer.methodFilter);
    }

    if (state.explorer.radiusFilter !== 'all') {
      const rf = state.explorer.radiusFilter;
      planets = planets.filter(p => {
        if (!p.radius) return false;
        if (rf === '<=1 Earth radius') return p.radius <= 1.0;
        if (rf === '1-2 Earth radii') return p.radius > 1.0 && p.radius <= 2.0;
        if (rf === '2-4 Earth radii') return p.radius > 2.0 && p.radius <= 4.0;
        if (rf === '4-10 Earth radii') return p.radius > 4.0 && p.radius <= 10.0;
        if (rf === '>10 Earth radii') return p.radius > 10.0;
        return true;
      });
    }

    // Sort
    const sortKey = state.explorer.sortBy;
    const asc = state.explorer.sortAsc ? 1 : -1;
    planets.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'string') {
        return va.localeCompare(vb) * asc;
      }
      return (va - vb) * asc;
    });

    state.explorer.filteredPlanets = planets;
    setText('filter-matching-count', planets.length.toLocaleString());

    renderTableRows();
    renderPagination();
  }

  function renderPlanetExplorer() {
    applyFilters();
    renderComparisonArena();
  }

  function renderTableRows() {
    const tbody = document.getElementById('planet-table-tbody');
    if (!tbody) return;

    const { filteredPlanets, currentPage, pageSize, comparisonList } = state.explorer;
    const startIndex = (currentPage - 1) * pageSize;
    const pagePlanets = filteredPlanets.slice(startIndex, startIndex + pageSize);

    if (pagePlanets.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No records matched your query. Adjust search or category filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pagePlanets.map(p => {
      const isCompared = comparisonList.some(item => item.name === p.name);

      return `
        <tr>
          <th scope="row" class="planet-row-click" data-planet-name="${p.name}" title="Click to view technical specifications">
            ${p.name}
          </th>
          <td data-label="Host Star">${p.host || '—'}</td>
          <td data-label="Method"><span class="method-badge">${p.method}</span></td>
          <td data-label="Year">${p.year || '—'}</td>
          <td data-label="Radius">${p.radius ? p.radius + ' R⊕' : '<span style="color:var(--text-muted);">Unmeasured</span>'}</td>
          <td data-label="Mass">${p.mass ? p.mass + ' M⊕' : '<span style="color:var(--text-muted);">Unmeasured</span>'}</td>
          <td data-label="Period">${p.period ? p.period + ' d' : '<span style="color:var(--text-muted);">Unmeasured</span>'}</td>
          <td data-label="Temp">${p.temp ? p.temp + ' K' : '<span style="color:var(--text-muted);">Unmeasured</span>'}</td>
          <td data-label="Dist">${p.dist ? p.dist + ' pc' : '<span style="color:var(--text-muted);">Unmeasured</span>'}</td>
          <td data-label="Compare">
            <button class="btn-compare-action ${isCompared ? 'added' : ''}" data-planet-name="${p.name}">
              ${isCompared ? 'Selected' : '+ Compare'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.planet-row-click').forEach(cell => {
      cell.addEventListener('click', () => {
        const name = cell.getAttribute('data-planet-name');
        openPlanetModal(name);
      });
    });

    tbody.querySelectorAll('.btn-compare-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.getAttribute('data-planet-name');
        togglePlanetComparison(name);
      });
    });
  }

  function renderPagination() {
    const info = document.getElementById('pagination-info');
    const container = document.getElementById('pagination-buttons');
    if (!container) return;

    const { filteredPlanets, currentPage, pageSize } = state.explorer;
    const total = filteredPlanets.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);
    if (info) info.textContent = `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} records`;

    let html = `
      <button class="btn-page" ${currentPage <= 1 ? 'disabled' : ''} id="btn-page-prev">&laquo; Prev</button>
    `;

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="btn-page ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
      `;
    }

    html += `
      <button class="btn-page" ${currentPage >= totalPages ? 'disabled' : ''} id="btn-page-next">Next &raquo;</button>
    `;

    container.innerHTML = html;

    const prevBtn = document.getElementById('btn-page-prev');
    const nextBtn = document.getElementById('btn-page-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      if (state.explorer.currentPage > 1) {
        state.explorer.currentPage--;
        renderTableRows();
        renderPagination();
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (state.explorer.currentPage < totalPages) {
        state.explorer.currentPage++;
        renderTableRows();
        renderPagination();
      }
    });

    container.querySelectorAll('.btn-page[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.explorer.currentPage = parseInt(btn.getAttribute('data-page'), 10);
        renderTableRows();
        renderPagination();
      });
    });
  }

  // ==========================================================================
  // SECTION 3: PLANETARY COMPARISON MATRIX CONTROLLER
  // ==========================================================================
  function setupComparisonControls() {
    // Autocomplete Search for comparison
    const compSearchInput = document.getElementById('comp-search-input');
    const compSearchResults = document.getElementById('comp-search-results');

    if (compSearchInput && compSearchResults) {
      let compDebounce;
      compSearchInput.addEventListener('input', (e) => {
        clearTimeout(compDebounce);
        const q = e.target.value.trim().toLowerCase();
        if (q.length < 2) {
          compSearchResults.style.display = 'none';
          compSearchResults.innerHTML = '';
          return;
        }

        compDebounce = setTimeout(() => {
          if (!state.data || !state.data.planets) return;
          const matches = state.data.planets.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.host && p.host.toLowerCase().includes(q))
          ).slice(0, 8);

          if (matches.length === 0) {
            compSearchResults.innerHTML = '<div style="padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.8rem;">No matching exoplanets found</div>';
            compSearchResults.style.display = 'block';
            return;
          }

          compSearchResults.innerHTML = matches.map(p => {
            const isSelected = state.explorer.comparisonList.some(item => item.name === p.name);
            return `
              <div class="comp-search-item" data-planet-name="${p.name}">
                <div>
                  <div class="name">${p.name}</div>
                  <div class="host">Host: ${p.host || 'Unknown'} &bull; ${p.radius ? p.radius + ' R⊕' : 'Radius unmeasured'}</div>
                </div>
                <span style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; color: ${isSelected ? 'var(--text-muted)' : 'var(--accent-aerospace-dark)'};">
                  ${isSelected ? 'Selected' : '+ Add'}
                </span>
              </div>
            `;
          }).join('');
          compSearchResults.style.display = 'block';

          compSearchResults.querySelectorAll('.comp-search-item').forEach(item => {
            item.addEventListener('click', () => {
              const name = item.getAttribute('data-planet-name');
              const alreadySelected = state.explorer.comparisonList.some(p => p.name === name);
              if (!alreadySelected) {
                if (state.explorer.comparisonList.length >= 4) {
                  alert('Comparison is limited to 4 planetary bodies for legible matrix display.');
                  return;
                }
                const planet = state.data.planets.find(p => p.name === name);
                if (planet) {
                  state.explorer.comparisonList.push(planet);
                  renderComparisonArena();
                  renderTableRows();
                }
              }
              compSearchInput.value = '';
              compSearchResults.style.display = 'none';
            });
          });
        }, 120);
      });

      document.addEventListener('click', (e) => {
        if (!compSearchInput.contains(e.target) && !compSearchResults.contains(e.target)) {
          compSearchResults.style.display = 'none';
        }
      });
    }

    // Scale Mode Toggle (Physical Scale vs Normalized Comparison)
    const btnScaleTrue = document.getElementById('btn-scale-true');
    const btnScaleNorm = document.getElementById('btn-scale-norm');

    if (btnScaleTrue && btnScaleNorm) {
      btnScaleTrue.addEventListener('click', () => {
        state.comparison.scaleMode = 'true';
        btnScaleTrue.classList.add('active');
        btnScaleNorm.classList.remove('active');
        renderSizeComparisonStage(state.explorer.comparisonList);
      });

      btnScaleNorm.addEventListener('click', () => {
        state.comparison.scaleMode = 'norm';
        btnScaleNorm.classList.add('active');
        btnScaleTrue.classList.remove('active');
        renderSizeComparisonStage(state.explorer.comparisonList);
      });
    }

    // Metric Selectors
    document.querySelectorAll('#comp-metric-selectors .metric-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#comp-metric-selectors .metric-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.comparison.selectedMetric = btn.getAttribute('data-metric');
        renderSingleMetricChart(state.explorer.comparisonList);
      });
    });

    // Radar Toggle
    const btnToggleRadar = document.getElementById('btn-toggle-radar');
    const radarWrap = document.getElementById('radar-viewport-wrap');
    if (btnToggleRadar && radarWrap) {
      btnToggleRadar.addEventListener('click', () => {
        state.comparison.showRadar = !state.comparison.showRadar;
        radarWrap.style.display = state.comparison.showRadar ? 'block' : 'none';
        btnToggleRadar.textContent = state.comparison.showRadar ? 'Hide Radar' : 'Show Radar';
      });
    }

    // Technical Table Toggle
    const btnToggleTable = document.getElementById('btn-toggle-spec-table');
    const tableWrap = document.getElementById('comp-table-collapse-wrapper');
    if (btnToggleTable && tableWrap) {
      btnToggleTable.addEventListener('click', () => {
        state.comparison.tableCollapsed = !state.comparison.tableCollapsed;
        tableWrap.style.display = state.comparison.tableCollapsed ? 'none' : 'block';
        btnToggleTable.textContent = state.comparison.tableCollapsed ? 'Expand Table' : 'Collapse Table';
      });
    }
  }

  function togglePlanetComparison(name) {
    const list = state.explorer.comparisonList;
    const existingIndex = list.findIndex(p => p.name === name);

    if (existingIndex >= 0) {
      list.splice(existingIndex, 1);
    } else {
      if (list.length >= 4) {
        alert('Comparison is limited to 4 planetary bodies for legible matrix display.');
        return;
      }
      const planet = state.data.planets.find(p => p.name === name);
      if (planet) list.push(planet);
    }

    renderComparisonArena();
    renderTableRows();
  }

  function loadComparisonPreset(presetKey) {
    const planetNames = PRESETS[presetKey];
    if (!planetNames || !state.data) return;

    state.explorer.comparisonList = planetNames
      .map(name => state.data.planets.find(p => p.name === name))
      .filter(Boolean)
      .slice(0, 4);

    renderComparisonArena();
    renderTableRows();
  }

  function renderComparisonArena() {
    const list = state.explorer.comparisonList;
    const counterEl = document.getElementById('comp-selection-counter');
    const emptyState = document.getElementById('comparison-empty-state');
    const visualContent = document.getElementById('comparison-visual-content');
    const stripContainer = document.getElementById('selected-planets-strip');

    if (counterEl) {
      counterEl.innerHTML = `<span>${list.length} / 4 SELECTED</span>`;
    }

    if (list.length === 0) {
      if (stripContainer) stripContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (visualContent) visualContent.style.display = 'none';

      // Clean up charts
      ['comp-single-metric', 'comp-orbital-scatter', 'comp-radar'].forEach(chartId => {
        if (state.charts[chartId]) {
          state.charts[chartId].destroy();
          delete state.charts[chartId];
        }
      });
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (visualContent) visualContent.style.display = 'block';

    // 1. Selection Strip
    renderSelectedStrip(list);

    // 2. Visual Size Stage
    renderSizeComparisonStage(list);

    // 3. Multi-Metric Single Property Comparison Chart
    renderSingleMetricChart(list);

    // 4. Orbital Dynamics & Schematic Architecture
    renderOrbitalDynamics(list);

    // 5. Planetary Profile Radar Fingerprint
    renderRadarProfileChart(list);

    // 6. Dynamic Difference Summary
    renderDynamicDifferenceSummary(list);

    // 7. Compact Numerical Specification Table
    renderNumericalComparisonTable(list);
  }

  // Section 1: Compact Horizontal Selection Strip
  function renderSelectedStrip(list) {
    const strip = document.getElementById('selected-planets-strip');
    if (!strip) return;

    const colors = state.comparison.assignedColors;

    strip.innerHTML = list.map((p, idx) => {
      const color = colors[idx % colors.length];
      return `
        <div class="selected-chip" style="border-left: 3px solid ${color};">
          <span class="chip-color-indicator" style="background-color: ${color};"></span>
          <div class="chip-info">
            <span class="chip-name">${p.name}</span>
            <span class="chip-meta">Host: ${p.host || 'Unknown'} &bull; ${p.method || 'Unspecified'}</span>
          </div>
          <button type="button" class="chip-remove-btn" data-remove="${p.name}" title="Remove ${p.name}">&times;</button>
        </div>
      `;
    }).join('');

    strip.querySelectorAll('.chip-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-remove');
        togglePlanetComparison(name);
      });
    });
  }

  // Section 2: Visual Size Stage
  function renderSizeComparisonStage(list) {
    const stage = document.getElementById('visual-size-stage');
    const disclaimer = document.getElementById('size-disclaimer-bar');
    if (!stage) return;

    const colors = state.comparison.assignedColors;
    const isPhysical = state.comparison.scaleMode === 'true';

    // Find maximum measured radius for linear proportional diameter
    const validRadii = list.map(p => p.radius).filter(r => r !== null && r !== undefined && r > 0);
    const maxR = validRadii.length > 0 ? Math.max(...validRadii) : 1.0;

    stage.innerHTML = list.map((p, idx) => {
      const color = colors[idx % colors.length];
      const r = p.radius;

      if (r !== null && r !== undefined && r > 0) {
        let px;
        if (isPhysical) {
          // Linear diameter scaling proportional to planetary radius
          // Keeping minimum size 24px and maximum 165px
          px = Math.round(Math.max(24, Math.min(165, (r / Math.max(maxR, 1.0)) * 155)));
        } else {
          // Normalized comparison: uniform diameter 90px
          px = 90;
        }

        let classification = 'Exoplanet';
        if (r <= 1.25) classification = 'Earth-sized';
        else if (r <= 2.0) classification = 'Super-Earth';
        else if (r <= 6.0) classification = 'Sub-Neptune';
        else if (r <= 15.0) classification = 'Gas Giant';
        else classification = 'Super-Jupiter';

        return `
          <div class="planet-size-node">
            <div class="planet-disc-wrap">
              <div class="planet-sphere-disc" style="
                width: ${px}px;
                height: ${px}px;
                background: radial-gradient(circle at 35% 35%, #ffffff 0%, ${color} 55%, #050b14 100%);
                border: 2px solid ${color};
                box-shadow: inset -6px -6px 16px rgba(0,0,0,0.45), 0 8px 24px ${color}28;
              " title="${p.name}: ${r.toFixed(2)} R⊕"></div>
            </div>
            <div class="planet-size-labels">
              <span class="size-planet-name" style="color: ${color};">${p.name}</span>
              <span class="size-planet-rad">${r.toFixed(2)} R⊕</span>
              <span class="size-planet-context">${classification} &bull; ${r.toFixed(1)}&times; Earth</span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="planet-size-node">
            <div class="planet-disc-wrap">
              <div class="planet-sphere-disc" style="
                width: 64px;
                height: 64px;
                border: 2px dashed var(--text-muted);
                background-color: var(--bg-subtle);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--text-muted);">N/A</span>
              </div>
            </div>
            <div class="planet-size-labels">
              <span class="size-planet-name" style="color: ${color};">${p.name}</span>
              <span class="size-planet-rad" style="color: var(--text-muted); font-size: 0.95rem;">Unmeasured</span>
              <span class="size-planet-context">Radius Not Recorded</span>
            </div>
          </div>
        `;
      }
    }).join('');

    if (disclaimer) {
      if (isPhysical) {
        disclaimer.innerHTML = `<strong>Physical Scaling Protocol:</strong> Circle diameter is linearly proportional to measured radius in Earth radii ($R_\\oplus$). Earth equatorial baseline is $1.00\\ R_\\oplus$. Planetary lighting and colors are illustrative identifiers; physical exoplanetary surface and atmospheric textures are not scientifically verified.`;
      } else {
        disclaimer.innerHTML = `<strong>Normalized Comparison Mode:</strong> All planetary spheres are scaled to a standardized visual diameter for direct structural and atmospheric parameter comparison without geometric distortion.`;
      }
    }
  }

  // Section 3: Multi-Metric Segregated Comparison Chart
  function renderSingleMetricChart(list) {
    const ctx = document.getElementById('chart-comp-single-metric');
    const descEl = document.getElementById('comp-metric-desc');
    const noteEl = document.getElementById('comp-metric-note');
    if (!ctx) return;

    if (state.charts['comp-single-metric']) {
      state.charts['comp-single-metric'].destroy();
    }

    const metric = state.comparison.selectedMetric || 'radius';
    const colors = state.comparison.assignedColors;

    const METRIC_SPECS = {
      radius: {
        label: 'Planetary Radius',
        unit: 'R⊕',
        field: 'radius',
        desc: 'Comparing physical equatorial radii against Earth\'s baseline (1.00 R⊕).'
      },
      mass: {
        label: 'Planetary Mass',
        unit: 'M⊕',
        field: 'mass',
        desc: 'Comparing mass measurements in Earth masses (1.00 M⊕ = 5.97 × 10²⁴ kg).'
      },
      period: {
        label: 'Orbital Period',
        unit: 'days',
        field: 'period',
        desc: 'Comparing the time required for a full revolution around the parent host star.'
      },
      semi_major: {
        label: 'Semi-Major Axis',
        unit: 'AU',
        field: 'semi_major',
        desc: 'Comparing average orbital distance from host star in Astronomical Units (1 AU ≈ 149.6 × 10⁶ km).'
      },
      temp: {
        label: 'Equilibrium Temperature',
        unit: 'K',
        field: 'temp',
        desc: 'Comparing estimated planetary blackbody equilibrium temperatures in Kelvin.'
      },
      dist: {
        label: 'Distance from Earth',
        unit: 'pc',
        field: 'dist',
        desc: 'Comparing distance from our Solar System in parsecs (1 pc ≈ 3.26 light years).'
      }
    };

    const spec = METRIC_SPECS[metric];
    if (descEl) descEl.textContent = spec.desc;

    const labels = list.map(p => p.name);
    const dataValues = list.map(p => {
      const val = p[spec.field];
      return (val !== null && val !== undefined && val > 0) ? val : 0;
    });
    const bgColors = list.map((_, i) => colors[i % colors.length]);

    // Check for missing records
    const missingCount = list.filter(p => p[spec.field] === null || p[spec.field] === undefined).length;
    if (noteEl) {
      if (missingCount > 0) {
        noteEl.innerHTML = `<strong>Data Notice:</strong> ${missingCount} of the ${list.length} selected planets lack a recorded <em>${spec.label}</em> in the NASA composite catalog. Missing values are demarcated explicitly and never treated as zero.`;
      } else {
        noteEl.innerHTML = `<strong>Scientific Calibration:</strong> Incompatible physical units are strictly segregated. Plotted on a dedicated single-metric axis (${spec.unit}).`;
      }
    }

    state.charts['comp-single-metric'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${spec.label} (${spec.unit})`,
          data: dataValues,
          backgroundColor: bgColors,
          borderRadius: 2,
          barThickness: 28
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 10, bottom: 10, left: 10, right: 25 } },
        scales: {
          x: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 10 }
            },
            title: {
              display: true,
              text: `${spec.label} (${spec.unit})`,
              color: '#475569',
              font: { family: 'Inter, sans-serif', size: 11, weight: '600' }
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              color: '#0f172a',
              font: { family: 'JetBrains Mono, monospace', size: 11, weight: '600' }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'JetBrains Mono, monospace', size: 11 },
            bodyFont: { family: 'Inter, sans-serif', size: 11 },
            callbacks: {
              label: (context) => {
                const planet = list[context.dataIndex];
                const raw = planet[spec.field];
                if (raw === null || raw === undefined) {
                  return `Measurement: Not recorded in catalog`;
                }
                return `Value: ${raw} ${spec.unit}`;
              }
            }
          }
        }
      }
    });
  }

  // Section 4: Orbital Dynamics Scatter & Schematic SVG
  function renderOrbitalDynamics(list) {
    const ctx = document.getElementById('chart-comp-orbital-scatter');
    const svgEl = document.getElementById('schematic-orbital-svg');
    const headerEl = document.getElementById('schematic-orbital-header');
    const disclaimerEl = document.getElementById('schematic-disclaimer');
    if (!ctx) return;

    if (state.charts['comp-orbital-scatter']) {
      state.charts['comp-orbital-scatter'].destroy();
    }

    const colors = state.comparison.assignedColors;

    // Filter planets with orbital parameters
    const validPlanets = list.filter(p =>
      p.semi_major !== null && p.semi_major !== undefined && p.semi_major > 0 &&
      p.period !== null && p.period !== undefined && p.period > 0
    );

    const datasets = list.map((p, idx) => {
      const color = colors[idx % colors.length];
      if (p.semi_major && p.period) {
        return {
          label: p.name,
          data: [{ x: p.semi_major, y: p.period }],
          backgroundColor: color,
          borderColor: color,
          pointRadius: 8,
          pointHoverRadius: 11
        };
      }
      return null;
    }).filter(Boolean);

    state.charts['comp-orbital-scatter'] = new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'logarithmic',
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 10 }
            },
            title: {
              display: true,
              text: 'Semi-Major Axis a (AU, log scale)',
              color: '#475569',
              font: { family: 'Inter, sans-serif', size: 11, weight: '600' }
            }
          },
          y: {
            type: 'logarithmic',
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono, monospace', size: 10 }
            },
            title: {
              display: true,
              text: 'Orbital Period P (days, log scale)',
              color: '#475569',
              font: { family: 'Inter, sans-serif', size: 11, weight: '600' }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              font: { family: 'JetBrains Mono, monospace', size: 10 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (context) => {
                const pt = context.raw;
                return `${context.dataset.label}: a = ${pt.x} AU, P = ${pt.y} d`;
              }
            }
          }
        }
      }
    });

    // Schematic Orbit Architecture SVG
    if (svgEl) {
      const hosts = [...new Set(list.map(p => p.host).filter(Boolean))];
      const isSingleHost = hosts.length === 1;

      if (headerEl) {
        if (isSingleHost) {
          headerEl.textContent = `SYSTEM HOST: ${hosts[0]} (CO-ORBITING ARCHITECTURE)`;
        } else {
          headerEl.textContent = `COMPARATIVE ORBIT RADII SCHEMATIC (DISTINCT STELLAR HOSTS)`;
        }
      }

      if (disclaimerEl) {
        if (isSingleHost) {
          disclaimerEl.textContent = `All selected worlds orbit ${hosts[0]}. Concentric elliptical rings illustrate relative measured semi-major axes. Eccentricity and 3D inclination are idealized.`;
        } else {
          disclaimerEl.textContent = `Selected worlds originate from separate host stars (${hosts.join(', ')}). Paths depict relative orbital distance from respective hosts.`;
        }
      }

      // Sort planets by semi-major axis for coherent concentric visual
      const orbitPlanets = list
        .map((p, idx) => ({ ...p, color: colors[idx % colors.length] }))
        .filter(p => p.semi_major && p.semi_major > 0)
        .sort((a, b) => a.semi_major - b.semi_major);

      if (orbitPlanets.length === 0) {
        svgEl.innerHTML = `
          <text x="250" y="85" text-anchor="middle" font-size="12" fill="#94a3b8" font-family="Inter, sans-serif">
            Orbital semi-major axes unmeasured for selected bodies
          </text>
        `;
        return;
      }

      let svgContent = `
        <defs>
          <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="1" />
            <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#d97706" stop-opacity="0" />
          </radialGradient>
        </defs>
        <!-- Central Host Star -->
        <circle cx="250" cy="80" r="14" fill="url(#star-glow)" />
        <circle cx="250" cy="80" r="7" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
        <text x="250" y="104" text-anchor="middle" font-size="9" font-family="JetBrains Mono, monospace" fill="#64748b" font-weight="600">
          ${isSingleHost ? hosts[0] : 'Host Star'}
        </text>
      `;

      const numOrbits = orbitPlanets.length;
      orbitPlanets.forEach((p, i) => {
        // Space orbits outward progressively
        const rx = 45 + ((i + 1) * (185 / (numOrbits + 1)));
        const ry = 18 + ((i + 1) * (48 / (numOrbits + 1)));
        const angle = 0.4 + (i * 1.5); // position planets around the ellipse
        const px = 250 + rx * Math.cos(angle);
        const py = 80 + ry * Math.sin(angle);

        svgContent += `
          <!-- Orbit Track -->
          <ellipse cx="250" cy="80" rx="${rx}" ry="${ry}" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3,3" />
          <!-- Planet Node -->
          <circle cx="${px}" cy="${py}" r="5" fill="${p.color}" stroke="#ffffff" stroke-width="1.5" />
          <text x="${px}" y="${py - 8}" text-anchor="middle" font-size="8.5" font-family="JetBrains Mono, monospace" fill="${p.color}" font-weight="700">
            ${p.name} (${p.semi_major.toFixed(3)} AU)
          </text>
        `;
      });

      svgEl.innerHTML = svgContent;
    }
  }

  // Section 5: Planetary Profile Radar Chart
  function renderRadarProfileChart(list) {
    const ctx = document.getElementById('chart-comp-radar');
    if (!ctx) return;

    if (state.charts['comp-radar']) {
      state.charts['comp-radar'].destroy();
    }

    const colors = state.comparison.assignedColors;
    const dimensions = [
      { key: 'radius', label: 'Radius' },
      { key: 'mass', label: 'Mass' },
      { key: 'period', label: 'Orbital Period' },
      { key: 'temp', label: 'Eq. Temp' },
      { key: 'semi_major', label: 'Semi-Major' }
    ];

    // Compute min and max across selected planets for each dimension
    const ranges = {};
    dimensions.forEach(dim => {
      const vals = list.map(p => p[dim.key]).filter(v => v !== null && v !== undefined && v > 0);
      if (vals.length > 0) {
        ranges[dim.key] = { min: Math.min(...vals), max: Math.max(...vals) };
      } else {
        ranges[dim.key] = { min: 1, max: 1 };
      }
    });

    const datasets = list.map((p, idx) => {
      const color = colors[idx % colors.length];
      const scores = dimensions.map(dim => {
        const val = p[dim.key];
        if (val === null || val === undefined || val <= 0) {
          // Missing value: set to null so it is not plotted as zero
          return null;
        }
        const { min, max } = ranges[dim.key];
        if (max === min) return 0.55;
        // Min-max scaled between 0.15 and 1.0
        return 0.15 + 0.85 * ((val - min) / (max - min));
      });

      return {
        label: p.name,
        data: scores,
        borderColor: color,
        backgroundColor: color + '18',
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 4,
        borderWidth: 2
      };
    });

    state.charts['comp-radar'] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dimensions.map(d => d.label),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 1.0,
            ticks: { display: false },
            grid: { color: '#e2e8f0' },
            angleLines: { color: '#e2e8f0' },
            pointLabels: {
              color: '#334155',
              font: { family: 'JetBrains Mono, monospace', size: 10, weight: '600' }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              font: { family: 'JetBrains Mono, monospace', size: 10 }
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            callbacks: {
              label: (context) => {
                const planet = list[context.datasetIndex];
                const dim = dimensions[context.dataIndex];
                const raw = planet[dim.key];
                return `${planet.name} ${dim.label}: ${raw !== null && raw !== undefined ? raw : 'Not recorded'}`;
              }
            }
          }
        }
      }
    });
  }

  // Section 6: Dynamic Difference Summary
  function renderDynamicDifferenceSummary(list) {
    const container = document.getElementById('difference-summary-grid');
    if (!container) return;

    const findings = [];

    // 1. Planetary Size Finding
    const withRadius = list.filter(p => p.radius !== null && p.radius !== undefined && p.radius > 0);
    if (withRadius.length > 0) {
      withRadius.sort((a, b) => b.radius - a.radius);
      const largest = withRadius[0];
      const smallest = withRadius[withRadius.length - 1];
      if (withRadius.length > 1 && largest.radius > smallest.radius) {
        const ratio = (largest.radius / smallest.radius).toFixed(1);
        findings.push({
          category: 'Physical Scale Divergence',
          text: `<strong>${largest.name}</strong> has the largest recorded radius at <strong>${largest.radius.toFixed(2)} R⊕</strong>, which is <strong>${ratio}&times;</strong> the size of <strong>${smallest.name}</strong> (${smallest.radius.toFixed(2)} R⊕).`
        });
      } else {
        findings.push({
          category: 'Physical Scale',
          text: `<strong>${largest.name}</strong> exhibits a measured radius of <strong>${largest.radius.toFixed(2)} R⊕</strong>.`
        });
      }
    }

    // 2. Mass Extreme Finding
    const withMass = list.filter(p => p.mass !== null && p.mass !== undefined && p.mass > 0);
    if (withMass.length > 0) {
      withMass.sort((a, b) => b.mass - a.mass);
      const maxMass = withMass[0];
      findings.push({
        category: 'Gravitational Mass Dominance',
        text: `<strong>${maxMass.name}</strong> possesses the greatest recorded mass among selected bodies at <strong>${maxMass.mass.toLocaleString()} M⊕</strong>.`
      });
    }

    // 3. Orbital Velocity / Period Finding
    const withPeriod = list.filter(p => p.period !== null && p.period !== undefined && p.period > 0);
    if (withPeriod.length > 0) {
      withPeriod.sort((a, b) => a.period - b.period);
      const fastest = withPeriod[0];
      const slowest = withPeriod[withPeriod.length - 1];
      const periodDesc = fastest.period < 1.0
        ? `just ${(fastest.period * 24).toFixed(1)} hours`
        : `${fastest.period.toFixed(2)} days`;

      findings.push({
        category: 'Orbital Kinematics',
        text: `<strong>${fastest.name}</strong> executes the shortest orbital period (${periodDesc}), completing full revolutions ${withPeriod.length > 1 ? `far faster than ${slowest.name} (${slowest.period.toFixed(1)} d)` : 'rapidly'}.`
      });
    }

    // 4. Thermal Regime Finding
    const withTemp = list.filter(p => p.temp !== null && p.temp !== undefined && p.temp > 0);
    if (withTemp.length >= 2) {
      withTemp.sort((a, b) => b.temp - a.temp);
      const hottest = withTemp[0];
      const coolest = withTemp[withTemp.length - 1];
      const deltaT = Math.round(hottest.temp - coolest.temp);
      findings.push({
        category: 'Thermal Regime Differential',
        text: `Equilibrium temperatures span a difference of <strong>${deltaT.toLocaleString()} K</strong>, from <strong>${coolest.name}</strong> (${coolest.temp} K) to <strong>${hottest.name}</strong> (${hottest.temp} K).`
      });
    }

    // 5. System Relationship Finding
    const hosts = [...new Set(list.map(p => p.host).filter(Boolean))];
    if (hosts.length === 1) {
      findings.push({
        category: 'System Architecture',
        text: `All ${list.length} selected exoplanets orbit the same central host star (<strong>${hosts[0]}</strong>), confirming a true multi-planet system architecture.`
      });
    } else {
      findings.push({
        category: 'System Diversity',
        text: `Selected planets orbit <strong>${hosts.length} distinct stellar hosts</strong> (${hosts.join(', ')}).`
      });
    }

    // 6. Data Completeness Finding
    let missingNotes = [];
    const missingRadii = list.filter(p => !p.radius).length;
    const missingMass = list.filter(p => !p.mass).length;
    const missingTemp = list.filter(p => !p.temp).length;

    if (missingRadii > 0) missingNotes.push(`${missingRadii} lack radius`);
    if (missingMass > 0) missingNotes.push(`${missingMass} lack mass`);
    if (missingTemp > 0) missingNotes.push(`${missingTemp} lack temperature`);

    if (missingNotes.length > 0) {
      findings.push({
        category: 'Catalog Completeness',
        text: `Observation gaps present: ${missingNotes.join(', ')}. Unrecorded values are omitted from parametric scaling to prevent computational bias.`
      });
    } else {
      findings.push({
        category: 'High Data Completeness',
        text: `All ${list.length} selected worlds possess complete verified physical measurements across standard parameter dimensions.`
      });
    }

    container.innerHTML = findings.map(f => `
      <div class="summary-finding-card">
        <div class="finding-category">${f.category}</div>
        <div class="finding-text">${f.text}</div>
      </div>
    `).join('');
  }

  // Section 7: Compact Numerical Comparison Table
  function renderNumericalComparisonTable(list) {
    const table = document.getElementById('comp-numerical-table');
    if (!table) return;

    const colors = state.comparison.assignedColors;

    const properties = [
      { key: 'radius', label: 'Planetary Radius', unit: 'R⊕', numeric: true },
      { key: 'mass', label: 'Planetary Mass', unit: 'M⊕', numeric: true },
      { key: 'period', label: 'Orbital Period', unit: 'days', numeric: true },
      { key: 'semi_major', label: 'Semi-Major Axis', unit: 'AU', numeric: true },
      { key: 'temp', label: 'Equilibrium Temperature', unit: 'K', numeric: true },
      { key: 'dist', label: 'System Distance', unit: 'pc', numeric: true },
      { key: 'host', label: 'Host Star', unit: '', numeric: false },
      { key: 'method', label: 'Detection Method', unit: '', numeric: false },
      { key: 'year', label: 'Discovery Year', unit: '', numeric: false }
    ];

    let headerHtml = `
      <thead>
        <tr>
          <th style="min-width: 170px;">Measurement / Property</th>
          ${list.map((p, idx) => `
            <th style="min-width: 140px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: ${colors[idx % colors.length]}; margin-right: 6px;"></span>
              ${p.name}
            </th>
          `).join('')}
        </tr>
      </thead>
    `;

    let bodyRows = properties.map(prop => {
      // For numeric properties, determine min and max among valid comparable numbers
      let minVal = null;
      let maxVal = null;

      if (prop.numeric) {
        const validValues = list
          .map(p => p[prop.key])
          .filter(v => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v));

        if (validValues.length >= 2) {
          minVal = Math.min(...validValues);
          maxVal = Math.max(...validValues);
        }
      }

      const cells = list.map(p => {
        const val = p[prop.key];
        if (val === null || val === undefined || val === '') {
          return `<td><span class="val-unmeasured">Not available</span></td>`;
        }

        if (prop.numeric && typeof val === 'number') {
          const isMin = minVal !== null && minVal !== maxVal && val === minVal;
          const isMax = maxVal !== null && minVal !== maxVal && val === maxVal;

          let badgeClass = '';
          if (isMin) badgeClass = 'val-min';
          else if (isMax) badgeClass = 'val-max';

          const formattedVal = val.toLocaleString(undefined, { maximumFractionDigits: 3 });

          if (badgeClass) {
            return `<td><span class="${badgeClass}" title="${isMin ? 'Minimum value' : 'Maximum value'}">${formattedVal} ${prop.unit}</span></td>`;
          }
          return `<td>${formattedVal} ${prop.unit}</td>`;
        }

        return `<td>${val}</td>`;
      }).join('');

      return `
        <tr>
          <th scope="row" style="color: var(--text-secondary); font-weight: 600; font-family: var(--font-mono); font-size: 0.78rem;">
            ${prop.label}
          </th>
          ${cells}
        </tr>
      `;
    }).join('');

    table.innerHTML = headerHtml + `<tbody>${bodyRows}</tbody>`;
  }

  // ==========================================================================
  // SECTION 4: PLANETARY PHYSICS & STELLAR SYSTEM
  // ==========================================================================
  function renderPlanetaryPhysics() {
    if (!state.data) return;

    // A. Radius Category Bins
    const radiusBinsCtx = document.getElementById('chart-radius-bins');
    if (radiusBinsCtx && !state.charts['radius-bins']) {
      const bins = state.data.radius_bins;
      state.charts['radius-bins'] = new Chart(radiusBinsCtx, {
        type: 'bar',
        data: {
          labels: bins.map(b => b.bin),
          datasets: [{
            label: 'Planets in Category',
            data: bins.map(b => b.count),
            backgroundColor: ['#0f172a', '#0284c7', '#334155', '#d97706', '#be123c'],
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }

    // B. Mass vs. Radius Scatter Plot (Log-Log)
    const massRadCtx = document.getElementById('chart-mass-radius-scatter');
    if (massRadCtx && !state.charts['mass-radius-scatter']) {
      const scatterPoints = state.data.mass_radius_scatter;

      const groups = {};
      scatterPoints.forEach(pt => {
        const m = pt.method || 'Other';
        if (!groups[m]) groups[m] = [];
        groups[m].push({
          x: pt.radius,
          y: pt.mass,
          name: pt.name,
          host: pt.host,
          period: pt.period
        });
      });

      const datasets = Object.keys(groups).slice(0, 5).map(m => ({
        label: m,
        data: groups[m],
        backgroundColor: getMethodColor(m),
        pointRadius: 3.5,
        pointHoverRadius: 6
      }));

      state.charts['mass-radius-scatter'] = new Chart(massRadCtx, {
        type: 'scatter',
        data: { datasets },
        options: {
          ...getScientificChartOptions(),
          scales: {
            x: {
              type: 'logarithmic',
              title: { display: true, text: 'Planetary Radius (Earth Radii, log scale)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            },
            y: {
              type: 'logarithmic',
              title: { display: true, text: 'Planetary Mass (Earth Masses, log scale)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pt = ctx.raw;
                  return `${pt.name} (${pt.host}): R=${pt.x} R⊕, M=${pt.y} M⊕`;
                }
              }
            }
          }
        }
      });
    }

    // C. Orbital Period Histogram
    const periodCtx = document.getElementById('chart-period-hist');
    if (periodCtx && !state.charts['period-hist']) {
      const hist = state.data.distributions.period;
      state.charts['period-hist'] = new Chart(periodCtx, {
        type: 'bar',
        data: {
          labels: hist.map(b => `${b.low} - ${b.high} d`),
          datasets: [{
            label: 'Planets',
            data: hist.map(b => b.count),
            backgroundColor: '#0f172a',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }

    // D. Equilibrium Temperature Histogram
    const tempCtx = document.getElementById('chart-temp-hist');
    if (tempCtx && !state.charts['temp-hist']) {
      const hist = state.data.distributions.temperature;
      state.charts['temp-hist'] = new Chart(tempCtx, {
        type: 'bar',
        data: {
          labels: hist.map(b => `${b.low} - ${b.high} K`),
          datasets: [{
            label: 'Planets',
            data: hist.map(b => b.count),
            backgroundColor: '#0284c7',
            borderRadius: 1
          }]
        },
        options: {
          ...getScientificChartOptions(),
          plugins: { legend: { display: false } }
        }
      });
    }

    // E. Host-Star Properties Scatter (Stellar Temp vs Stellar Mass)
    const stellarCtx = document.getElementById('chart-stellar-scatter');
    if (stellarCtx && !state.charts['stellar-scatter'] && state.data.stellar) {
      const stars = state.data.stellar;
      state.charts['stellar-scatter'] = new Chart(stellarCtx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Host Stars (Teff vs Mass)',
            data: stars.map(s => ({
              x: s.teff,
              y: s.mass,
              host: s.host,
              rad: s.rad,
              planet: s.planet
            })),
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            borderColor: '#0f172a',
            borderWidth: 1,
            pointRadius: 3.5,
            pointHoverRadius: 6
          }]
        },
        options: {
          ...getScientificChartOptions(),
          scales: {
            x: {
              title: { display: true, text: 'Stellar Effective Temperature (K)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            },
            y: {
              title: { display: true, text: 'Host Star Mass (Solar Masses M☉)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw.host} (Planet: ${ctx.raw.planet}): Teff=${ctx.raw.x} K, Mass=${ctx.raw.y} M☉, Rad=${ctx.raw.rad} R☉`
              }
            }
          }
        }
      });
    }

    // F. Distance vs Radius Scatter Plot
    const distCtx = document.getElementById('chart-distance-scatter');
    if (distCtx && !state.charts['dist-scatter']) {
      const sample = state.data.mass_radius_scatter.filter(p => p.dist && p.radius);
      state.charts['dist-scatter'] = new Chart(distCtx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'System Distance (pc) vs Radius (R⊕)',
            data: sample.map(p => ({ x: p.dist, y: p.radius, name: p.name })),
            backgroundColor: 'rgba(2, 132, 199, 0.7)',
            pointRadius: 3
          }]
        },
        options: {
          ...getScientificChartOptions(),
          scales: {
            x: {
              type: 'logarithmic',
              title: { display: true, text: 'Distance from Earth (Parsecs, log scale)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            },
            y: {
              title: { display: true, text: 'Planetary Radius (R⊕)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw.name}: Dist=${ctx.raw.x} pc, Radius=${ctx.raw.y} R⊕`
              }
            }
          }
        }
      });
    }
  }

  // ==========================================================================
  // SECTION 5: CORRELATION MATRIX & STATISTICAL MODEL ENGINE
  // ==========================================================================
  function renderModelsAndCorrelation() {
    if (!state.data) return;

    // A. Correlation Heatmap Table
    const heatmapWrapper = document.getElementById('heatmap-wrapper');
    if (heatmapWrapper && !heatmapWrapper.hasChildNodes()) {
      const corr = state.data.correlation;
      const cols = corr.columns;
      const matrix = corr.matrix;

      let tableHtml = `
        <table class="heatmap-table">
          <thead>
            <tr>
              <th scope="col">Variable</th>
              ${cols.map(c => `<th scope="col">${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
      `;

      cols.forEach((rowLabel, i) => {
        tableHtml += `<tr><th scope="row">${rowLabel}</th>`;
        matrix[i].forEach((val, j) => {
          let bgColor = '#ffffff';
          let textColor = '#0f172a';
          if (val > 0) {
            bgColor = `rgba(217, 119, 6, ${Math.min(0.85, 0.08 + val * 0.75)})`;
            if (val > 0.6) textColor = '#ffffff';
          } else if (val < 0) {
            bgColor = `rgba(2, 132, 199, ${Math.min(0.85, 0.08 + Math.abs(val) * 0.75)})`;
            if (Math.abs(val) > 0.6) textColor = '#ffffff';
          }
          tableHtml += `
            <td class="heatmap-cell" style="background-color: ${bgColor}; color: ${textColor};" title="${rowLabel} &bull; ${cols[j]}: ${val.toFixed(3)}">
              ${val.toFixed(2)}
            </td>
          `;
        });
        tableHtml += '</tr>';
      });

      tableHtml += `</tbody></table>`;
      heatmapWrapper.innerHTML = tableHtml;
    }

    // B. Regression Model Metrics & Scatter
    const reg = state.data.regression;
    if (reg && reg.metrics) {
      setText('reg-eq', reg.metrics.equation);
      setText('reg-r2', reg.metrics.r2.toFixed(4));
      setText('reg-mae', reg.metrics.mae.toFixed(4));
      setText('reg-rmse', reg.metrics.rmse.toFixed(4));
    }

    const regCtx = document.getElementById('chart-regression-scatter');
    if (regCtx && !state.charts['regression-scatter'] && reg && reg.scatter) {
      const obsPoints = reg.scatter.map(pt => ({ x: pt.log_rad, y: pt.log_mass, name: pt.name }));

      const minX = Math.min(...reg.scatter.map(p => p.log_rad));
      const maxX = Math.max(...reg.scatter.map(p => p.log_rad));
      const slope = reg.metrics.slope;
      const intercept = reg.metrics.intercept;

      const linePoints = [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept }
      ];

      state.charts['regression-scatter'] = new Chart(regCtx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              type: 'line',
              label: 'Fitted Linear Model',
              data: linePoints,
              borderColor: '#0284c7',
              borderWidth: 2.5,
              pointRadius: 0,
              tension: 0
            },
            {
              type: 'scatter',
              label: 'Observed Test Exoplanets (log10)',
              data: obsPoints,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              pointRadius: 3
            }
          ]
        },
        options: {
          ...getScientificChartOptions(),
          scales: {
            x: {
              title: { display: true, text: 'log10 (Planet Radius in Earth Radii)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            },
            y: {
              title: { display: true, text: 'log10 (Planet Mass in Earth Masses)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw.name || 'Fit'}: log(R)=${ctx.raw.x.toFixed(2)}, log(M)=${ctx.raw.y.toFixed(2)}`
              }
            }
          }
        }
      });
    }

    // C. Outlier Review Bounds
    const outlierContainer = document.getElementById('outlier-cards-container');
    if (outlierContainer && state.data.outliers) {
      const outs = state.data.outliers;
      const names = {
        pl_rade: 'Planetary Radius (R⊕)',
        pl_orbper: 'Orbital Period (Days)',
        pl_bmasse: 'Planetary Mass (M⊕)',
        sy_dist: 'System Distance (pc)',
        pl_eqt: 'Equilibrium Temp (K)'
      };

      outlierContainer.innerHTML = Object.keys(outs).map(k => {
        const o = outs[k];
        return `
          <div class="spec-cell" style="background-color: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-xs); padding: 1.25rem;">
            <span class="spec-label">${names[k] || k}</span>
            <div class="spec-value" style="font-size: 1.8rem; color: var(--accent-amber);">${o.outliers.toLocaleString()}</div>
            <div class="spec-context">
              Flagged observations (${((o.outliers / o.total) * 100).toFixed(1)}% of measurements)
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); margin-top: 0.5rem;">
              Q1: ${o.q1} &bull; Q3: ${o.q3} &bull; Upper: ${o.upper}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Mass Predictor Logic
  function setupPredictor() {
    const input = document.getElementById('input-radius-predict');
    const btn = document.getElementById('btn-run-prediction');
    const result = document.getElementById('predict-result-text');

    function calculate() {
      if (!input || !result || !state.data || !state.data.regression) return;
      const r = parseFloat(input.value);
      if (isNaN(r) || r <= 0) {
        result.textContent = 'Invalid R';
        return;
      }
      const slope = state.data.regression.metrics.slope || 2.383;
      const intercept = state.data.regression.metrics.intercept || -0.006;

      const logR = Math.log10(r);
      const logM = slope * logR + intercept;
      const predMass = Math.pow(10, logM);

      result.textContent = `${predMass.toFixed(2)} M⊕`;
    }

    if (btn) btn.addEventListener('click', calculate);
    if (input) input.addEventListener('input', calculate);
  }

  // ==========================================================================
  // SECTION 6: DATA QUALITY SPECIFICATIONS
  // ==========================================================================
  function renderDataQuality() {
    if (!state.data) return;

    // Missing Values Horizontal Bar Chart
    const missingCtx = document.getElementById('chart-missing-values');
    if (missingCtx && !state.charts['missing-values']) {
      const report = state.data.data_quality.missing_report;
      const keys = Object.keys(report);
      const missingPct = keys.map(k => report[k].missing_pct);
      const availPct = keys.map(k => report[k].available_pct);

      state.charts['missing-values'] = new Chart(missingCtx, {
        type: 'bar',
        data: {
          labels: keys,
          datasets: [
            {
              label: 'Available Measurements (%)',
              data: availPct,
              backgroundColor: '#0f172a',
              borderRadius: 1
            },
            {
              label: 'Missing / Unmeasured (%)',
              data: missingPct,
              backgroundColor: '#be123c',
              borderRadius: 1
            }
          ]
        },
        options: {
          ...getScientificChartOptions(),
          indexAxis: 'y',
          scales: {
            x: {
              stacked: true,
              max: 100,
              title: { display: true, text: 'Percentage of Catalog Records (%)', color: '#475569' },
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            },
            y: {
              stacked: true,
              grid: { color: '#f1f5f9' },
              ticks: { color: '#64748b' }
            }
          }
        }
      });
    }

    // Data Dictionary Table
    const dictTbody = document.getElementById('dictionary-tbody');
    if (dictTbody && !dictTbody.hasChildNodes()) {
      const dict = state.data.data_dictionary;
      dictTbody.innerHTML = dict.map(row => `
        <tr>
          <th scope="row"><code>${row.field}</code></th>
          <td><strong>${row.meaning}</strong></td>
          <td><span style="font-family: var(--font-mono); color: var(--accent-aerospace); font-weight: 600;">${row.unit}</span></td>
          <td style="color: var(--text-secondary); font-size: 0.82rem;">${row.description}</td>
        </tr>
      `).join('');
    }
  }

  // Planet Technical Specification Modal (Dossier)
  function setupModals() {
    const modal = document.getElementById('planet-modal');
    const closeBtn = document.getElementById('btn-close-modal');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
    });
  }

  function openPlanetModal(planetName) {
    const modal = document.getElementById('planet-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content || !state.data) return;

    const planet = state.data.planets.find(p => p.name === planetName);
    if (!planet) return;

    content.innerHTML = `
      <div class="dossier-header-bar">
        <div>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em;">
            PLANETARY RECORD &bull; NASA ARCHIVE COMPOSITE
          </span>
          <h3 id="modal-planet-title" class="dossier-name">${planet.name}</h3>
          <div class="dossier-host">Host Star System: <strong>${planet.host}</strong></div>
        </div>
      </div>

      <!-- Specification Grid -->
      <div class="dossier-spec-grid">
        <div class="dossier-field">
          <div class="field-label">Planetary Radius</div>
          <div class="field-val">
            ${planet.radius ? planet.radius + ' R⊕' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
          <div class="field-sub">
            ${planet.radius ? (planet.radius / 11.2).toFixed(2) + ' Jupiter radii (RJ)' : 'Measurement unavailable'}
          </div>
        </div>

        <div class="dossier-field">
          <div class="field-label">Planetary Mass</div>
          <div class="field-val">
            ${planet.mass ? planet.mass + ' M⊕' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
          <div class="field-sub">
            ${planet.mass ? (planet.mass / 317.8).toFixed(2) + ' Jupiter masses (MJ)' : 'Measurement unavailable'}
          </div>
        </div>

        <div class="dossier-field">
          <div class="field-label">Orbital Period</div>
          <div class="field-val">
            ${planet.period ? planet.period + ' days' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
        </div>

        <div class="dossier-field">
          <div class="field-label">Semi-Major Axis</div>
          <div class="field-val">
            ${planet.semi_major ? planet.semi_major + ' AU' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
        </div>

        <div class="dossier-field">
          <div class="field-label">Equilibrium Temperature</div>
          <div class="field-val">
            ${planet.temp ? planet.temp + ' K' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
        </div>

        <div class="dossier-field">
          <div class="field-label">System Distance</div>
          <div class="field-val">
            ${planet.dist ? planet.dist + ' pc' : '<span style="color:var(--text-muted);">Unmeasured</span>'}
          </div>
        </div>
      </div>

      <!-- Facility & Stellar Context -->
      <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-xs); font-size: 0.86rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1.5rem;">
        <div><strong>Discovery Method:</strong> ${planet.method} (${planet.year || 'Unknown year'})</div>
        <div><strong>Observing Facility:</strong> ${planet.facility}</div>
        <div><strong>Host Stellar Effective Temp:</strong> ${planet.st_teff ? planet.st_teff + ' K' : 'Unmeasured'}</div>
        <div><strong>Host Stellar Mass / Radius:</strong> ${planet.st_mass ? planet.st_mass + ' M☉' : 'Unmeasured'} / ${planet.st_rad ? planet.st_rad + ' R☉' : 'Unmeasured'}</div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button type="button" class="btn-primary" id="modal-compare-btn" style="padding: 0.65rem 1.25rem; font-size: 0.8rem;">
          ${state.explorer.comparisonList.some(p => p.name === planet.name) ? 'REMOVE FROM COMPARISON' : '+ ADD TO COMPARISON MATRIX'}
        </button>
      </div>
    `;

    const compareBtn = document.getElementById('modal-compare-btn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        togglePlanetComparison(planet.name);
        modal.classList.remove('active');
      });
    }

    modal.classList.add('active');
  }

})();
