import type {DriveLoad} from '../../engine/index.js';
import {focus} from '../cell.js';
import type {SimpleField} from '../cell.js';
import type {OpenISDDriver} from '../driver/openISDDriver.js';
import type {OpenISDProjectJson} from '../openisdSchema.js';
import {ProjectAdvanced} from './projectAdvanced.js';

/** What loads the project's driver beyond the driver itself, read off the project's own record: the source
 *  resistance, the driver count, how the drivers are loaded and the voice coil's heating.
 *  The coil's temperature coefficient is `driver`'s own when it states one other than 0, else the project's; the
 *  project's only with the "Coil coefficient from project" WinISD bug switch (QO953.c16, `coilAlfaVC_per_K`).
 *  The Box tab's sealed readout, the volume it gives back, the charts and the Signal tab's power read exactly these. */
export function driveLoadOf(root: SimpleField<OpenISDProjectJson>, driver: OpenISDDriver): DriveLoad {
    const embedding = root.value.driverEmbedding;
    const winisdProjectAlfaVC = ProjectAdvanced.wrap(focus(root, 'advanced'), focus(root, 'filters')).winisdProjectAlfaVC.value;
    return {
        Rs_ohm: embedding.Rs_ohm,
        nDrivers: embedding.nDrivers,
        loading: embedding.loading,
        alfaVC_per_K: driver.coilAlfaVC_per_K(embedding.alfaVC_per_K, winisdProjectAlfaVC),
        vcTempRise_K: embedding.vcTempRise_K,
    };
}
