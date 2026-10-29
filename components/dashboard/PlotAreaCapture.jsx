"use client";

import { useMemo, useState } from "react";
import { Crosshair, Loader2, MapPinned, RotateCcw, Trash2 } from "lucide-react";
import { formatArea, polygonAreaSqM, polygonPerimeterM } from "@/lib/geo";

const GOOD_ACCURACY_M = 15;

/**
 * Captures the dimensions of a plot with the device GPS.
 * Stand at each corner of the plot and tap "Add corner point"; with three or more points the
 * enclosed area and perimeter are calculated and handed to the listing form via onChange.
 */
export default function PlotAreaCapture({ onChange }) {
  const [points, setPoints] = useState([]);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const metrics = useMemo(() => {
    if (points.length < 3) return null;
    return { areaSqM: polygonAreaSqM(points), perimeterM: polygonPerimeterM(points) };
  }, [points]);

  const publish = (nextPoints) => {
    setPoints(nextPoints);
    if (nextPoints.length < 3) {
      onChange?.(null);
      return;
    }
    const areaSqM = polygonAreaSqM(nextPoints);
    const perimeterM = polygonPerimeterM(nextPoints);
    onChange?.({
      areaSqM,
      perimeterM,
      areaLabel: formatArea(areaSqM),
      perimeterLabel: `${Math.round(perimeterM).toLocaleString("en-US")} m`,
      boundary: nextPoints.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("; "),
      pointCount: nextPoints.length,
    });
  };

  const addPoint = () => {
    setError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This device or browser does not support GPS location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        publish([...points, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }]);
      },
      (geoError) => {
        setLocating(false);
        setError(geoError.code === 1
          ? "Location permission was denied. Allow location access for this site and try again."
          : "Could not get a GPS fix. Move to open sky and try again.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // Simple preview of the captured boundary.
  const preview = useMemo(() => {
    if (points.length < 2) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 1e-7);
    const spanLng = Math.max(maxLng - minLng, 1e-7);
    const scale = 100 / Math.max(spanLat, spanLng);
    return points.map((p) => `${((p.lng - minLng) * scale + 10).toFixed(1)},${(110 - ((p.lat - minLat) * scale)).toFixed(1)}`);
  }, [points]);

  const worstAccuracy = points.length ? Math.max(...points.map((p) => p.accuracy || 0)) : 0;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-input)]/30 p-4">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          <MapPinned className="h-3.5 w-3.5 text-[var(--color-primary)]" /> Plot area (GPS)
        </span>
        <span className="text-[10px] text-[var(--color-muted)]">{points.length} point{points.length === 1 ? "" : "s"} captured</span>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
        Stand at each corner of the plot, in order around its boundary, and tap <strong>Add corner point</strong>. Capture at least 3 corners to calculate the area.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addPoint} disabled={locating} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60">
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          {locating ? "Getting GPS fix..." : "Add corner point"}
        </button>
        <button type="button" onClick={() => publish(points.slice(0, -1))} disabled={!points.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-[var(--color-text)] disabled:opacity-40">
          <RotateCcw className="h-3.5 w-3.5" /> Undo last
        </button>
        <button type="button" onClick={() => publish([])} disabled={!points.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold text-red-400 disabled:opacity-40">
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-400" role="alert">{error}</p>}

      {points.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <svg viewBox="0 0 120 120" className="h-28 w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]" aria-label="Captured plot boundary">
            {preview && (points.length >= 3
              ? <polygon points={preview.join(" ")} fill="var(--color-primary)" fillOpacity="0.2" stroke="var(--color-primary)" strokeWidth="1.5" />
              : <polyline points={preview.join(" ")} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />)}
            {(preview || ["10,110"]).map((pt, index) => {
              const [cx, cy] = pt.split(",");
              return <circle key={index} cx={cx} cy={cy} r="2.5" fill="var(--color-primary)" />;
            })}
          </svg>
          <ol className="max-h-28 space-y-0.5 overflow-y-auto text-[10px] text-[var(--color-muted)]">
            {points.map((p, index) => (
              <li key={index}>#{index + 1} {p.lat.toFixed(6)}, {p.lng.toFixed(6)} <span className={p.accuracy > GOOD_ACCURACY_M ? "text-amber-400" : ""}>(±{Math.round(p.accuracy)} m)</span></li>
            ))}
          </ol>
        </div>
      )}

      {metrics ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400" role="status">
          <p className="font-bold">Plot area: {formatArea(metrics.areaSqM)}</p>
          <p>Perimeter: {Math.round(metrics.perimeterM).toLocaleString("en-US")} m. These details are saved with the listing.</p>
          {worstAccuracy > GOOD_ACCURACY_M && <p className="mt-1 text-amber-400">GPS accuracy was up to ±{Math.round(worstAccuracy)} m, so the result is approximate. Re-capture in open sky for a better reading.</p>}
        </div>
      ) : points.length > 0 && <p className="text-[11px] text-[var(--color-muted)]">Add {3 - points.length} more corner point{3 - points.length === 1 ? "" : "s"} to calculate the area.</p>}
    </div>
  );
}
