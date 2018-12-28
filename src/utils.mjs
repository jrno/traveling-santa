import fs from 'fs'
import deg2rad from 'deg2rad'
import zlib from 'zlib'
import { createPoint } from './models.mjs';
import { addPath } from './models.mjs';

/**
 * Reads the input file as an array of Points
 */
export const readPointsFromFile = (filename, maxEntries = undefined) => {
  const file = fs.readFileSync(filename);
  const uncompressed = zlib.gunzipSync(file).toString();
  const points = uncompressed.split("\n").map((line) => {
    const cols = line.split(";");
    return createPoint(cols[0], cols[1], cols[2], cols[3]);
  });

  return maxEntries ? points.splice(0, maxEntries) : points;
}

/**
 * Write arrays as csv
 */
export const writeCsv = (fileName, data, callback, separator = ';', linebreak = '\n') => {
  const csv = data.map(row => row.join(separator)).join(linebreak);
  fs.writeFile(`./solutions/${fileName}`, csv, (err) => {
    if (err) {
      callback(err);
    }
    callback();
  });
}

/**
 * Returns the distance between two points (as kilometers)
 * 
 * @param R - Radius of the earth as kilometers
 */
export const distanceBetweenPoints = (lat1,lon1,lat2,lon2,R = 6378) => {
  const dLat = deg2rad(lat2 - lat1); 
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // distance in km
  return d;
}

/**
 * Fill points with connections to one another (=paths). Function will calculate 
 * distance between points and create paths from one point to another
 * 
 * @param points - all points
 * @param maxNearestConnections - how many connections to nearest points to create
 */
export const fillConnections = (points, maxNearestConnections) => {

  for (const p1 of points) {
    for (const p2 of points) {
      if (p1.id !== p2.id) {
        addPath(p1, p2, distanceBetweenPoints(p1.lat, p1.lon, p2.lat, p2.lon));
      }
    }

    // sort by distance, nearest first. Leave connections to X nearest nodes only.
    p1.paths = p1.paths.sort((a,b) => a.distance > b.distance ? 1 : -1);
    p1.paths = p1.paths.slice(0, maxNearestConnections);
  }

  return points;
}

/**
 * Sort two routes by amount of points (primary) and by lowest distance (secondary) 
 */
export const sortRoutes = (a, b) => {
  // return sortByPointsAndDistance(a,b);
  return sortByDistanceToPointRatio(a,b); // 1.9M vs 2.2M better algorithm with standard setting.
}

const sortByDistanceToPointRatio = (a, b) => {
  return a.distanceToPointRatio > b.distanceToPointRatio ? 1 : -1;
}

const sortByPointsAndDistance = (a, b) => {
  if (a.points.length === b.points.length) {
    return a.distance > a.distance ? 1 : -1;
  }
  return a.points.length < b.points.length ? 1 : -1;
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
export const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}