# -*- coding: utf-8 -*-
"""
Exoplanet Discovery & Planetary Analytics Pipeline
Fetches from NASA Exoplanet Archive (with resilient fallback/cache),
cleans, analyzes, computes models, and exports web-ready data artifacts.
"""

from pathlib import Path
from datetime import datetime, timezone
import json
import sqlite3
import warnings
import urllib.request
import io

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

warnings.filterwarnings("ignore")

DATA_DIR = Path("data")
OUTPUT_DIR = Path("outputs")
DATA_DIR.mkdir(exist_ok=True, parents=True)
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)

RETRIEVED_AT_UTC = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
print(f"Starting pipeline at: {RETRIEVED_AT_UTC}")

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

columns = [
    "pl_name", "hostname", "discoverymethod", "disc_year", "disc_facility",
    "pl_orbper", "pl_rade", "pl_bmasse", "pl_bmassj", "pl_orbsmax",
    "pl_eqt", "sy_dist", "st_teff", "st_mass", "st_rad", "sy_snum", "sy_pnum"
]

query = f"""
SELECT {", ".join(columns)}
FROM pscomppars
WHERE pl_name IS NOT NULL
"""

raw_csv_path = DATA_DIR / "nasa_exoplanets_raw.csv"

# Fetch data if not already present or refresh
raw_df = None
if raw_csv_path.exists() and raw_csv_path.stat().st_size > 10000:
    print(f"Loading existing raw data from: {raw_csv_path}")
    raw_df = pd.read_csv(raw_csv_path)
else:
    print("Querying NASA Exoplanet Archive TAP API...")
    try:
        import urllib.parse
        encoded_params = urllib.parse.urlencode({"query": query, "format": "csv"})
        req_url = f"{TAP_URL}?{encoded_params}"
        req = urllib.request.Request(req_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, timeout=90) as response:
            content = response.read()
            raw_csv_path.write_bytes(content)
            raw_df = pd.read_csv(io.BytesIO(content))
            print(f"Retrieved {len(raw_df)} records successfully from NASA!")
    except Exception as exc:
        print(f"NASA TAP live query failed: {exc}")
        if raw_csv_path.exists():
            print("Reading from fallback raw CSV...")
            raw_df = pd.read_csv(raw_csv_path)
        else:
            raise RuntimeError("Could not fetch data and no local raw CSV exists.") from exc

print(f"Raw dataset shape: {raw_df.shape}")

# Metadata
metadata = {
    "source": "NASA Exoplanet Archive (pscomppars)",
    "retrieved_at_utc": RETRIEVED_AT_UTC,
    "raw_rows": int(raw_df.shape[0]),
    "columns": list(raw_df.columns)
}
with open(DATA_DIR / "retrieval_metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

# Initial checks
exact_duplicates_count = int(raw_df.duplicated().sum())

# Clean data
clean_df = raw_df.copy()
initial_rows = len(clean_df)
clean_df = clean_df.drop_duplicates().copy()

text_cols = ["pl_name", "hostname", "discoverymethod", "disc_facility"]
for col in text_cols:
    if col in clean_df.columns:
        clean_df[col] = clean_df[col].astype("string").str.strip()
        clean_df[col] = clean_df[col].replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})

numeric_cols = [
    "disc_year", "pl_orbper", "pl_rade", "pl_bmasse", "pl_bmassj",
    "pl_orbsmax", "pl_eqt", "sy_dist", "st_teff", "st_mass",
    "st_rad", "sy_snum", "sy_pnum"
]
for col in numeric_cols:
    if col in clean_df.columns:
        clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce")

# Plausible domain checks
positive_cols = [
    "pl_orbper", "pl_rade", "pl_bmasse", "pl_bmassj",
    "pl_orbsmax", "pl_eqt", "sy_dist", "st_teff", "st_mass", "st_rad"
]
invalid_counts = {}
for col in positive_cols:
    if col in clean_df.columns:
        invalid_mask = clean_df[col].notna() & (clean_df[col] <= 0)
        invalid_counts[col] = int(invalid_mask.sum())
        clean_df.loc[invalid_mask, col] = np.nan

clean_df = clean_df[clean_df["pl_name"].notna()].copy()
print(f"Cleaned dataset shape: {clean_df.shape}")

