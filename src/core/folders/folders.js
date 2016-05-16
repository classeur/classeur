angular.module('classeur.core.folders', [])
  .directive('clFolderName',
    function ($timeout, clExplorerLayoutSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/folders/folderName.html',
        link: link
      }

      function link (scope, element) {
        var nameInputElt = element[0].querySelector('.tab-title__input')
        nameInputElt.addEventListener('keydown', function (e) {
          if (e.which === 27) {
            scope.form.$rollbackViewValue()
            nameInputElt.blur()
          } else if (e.which === 13) {
            nameInputElt.blur()
          }
        })
        scope.name = function (name) {
          if (clExplorerLayoutSvc.currentFolder) {
            if (name) {
              clExplorerLayoutSvc.currentFolder.name = name
            }
            return clExplorerLayoutSvc.currentFolder.name
          }
        }
        scope.name()
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
              scope.folderNameModified()
            }, 250)
          }
        }
      }
    })
  .factory('clFolderSvc',
    function (clLocalStorage, clLocalDbStore, clDebug, clHash) {
      var debug = clDebug('classeur:clFolderSvc')
      var clFolderSvc = {
        init: init,
        getPatch: getPatch,
        writeAll: writeAll,
        clearAll: clearAll,
        createFolder: createFolder,
        createPublicFolder: createPublicFolder,
        removeDaos: removeDaos,
        setDeletedFolders: setDeletedFolders,
        setDeletedFolder: setDeletedFolder,
        applyServerChanges: applyServerChanges
      }

      var store = clLocalDbStore('folders', {
        name: 'string128',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      })

      var isInitialized
      var daoMap = {}

      function init () {
        if (!isInitialized) {
          // Backward compatibility
          var folderIds = clLocalStorage.getItem('folderSvc.folderIds')
          clLocalStorage.removeItem('folderSvc.folderIds')
          if (folderIds) {
            JSON.parse(folderIds).cl_each(function (id) {
              var folder = store.createDao(id)
              folder.name = clLocalStorage.getItem('F.' + id + '.name')
              folder.userId = clLocalStorage.getItem('F.' + id + '.userId')
              folder.sharing = clLocalStorage.getItem('F.' + id + '.sharing')
              folder.deleted = parseInt(clLocalStorage.getItem('F.' + id + '.deleted') || 0, 10)
              folder.updated = parseInt(clLocalStorage.getItem('F.' + id + '.u') || 0, 10)
              daoMap[folder.id] = folder
            })
            // Clean up local storage
            var keyMatcher = /^F\.\w+\.\w+/
            Object.keys(clLocalStorage).cl_each(function (key) {
              if (key.match(keyMatcher)) {
                clLocalStorage.removeItem(key)
              }
            })
          }
        }

        var activeDaoMap = clFolderSvc.activeDaoMap = Object.create(null)
        var deletedDaoMap = clFolderSvc.deletedDaoMap = Object.create(null)

        daoMap.cl_each(function (dao, id) {
          if (dao.deleted) {
            deletedDaoMap[id] = dao
          } else {
            if (!dao.colorClass) {
              dao.colorClass = 'plastic--' + (Math.abs(clHash(id)) % 19 + 1)
            }
            activeDaoMap[id] = dao
          }
        })

        clFolderSvc.activeDaos = Object.keys(activeDaoMap).cl_map(function (id) {
          return daoMap[id]
        })
        clFolderSvc.deletedDaos = Object.keys(deletedDaoMap).cl_map(function (id) {
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

      function createFolder (id) {
        var folder = clFolderSvc.deletedDaoMap[id] || store.createDao(id)
        folder.deleted = 0
        daoMap[folder.id] = folder
        init()
        return folder
      }

      function createPublicFolder (id) {
        var folder = createFolder(id)
        folder.userId = folder.userId || '0' // Will be filled by the sync module
        return folder
      }

      function setDeletedFolders (folderList) {
        if (folderList.length) {
          var currentDate = Date.now()
          folderList.cl_each(function (folder) {
            folder.updated = currentDate // Ensure we don't keep the server date when called by synchronizer
            folder.deleted = currentDate
          })
          init()
        }
      }

      function setDeletedFolder (folder) {
        var index = clFolderSvc.activeDaos.indexOf(folder)
        if (~index) {
          setDeletedFolders([folder])
        }
        return index
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
          dao.sharing = item.sharing
          dao.updated = item.updated
        })
        init() // Do it even if not item, as there could be some classeur mapping changes
      }

      return clFolderSvc
    })
