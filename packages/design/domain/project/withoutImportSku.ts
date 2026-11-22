/**
 * A WinISD file states no short code (QO259), but earlier imports stored one anyway: 'WPR-IMPORT'
 * for a `.wpr` project's passive radiator (the model text stored for a `.wdr` driver is cleared
 * once by the load upgrade, which still sees the grounds that said it was typed by the import,
 * `slimModel.ts`). A saved project carrying the placeholder loads with none ('') and the field is
 * reported as repaired.
 */
import type {OpenISDProjectJson, OpenISDProjectSessionJson} from '../openisdSchema.js';
import type {FieldPath} from '../schemaRepair.js';

const IMPORT_PLACEHOLDER = 'WPR-IMPORT';

interface SkuHolder {
    readonly sku: {readonly value: string};
}

/** `device` with an import's placeholder short code cleared; `device` itself when it has none. */
export function deviceWithoutImportSku<D extends SkuHolder>(device: D): D {
    if (device.sku.value !== IMPORT_PLACEHOLDER) return device;
    return {...device, sku: {value: ''}};
}

function clearedProject(project: OpenISDProjectJson, where: 'saved' | 'edited'): {project: OpenISDProjectJson; repaired: FieldPath[]} {
    const {driverEmbedding} = project;
    const {device} = driverEmbedding;
    const cleared = deviceWithoutImportSku(device);
    if (cleared === device) return {project, repaired: []};
    return {
        project: {...project, driverEmbedding: {...driverEmbedding, device: cleared}},
        repaired: [[where, 'driverEmbedding', 'device', 'sku']],
    };
}

/** `session` with an import's placeholder short code cleared in both states, and the fields cleared. */
export function withoutImportSku(session: OpenISDProjectSessionJson): {session: OpenISDProjectSessionJson; repaired: FieldPath[]} {
    const saved = clearedProject(session.saved, 'saved');
    const edited = session.edited === null ? null : clearedProject(session.edited, 'edited');
    return {
        session: {...session, saved: saved.project, edited: edited === null ? null : edited.project},
        repaired: [...saved.repaired, ...(edited === null ? [] : edited.repaired)],
    };
}
