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
    function (clLocalStorage, clUid, clLocalStorageObject) {
      var folderDaoProto = clLocalStorageObject('F', {
        name: 'string',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      }, true)

      function FolderDao (id) {
        this.id = id
        this.$setId(id)
        this.read()
      }

      FolderDao.prototype = folderDaoProto

      FolderDao.prototype.read = function () {
        this.$read()
        this.$readUpdate()
      }

      FolderDao.prototype.write = function (updated) {
        this.$write()
        this.extUpdated = undefined
      }

      var clFolderSvc = clLocalStorageObject('folderSvc', {
        folderIds: 'array',
        foldersToRemove: 'array'
      })

      var authorizedKeys = {
        u: true,
        userId: true,
        name: true,
        sharing: true,
        deleted: true
      }

      var isInitialized

      function init () {
        if (!clFolderSvc.folderIds) {
          clFolderSvc.$read()
        }

        var folderMap = Object.create(null)
        var deletedFolderMap = Object.create(null)
        clFolderSvc.folderIds = clFolderSvc.folderIds.cl_filter(function (id) {
          var folder = clFolderSvc.daoMap[id] || clFolderSvc.deletedDaoMap[id] || new FolderDao(id)
          if (!folder.deleted && !folderMap[id]) {
            folderMap[id] = folder
            return true
          }
          if (folder.deleted && !deletedFolderMap[id]) {
            deletedFolderMap[id] = folder
            return true
          }
        })
        clFolderSvc.daoMap = folderMap
        clFolderSvc.deletedDaoMap = deletedFolderMap

        clFolderSvc.daos = Object.keys(folderMap).cl_map(function (id) {
          return folderMap[id]
        })
        clFolderSvc.deletedDaos = Object.keys(deletedFolderMap).cl_map(function (id) {
          return deletedFolderMap[id]
        })

        if (!isInitialized) {
          var keyPrefix = /^F\.(\w+)\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            if (key.charCodeAt(0) === 0x46 /* F */) {
              var match = key.match(keyPrefix)
              if (match) {
                if ((!clFolderSvc.daoMap[match[1]] && !clFolderSvc.deletedDaoMap[match[1]]) ||
                  !authorizedKeys.hasOwnProperty(match[2])) {
                  clLocalStorage.removeItem(key)
                }
              }
            }
          })
          isInitialized = true
        }
      }

      function checkLocalStorage () {
        // Check folder id list
        var checkFolderSvcUpdate = clFolderSvc.$checkUpdate()
        clFolderSvc.$readUpdate()
        if (checkFolderSvcUpdate && clFolderSvc.$check()) {
          clFolderSvc.folderIds = undefined
        } else {
          clFolderSvc.$write()
        }

        // Check every folder
        var checkFolderUpdate = folderDaoProto.$checkGlobalUpdate()
        folderDaoProto.$readGlobalUpdate()
        clFolderSvc.daos.concat(clFolderSvc.deletedDaos).cl_each(function (folder) {
          if (checkFolderUpdate && folder.$checkUpdate()) {
            folder.read()
          } else {
            folder.write()
          }
        })

        if (checkFolderSvcUpdate || checkFolderUpdate) {
          init()
          return true
        }
      }

      function createFolder (id) {
        id = id || clUid()
        var folder = clFolderSvc.deletedDaoMap[id] || new FolderDao(id)
        folder.deleted = 0
        clFolderSvc.folderIds.push(id)
        clFolderSvc.daoMap[id] = folder
        init()
        return folder
      }

      function createPublicFolder (id) {
        var folder = createFolder(id)
        folder.userId = folder.userId || '0' // Will be filled by the sync module
        return folder
      }

      // Remove folder from folders and deletedFolders
      function removeFolders (folderList) {
        if (!folderList.length) {
          return
        }

        // Create hash for fast filter
        var folderIds = folderList.cl_reduce(function (folderIds, folder) {
          folderIds[folder.id] = 1
          return folderIds
        }, Object.create(null))

        // Filter
        clFolderSvc.folderIds = clFolderSvc.folderIds.cl_filter(function (folderId) {
          return !folderIds[folderId]
        })
        init()
      }

      function setDeletedFolders (folderList) {
        if (!folderList.length) {
          return
        }
        var currentDate = Date.now()
        folderList.cl_each(function (folder) {
          folder.deleted = currentDate
        })
        init()
      }

      function setDeletedFolder (folder) {
        var index = clFolderSvc.daos.indexOf(folder)
        if (~index) {
          setDeletedFolders([folder])
        }
        return index
      }

      function applyFolderChanges (items) {
        items.cl_each(function (item) {
          var folder = clFolderSvc.daoMap[item.id]
          if (item.deleted && folder) {
            var index = clFolderSvc.daos.indexOf(folder)
            clFolderSvc.folderIds.splice(index, 1)
          } else if (!item.deleted && !folder) {
            folder = new FolderDao(item.id)
            clFolderSvc.daoMap[item.id] = folder
            clFolderSvc.folderIds.push(item.id)
          }
          folder.userId = item.userId || ''
          folder.name = item.name || ''
          folder.sharing = item.sharing || ''
          folder.$setExtUpdate(item.updated)
        })
        items.length && init()
      }

      clFolderSvc.FolderDao = FolderDao
      clFolderSvc.init = init
      clFolderSvc.checkLocalStorage = checkLocalStorage
      clFolderSvc.createFolder = createFolder
      clFolderSvc.createPublicFolder = createPublicFolder
      clFolderSvc.removeDaos = removeFolders
      clFolderSvc.setDeletedFolders = setDeletedFolders
      clFolderSvc.setDeletedFolder = setDeletedFolder
      clFolderSvc.applyFolderChanges = applyFolderChanges
      clFolderSvc.daos = []
      clFolderSvc.deletedDaos = []
      clFolderSvc.daoMap = Object.create(null)
      clFolderSvc.deletedDaoMap = Object.create(null)

      init()
      return clFolderSvc
    })
