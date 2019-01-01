# Overview

Solution for reaktor christmas puzzle [traveling santa](https://traveling-santa.reaktor.com)

Problem was to find shortest overall distance for santa claus to deliver all the presents defined in the input file. From each child coordinates and gift weight was known. Santa claus could pack up maximum of 10.000kg worth of gifts at a time and then he'd need to return to Korvatunturi.

This solutions result was **8114372842** m calculated in 3 hours with MB pro with 2,2ghz Intel core i7 + 16gb ram. (~450k meters above the best score)

## Running

```npm start```

Adjust index.js config MAX_ENTRIES for input size.

## Dependencies

NodeJS v11.5 with flags --experimental-modules

**cluster**
node cluster module to parallelize work across multiple workers. Solution used worker/cpu core.

**redis** 
local in-memory cache to share computation data between workers to reduce required calculatio effort.

**ramda**
Just few usages of ramda utility functions, could've used more..

**deg2rad**
Conversion from degrees to radians in distance calculation.

**zlib**
Decompress file data