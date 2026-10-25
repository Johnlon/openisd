/**
 * A WinISD file states no short code (QO259), but earlier imports stored one anyway: the model
 * text for a `.wdr` driver, 'WPR-IMPORT' for a `.wpr` project's passive radiator. A saved
 * project carrying such a code loads with none ('') and the field is reported as repaired.
 * A code that came from a datasheet, or one that differs from the model, is left alone.
 */
import type {OpenISDProjectJson, OpenISDProjectSessionJson} from '../openisdSchema.js';
import type {FieldPath} from '../schemaRepair.js';

const IMPORT_PLACEHOLDER = 'WPR-IMPORT';

function isImportSku(sku: {readonly value: string; readonly grounds: readonly {readonly origin: string}[]}, model: string): boolean {
    if (sku.value === IMPORT_PLACEHOLDER) return true;
    return sku.value !== '' && sku.value === model && sku.grounds.every(g => g.origin === 'manual');
}

interface SkuHolder {
    readonly sku: {readonly value: string; readonly grounds: readonly {readonly origin: string}[]};
    readonly model: {readonly value: string};
}

/** `device` with an import's placeholder short code cleared; `device` itself when it has none. */
export function deviceWithoutImportSku<D extends SkuHolder>(device: D): D {
    if (!isImportSku(device.sku, device.model.value)) return device;
    return {...device, sku: {value: '', grounds: [{origin: 'manual' as const, reading: ''}]}};
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
