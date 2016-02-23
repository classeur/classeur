angular.module('classeur.core.folders', [])
  .directive('clFolderName',
    function ($timeout, clExplorerLayoutSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/folders/folderName.html',
        link: link
      }

      function link (scope, element) {
        var nameInputElt = element[0].querySelector('.folder-name__input')
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
            clExplorerLayoutSvc.currentFolder.name = name
          } else if (!clExplorerLayoutSvc.currentFolder.name) {
            clExplorerLayoutSvc.currentFolder.name = 'Untitled'
          }
          return clExplorerLayoutSvc.currentFolder.name
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
    function (clUid, clLocalStorage, clLocalDbStore) {
      var clFolderSvc = {
        init: init,
        readAll: readAll,
        writeAll: writeAll,
        createFolder: createFolder,
        createPublicFolder: createPublicFolder,
        removeDaos: removeDaos,
        setDeletedFolders: setDeletedFolders,
        setDeletedFolder: setDeletedFolder,
        applyServerChanges: applyServerChanges
      }

      var store = clLocalDbStore('classeurs', {
        name: 'string',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      })

      function Folder (id) {
        this.id = id || clUid()
        this.name = ''
        this.sharing = ''
        this.userId = ''
        this.deleted = 0
      }

      var isInitialized
      var daoMap = {}

      function init () {
        if (!isInitialized) {
          // Backward compatibility
          var done = clLocalStorage.getItem('folderSvc.done')
          clLocalStorage.setItem('folderSvc.done', 1)
          var folderIds = clLocalStorage.getItem('folderSvc.folderIds')
          clLocalStorage.removeItem('folderSvc.folderIds')
          if (!done && folderIds) {
            JSON.parse(folderIds).cl_each(function (id) {
              var folder = {
                id: id,
                name: clLocalStorage.getItem('f.' + id + '.name') || '',
                userId: clLocalStorage.getItem('f.' + id + '.userId') || '',
                sharing: clLocalStorage.getItem('f.' + id + '.sharing') || '',
                deleted: parseInt(clLocalStorage.getItem('f.' + id + '.deleted') || 0, 10),
                updated: parseInt(clLocalStorage.getItem('f.' + id + '.u') || 0, 10)
              }
              daoMap[folder.id] = folder
            })
            // Clean up local storage
            var keyMatcher = /^F\.(\w+)\.(\w+)/
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
            activeDaoMap[id] = dao
          }
        })

        clFolderSvc.activeDaos = Object.keys(activeDaoMap).cl_map(function (id) {
          return daoMap[id]
        })
        clFolderSvc.deletedDaos = Object.keys(deletedDaoMap).cl_map(function (id) {
          return daoMap[id]
        })

        isInitialized = true
      }

      function readAll (tx, cb) {
        store.readAll(daoMap, tx, function (hasChanged) {
          if (hasChanged || !isInitialized) {
            init()
          }
          cb(hasChanged)
        })
      }

      function writeAll (tx) {
        store.writeAll(daoMap, tx)
      }

      function createFolder (id) {
        var folder = clFolderSvc.deletedDaoMap[id] || new Folder(id)
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

      // Remove classeurs from daoMap
      function removeDaos (daos) {
        daos.cl_each(function (dao) {
          delete daoMap[dao.id]
        })
        daos.length && init()
      }

      function applyServerChanges (items) {
        items.cl_each(function (item) {
          var dao = daoMap[item.id] || new Folder(item.id)
          if (item.deleted) {
            delete daoMap[item.id]
          } else if (!item.deleted) {
            dao.deleted = 0
            daoMap[item.id] = dao
          }
          dao.userId = item.userId || ''
          dao.name = item.name || ''
          dao.sharing = item.sharing || ''
          dao.updated = item.updated
        })
        items.length && init()
      }

      return clFolderSvc
    })