# Radius category binning
clean_df["radius_bin"] = pd.cut(
    clean_df["pl_rade"],
    bins=[0, 1, 2, 4, 10, np.inf],
    labels=["<=1 Earth radius", "1-2 Earth radii", "2-4 Earth radii", "4-10 Earth radii", ">10 Earth radii"],
    include_lowest=True
)

# Outlier summary function
def iqr_outlier_summary(series):
    values = series.dropna()
    if values.empty:
        return {"q1": 0.0, "q3": 0.0, "iqr": 0.0, "lower": 0.0, "upper": 0.0, "outliers": 0, "total": 0}
    q1 = float(values.quantile(0.25))
    q3 = float(values.quantile(0.75))
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    count = int(((values < lower) | (values > upper)).sum())
    return {
        "q1": round(q1, 3),
        "q3": round(q3, 3),
        "iqr": round(iqr, 3),
        "lower": round(lower, 3),
        "upper": round(upper, 3),
        "outliers": count,
        "total": len(values)
    }

outlier_stats = {
    col: iqr_outlier_summary(clean_df[col])
    for col in ["pl_rade", "pl_orbper", "pl_bmasse", "sy_dist", "pl_eqt"]
}

# Missing values report
missing_report = {}
for col in clean_df.columns:
    missing_cnt = int(clean_df[col].isna().sum())
    missing_report[col] = {
        "missing_count": missing_cnt,
        "available_count": len(clean_df) - missing_cnt,
        "missing_pct": round(100.0 * missing_cnt / len(clean_df), 2),
        "available_pct": round(100.0 * (len(clean_df) - missing_cnt) / len(clean_df), 2)
    }

# Overall completeness across key scientific variables
key_vars = ["pl_orbper", "pl_rade", "pl_bmasse", "pl_eqt", "sy_dist", "st_teff"]
total_cells = len(clean_df) * len(key_vars)
available_cells = sum(clean_df[c].notna().sum() for c in key_vars)
data_completeness_pct = round(100.0 * available_cells / total_cells, 1)

# Discovery timeline & Moving average
annual = (
    clean_df.dropna(subset=["disc_year"])
    .assign(disc_year=lambda x: x["disc_year"].astype(int))
    .groupby("disc_year")["pl_name"]
    .count()
    .sort_index()
)
# Focus from 1992 upwards (first confirmed exoplanets around pulsar PSR B1257+12)
annual = annual[annual.index >= 1992]
years_list = [int(y) for y in annual.index]
counts_list = [int(c) for c in annual.values]
rolling_3yr = [round(float(v), 1) for v in annual.rolling(window=3, min_periods=1).mean().values]

timeline_data = [
    {"year": y, "discoveries": c, "moving_avg": ma}
    for y, c, ma in zip(years_list, counts_list, rolling_3yr)
]

# Discovery methods
method_counts = clean_df["discoverymethod"].value_counts(dropna=False)
methods_data = [
    {"method": str(k), "count": int(v), "percentage": round(100.0 * v / len(clean_df), 2)}
    for k, v in method_counts.items() if pd.notna(k)
]

# Discovery facilities (Top 15)
facility_counts = clean_df["disc_facility"].value_counts().head(15)
facility_data = [
    {"facility": str(k), "count": int(v)}
    for k, v in facility_counts.items()
]

# Radius bins distribution
radius_bin_counts = clean_df["radius_bin"].value_counts(sort=False)
radius_bins_data = [
    {"bin": str(k), "count": int(v)}
    for k, v in radius_bin_counts.items()
]

# Correlation matrix
corr_cols = ["pl_orbper", "pl_rade", "pl_bmasse", "pl_orbsmax", "pl_eqt", "sy_dist", "st_teff", "st_mass"]
corr_labels = ["Orbital Period", "Planet Radius", "Planet Mass", "Semi-major Axis", "Equilibrium Temp", "Distance", "Stellar Temp", "Stellar Mass"]
corr_matrix = clean_df[corr_cols].corr().fillna(0).round(3)
corr_data = {
    "columns": corr_labels,
    "keys": corr_cols,
    "matrix": corr_matrix.values.tolist()
}

# Regression: log10(Radius) vs log10(Mass)
reg_subset = clean_df[["pl_name", "hostname", "pl_rade", "pl_bmasse", "discoverymethod"]].dropna().copy()
reg_subset = reg_subset[(reg_subset["pl_rade"] > 0) & (reg_subset["pl_bmasse"] > 0)]
reg_subset["log_rad"] = np.log10(reg_subset["pl_rade"])
reg_subset["log_mass"] = np.log10(reg_subset["pl_bmasse"])

