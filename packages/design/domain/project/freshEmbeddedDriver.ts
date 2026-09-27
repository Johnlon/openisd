import { realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import type { OpenISDProjectJson } from '../openisdSchema.js';

export function freshEmbeddedDriver(json: OpenISDProjectJson, appContext: AppContext = realAppContext): OpenISDProjectJson {
    const copy = structuredClone(json);
    copy.driverEmbedding.device.uuid = {value: appContext.newId()};
    return copy;
}
