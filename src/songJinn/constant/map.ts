import {MapFeatures0} from './map-part-0';
import {MapFeatures1} from './map-part-1';
import {MapFeatures2} from './map-part-2';
import {MapFeatures3} from './map-part-3';

// The Natural Earth geometry is split across several modules so Rolldown emits
// each part as its own chunk. A single module this large cannot be split by the
// bundler and would exceed Vite's 500 kB chunk-size warning limit.
export const MapData = {
    type: 'FeatureCollection',
    features: [
        ...MapFeatures0,
        ...MapFeatures1,
        ...MapFeatures2,
        ...MapFeatures3,
    ],
};