regression_metrics = {}
regression_scatter = []

if len(reg_subset) >= 20:
    X = reg_subset[["log_rad"]]
    y = reg_subset["log_mass"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    y_pred = lr.predict(X_test)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(mean_squared_error(y_test, y_pred) ** 0.5)
    r2 = float(r2_score(y_test, y_pred))
    slope = float(lr.coef_[0])
    intercept = float(lr.intercept_)

    regression_metrics = {
        "sample_size": len(reg_subset),
        "test_size": len(X_test),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "slope": round(slope, 4),
        "intercept": round(intercept, 4),
        "equation": f"log10(Mass) = {round(slope, 3)} · log10(Radius) + {round(intercept, 3)}"
    }

    # Sample points for scatter visualization (up to 400 points to keep payload snappy)
    sample_points = reg_subset.sample(n=min(len(reg_subset), 400), random_state=42)
    for _, row in sample_points.iterrows():
        pred_log_mass = float(lr.predict([[row["log_rad"]]])[0])
        regression_scatter.append({
            "name": row["pl_name"],
            "radius": round(float(row["pl_rade"]), 2),
            "mass": round(float(row["pl_bmasse"]), 2),
            "log_rad": round(float(row["log_rad"]), 3),
            "log_mass": round(float(row["log_mass"]), 3),
            "pred_log_mass": round(pred_log_mass, 3),
            "pred_mass": round(float(10 ** pred_log_mass), 2),
            "method": str(row["discoverymethod"])
        })

# Mass vs Radius scatter plot data (for interactive exploration)
mass_radius_subset = clean_df.dropna(subset=["pl_rade", "pl_bmasse"]).copy()
mass_radius_subset = mass_radius_subset[(mass_radius_subset["pl_rade"] > 0) & (mass_radius_subset["pl_bmasse"] > 0)]
# Sample for visual rendering if large
if len(mass_radius_subset) > 700:
    mr_sample = mass_radius_subset.sample(n=700, random_state=42)
else:
    mr_sample = mass_radius_subset

mass_radius_data = [
    {
        "name": str(r["pl_name"]),
        "host": str(r["hostname"]),
        "year": int(r["disc_year"]) if pd.notna(r["disc_year"]) else None,
        "method": str(r["discoverymethod"]),
        "radius": round(float(r["pl_rade"]), 2),
        "mass": round(float(r["pl_bmasse"]), 2),
        "period": round(float(r["pl_orbper"]), 2) if pd.notna(r["pl_orbper"]) else None,
        "temp": round(float(r["pl_eqt"]), 0) if pd.notna(r["pl_eqt"]) else None,
        "dist": round(float(r["sy_dist"]), 1) if pd.notna(r["sy_dist"]) else None
    }
    for _, r in mr_sample.iterrows()
]

# Histograms / Distributions
def make_hist(series, bins_count=25, log_scale=False):
    s = series.dropna()
    if s.empty:
        return []
    if log_scale:
        s = s[s > 0]
        logs = np.log10(s)
        counts, bin_edges = np.histogram(logs, bins=bins_count)
        # convert edges back
        res = []
        for i in range(len(counts)):
            low = round(float(10 ** bin_edges[i]), 2)
            high = round(float(10 ** bin_edges[i+1]), 2)
            res.append({"bin_label": f"{low} - {high}", "count": int(counts[i]), "low": low, "high": high})
        return res
    else:
        # Cap high percentiles for readable histograms
        p99 = s.quantile(0.98)
        s_filt = s[s <= p99]
        counts, bin_edges = np.histogram(s_filt, bins=bins_count)
        res = []
        for i in range(len(counts)):
            low = round(float(bin_edges[i]), 1)
            high = round(float(bin_edges[i+1]), 1)
            res.append({"bin_label": f"{low} - {high}", "count": int(counts[i]), "low": low, "high": high})
        return res

hist_radius = make_hist(clean_df["pl_rade"], bins_count=20)
hist_mass = make_hist(clean_df["pl_bmasse"], bins_count=20, log_scale=True)
hist_period = make_hist(clean_df["pl_orbper"], bins_count=20, log_scale=True)
hist_temp = make_hist(clean_df["pl_eqt"], bins_count=20)
hist_dist = make_hist(clean_df["sy_dist"], bins_count=20)

explorer_cols = [
    "pl_name", "hostname", "discoverymethod", "disc_year", "pl_rade", 
    "pl_bmasse", "pl_orbper", "pl_orbsmax", "pl_eqt", "sy_dist", 
    "disc_facility", "st_teff", "st_mass", "st_rad"
]
explorer_df = clean_df[explorer_cols].copy()
explorer_records = []
for _, r in explorer_df.iterrows():
    explorer_records.append({
        "name": str(r["pl_name"]),
        "host": str(r["hostname"]) if pd.notna(r["hostname"]) else "Unknown",
        "method": str(r["discoverymethod"]) if pd.notna(r["discoverymethod"]) else "Other",
        "year": int(r["disc_year"]) if pd.notna(r["disc_year"]) else None,
        "radius": round(float(r["pl_rade"]), 2) if pd.notna(r["pl_rade"]) else None,
        "mass": round(float(r["pl_bmasse"]), 2) if pd.notna(r["pl_bmasse"]) else None,
        "period": round(float(r["pl_orbper"]), 2) if pd.notna(r["pl_orbper"]) else None,
        "semi_major": round(float(r["pl_orbsmax"]), 4) if pd.notna(r["pl_orbsmax"]) else None,
        "temp": round(float(r["pl_eqt"]), 0) if pd.notna(r["pl_eqt"]) else None,
        "dist": round(float(r["sy_dist"]), 1) if pd.notna(r["sy_dist"]) else None,
        "facility": str(r["disc_facility"]) if pd.notna(r["disc_facility"]) else "Not Specified",
        "st_teff": round(float(r["st_teff"]), 0) if pd.notna(r["st_teff"]) else None,
        "st_mass": round(float(r["st_mass"]), 2) if pd.notna(r["st_mass"]) else None,
        "st_rad": round(float(r["st_rad"]), 2) if pd.notna(r["st_rad"]) else None
    })

# Host-star properties dataset for Section 4 (Stellar Temperature vs Stellar Mass)
stellar_subset = clean_df.dropna(subset=["st_teff", "st_mass"]).copy()
stellar_subset = stellar_subset[(stellar_subset["st_teff"] > 1500) & (stellar_subset["st_mass"] > 0.05) & (stellar_subset["st_mass"] < 5)]
if len(stellar_subset) > 600:
    stellar_sample = stellar_subset.sample(n=600, random_state=42)
else:
    stellar_sample = stellar_subset

stellar_data = [
    {
        "host": str(r["hostname"]),
        "teff": round(float(r["st_teff"]), 0),
        "mass": round(float(r["st_mass"]), 2),
        "rad": round(float(r["st_rad"]), 2) if pd.notna(r["st_rad"]) else 1.0,
        "planet": str(r["pl_name"])
    }
    for _, r in stellar_sample.iterrows()
]

# Summary Stats
summary_stats = {
    "total_planets": int(clean_df["pl_name"].nunique()),
    "discovery_methods_count": int(clean_df["discoverymethod"].nunique()),
    "min_year": int(clean_df["disc_year"].min()) if clean_df["disc_year"].notna().any() else 1992,
    "max_year": int(clean_df["disc_year"].max()) if clean_df["disc_year"].notna().any() else 2026,
    "host_stars_count": int(clean_df["hostname"].nunique()),
    "data_completeness_pct": data_completeness_pct,
    "exact_duplicates_removed": exact_duplicates_count,
    "invalid_values_filtered": sum(invalid_counts.values())
}

# Data Dictionary
data_dictionary = [
    {"field": "pl_name", "meaning": "Planet Name", "unit": "String identifier", "description": "Standard astronomical name of the confirmed exoplanet"},
    {"field": "hostname", "meaning": "Host Star Name", "unit": "String identifier", "description": "Primary parent star around which the exoplanet orbits"},
    {"field": "discoverymethod", "meaning": "Discovery Method", "unit": "Categorical", "description": "Primary observational technique used to detect the planet"},
    {"field": "disc_year", "meaning": "Discovery Year", "unit": "Year (CE)", "description": "Year of formal scientific announcement or publication"},
    {"field": "disc_facility", "meaning": "Discovery Facility", "unit": "Observatory / Mission", "description": "Telescope, mission, or facility primarily credited with discovery"},
    {"field": "pl_orbper", "meaning": "Orbital Period", "unit": "Days", "description": "Time taken by the planet to complete one full revolution around its star"},
    {"field": "pl_rade", "meaning": "Planetary Radius", "unit": "Earth Radii (R⊕)", "description": "Physical radius of the planet normalized to Earth radius (1 R⊕ ≈ 6,371 km)"},
    {"field": "pl_bmasse", "meaning": "Planetary Mass", "unit": "Earth Masses (M⊕)", "description": "Best-estimate or minimum planetary mass normalized to Earth mass (1 M⊕ ≈ 5.972 × 10²⁴ kg)"},
    {"field": "pl_eqt", "meaning": "Equilibrium Temperature", "unit": "Kelvin (K)", "description": "Theoretical equilibrium temperature calculated assuming blackbody planetary albedo"},
    {"field": "sy_dist", "meaning": "Distance to System", "unit": "Parsecs (pc)", "description": "Distance from our Solar System to the planetary system (1 pc ≈ 3.26 light-years)"},
    {"field": "st_teff", "meaning": "Stellar Effective Temperature", "unit": "Kelvin (K)", "description": "Effective surface temperature of the primary host star"},
    {"field": "st_mass", "meaning": "Host Star Mass", "unit": "Solar Masses (M☉)", "description": "Mass of the host star normalized to Sun mass (1 M☉ ≈ 1.989 × 10³⁰ kg)"},
    {"field": "radius_bin", "meaning": "Radius Category", "unit": "Classification", "description": "Binned size tier (<=1 Earth radius, 1-2, 2-4, 4-10, >10 Earth radii)"}
]

# Assemble final dashboard payload
dashboard_payload = {
    "metadata": metadata,
    "summary": summary_stats,
    "timeline": timeline_data,
    "methods": methods_data,
    "facilities": facility_data,
    "radius_bins": radius_bins_data,
    "distributions": {
        "radius": hist_radius,
        "mass": hist_mass,
        "period": hist_period,
        "temperature": hist_temp,
        "distance": hist_dist
    },
    "mass_radius_scatter": mass_radius_data,
    "correlation": corr_data,
    "regression": {
        "metrics": regression_metrics,
        "scatter": regression_scatter
    },
    "outliers": outlier_stats,
    "data_quality": {
        "missing_report": missing_report,
        "completeness_pct": data_completeness_pct,
        "duplicates_removed": exact_duplicates_count,
        "invalid_counts": invalid_counts
    },
    "data_dictionary": data_dictionary,
    "stellar": stellar_data,
    "planets": explorer_records
}

# Export outputs
with open(OUTPUT_DIR / "dashboard_data.json", "w", encoding="utf-8") as f:
    json.dump(dashboard_payload, f, indent=2)

# Also sync assets/dashboard_data.js for standalone file:// and http:// execution
assets_js_path = Path("assets") / "dashboard_data.js"
with open(assets_js_path, "w", encoding="utf-8") as f:
    f.write("window.EXOPLANET_DATA = " + json.dumps(dashboard_payload) + ";")

clean_csv = OUTPUT_DIR / "exoplanets_cleaned.csv"
clean_json = OUTPUT_DIR / "exoplanets_cleaned.json"
clean_df.to_csv(clean_csv, index=False)
clean_df.to_json(clean_json, orient="records", indent=2)

annual_df = pd.DataFrame(timeline_data)
annual_df.to_csv(OUTPUT_DIR / "annual_discoveries.csv", index=False)
pd.DataFrame.from_dict(missing_report, orient="index").to_csv(OUTPUT_DIR / "missing_value_report.csv")
pd.DataFrame.from_dict(outlier_stats, orient="index").to_csv(OUTPUT_DIR / "outlier_report.csv")

# Save to SQLite database
db_path = OUTPUT_DIR / "exoplanet_analytics.db"
with sqlite3.connect(db_path) as conn:
    clean_df.to_sql("exoplanets", conn, if_exists="replace", index=False)
    annual_df.to_sql("annual_discoveries", conn, if_exists="replace", index=False)

print(f"Pipeline executed successfully!")
print(f"Total planets processed: {summary_stats['total_planets']}")
print(f"Dashboard data exported to: {OUTPUT_DIR / 'dashboard_data.json'}")
print(f"SQLite DB created at: {db_path}")
