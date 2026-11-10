import {announcementEndpointsForHostname, type AnnouncementEndpoints} from '../../src/logic/announcementCenter.js';

/** The TEST announcements server's endpoints, for tests only. Production code always passes its own. */
export function testAnnouncementEndpoints(): AnnouncementEndpoints {
  return announcementEndpointsForHostname('test.openisd.app');
}
