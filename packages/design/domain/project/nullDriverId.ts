import type { OpenISDProjectJson } from '../openisdSchema.js';

/** The id an embedded driver holds in stored project text. The driver inside a project has no id
 *  of its own (John, QO312), but the record type requires the field, so it holds this. */
export const NULL_GUID = '00000000-0000-0000-0000-000000000000';

/** `json` with its embedded driver's id set to the null GUID, whatever it was stored with. */
export function withNullEmbeddedDriverId(json: OpenISDProjectJson): OpenISDProjectJson {
    const {driverEmbedding} = json;
    const {device} = driverEmbedding;
    return {...json, driverEmbedding: {...driverEmbedding, device: {...device, uuid: {...device.uuid, value: NULL_GUID}}}};
}
