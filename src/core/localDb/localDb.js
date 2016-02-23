angular.module('classeur.core.localDb', [])
  .factory('clLocalDbStore',
    function ($window, clLocalDb) {
      var lastSeqMargin = 1000 // 1 sec
      var deletedMarkerMaxAge = 24 * 60 * 60 * 1000 // 24h

      function identity (value) {
        return value
      }

      return function (storeName, schema) {
        var attributeCheckers = {}
        var attributeReaders = {}
        var attributeWriters = {}

        angular.extend({
          updated: 'int'
        }, schema)
          .cl_each(function (value, key) {
            var storedValueKey = '$_' + key
            var defaultStoredValue = value.default === undefined ? '' : value.default
            var serializer = value.serializer || identity
            var parser = value.parser || identity
            if (value === 'int') {
              defaultStoredValue = 0
            } else if (value === 'object' || value === 'array') {
              defaultStoredValue = value === 'object' ? '{}' : '[]'
              parser = JSON.parse
              serializer = JSON.stringify
            }
            /* eslint-disable no-new-func */
            // Some dirty checking optimization
            attributeCheckers[key] = (new Function('serializer',
              'return function (dao) { return serializer(dao.' + key + ') !== dao.' + storedValueKey + '}'
            ))(serializer)
            if (value === 'string' || value === 'int') {
              attributeCheckers[key] = new Function('dao',
                'return dao.' + key + ' !== dao.' + storedValueKey
              )
            }
            /* eslint-enable no-new-func */
            attributeReaders[key] = function (dbItem, dao) {
              var storedValue = dbItem[key]
              if (!storedValue) {
                storedValue = defaultStoredValue
              }
              dao[storedValueKey] = storedValue
              dao[key] = parser(storedValue)
            }
            attributeWriters[key] = function (dbItem, dao) {
              var storedValue = serializer(dao[key])
              dao[storedValueKey] = storedValue
              if (storedValue && storedValue !== defaultStoredValue) {
                dbItem[key] = storedValue
              }
            }
          })

        var lastSeq = 0
        var storeSeqs = {}

        function readFromDb (item, daoMap) {
          lastSeq = Math.max(lastSeq, item.seq || 0)
          var dao = daoMap[item.id] || {}
          if (!item.updated) {
            delete storeSeqs[item.id]
            if (dao.updated) {
              delete daoMap[item.id]
              return true
            }
            return
          }
          if (storeSeqs[item.id] === item.seq) {
            return
          }
          storeSeqs[item.id] = item.seq
          if (item.updated === dao.updated) {
            return
          }
          for (var key in schema) {
            attributeReaders[key](item, dao)
          }
          attributeReaders.updated(item, dao)
          daoMap[item.id] = dao
          return true
        }

        function readAll (daoMap, tx, cb) {
          var hasChanged
          var store = tx.objectStore(storeName)
          var index = store.index('seq')
          var range = $window.IDBKeyRange.lowerBound(lastSeq - lastSeqMargin)
          var currentDate = Date.now()
          var itemsToDelete = []
          index.openCursor(range).onsuccess = function (event) {
            var cursor = event.target.result
            if (!cursor) {
              itemsToDelete.cl_each(function (item) {
                store.delete(item.id)
              })
              return cb(hasChanged)
            }
            var item = cursor.value
            hasChanged |= readFromDb(item, daoMap)
            // Remove old deleted markers
            if (!item.updated && currentDate - item.seq > deletedMarkerMaxAge) {
              itemsToDelete.push(item)
            }
            cursor.continue()
          }
        }

        function writeAll (daoMap, tx) {
          var currentDate = Date.now()
          var store = tx.objectStore(storeName)
          var daoChanged, updatedChanged
          // Remove deleted daos
          for (id in storeSeqs) {
            if (!daoMap[id]) {
              // Put an deleted marker to notify other tabs
              store.put({
                id: id,
                seq: currentDate
              })
              delete storeSeqs[id]
            }
          }
          // Put changes
          for (var id in daoMap) {
            var dao = daoMap[id]
            // Dirty checking
            daoChanged = updatedChanged = attributeCheckers.updated(dao)
            for (var key in schema) {
              daoChanged |= attributeCheckers[key](dao)
            }
            if (daoChanged) {
              if (!updatedChanged) {
                // Force update the `updated` attribute
                dao.updated = currentDate
              }
              var item = {
                id: id,
                seq: currentDate
              }
              attributeWriters.updated(item, dao)
              for (key in schema) {
                attributeWriters[key](item, dao)
              }
              store.put(item)
              storeSeqs[item.id] = item.seq
            }
          }
        }

        var store = {
          readAll: readAll,
          writeAll: writeAll
        }

        return store
      }
    }
)
  .factory('clLocalDb',
    function ($window, clLocalStorage) {
      var db
      var lastTx = Date.now()
      var lastTxMaxAge = 24 * 60 * 60 * 1000 // 24h
      var getTxCbs = []
      var storeNames = [
        'contents',
        'files',
        'folders',
        'classeurs',
        'objects'
      ]

      function createTx () {
        var currentDate = Date.now()
        // Deleted markers have been possibly removed or DB version has changed (Safari)
        if (currentDate - lastTx > lastTxMaxAge || parseInt(clLocalStorage.localDbVersion, 10) !== db.version) {
          return $window.location.reload()
        }
        lastTx = currentDate
        var tx = db.transaction(storeNames, 'readwrite')
        tx.oncomplete = function (event) {
          console.log('IDB commit', event)
        }
        tx.onerror = function (event) {
          console.log('IDB rollback', event)
        }
        return tx
      }

      ;(function () {
        // Init connexion
        var request = $window.indexedDB.open('classeur-db', 1)

        request.onerror = function (event) {
          $window.alert("Can't connect to IndexedDB.")
        }

        request.onsuccess = function (event) {
          db = event.target.result

          clLocalStorage.localDbVersion = db.version // Safari does not support onversionchange
          db.onversionchange = function (event) {
            return $window.location.reload()
          }

          getTxCbs.cl_each(function (cb) {
            cb(createTx())
          })
        }

        request.onupgradeneeded = function (event) {
          var db = event.target.result
          var oldVersion = event.oldVersion || 0
          function createStore (name) {
            var store = db.createObjectStore(name, { keyPath: 'id' })
            store.createIndex('seq', 'seq', { unique: false })
          }

          // Note: we don't use 'break' in this switch statement,
          // the fall-through behaviour is what we want.
          switch (oldVersion) {
            case 0:
              ;[
                'contents',
                'files',
                'folders',
                'classeurs',
                'objects'
              ].cl_each(createStore)
          }
        }
      })()

      return function (cb) {
        if (db) {
          cb(createTx())
        } else {
          getTxCbs.push(cb)
        }
      }
    })
