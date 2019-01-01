import fs from 'fs'
import deg2rad from 'deg2rad'
import zlib from 'zlib'
import createPoint from './models/point.mjs';

/**
 * Intersection of two arrays as an array
 */
const intersection = (a, b) => a.filter(val => b.indexOf(val) !== -1);

/**
 * Read point data from provided file. Expects the file to be compressed.
 * 
 * @param filename - filename to read in workdir
 * @param maxEntries - amount of points to read (undefined for all)
 */
const readPointsFromFile = (filename, maxEntries = undefined) => {

  const file = fs.readFileSync(filename);
  const uncompressed = zlib.gunzipSync(file).toString();
  const points = uncompressed.split("\n").map((line) => {
    const cols = line.split(";");
    return createPoint(cols[0], cols[1], cols[2], cols[3]);
  });

  return maxEntries ? points.splice(0, maxEntries) : points;
}

/**
 * Returns the distance between two points (as kilometers)
 * 
 * @param R - Radius of the earth as kilometers
 */
const distanceBetweenPoints = (lat1,lon1,lat2,lon2,R = 6378) => {
  const dLat = deg2rad(lat2 - lat1); 
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // distance in km
  return d;
}

/**
 * Sort two routes by amount of points (primary) and by lowest distance (secondary) 
 */
const sortRoutes = (a, b) => {
  return a.score < b.score ? 1 : -1;
}

const api = {
  intersection: intersection,
  readPointsFromFile: readPointsFromFile,
  distanceBetweenPoints: distanceBetweenPoints,
  sortRoutes: sortRoutes
}

export default api;