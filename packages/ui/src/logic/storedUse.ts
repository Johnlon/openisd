/** What OpenISD holds in this browser now, read for the storage notices and warnings. */
import type {StoredUse} from '@openisd/design/fields';
import type {ProjectRepo, StorageUsage} from '@openisd/persistence';

export function storedUseOf(projectRepo: ProjectRepo, storageUsage: StorageUsage): StoredUse {
  return {projectCount: projectRepo.listStoredProjects().length, localBytes: storageUsage.report().total};
}
