# Overview

Solution for Reaktors christmas puzzle _Traveling Santa_

Puzzle problem was to find shortest overall distance for santa claus to deliver all the presents for 10k children. Each children had a one gift with predefined gift weight. Santa claus could only have 10.000kg at one trip, and then he would have to return to Korvatunturi.

https://traveling-santa.reaktor.com

Result **8114372842** meters calculated in 3 hours with MB pro with 2,2ghz Intel core i7 + 16gb ram. (~450k meters above the best score)

## Dependencies

NodeJS v11.5 with flags --experimental-modules

*cluster*

node cluster module to parallelize work across multiple workers. Solution used worker/cpu core.

*redis* 

local in-memory cache to share computation data between workers to reduce required calculatio effort.

*ramda*

Just few usages of ramda utility functions, could've used more..

*deg2rad*

Conversion from degrees to radians in distance calculation.

*zlib* 

Decompress file data

## TODO:

Work everything as more compact, more functional and readable if possible. Then final commit and to other challenges..

index.mjs
master.mjs
worker.mjs
util.mjs

models/route.mjs
models/graph.mjs
models/point.mjs

- master/worker variables to top of the module. assert that they arent seen in other modules
- make sense to master.mjs the async loop etc.
- max weight from config