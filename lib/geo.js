const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Projects lat/lng points onto a local flat plane (metres) around their centroid. */
function projectToMetres(points) {
  const lat0 = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng0 = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  const cosLat0 = Math.cos(toRad(lat0));
  return points.map((p) => ({
    x: toRad(p.lng - lng0) * EARTH_RADIUS_M * cosLat0,
    y: toRad(p.lat - lat0) * EARTH_RADIUS_M,
  }));
}

/** Area of a polygon of GPS points in square metres (shoelace formula on a local projection). */
export function polygonAreaSqM(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  const flat = projectToMetres(points);
  let twiceArea = 0;
  for (let i = 0; i < flat.length; i += 1) {
    const a = flat[i];
    const b = flat[(i + 1) % flat.length];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

/** Closed perimeter of the polygon in metres. */
export function polygonPerimeterM(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const flat = projectToMetres(points);
  let total = 0;
  for (let i = 0; i < flat.length; i += 1) {
    const a = flat[i];
    const b = flat[(i + 1) % flat.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function formatArea(areaSqM) {
  const hectares = areaSqM / 10000;
  const acres = areaSqM / 4046.8564224;
  return `${Math.round(areaSqM).toLocaleString("en-US")} m² (${hectares.toFixed(hectares < 1 ? 3 : 2)} ha / ${acres.toFixed(2)} acres)`;
}
