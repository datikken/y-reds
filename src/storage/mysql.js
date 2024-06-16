import * as Y from 'yjs'
import mysql from 'mysql2/promise';

export const createMysqlStorage = async ({ database } = {}) => {
  // Create the connection to database
  const connection = await mysql.createConnection({
    host: 'auth-express-mysql-1',
    user: 'root',
    password: 'toor',
    database: 'yredis',
  });

  try {
    const [results] = await connection.query(
        "SHOW TABLES LIKE 'yredis_docs_v1'"
    );
    if(results.length === 0) {
      await connection.query(
          "CREATE TABLE yredis_docs_v1 (room TEXT, doc TEXT, r BIGINT NOT NULL AUTO_INCREMENT, u BLOB, sv BLOB, PRIMARY KEY(r))"
      )
    }
  } catch(e) {
    console.warn(e, 'Mysql connection failed');
  }

  return new MysqlStorage(connection);
}

class MysqlStorage {
  constructor (connection) {
    this.connection = connection
  }

  async persistDoc (room, docname, ydoc) {
    console.log('persistDoc')
    await this.connection.execute(
        "INSERT INTO yredis_docs_v1 (`room`,`doc`,`r`,`u`, `sv`) VALUES (?, ?, null, ?, ?)",
        [room, docname, Y.encodeStateAsUpdateV2(ydoc), Y.encodeStateVector(ydoc)]
    );
  }

  async retrieveDoc (room, docname) {
    console.log('retrieveDoc')
    const [rows] = await this.connection.execute(
        "SELECT u, r from `yredis_docs_v1` WHERE `room` = ? AND `doc` = ?",
        [room, docname]
    );

    if (rows.length === 0) {
      return null
    }

    const doc = Y.mergeUpdatesV2(rows.map(row => row.u))
    const references = rows.map(row => row.r)
    console.log(doc);
    return { doc, references }
  }

  async retrieveStateVector (room, docname) {
    const [rows] = this.connection.execute(
        "SELECT sv from `yredis_docs_v1` WHERE `room` = ? AND `doc` = ? LIMIT 1",
        [room, docname]
    );

    if (rows.length > 1) {
      console.log('Error with retrieveStateVector see MysqlStorage');
    }

    return rows.length === 0 ? null : rows[0].sv
  }

  async deleteReferences (room, docname, storeReferences) {
    await this.connection.execute(
        `DELETE FROM yredis_docs_v1 WHERE room = ? AND doc = ? AND r IN (${storeReferences.map(id=>"'"+id+"'").join()})`,
        [room, docname]
    );

    console.log('deleteReferences')
  }

  async destroy () {
    await this.connection.end();
  }
}

export const Storage = MysqlStorage
