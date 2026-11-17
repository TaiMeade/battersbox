import journal from './meta/_journal.json';
import m0000 from './0000_rare_marvel_boy.sql';
import m0001 from './0001_equal_rawhide_kid.sql';
import m0002 from './0002_sync_tables.sql';
import m0003 from './0003_sync_triggers.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  