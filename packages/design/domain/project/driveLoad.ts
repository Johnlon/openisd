import type {DriveLoad} from '../../engine/index.js';
import type {OpenISDDriverEmbeddingJson} from '../openisdSchema.js';

/** What loads the project's driver beyond the driver itself, read off the project's own record: the source
 *  resistance, the driver count and how the drivers are loaded.
 *  The Box tab's sealed readout and the volume it gives back read exactly these. */
export function driveLoadOf(embedding: OpenISDDriverEmbeddingJson): DriveLoad {
    return {
        Rs_ohm: embedding.Rs_ohm,
        nDrivers: embedding.nDrivers,
        loading: embedding.loading,
    };
}
