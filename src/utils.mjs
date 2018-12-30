import fs from 'fs'
import deg2rad from 'deg2rad'
import zlib from 'zlib'
import { createPoint } from './models.mjs';

export const intersection = (first, second) => first.filter(id => second.indexOf(id) !== -1);

/**
 * Find n points with most spread
 */
export const farthestPoints = (points, n = 10) => {

  const asPath = (p1, p2) => {
    return {
      point: p2,
      distance: distanceBetweenPoints(p1.lat,p1.lon,p2.lat,p2.lon)
    };
  };

  const resultCount = Math.min(points.length, n);
  const results = [];

  do {

    const resultIds = results.map(r => r.id);
    const remainingPoints = points.filter(p => !resultIds.includes(p.id));

    let randomPoint = remainingPoints[Math.floor(Math.random() * remainingPoints.length)];
    let paths = remainingPoints.map(p => asPath(randomPoint, p));
    paths.sort((a,b) => a.distance < b.distance ? 1 : -1);
    
    results.push(paths[0].point);

  } while (results.length < resultCount);

  return results;
}

/**
 * Reads the input file as an array of Points
 */
export const readPointsFromFile = (filename, maxEntries = undefined) => {
  // TODO: Store to redis and read from redis in workers.
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
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // distance in km
  return d;
}

/**
 * Sort two routes by amount of points (primary) and by lowest distance (secondary) 
 */
export const sortRoutes = (a, b) => {
  return sortByRouteScore(a,b);
}

const sortByRouteScore = (a, b) => {
  return a.score < b.score ? 1 : -1;
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