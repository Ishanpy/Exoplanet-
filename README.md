# Exoplanet Analytics – NASA Archive Research Platform

## Overview

**Exoplanet Analytics** is an interactive, web-based dashboard for exploring and visualising data from the NASA Exoplanet Archive. It lets researchers and enthusiasts:

- Browse a curated set of ~6,500 confirmed exoplanets.
- Compare planetary properties side-by-side with rich scientific visualisations.
- Explore statistical relationships via correlation maps and modelling tools.
- Experience the data through a cinematic, aerospace-inspired UI.

Built with vanilla **HTML / CSS / JavaScript** (Chart.js) — fully client-side, no backend required.

---

## Project Structure

```
📦 DAV project/
├─ index.html                              # Main SPA entry point
├─ app.js                                  # Application logic & Chart.js controllers
├─ styles.css                              # Global styling & aerospace theme
├─ pipeline.py                             # Data pipeline: fetches & cleans NASA TAP data
├─ Exoplanet_Discovery_Planetary_Analytics.py  # EDA notebook / analysis script
├─ outputs/
│   └─ dashboard_data.json                 # Pre-processed dataset consumed by the frontend
├─ assets/                                 # Icons, images, static assets
├─ data/                                   # Raw CSVs (git-ignored)
├─ .gitignore
├─ .env.example                            # Environment variable template
└─ README.md                               # You are here
```

---

## Getting Started

### Prerequisites

- **Python 3.9+** – for running the data pipeline.
- A modern browser (Chrome, Edge, Firefox, Safari).

### 1 – Clone the repository

```bash
git clone <repository-url>
cd "DAV project"
```

### 2 – Set up the Python environment (for data pipeline only)

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt   # pandas, requests, etc.
```

### 3 – (Optional) Refresh the dataset

```bash
python pipeline.py
```

This fetches the latest data from the NASA TAP service and writes `outputs/dashboard_data.json`.

### 4 – Start the local dev server

```bash
python -m http.server 8080
```

Then open **http://localhost:8080** in your browser.

---

## Sections

| Section | Description |
|---------|-------------|
| **Overview Dashboard** | High-level metrics: total planets, discovery methods, date range, host stars |
| **Discovery Methods** | Breakdown by detection technique and facility with animated charts |
| **Temporal Analysis** | Year-by-year discovery trends and cumulative growth |
| **Planetary Properties** | Distribution of radius, mass, orbital period, and equilibrium temperature |
| **Planet Comparison** | Side-by-side visual analysis of up to four planets (scaled diagrams, radar fingerprint, orbital schematic) |
| **Correlation & Modelling** | Heat-map correlation matrix, scatter plots, and regression overlays |

---

## Data Pipeline

`pipeline.py` queries the NASA Exoplanet Archive via the **TAP** (Table Access Protocol) service:

```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync
```

It uses the `pscomppars` table (composite parameters – one row per confirmed planet) and exports a cleaned JSON file consumed directly by the frontend.

**Columns fetched:** `pl_name`, `hostname`, `discoverymethod`, `disc_year`, `disc_facility`, `pl_orbper`, `pl_rade`, `pl_bmasse`, `pl_orbsmax`, `pl_eqt`, `sy_dist`, `st_teff`, `st_mass`, `st_rad`, `sy_snum`, `sy_pnum`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `EXOPLANET_DATA_PATH` | `./outputs/dashboard_data.json` | Path to the pre-processed dataset |
| `NASA_API_KEY` | *(optional)* | NASA API key for additional services |
| `DEV_SERVER_PORT` | `8080` | Port used by the local HTTP server |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | HTML5, Vanilla CSS, Vanilla JavaScript |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Data source | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) |
| Data pipeline | Python 3 (pandas, requests) |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit your changes: `git commit -m "feat: add my feature"`.
4. Push to the branch: `git push origin feature/my-feature`.
5. Open a Pull Request with a clear description.

Please keep the aerospace design language consistent and ensure charts remain scientifically accurate.

---

## License

This project is licensed under the **MIT License**.

---

## Acknowledgements

- **NASA Exoplanet Archive** – data provider.
- **Chart.js** – visualisation library.
- Design inspiration from [Magdrive Rogue](https://magdrive.space/products/rogue/) and [Mapa do Astro](https://www.mapadoastro.com.br/).

---

*Happy exploring the cosmos! 🚀*
