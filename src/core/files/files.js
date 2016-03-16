angular.module('classeur.core.files', [])
  .directive('clFileEntry',
    function ($timeout, clExplorerLayoutSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/files/fileEntry.html',
        link: link
      }

      function link (scope, element) {
        var nameInputElt = element[0].querySelector('.file-entry__name input')
        nameInputElt.addEventListener('keydown', function (e) {
          if (e.which === 27) {
            scope.form.$rollbackViewValue()
            nameInputElt.blur()
          } else if (e.which === 13) {
            nameInputElt.blur()
          }
        })
        scope.name = function (name) {
          if (name) {
            scope.file.name = name
          }
          return scope.file.name
        }
        scope.name()
        scope.open = function () {
          !scope.isEditing && scope.setCurrentFile(scope.file)
        }
        var unsetTimeout
        scope.setEditing = function (value) {
          $timeout.cancel(unsetTimeout)
          if (value) {
            scope.isEditing = true
            setTimeout(function () {
              nameInputElt.focus()
            }, 10)
          } else {
            unsetTimeout = $timeout(function () {
              scope.isEditing = false
              clExplorerLayoutSvc.refreshFiles()
            }, 250)
          }
        }
      }
    })
  .factory('clFileSvc',
    function ($rootScope, $timeout, $templateCache, clLocalStorage, clUid, clLocalDbStore, clSocketSvc, clIsNavigatorOnline, clDiffUtils, clHash, clDebug) {
      var debug = clDebug('classeur:clFileSvc')
      var clFileSvc = {
        init: init,
        getPatch: getPatch,
        writeAll: writeAll,
        clearAll: clearAll,
        readLocalFileChanges: readLocalFileChanges,
        writeLocalFileChanges: writeLocalFileChanges,
        createFile: createFile,
        createPublicFile: createPublicFile,
        removeDaos: removeDaos,
        setDeletedFiles: setDeletedFiles,
        applyServerChanges: applyServerChanges,
        defaultContent: defaultContent,
        firstFileContent: $templateCache.get('core/explorerLayout/firstFile.md'),
        firstFileName: 'My first file'
      }

      var maxLocalFiles = 25
      var store = clLocalDbStore('files', {
        name: 'string128',
        folderId: 'string',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      })

      var contentMap = Object.create(null) // Faster when checking for a missing key

      var currentLocalFileOrder
      function checkLocalFileOrder () {
        var localFileOrder = Object.keys(contentMap)
          .sort(function (id1, id2) {
            return contentMap[id1].lastChange - contentMap[id2].lastChange
          })
        localFileOrder = JSON.stringify(localFileOrder)
        if (currentLocalFileOrder !== localFileOrder) {
          if (currentLocalFileOrder) {
            // Refresh local file list
            init()
            $rootScope.$evalAsync() // We're outside the angular context when called by clContentSyncSvc
          }
          currentLocalFileOrder = localFileOrder
        }
      }

      var storedLocalFileChanges
      function readLocalFileChanges () {
        var localFileChanges = clLocalStorage.getItem('localFileChanges')
        if (localFileChanges && storedLocalFileChanges !== localFileChanges) {
          storedLocalFileChanges = localFileChanges
          JSON.parse(localFileChanges).cl_each(function (lastChange, id) {
            var content = contentMap[id] || {}
            contentMap[id] = content
            // If content was modified by another tab
            if (lastChange > (content.lastChange || 0)) {
              content.lastChange = lastChange
              // Unload the file if loaded
              if (daoMap[id] && daoMap[id].state) {
                daoMap[id].unload()
                $rootScope.$evalAsync() // We're outside the angular context when called by clContentSyncSvc
              }
            }
          })
          checkLocalFileOrder()
        }
      }

      function writeLocalFileChanges () {
        var localFileChanges = Object.keys(contentMap)
          .sort(function (id1, id2) {
            return contentMap[id1].lastChange - contentMap[id2].lastChange
          })
          .cl_reduce(function (localFileChanges, id) {
            localFileChanges[id] = contentMap[id].lastChange
            return localFileChanges
          }, {})
        localFileChanges = JSON.stringify(localFileChanges)
        if (storedLocalFileChanges !== localFileChanges) {
          storedLocalFileChanges = localFileChanges
          clLocalStorage.setItem('localFileChanges', localFileChanges)
          checkLocalFileOrder()
        }
      }

      function defaultContent () {
        return {
          state: {},
          text: '\n',
          properties: {},
          discussions: {},
          comments: {},
          conflicts: {}
        }
      }

      var strippedContentKeys = (function () {
        var obj = defaultContent()
        delete obj.state
        return Object.keys(obj)
      })()

      function stripContent (content) {
        return strippedContentKeys.cl_reduce(function (strippedContent, key) {
          strippedContent[key] = content[key]
          return strippedContent
        }, {})
      }

      function getContentHash (content) {
        return clHash(clDiffUtils.serializeObject(stripContent(content)))
      }

      Object.defineProperty(store.Dao.prototype, 'content', {
        set: function (value) {
          throw new Error('Content cannot be set.') // Not supposed to be called
        },
        get: function () {
          return contentMap[this.id]
        }
      })

      store.Dao.prototype.readContent = function () {
        try {
          if (contentMap[this.id]) {
            var content = JSON.parse(clLocalStorage.getItem('fileContent.' + this.id))
            angular.extend(contentMap[this.id], defaultContent(), content)
            var strippedContent = stripContent(content)
            contentMap[this.id].$storedContent = JSON.stringify(strippedContent)
            return
          }
        } catch (e) {
          this.removeContent()
        }
        throw new Error('File is not local.')
      }

      store.Dao.prototype.writeContent = function () {
        // If content exist and is loaded
        if (contentMap[this.id] && contentMap[this.id].state) {
          // Pick only relevant content keys
          var strippedContent = stripContent(contentMap[this.id])
          var storedContent = JSON.stringify(strippedContent)
          // If content has changed, update lastChange date
          if (contentMap[this.id].$storedContent !== storedContent) {
            contentMap[this.id].lastChange = Date.now()
            contentMap[this.id].$storedContent = storedContent
          }
          // Store the stripped content + state + syncedRev + syncedHash
          strippedContent.state = contentMap[this.id].state
          strippedContent.syncedRev = contentMap[this.id].syncedRev
          strippedContent.syncedHash = contentMap[this.id].syncedHash
          clLocalStorage.setItem('fileContent.' + this.id, JSON.stringify(strippedContent))
        }
      }

      store.Dao.prototype.freeContent = function () {
        if (contentMap[this.id] && contentMap[this.id].state) {
          contentMap[this.id] = {
            // Keep only lastChange attribute
            lastChange: contentMap[this.id].lastChange
          }
        }
      }

      function removeContent (id) {
        readLocalFileChanges()
        delete contentMap[id]
        writeLocalFileChanges()
        clLocalStorage.removeItem('fileContent.' + id)
      }

      store.Dao.prototype.removeContent = function () {
        this.freeContent()
        this.state = undefined
        removeContent(this.id)
      }

      store.Dao.prototype.load = function () {
        if (this.state) {
          return
        }
        readLocalFileChanges()
        try {
          this.readContent()
          this.state = 'loading'
          $timeout(function () {
            if (this.state === 'loading') {
              this.state = 'loaded'
            }
          }.cl_bind(this))
        } catch (e) {
          // File is not local
          if (clSocketSvc.isReady || (this.userId && clIsNavigatorOnline())) {
            this.state = 'loading'
          }
        }
      }

      store.Dao.prototype.unload = function () {
        this.freeContent()
        this.state = undefined
      }

      store.Dao.prototype.setLoaded = function () {
        this.state = 'loaded'
        try {
          this.readContent()
        } catch (e) {
          contentMap[this.id] = defaultContent()
          this.writeContent()
        }
      }

      store.Dao.prototype.loadDoUnload = function (todo) {
        if (contentMap[this.id] && contentMap[this.id].state) {
          return todo()
        }
        this.readContent()
        var result = todo()
        this.freeContent()
        return result
      }

      store.Dao.prototype.setContentSynced = function (rev) {
        if (contentMap[this.id] && contentMap[this.id].state) {
          contentMap[this.id].syncedRev = rev
          contentMap[this.id].syncedHash = getContentHash(contentMap[this.id])
        }
      }

      store.Dao.prototype.isContentSynced = function () {
        if (contentMap[this.id] && contentMap[this.id].state) {
          return contentMap[this.id].syncedHash === getContentHash(contentMap[this.id])
        }
      }

      var isInitialized
      var daoMap = {}

      function init () {
        if (!isInitialized) {
          readLocalFileChanges()

          // Removed unreachable contents
          var keyMatcher = /^fileContent\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            var match = key.match(keyMatcher)
            if (match && !contentMap[match[1]]) {
              clLocalStorage.removeItem(key)
            }
          })

          // Backward compatibility
          var fileIds = clLocalStorage.getItem('fileSvc.fileIds')
          clLocalStorage.removeItem('fileSvc.fileIds')
          if (fileIds) {
            JSON.parse(fileIds).cl_each(function (id) {
              var file = store.createDao(id)
              file.name = clLocalStorage.getItem('f.' + id + '.name')
              file.folderId = clLocalStorage.getItem('f.' + id + '.folderId')
              file.userId = clLocalStorage.getItem('f.' + id + '.userId')
              file.sharing = clLocalStorage.getItem('f.' + id + '.sharing')
              file.deleted = parseInt(clLocalStorage.getItem('f.' + id + '.deleted') || 0, 10)
              file.updated = parseInt(clLocalStorage.getItem('f.' + id + '.u') || 0, 10)
              daoMap[file.id] = file
              if (clLocalStorage.getItem('c.' + id + '.isLocal')) {
                contentMap[id] = {
                  state: JSON.parse(clLocalStorage.getItem('c.' + id + '.state') || '{}'),
                  text: clLocalStorage.getItem('c.' + id + '.text') || '\n',
                  properties: JSON.parse(clLocalStorage.getItem('c.' + id + '.properties') || '{}'),
                  discussions: JSON.parse(clLocalStorage.getItem('c.' + id + '.discussions') || '{}'),
                  comments: JSON.parse(clLocalStorage.getItem('c.' + id + '.comments') || '{}'),
                  conflicts: JSON.parse(clLocalStorage.getItem('c.' + id + '.conflicts') || '{}')
                }
                var syncedRev = parseInt(clLocalStorage.getItem('cr.' + id), 10)
                var syncedHash = parseInt(clLocalStorage.getItem('ch.' + id), 10)
                if (!isNaN(syncedRev) && !isNaN(syncedHash)) {
                  contentMap[id].syncedRev = syncedRev
                  contentMap[id].syncedHash = syncedHash
                }
                file.writeContent()
                file.freeContent()
                contentMap[id].lastChange = parseInt(clLocalStorage.getItem('c.' + id + '.lastChange') || contentMap[id].lastChange, 10)
              }
            })

            // Clean up local storage
            keyMatcher = /^(f|c|cr|ch)\.\w+/
            Object.keys(clLocalStorage).cl_each(function (key) {
              if (key.match(keyMatcher)) {
                clLocalStorage.removeItem(key)
              }
            })
          }
        }

        var activeDaoMap = clFileSvc.activeDaoMap = Object.create(null)
        var deletedDaoMap = clFileSvc.deletedDaoMap = Object.create(null)

        daoMap.cl_each(function (dao, id) {
          if (dao.deleted) {
            deletedDaoMap[id] = dao
          } else {
            activeDaoMap[id] = dao
          }
        })

        // Filter contents that have to be removed
        var localFileIds = Object.keys(contentMap)
        var filteredLocalFileIds = localFileIds.cl_filter(function (id) {
          return activeDaoMap[id]
        }).sort(function (id1, id2) {
          return contentMap[id2].lastChange - contentMap[id1].lastChange
        })
        filteredLocalFileIds.splice(maxLocalFiles)
        if (localFileIds.length !== filteredLocalFileIds.length) {
          localFileIds.cl_each(function (id) {
            if (!~filteredLocalFileIds.indexOf(id)) {
              daoMap[id] ? daoMap[id].removeContent() : removeContent(id)
            }
          })
          return init()
        }

        clFileSvc.activeDaos = Object.keys(activeDaoMap).cl_map(function (id) {
          return daoMap[id]
        })
        clFileSvc.deletedDaos = Object.keys(deletedDaoMap).cl_map(function (id) {
          return daoMap[id]
        })
        clFileSvc.localFiles = localFileIds.cl_map(function (id) {
          return daoMap[id]
        })

        debug('Init')
        isInitialized = true
      }

      function getPatch (tx, cb) {
        store.getPatch(tx, function (patch) {
          cb(function () {
            var hasChanged = patch(daoMap)
            hasChanged && init()
            return hasChanged
          })
        })
      }

      function writeAll (tx) {
        store.writeAll(daoMap, tx)
      }

      function clearAll () {
        daoMap = {}
        init()
      }

      function createFile (id) {
        var file = clFileSvc.deletedDaoMap[id] || store.createDao(id)
        file.deleted = 0
        file.isSelected = false
        contentMap[file.id] = defaultContent()
        file.writeContent()
        file.freeContent()
        daoMap[file.id] = file
        init()
        return file
      }

      function createPublicFile (id, addLater) {
        var file = clFileSvc.deletedDaoMap[id] || store.createDao(id)
        file.isSelected = false
        file.userId = file.userId || '0' // Will be filled by sync module
        if (addLater) {
          file.addToDaos = function () {
            file.addToDaos = undefined
            file.deleted = 0
            daoMap[file.id] = file
            init()
          }
        } else {
          file.deleted = 0
          daoMap[file.id] = file
        }
        return file
      }

      function setDeletedFiles (fileList) {
        if (fileList.length) {
          var currentDate = Date.now()
          fileList.cl_each(function (file) {
            file.updated = currentDate // Ensure we don't keep the server date when called by synchronizer
            file.deleted = currentDate
          })
          init()
        }
      }

      function removeDaos (daos) {
        daos.cl_each(function (dao) {
          delete daoMap[dao.id]
        })
        daos.length && init()
      }

      function applyServerChanges (items) {
        items.cl_each(function (item) {
          var dao = daoMap[item.id] || store.createDao(item.id)
          if (item.deleted) {
            delete daoMap[item.id]
          } else if (!item.deleted) {
            dao.deleted = 0
            daoMap[item.id] = dao
          }
          dao.userId = item.userId
          dao.name = item.name
          // Change doesn't contain folderId for public file
          if (!dao.userId || !dao.folderId || item.folderId) {
            dao.folderId = item.folderId
          }
          dao.sharing = item.sharing
          dao.updated = item.updated
        })
        init()
      }

      return clFileSvc
    })
