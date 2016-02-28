angular.module('classeur.core.localDb', [])
  .factory('clLocalDbStore',
    function ($window, clUid, clLocalDb, clDebug) {
      var debug = clDebug('classeur:clLocalDbStore')
      var deletedMarkerMaxAge = 60 * 60 * 1000 // 1h

      function identity (value) {
        return value
      }

      return function (storeName, schema) {
        schema = angular.extend({}, schema, {
          updated: 'int'
        })

        var schemaKeys = Object.keys(schema)
        var schemaKeysLen = schemaKeys.length
        var complexKeys = []
        var complexKeysLen = 0
        var attributeCheckers = {}
        var attributeReaders = {}
        var attributeWriters = {}

        function Dao (id, skipInit) {
          this.id = id || clUid()
          if (!skipInit) {
            var fakeItem = {}
            for (var i = 0; i < schemaKeysLen; i++) {
              attributeReaders[schemaKeys[i]](fakeItem, this)
            }
            this.$dirty = true
          }
        }

        function createDao (id) {
          return new Dao(id)
        }

        schema.cl_each(function (value, key) {
          var storedValueKey = '_' + key
          var defaultValue = value.default === undefined ? '' : value.default
          var serializer = value.serializer || identity
          var parser = value.parser || identity
          if (value === 'int') {
            defaultValue = 0
          } else if (value === 'object') {
            defaultValue = 'null'
            parser = JSON.parse
            serializer = JSON.stringify
          }

          attributeReaders[key] = function (dbItem, dao) {
            dao[storedValueKey] = dbItem[key] || defaultValue
          }
          attributeWriters[key] = function (dbItem, dao) {
            var storedValue = dao[storedValueKey]
            if (storedValue && storedValue !== defaultValue) {
              dbItem[key] = storedValue
            }
          }

          function getter () {
            return this[storedValueKey]
          }

          function setter (value) {
            value = value || defaultValue
            if (this[storedValueKey] !== value) {
              this[storedValueKey] = value
              this.$dirty = true
              return true
            }
          }

          if (key === 'updated') {
            Object.defineProperty(Dao.prototype, key, {
              get: getter,
              set: function (value) {
                if (setter.call(this, value)) {
                  this.$dirtyUpdated = true
                }
              }
            })
          } else if (value === 'string' || value === 'int') {
            Object.defineProperty(Dao.prototype, key, {
              get: getter,
              set: setter
            })
          } else if (![64, 128] // Handle string64 and string128
              .cl_some(function (length) {
                if (value === 'string' + length) {
                  Object.defineProperty(Dao.prototype, key, {
                    get: getter,
                    set: function (value) {
                      if (value && value.length > length) {
                        value = value.slice(0, length)
                      }
                      setter.call(this, value)
                    }
                  })
                  return true
                }
              })
          ) {
            // Other types go to complexKeys list
            complexKeys.push(key)
            complexKeysLen++

            // And have complex readers/writers
            attributeReaders[key] = function (dbItem, dao) {
              var storedValue = dbItem[key]
              if (!storedValue) {
                storedValue = defaultValue
              }
              dao[storedValueKey] = storedValue
              dao[key] = parser(storedValue)
            }
            attributeWriters[key] = function (dbItem, dao) {
              var storedValue = serializer(dao[key])
              dao[storedValueKey] = storedValue
              if (storedValue && storedValue !== defaultValue) {
                dbItem[key] = storedValue
              }
            }

            // Checkers are only for complex types
            attributeCheckers[key] = function (dao) {
              return serializer(dao[key]) !== dao[storedValueKey]
            }
          }
        })

        var lastSeq = 0
        var storedSeqs = Object.create(null)

        function readDbItem (item, daoMap) {
          lastSeq = Math.max(lastSeq, item.seq || 0)
          var dao = daoMap[item.id] || new Dao(item.id, true)
          if (!item.updated) {
            delete storedSeqs[item.id]
            if (dao.updated) {
              delete daoMap[item.id]
              return true
            }
            return
          }
          if (storedSeqs[item.id] === item.seq) {
            return
          }
          storedSeqs[item.id] = item.seq
          for (var i = 0; i < schemaKeysLen; i++) {
            attributeReaders[schemaKeys[i]](item, dao)
          }
          dao.$dirty = false
          dao.$dirtyUpdated = false
          daoMap[item.id] = dao
          return true
        }

        var lastReadAll

        function getPatch (tx, cb) {
          var currentDate = Date.now()
          var hasChanged = !lastReadAll
          var resetMap

          // We may have missed some deleted markers
          if (lastReadAll && currentDate - lastReadAll > deletedMarkerMaxAge) {
            // Delete all dirty daos, user was asleep anyway...
            resetMap = true
            // And retrieve everything from DB
            lastSeq = 0
            hasChanged = true
          }
          lastReadAll = currentDate

          var store = tx.objectStore(storeName)
          var index = store.index('seq')
          var range = $window.IDBKeyRange.lowerBound(lastSeq, true)
          var items = []
          var itemsToDelete = []
          index.openCursor(range).onsuccess = function (event) {
            var cursor = event.target.result
            if (!cursor) {
              itemsToDelete.cl_each(function (item) {
                store.delete(item.id)
              })
              items.length && debug('Got ' + items.length + ' ' + storeName + ' items')
              // Return a patch, to apply changes later
              return cb(function (daoMap) {
                if (resetMap) {
                  Object.keys(daoMap).cl_each(function (key) {
                    delete daoMap[key]
                  })
                  storedSeqs = Object.create(null)
                }
                items.cl_each(function (item) {
                  hasChanged |= readDbItem(item, daoMap)
                })
                return hasChanged
              })
            }
            var item = cursor.value
            items.push(item)
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

          // Remove deleted daos
          var storedIds = Object.keys(storedSeqs)
          var storedIdsLen = storedIds.length
          for (var i = 0; i < storedIdsLen; i++) {
            var id = storedIds[i]
            if (!daoMap[id]) {
              // Put a deleted marker to notify other tabs
              store.put({
                id: id,
                seq: currentDate
              })
              delete storedSeqs[id]
            }
          }

          // Put changes
          var daoIds = Object.keys(daoMap)
          var daoIdsLen = daoIds.length
          for (i = 0; i < daoIdsLen; i++) {
            var dao = daoMap[daoIds[i]]
            var dirty = dao.$dirty
            if (!dirty) {
              for (var j = 0; j < complexKeysLen; j++) {
                dirty |= attributeCheckers[complexKeys[j]](dao)
              }
            }
            if (dirty) {
              if (!dao.$dirtyUpdated) {
                // Force update the `updated` attribute
                dao.updated = currentDate
              }
              var item = {
                id: daoIds[i],
                seq: currentDate
              }
              for (j = 0; j < schemaKeysLen; j++) {
                attributeWriters[schemaKeys[j]](item, dao)
              }
              debug('Put ' + storeName + ' item')
              store.put(item)
              storedSeqs[item.id] = item.seq
              dao.$dirty = false
              dao.$dirtyUpdated = false
            }
          }
        }

        var store = {
          getPatch: getPatch,
          writeAll: writeAll,
          createDao: createDao,
          Dao: Dao
        }

        return store
      }
    }
)
  .factory('clLocalDb',
    function ($window, clLocalStorage, clDebug) {
      var debug = clDebug('classeur:clLocalDb')
      var db
      var getTxCbs = []
      var storeNames = [
        'files',
        'folders',
        'classeurs',
        'objects'
      ]

      function createTx () {
        // If DB version has changed (Safari support)
        if (parseInt(clLocalStorage.localDbVersion, 10) !== db.version) {
          return $window.location.reload()
        }
        var tx = db.transaction(storeNames, 'readwrite')
        tx.onerror = function (evt) {
          debug('Rollback transaction', evt)
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
