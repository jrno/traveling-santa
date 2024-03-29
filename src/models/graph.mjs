import { default as util } from '../utils.mjs';

class Graph {

  constructor(points, depth) {
    this.points = points;
    this.depth = depth;
    this.points.forEach(p => this.mapPaths(p));
  }

  /**
   * Return points for given id's
   */
  getPoints(ids) {
    return this.points.filter(p => ids.includes(p.id));
  }

  /**
   * Return array of paths for given point, path contains distance and linked point. Results
   * are sorted to nearest first and result size is dictated by the graph depth.
   * 
   * @param p1 - point from which paths are resolved
   * @param ignoreIds - all point id's to ignore in path generation
   */
  mapPaths(p1, ignoreIds = []) {

    let paths = [];
    for (const p2 of this.points) {
      if (p1.id !== p2.id && !ignoreIds.includes(p2.id)) {
        paths.push({
          distance: util.distanceBetweenPoints(p1.lat, p1.lon, p2.lat, p2.lon), // TODO: use local cached value
          point: p2
        });
      }
    }

    paths.sort((a,b) => a.distance > b.distance ? 1 : -1);
    p1.paths = paths.slice(0, this.depth);
  }

  /**
   * Re-arrange graph after trip resolution. New connections are made between points that won't contain
   * already visited points.
   * 
   * @param resolvedPointIds - array of point ids visited in this trip
   * @param allPointIds - array of all point ids visited so far
   */
  arrange(resolvedPointIds, allPointIds) {

    // safe to drop visited children from the graph
    this.points = this.points.filter(point => !resolvedPointIds.includes(point.id));

    for (const p1 of this.points) {
      const connectedPointIds = p1.paths.map(path => path.point.id);
      if (util.intersection(connectedPointIds, resolvedPointIds).length > 0) {
        this.mapPaths(p1, allPointIds);
      }
    }
  }
}

export default Graph;
