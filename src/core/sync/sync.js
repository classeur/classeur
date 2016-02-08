angular.module('classeur.core.sync', [])
  .factory('clSyncDataSvc',
    function (clLocalStorage, clLocalStorageObject, clFileSvc, clFolderSvc, clSocketSvc) {
      var cleanPublicObjectAfter = 86400000 // 1 day
      var lastSendNewFileKey = 'lastSendNewFile'

      function parseSyncData (data) {
        return JSON.parse(data, function (id, value) {
          return typeof value === 'number' && id !== 'r' && id !== 's' ? {
            r: value
          } : value
        })
      }

      function serializeSyncData (data) {
        return JSON.stringify(data, function (id, value) {
          return (value && !value.s && value.r) || value
        })
      }

      var clSyncDataSvc = clLocalStorageObject('syncData', {
        classeurs: {
          default: '{}',
          parser: parseSyncData,
          serializer: serializeSyncData
        },
        classeurLastUpdated: 'int',
        folders: {
          default: '{}',
          parser: parseSyncData,
          serializer: serializeSyncData
        },
        nextFolderSeq: 'int',
        folderLastUpdated: 'int',
        files: {
          default: '{}',
          parser: parseSyncData,
          serializer: serializeSyncData
        },
        lastFileSeq: 'int',
        fileLastUpdated: 'int',
        userId: 'string',
        userData: {
          default: '{}',
          parser: parseSyncData,
          serializer: serializeSyncData
        },
        fileSyncReady: 'string',
        fileCreationDates: 'object',
        folderRefreshDates: 'object',
        fileRecoveryDates: 'object'
      })

      function reset () {
        var fileKeyPrefix = /^syncData\./
        Object.keys(clLocalStorage).cl_each(function (key) {
          if (key.charCodeAt(0) === 0x73 /* s */ && key.match(fileKeyPrefix)) {
            clLocalStorage.removeItem(key)
          }
        })
        checkLocalStorage()
      }

      function read () {
        clSyncDataSvc.$read()
        clSyncDataSvc.$readUpdate()
      }

      function write () {
        clSyncDataSvc.$write()
      }

      function init () {
        var currentDate = Date.now()

        // Eject old public deletedFiles from clSyncDataSvc
        clSyncDataSvc.files = clSyncDataSvc.files.cl_reduce(function (files, syncData, id) {
          var fileDao = clFileSvc.fileMap[id] || clFileSvc.deletedFileMap[id]
          if (fileDao && (!fileDao.userId || !fileDao.deleted || currentDate - fileDao.deleted < cleanPublicObjectAfter)) {
            files[id] = syncData
          }
          return files
        }, {})

        // Eject old public deletedFolders from clSyncDataSvc
        clSyncDataSvc.folders = clSyncDataSvc.folders.cl_reduce(function (folders, syncData, id) {
          var folderDao = clFolderSvc.folderMap[id] || clFolderSvc.deletedFolderMap[id]
          if (folderDao && (!folderDao.userId || !folderDao.deleted || currentDate - folderDao.deleted < cleanPublicObjectAfter)) {
            folders[id] = syncData
          }
          return folders
        }, {})

        // Eject old folderRefreshDates
        clSyncDataSvc.folderRefreshDates.cl_each(function (date, folderId) {
          if (currentDate - date > cleanPublicObjectAfter) {
            delete clSyncDataSvc.folderRefreshDates[folderId]
          }
        })

        clFileSvc.removeFiles(
          // Remove deletedFiles that are not synced anymore
          clFileSvc.deletedFiles.cl_filter(function (fileDao) {
            if (!clSyncDataSvc.files.hasOwnProperty(fileDao.id)) {
              return true
            }
          })
            // Remove public files that are not local and not refreshed recently
            .concat(clFileSvc.files.cl_filter(function (fileDao) {
              if (fileDao.userId &&
                !fileDao.contentDao.isLocal &&
                (!fileDao.folderId || !clSyncDataSvc.folderRefreshDates.hasOwnProperty(fileDao.folderId))
              ) {
                return true
              }
            }))
        )

        // Remove deletedFolders not synced anymore
        clFolderSvc.removeFolders(clFolderSvc.deletedFolders.cl_filter(function (folderDao) {
          if (!clSyncDataSvc.folders.hasOwnProperty(folderDao.id)) {
            return true
          }
        }))
      }

      function checkLocalStorage (ctx) {
        if (clSyncDataSvc.$checkUpdate()) {
          read()
        } else {
          write()
        }

        if (ctx && ctx.userId && ctx.userId !== clSyncDataSvc.userId) {
          // Add userId to synced files owned by previous user
          var filesToRemove = clFileSvc.files.cl_filter(function (fileDao) {
            if (!fileDao.userId && clSyncDataSvc.files.hasOwnProperty(fileDao.id)) {
              fileDao.userId = clSyncDataSvc.userId
              return !fileDao.contentDao.isLocal
            }
          })
          // Remove files that are public and not local
          clFileSvc.removeFiles(filesToRemove)
          // Remove files that are pending for deletion
          clFileSvc.removeFiles(clFileSvc.deletedFiles)

          // Add userId to synced folders owned by previous user
          clFolderSvc.folders.cl_each(function (folderDao) {
            if (!folderDao.userId && clSyncDataSvc.folders.hasOwnProperty(folderDao.id)) {
              folderDao.userId = clSyncDataSvc.userId
            }
          })
          // Remove folders that are pending for deletion
          clFolderSvc.removeFolders(clFolderSvc.deletedFolders)

          reset()
          clSyncDataSvc.userId = ctx.userId
          return true
        }
      }

      function setLastSendNewFile () {
        clLocalStorage[lastSendNewFileKey] = Date.now()
      }

      function getLastSendNewFile () {
        return parseInt(clLocalStorage[lastSendNewFileKey] || 0, 10)
      }

      function isFilePendingCreation (fileDao) {
        var isWritable = !fileDao.userId || fileDao.sharing === 'rw'
        if (!isWritable) {
          var folderDao = clFolderSvc.folderMap[fileDao.folderId]
          isWritable = folderDao && folderDao.sharing === 'rw'
        }
        return isWritable && fileDao.contentDao.isLocal && !clSyncDataSvc.files.hasOwnProperty(fileDao.id)
      }

      function updatePublicFileMetadata (fileDao, metadata) {
        fileDao.refreshed = Date.now()
        var syncData = clSyncDataSvc.files[fileDao.id] || {}
        if (metadata.updated) {
          // File permission can change without metadata update
          if ((metadata.updated !== syncData.r && metadata.updated !== syncData.s) || fileDao.sharing !== metadata.permission) {
            fileDao.name = metadata.name || ''
            // For public files we take the permission as the file sharing
            fileDao.sharing = metadata.permission || metadata.permission || ''
            fileDao.updated = metadata.updated
            fileDao.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : ''
            fileDao.$setExtUpdate(fileDao.updated)
          }
          syncData.r = metadata.updated
          clSyncDataSvc.files[fileDao.id] = syncData
        }
      }

      function updatePublicFolderMetadata (folderDao, metadata) {
        var syncData = clSyncDataSvc.folders[folderDao.id] || {}
        if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
          folderDao.name = metadata.name || ''
          folderDao.sharing = metadata.sharing || ''
          folderDao.updated = metadata.updated
          folderDao.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : ''
          folderDao.$setExtUpdate(folderDao.updated)
        }
        syncData.r = metadata.updated
        clSyncDataSvc.folders[folderDao.id] = syncData
      }

      function updatePublicClasseurMetadata (classeurDao, metadata) {
        var syncData = clSyncDataSvc.classeur[classeurDao.id] || {}
        if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
          classeurDao.name = metadata.name || ''
          classeurDao.updated = metadata.updated
          classeurDao.$setExtUpdate(classeurDao.updated)
        }
        syncData.r = metadata.updated
        clSyncDataSvc.classeur[classeurDao.id] = syncData
      }

      clSyncDataSvc.checkLocalStorage = checkLocalStorage
      clSyncDataSvc.setLastSendNewFile = setLastSendNewFile
      clSyncDataSvc.getLastSendNewFile = getLastSendNewFile
      clSyncDataSvc.isFilePendingCreation = isFilePendingCreation
      clSyncDataSvc.updatePublicFileMetadata = updatePublicFileMetadata
      clSyncDataSvc.updatePublicFolderMetadata = updatePublicFolderMetadata
      clSyncDataSvc.updatePublicClasseurMetadata = updatePublicClasseurMetadata
      clSyncDataSvc.loadingTimeout = 30 * 1000 // 30 sec

      read()
      init()
      return clSyncDataSvc
    })
  .factory('clContentRevSvc',
    function (clLocalStorage, clFileSvc, clDiffUtils, clHash) {
      var contentRevKeyPrefix = 'cr.'
      var contentHashKeyPrefix = 'ch.'

      var fileKeyPrefix = /^c[rh]\.(\w\w+)/
      Object.keys(clLocalStorage).cl_each(function (key) {
        if (key.charCodeAt(0) === 0x63 /* c */) {
          var match = key.match(fileKeyPrefix)
          if (match) {
            if (!clFileSvc.fileMap[match[1]] || !clFileSvc.fileMap[match[1]].contentDao.isLocal) {
              clLocalStorage.removeItem(key)
            }
          }
        }
      })

      function getContentHash (content) {
        var serializedContent = clDiffUtils.serializeObject({
          text: content.text,
          properties: content.properties,
          discussions: content.discussions,
          comments: content.comments,
          conflicts: content.conflicts
        })
        return clHash(serializedContent)
      }

      function getLocalStorageInt (key) {
        var value = parseInt(clLocalStorage.getItem(key), 10)
        return isNaN(value) ? undefined : value
      }

      return {
        setContent: function (fileId, content) {
          clLocalStorage.setItem(contentRevKeyPrefix + fileId, content.rev)
          clLocalStorage.setItem(contentHashKeyPrefix + fileId, getContentHash(content))
        },
        getRev: function (fileId) {
          return getLocalStorageInt(contentRevKeyPrefix + fileId)
        },
        isServerContent: function (fileId, content) {
          var localHash = getContentHash(content)
          var serverHash = getLocalStorageInt(contentHashKeyPrefix + fileId)
          return localHash === serverHash
        }
      }
    })
  .factory('clSyncSvc',
    function ($rootScope, $location, $http, $templateCache, clIsNavigatorOnline, clLocalStorage, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clRestSvc, clUserActivity, clSetInterval, clSyncDataSvc, clContentRevSvc) {
      var userNameMaxLength = 64
      var nameMaxLength = 128
      var createFileTimeout = 30 * 1000 // 30 sec
      var recoverFileTimeout = 30 * 1000 // 30 sec
      var clSyncSvc = {}
      clSyncSvc.userNameMaxLength = userNameMaxLength

      var localStorageObjects = [
        clFileSvc.FileDao.prototype,
        clFolderSvc.FolderDao.prototype,
        clUserSvc,
        clClasseurSvc,
        clSettingSvc,
        clLocalSettingSvc
      ]

      var localStorageCheckers = [
        clFileSvc,
        clFolderSvc,
        clUserSvc,
        clClasseurSvc,
        clSettingSvc,
        clLocalSettingSvc
      ]

      function doInLocalStorage (todo) {
        // Check all localStorage objects to write current tab changes and read other tabs
        var userChanged = clSyncDataSvc.checkLocalStorage(clSocketSvc.ctx)
        var apply = localStorageCheckers.cl_reduce(function (apply, checker) {
          apply |= checker.checkLocalStorage()
          return apply
        }, userChanged)

        !userChanged && todo && todo()

        // If todo() made external changes from the server, persist them asap so that we can detect further changes.
        if (localStorageObjects
            .cl_some(function (localStorageObject) {
              return localStorageObject.gExtUpdated
            })
        ) {
          clSyncDataSvc.checkLocalStorage()
          localStorageCheckers.cl_each(function (checker) {
            checker.checkLocalStorage()
          })
          localStorageObjects.cl_each(function (localStorageObject) {
            localStorageObject.gExtUpdated = undefined
          })
          apply = true
        }

        // Apply possible UI changes
        apply && $rootScope.$evalAsync()
        return userChanged
      }

      clSyncSvc.saveAll = doInLocalStorage.cl_bind()

      $rootScope.$watch('socketSvc.ctx.userId', function (userId) {
        // Make some cleaning when user changes
        userId && clSyncSvc.saveAll()
      })

      /* -----------------------
       * User
       */

      var syncUser = (function () {
        function retrieveChanges () {
          clSocketSvc.sendMsg('getUserData', {
            userUpdated: clUserSvc.user && (clSyncDataSvc.userData.user || {}).r,
            classeursUpdated: (clSyncDataSvc.userData.classeurs || {}).r,
            settingsUpdated: (clSyncDataSvc.userData.settings || {}).r
          })
        }

        clSocketSvc.addMsgHandler('userData', function (msg, ctx) {
          doInLocalStorage(function () {
            clSyncDataSvc.setLastActivity()
            var syncData
            if (msg.user) {
              syncData = clSyncDataSvc.userData.user || {}
              if (syncData.s !== msg.userUpdated) {
                clUserSvc.user = msg.user
                clUserSvc.$setExtUpdate(msg.userUpdated)
              }
              clSyncDataSvc.userData.user = {
                r: msg.userUpdated
              }
            }
            if (msg.classeurs) {
              syncData = clSyncDataSvc.userData.classeurs || {}
              if (syncData.s !== msg.classeursUpdated) {
                clClasseurSvc.init(msg.classeurs)
                clClasseurSvc.$setExtUpdate(msg.classeursUpdated)
              }
              clSyncDataSvc.userData.classeurs = {
                r: msg.classeursUpdated
              }
              getPublicFoldersMetadata()
            }
            if (msg.settings) {
              syncData = clSyncDataSvc.userData.settings || {}
              if (syncData.s !== msg.settingsUpdated) {
                clSettingSvc.updateSettings(msg.settings)
                clSettingSvc.$setExtUpdate(msg.settingsUpdated)
              }
              clSyncDataSvc.userData.settings = {
                r: msg.settingsUpdated
              }
            }
            // Use setTimeout to let doInLocalStorage persist external changes
            setTimeout(sendChanges, 10)
          })
        })

        function sendChanges () {
          var syncData
          var msg = {}
          syncData = clSyncDataSvc.userData.user || {}
          if (clUserSvc.user && clUserSvc.updated !== syncData.r) {
            if (clUserSvc.user.name.length > userNameMaxLength) {
              clUserSvc.user.name = clUserSvc.user.name.slice(0, userNameMaxLength)
              return
            }
            msg.user = {
              name: clUserSvc.user.name,
              gravatarEmail: clUserSvc.user.gravatarEmail
            }
            msg.userUpdated = clUserSvc.updated
            syncData.s = clUserSvc.updated
            clSyncDataSvc.userData.user = syncData
          }
          syncData = clSyncDataSvc.userData.classeurs || {}
          if (clClasseurSvc.updated !== syncData.r) {
            msg.classeurs = clClasseurSvc.classeurs.cl_map(function (classeurDao) {
              return classeurDao.toStorable()
            })
            msg.classeursUpdated = clClasseurSvc.updated
            syncData.s = clClasseurSvc.updated
            clSyncDataSvc.userData.classeurs = syncData
          }
          syncData = clSyncDataSvc.userData.settings || {}
          if (clSettingSvc.updated !== syncData.r) {
            msg.settings = clSettingSvc.values
            msg.settingsUpdated = clSettingSvc.updated
            syncData.s = clSettingSvc.updated
            clSyncDataSvc.userData.settings = syncData
          }
          Object.keys(msg).length > 1 && clSocketSvc.sendMsg('setUserData', msg)
        }

        return retrieveChanges
      })()

      /* ------------------------
       * Folders
       */

      function getPublicFoldersMetadata () {
        var foldersToRefresh = clFolderSvc.folders.cl_filter(function (folderDao) {
          return folderDao.userId && !folderDao.name
        })
        if (!foldersToRefresh.length || !clIsNavigatorOnline()) {
          return
        }
        $http.get('/api/v1/metadata/folders', {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout,
          params: {
            id: foldersToRefresh.cl_map(function (folderDao) {
              return folderDao.id
            }).join(',')
          }
        })
          .success(function (res) {
            res.cl_each(function (item) {
              var folderDao = clFolderSvc.folderMap[item.id]
              if (folderDao) {
                clSyncDataSvc.updatePublicFolderMetadata(folderDao, item)
              }
            })
            clFolderSvc.init() // Refresh tabs order
          })
      }

      var syncFolders = (function () {
        function retrieveChanges () {
          clSocketSvc.sendMsg('getFolderChanges', {
            nextSeq: clSyncDataSvc.nextFolderSeq
          })
        }

        clSocketSvc.addMsgHandler('folderChanges', function (msg, ctx) {
          doInLocalStorage(function () {
            clSyncDataSvc.setLastActivity()
            var foldersToUpdate = []
            ;(msg.changes || []).cl_each(function (change) {
              var folderDao = clFolderSvc.folderMap[change.id]
              var syncData = clSyncDataSvc.folders[change.id] || {}
              if (
                // Has been deleted on the server
                (change.deleted && folderDao) ||
                // Has been created on the server and is not pending for deletion locally
                (!change.deleted && !folderDao && !clFolderSvc.deletedFolderMap[change.id]) ||
                // Has been updated on the server and is different from local
                (folderDao && folderDao.updated !== change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
              ) {
                foldersToUpdate.push(change)
              }
              if (change.deleted) {
                delete clSyncDataSvc.folders[change.id]
              } else {
                clSyncDataSvc.folders[change.id] = {
                  r: change.updated
                }
              }
            })
            if (foldersToUpdate.length) {
              clFolderSvc.updateUserFolders(foldersToUpdate)
            }
            clSyncDataSvc.nextFolderSeq = msg.nextSeq || clSyncDataSvc.nextFolderSeq
            if (msg.hasMore) {
              retrieveChanges()
            } else {
              // Sync user's classeurs once all folders are synced
              syncUser()
              clSyncDataSvc.fileSyncReady = '1'
              // Use setTimeout to let doInLocalStorage persist external changes
              setTimeout(sendChanges, 10)
            }
          })
        })

        function checkUpdated (folderDao, syncData) {
          if (folderDao.name && folderDao.updated &&
            folderDao.updated !== syncData.r &&
            (!folderDao.userId || (folderDao.sharing === 'rw' && folderDao.updated !== syncData.s))
          ) {
            if (folderDao.name.length > nameMaxLength) {
              folderDao.name = folderDao.name.slice(0, nameMaxLength)
            } else {
              return true
            }
          }
        }

        function sendChanges () {
          clFolderSvc.folders.cl_each(function (folderDao) {
            var syncData = clSyncDataSvc.folders[folderDao.id] || {}
            if (checkUpdated(folderDao, syncData)) {
              clSocketSvc.sendMsg('setFolderMetadata', {
                id: folderDao.id,
                name: folderDao.name,
                sharing: folderDao.sharing || undefined,
                updated: folderDao.updated
              })
              syncData.s = folderDao.updated
              clSyncDataSvc.folders[folderDao.id] = syncData
            }
          })
          clFolderSvc.deletedFolders.cl_each(function (folderDao) {
            var syncData = clSyncDataSvc.folders[folderDao.id]
            // Folder has been synchronized
            if (syncData && checkUpdated(folderDao, syncData)) {
              clSocketSvc.sendMsg('deleteFolder', {
                id: folderDao.id
              })
              syncData.s = folderDao.updated
            }
          })
          clSyncDataSvc.folderLastUpdated = clFolderSvc.FolderDao.prototype.gUpdated || 0
        }

        return retrieveChanges
      })()

      /* ----------------------
       * Files
       */

      var syncFiles = (function () {
        function retrieveChanges () {
          clSocketSvc.sendMsg('getFileChanges', {
            nextSeq: clSyncDataSvc.lastFileSeq
          })
        }

        clSocketSvc.addMsgHandler('fileChanges', function (msg, ctx) {
          doInLocalStorage(function () {
            clSyncDataSvc.setLastActivity()
            var filesToUpdate = []
            ;(msg.changes || []).cl_each(function (change) {
              var fileDao = clFileSvc.fileMap[change.id]
              if (fileDao && fileDao.userId && change.deleted) {
                // We just lost ownership of the file
                return
              }
              var syncData = clSyncDataSvc.files[change.id] || {}
              if (
                // Has been deleted on the server
                (change.deleted && fileDao) ||
                // Has been created on the server and is not pending for deletion locally
                (!change.deleted && !fileDao && !clFileSvc.deletedFileMap[change.id]) ||
                // Has been updated on the server and is different from local
                (fileDao && fileDao.updated !== change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
              ) {
                filesToUpdate.push(change)
              }
              if (change.deleted) {
                delete clSyncDataSvc.files[change.id]
              } else {
                clSyncDataSvc.files[change.id] = {
                  r: change.updated
                }
              }
            })
            if (filesToUpdate.length) {
              clFileSvc.updateUserFiles(filesToUpdate)
            }
            clSyncDataSvc.lastFileSeq = msg.nextSeq || clSyncDataSvc.lastFileSeq
            if (msg.hasMore) {
              retrieveChanges()
            } else {
              // Sync user's folders once all files are synced
              syncFolders()
              // Use setTimeout to let doInLocalStorage persist external changes
              setTimeout(sendChanges, 10)
            }
          })
        })

        function checkUpdated (fileDao, syncData) {
          var folderDao = clFolderSvc.folderMap[fileDao.folderId]
          if (fileDao.name && fileDao.updated &&
            fileDao.updated !== syncData.r &&
            (!fileDao.userId || ((fileDao.sharing === 'rw' || (folderDao && folderDao.sharing === 'rw')) && fileDao.updated !== syncData.s))
          ) {
            if (fileDao.name.length > nameMaxLength) {
              fileDao.name = fileDao.name.slice(0, nameMaxLength)
            } else {
              return true
            }
          }
        }

        function sendChanges () {
          clFileSvc.files.cl_each(function (fileDao) {
            var syncData = clSyncDataSvc.files[fileDao.id] || {}
            // File has been created
            if (syncData.r && checkUpdated(fileDao, syncData)) {
              clSocketSvc.sendMsg('setFileMetadata', {
                id: fileDao.id,
                name: fileDao.name,
                folderId: fileDao.folderId || undefined,
                classeurId: fileDao.classeurId || undefined,
                sharing: fileDao.sharing || undefined,
                updated: fileDao.updated
              })
              syncData.s = fileDao.updated
              clSyncDataSvc.files[fileDao.id] = syncData
            }
          })
          clFileSvc.deletedFiles.cl_each(function (fileDao) {
            var syncData = clSyncDataSvc.files[fileDao.id]
            // File has been synchronized
            if (syncData && checkUpdated(fileDao, syncData) && !clSyncDataSvc.fileRecoveryDates.hasOwnProperty(fileDao.id)) {
              clSocketSvc.sendMsg('setFileMetadata', {
                id: fileDao.id,
                name: fileDao.name,
                folderId: fileDao.folderId || undefined,
                classeurId: fileDao.classeurId || undefined,
                sharing: fileDao.sharing || undefined,
                updated: fileDao.updated,
                deleted: fileDao.deleted
              })
              syncData.s = fileDao.updated
            }
          })
          clSyncDataSvc.fileLastUpdated = clFileSvc.FileDao.prototype.gUpdated || 0
        }

        return retrieveChanges
      })()

      clSyncSvc.recoverFile = function (file) {
        var currentDate = Date.now()
        clSyncDataSvc.fileRecoveryDates[file.id] = currentDate
        if (!clFileSvc.fileMap[file.id]) {
          clSocketSvc.sendMsg('setFileMetadata', {
            id: file.id,
            name: file.name,
            folderId: file.folderId || undefined,
            classeurId: file.classeurId || undefined,
            sharing: file.sharing || undefined,
            updated: currentDate
          })
        }
      }

      /* --------------------
       * New files
       */

      var sendNewFiles = (function () {
        function sendNewFiles () {
          var currentDate = Date.now()
          Object.keys(clSyncDataSvc.fileCreationDates).cl_each(function (fileId) {
            if (clSyncDataSvc.fileCreationDates[fileId] + createFileTimeout < currentDate) {
              delete clSyncDataSvc.fileCreationDates[fileId]
            }
          })
          var filesToRemove = []
          clFileSvc.files.cl_filter(function (fileDao) {
            return clSyncDataSvc.isFilePendingCreation(fileDao) && !clSyncDataSvc.fileCreationDates.hasOwnProperty(fileDao.id)
          }).cl_each(function (fileDao) {
            clSyncDataSvc.fileCreationDates[fileDao.id] = currentDate
            fileDao.loadExecUnload(function () {
              // Remove first file in case existing user signs in (see #13)
              if (clFileSvc.files.length > 1 && fileDao.name === clFileSvc.firstFileName && fileDao.contentDao.text === clFileSvc.firstFileContent) {
                return filesToRemove.push(fileDao)
              }
              clSyncDataSvc.setLastSendNewFile()
              clSocketSvc.sendMsg('createFile', {
                id: fileDao.id,
                name: fileDao.name,
                folderId: fileDao.folderId || undefined,
                classeurId: fileDao.classeurId || undefined,
                sharing: fileDao.sharing || undefined,
                updated: fileDao.updated,
                content: {
                  text: fileDao.contentDao.text || '\n',
                  properties: fileDao.contentDao.properties || {},
                  discussions: fileDao.contentDao.discussions || {},
                  comments: fileDao.contentDao.comments || {},
                  conflicts: fileDao.contentDao.conflicts || {}
                }
              })
            })
          })
          if (filesToRemove.length) {
            clFileSvc.removeFiles(filesToRemove)
            $rootScope.$evalAsync()
          }
        }

        clSocketSvc.addMsgHandler('createdFile', function (msg, ctx) {
          doInLocalStorage(function () {
            delete clSyncDataSvc.fileCreationDates[msg.id]
            var fileDao = clFileSvc.fileMap[msg.id]
            if (!fileDao) {
              return
            }
            if (fileDao.folderId) {
              fileDao.folderId = msg.folderId
            }
            if (msg.userId) {
              fileDao.userId = msg.userId !== clSyncDataSvc.userId ? msg.userId : ''
            } else {
              // Was an existing file from another user
              fileDao.userId = '0'
            }
            clSyncDataSvc.files[msg.id] = {
              r: msg.updated
            }
            if (msg.content) {
              clContentRevSvc.setContent(msg.id, msg.content)
            }
          })
        })

        return sendNewFiles
      })()

      var isSyncActive = (function () {
        var lastSyncActivityKey = 'lastSyncActivity'
        var lastSyncActivity
        var inactivityThreshold = 10000 // 10 sec

        return function (currentDate) {
          if (!clSocketSvc.isOnline()) {
            return
          }
          var storedLastSyncActivity = parseInt(clLocalStorage[lastSyncActivityKey], 10) || 0
          if (lastSyncActivity === storedLastSyncActivity || storedLastSyncActivity < currentDate - inactivityThreshold) {
            clLocalStorage[lastSyncActivityKey] = currentDate
            lastSyncActivity = currentDate
            return true
          }
        }
      })()

      clSetInterval(function () {
        doInLocalStorage(function () {
          var currentDate = Date.now()

          if (!isSyncActive(currentDate)) {
            return
          }

          clSyncDataSvc.fileRecoveryDates.cl_each(function (date, fileId) {
            if (currentDate - date > recoverFileTimeout) {
              delete clSyncDataSvc.fileRecoveryDates[fileId]
            }
          })

          if (!clSocketSvc.ctx.syncState) {
            clSocketSvc.ctx.syncState = 'starting'
            clRestSvc.list('/api/v2/users/' + clSyncDataSvc.userId + '/files', {
              minSeq: clSyncDataSvc.lastFileSeq,
              outFormat: 'private'
            })
            .then(function (items) {
              console.log(items)
            })
          }


          // Check last sync activity to prevent overlap with other tabs
          // if (currentDate - clSyncDataSvc.getLastActivity() > inactivityThreshold) {
          //   clSyncDataSvc.setLastActivity()
          //   // Start the chain: files, then folders, then user
          //   syncFiles()
          // }

          // Check last file sent to prevent overlap with other tabs
          // if (clSyncDataSvc.fileSyncReady && currentDate - clSyncDataSvc.getLastSendNewFile() > shortInactivityThreshold) {
          //   sendNewFiles()
          // }
        })
      }, 1200)

      return clSyncSvc
    })
  .factory('clPublicSyncSvc',
    function ($http, clSocketSvc, clSyncDataSvc, clFileSvc, clFolderSvc, clToast, clIsNavigatorOnline) {
      var publicFileRefreshAfter = 30 * 1000 // 30 sec
      var lastGetExtFileAttempt = 0

      function getLocalFiles () {
        var currentDate = Date.now()
        var filesToRefresh = clFileSvc.localFiles.cl_filter(function (fileDao) {
          return fileDao.userId && (!fileDao.refreshed || currentDate - publicFileRefreshAfter > fileDao.refreshed)
        })
        if (!filesToRefresh.length ||
          currentDate - lastGetExtFileAttempt < publicFileRefreshAfter
        ) {
          return
        }
        lastGetExtFileAttempt = currentDate
        $http.get('/api/v1/metadata/files', {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout,
          params: {
            id: filesToRefresh.cl_map(function (fileDao) {
              return fileDao.id
            }).join(',')
          }
        })
          .success(function (res) {
            lastGetExtFileAttempt = 0
            res.cl_each(function (item) {
              var fileDao = clFileSvc.fileMap[item.id]
              if (fileDao) {
                clSyncDataSvc.updatePublicFileMetadata(fileDao, item)
                !item.updated && clToast('File not accessible: ' + (fileDao.name || fileDao.id))
              }
            })
          })
      }

      function getPublicFolder (folderDao) {
        if (!folderDao || !folderDao.userId ||
          (folderDao.refreshed && Date.now() - folderDao.refreshed < publicFileRefreshAfter)
        ) {
          return
        }
        $http.get('/api/v1/folders/' + folderDao.id, {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout
        })
          .success(function (res) {
            var currentDate = Date.now()
            clSyncDataSvc.folderRefreshDates[folderDao.id] = currentDate
            folderDao.refreshed = currentDate
            clSyncDataSvc.updatePublicFolderMetadata(folderDao, res)
            var filesToMove = {}
            clFileSvc.files.cl_each(function (fileDao) {
              if (fileDao.folderId === folderDao.id) {
                filesToMove[fileDao.id] = fileDao
              }
            })
            res.files.cl_each(function (item) {
              delete filesToMove[item.id]
              var fileDao = clFileSvc.fileMap[item.id]
              if (!fileDao) {
                fileDao = clFileSvc.createPublicFile(item.id)
                fileDao.deleted = 0
                clFileSvc.fileMap[fileDao.id] = fileDao
                clFileSvc.fileIds.push(fileDao.id)
              }
              fileDao.folderId = folderDao.id
              fileDao.classeurId = ''
              clSyncDataSvc.updatePublicFileMetadata(fileDao, item)
            })
            filesToMove.cl_each(function (fileDao) {
              fileDao.folderId = ''
            })
            clFolderSvc.init() // Refresh tabs order
            clFileSvc.init()
          })
          .error(function () {
            folderDao.refreshed = 1 // Get rid of the spinner
            clToast('Folder not accessible: ' + folderDao.name)
            !folderDao.name && clFolderSvc.removeFolders([folderDao])
          })
      }

      return {
        getFolder: function (folderDao) {
          if (clIsNavigatorOnline()) {
            folderDao ? getPublicFolder(folderDao) : getLocalFiles()
          }
        }
      }
    })
  .factory('clContentSyncSvc',
    function ($window, $rootScope, $timeout, $http, $q, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clContentRevSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clEditorLayoutSvc, clSyncSvc) {
      var textMaxSize = 200000
      var backgroundUpdateContentEvery = 30 * 1000 // 30 sec
      var clContentSyncSvc = {}
      var watchCtx

      function setWatchCtx (ctx) {
        watchCtx = ctx
        clContentSyncSvc.watchCtx = ctx
      }
      clSocketSvc.addMsgHandler('userToken', setWatchCtx.cl_bind(null, null))

      function setLoadedContent (fileDao, serverContent) {
        fileDao.contentDao.text = serverContent.text
        fileDao.contentDao.properties = ({}).cl_extend(serverContent.properties)
        fileDao.contentDao.discussions = ({}).cl_extend(serverContent.discussions)
        fileDao.contentDao.comments = ({}).cl_extend(serverContent.comments)
        fileDao.contentDao.conflicts = ({}).cl_extend(serverContent.conflicts)
        fileDao.contentDao.isLocal = '1'
        fileDao.contentDao.state = {}
        fileDao.writeContent(true)
        fileDao.state = 'loaded'
        clFileSvc.init()
      }

      function setLoadingError (fileDao, error) {
        if (fileDao.state === 'loading') {
          fileDao.state = undefined
        }
        clToast(error || 'File not accessible: ' + (fileDao.name || fileDao.id))
      }

      function applyServerContent (fileDao, oldContent, serverContent) {
        var newContent = {
          text: clEditorSvc.cledit.getContent(),
          properties: fileDao.contentDao.properties,
          discussions: fileDao.contentDao.discussions,
          comments: fileDao.contentDao.comments,
          conflicts: fileDao.contentDao.conflicts
        }
        var conflicts = clDiffUtils.mergeContent(oldContent, newContent, serverContent)
        fileDao.contentDao.properties = newContent.properties
        fileDao.contentDao.discussions = newContent.discussions
        fileDao.contentDao.comments = newContent.comments
        fileDao.contentDao.conflicts = newContent.conflicts
        clEditorSvc.setContent(newContent.text, true)
        if (conflicts.length) {
          conflicts.cl_each(function (conflict) {
            fileDao.contentDao.conflicts[clUid()] = conflict
          })
          clEditorLayoutSvc.currentControl = 'conflictAlert'
        }
      }

      function watchFile (fileDao) {
        if (watchCtx) {
          if (fileDao === watchCtx.fileDao) {
            // File already being watched
            return
          } else {
            // Stop previous file watching
            clSocketSvc.sendMsg('stopWatchContent', {
              id: watchCtx.id
            })
            setWatchCtx()
          }
        }
        if (!fileDao || !fileDao.state || fileDao.isReadOnly || fileDao.isLocalFile || clSyncDataSvc.isFilePendingCreation(fileDao)) {
          return
        }
        fileDao.loadPending = false
        setWatchCtx({
          id: clUid(),
          fileDao: fileDao,
          userCursors: {},
          contentChanges: []
        })
        clSocketSvc.sendMsg('startWatchContent', {
          id: watchCtx.id,
          fileId: fileDao.id,
          previousRev: clContentRevSvc.getRev(fileDao.id)
        })
        $timeout.cancel(fileDao.loadingTimeoutId)
        fileDao.loadingTimeoutId = $timeout(function () {
          setLoadingError(fileDao, 'Loading timeout.')
        }, clSyncDataSvc.loadingTimeout)
      }

      clSocketSvc.addMsgHandler('watchedContent', function (msg) {
        if (!watchCtx || !watchCtx.fileDao.state || watchCtx.id !== msg.id) {
          return
        }
        var fileDao = watchCtx.fileDao
        $timeout.cancel(fileDao.loadingTimeoutId)
        if (msg.error) {
          return setLoadingError(fileDao)
        }
        var oldContent = clDiffUtils.flattenContent(msg.previousContent || msg.lastContent, true)
        var serverContent = clDiffUtils.flattenContent(msg.lastContent, true)
        if (fileDao.state === 'loading') {
          setLoadedContent(fileDao, serverContent)
        } else {
          applyServerContent(fileDao, oldContent, serverContent)
        }
        watchCtx.chars = serverContent.chars
        watchCtx.text = serverContent.text
        watchCtx.properties = serverContent.properties
        watchCtx.discussions = serverContent.discussions
        watchCtx.comments = serverContent.comments
        watchCtx.conflicts = serverContent.conflicts
        watchCtx.rev = serverContent.rev
        clContentRevSvc.setContent(fileDao.id, serverContent)
        // Evaluate scope synchronously to have cledit instantiated
        $rootScope.$apply()
        // Changes can be received before the watchedFile
        applyContentChangeMsgs()
      })

      function getPublicFile (fileDao) {
        if (!fileDao || !fileDao.state || !fileDao.loadPending || !fileDao.userId || !clIsNavigatorOnline()) {
          return
        }
        fileDao.loadPending = false
        var fromRev = clContentRevSvc.getRev(fileDao.id)
        $http.get('/api/v1/files/' + fileDao.id + (fromRev ? '/fromRev/' + fromRev : ''), {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout,
          params: {
            flatten: false
          }
        })
          .success(function (res) {
            clSyncDataSvc.updatePublicFileMetadata(fileDao, res)
            if (!fileDao.state) {
              return
            }
            var oldContent = clDiffUtils.flattenContent(res.content, true)
            var serverContent = clDiffUtils.applyFlattenedContentChanges(oldContent, res.contentChanges, true)
            if (fileDao.state === 'loading') {
              setLoadedContent(fileDao, serverContent)
            } else {
              applyServerContent(fileDao, oldContent, serverContent)
            }
            clContentRevSvc.setContent(fileDao.id, serverContent)
          })
          .error(function () {
            setLoadingError(fileDao)
          })
      }

      var lastTooBigWarning = 0

      function tooBigWarning () {
        var currentDate = Date.now()
        if (currentDate - lastTooBigWarning > 30000) {
          clToast('File is too big!')
          lastTooBigWarning = currentDate
        }
      }

      function sendContentChange () {
        if (!watchCtx || watchCtx.rev === undefined || watchCtx.sentMsg) {
          return
        }
        if (watchCtx.fileDao.userId && (watchCtx.fileDao.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
          return
        }
        var newText = clEditorSvc.cledit.getContent()
        if (newText.length > textMaxSize) {
          return tooBigWarning()
        }
        var textChanges = clDiffUtils.getTextPatches(watchCtx.text, newText)
        var propertiesPatches = clDiffUtils.getObjectPatches(watchCtx.properties, watchCtx.fileDao.contentDao.properties)
        var discussionsPatches = clDiffUtils.getObjectPatches(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions)
        var commentsPatches = clDiffUtils.getObjectPatches(watchCtx.comments, watchCtx.fileDao.contentDao.comments)
        var conflictsPatches = clDiffUtils.getObjectPatches(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts)
        if (!textChanges && !propertiesPatches && !discussionsPatches && !commentsPatches && !conflictsPatches) {
          return
        }
        var newRev = watchCtx.rev + 1
        watchCtx.sentMsg = {
          id: watchCtx.id,
          rev: newRev,
          text: textChanges,
          properties: propertiesPatches,
          discussions: discussionsPatches,
          comments: commentsPatches,
          conflicts: conflictsPatches
        }
        clSocketSvc.sendMsg('setContentChange', watchCtx.sentMsg)
      }

      function applyContentChangeMsgs () {
        if (watchCtx.rev === undefined) {
          return
        }
        var msg
        var apply
        var serverText = watchCtx.text
        var localText = clEditorSvc.cledit.getContent()
        var serverProperties = ({}).cl_extend(watchCtx.properties)
        var serverDiscussions = ({}).cl_extend(watchCtx.discussions)
        var serverComments = ({}).cl_extend(watchCtx.comments)
        var serverConflicts = ({}).cl_extend(watchCtx.conflicts)
        while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
          watchCtx.rev = msg.rev
          if (!msg.userId && watchCtx.sentMsg && msg.rev === watchCtx.sentMsg.rev) {
            // It ought to be the previously sent message
            msg = watchCtx.sentMsg
            watchCtx.contentChanges[msg.rev] = watchCtx.sentMsg
          }
          var oldText = serverText
          watchCtx.chars = clDiffUtils.applyCharPatches(watchCtx.chars, msg.text || [], msg.userId || clSyncDataSvc.userId)
          serverText = watchCtx.chars.cl_map(function (item) {
            return item[1]
          }).join('')
          apply |= !!(msg.properties || msg.discussions || msg.comments || msg.conflicts)
          clDiffUtils.applyFlattenedObjectPatches(serverProperties, msg.properties || [])
          clDiffUtils.applyFlattenedObjectPatches(serverDiscussions, msg.discussions || [])
          clDiffUtils.applyFlattenedObjectPatches(serverComments, msg.comments || [])
          clDiffUtils.applyFlattenedObjectPatches(serverConflicts, msg.conflicts || [])
          if (msg !== watchCtx.sentMsg) {
            var isServerTextChanges = oldText !== serverText
            var isLocalTextChanges = oldText !== localText
            var isTextSynchronized = serverText === localText
            if (!isTextSynchronized && isServerTextChanges) {
              if (isLocalTextChanges) {
                localText = clDiffUtils.quickPatch(oldText, serverText, localText)
              } else {
                localText = serverText
              }
              var offset = clEditorSvc.setContent(localText, true)
              var userCursor = watchCtx.userCursors[msg.userId] || {}
              userCursor.offset = offset
              watchCtx.userCursors[msg.userId] = userCursor
            }
            clUserInfoSvc.request(msg.userId)
          }
          watchCtx.sentMsg = undefined
        }
        watchCtx.fileDao.contentDao.properties = clDiffUtils.mergeObjects(watchCtx.properties, watchCtx.fileDao.contentDao.properties, serverProperties)
        watchCtx.fileDao.contentDao.discussions = clDiffUtils.mergeObjects(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions, serverDiscussions)
        watchCtx.fileDao.contentDao.comments = clDiffUtils.mergeObjects(watchCtx.comments, watchCtx.fileDao.contentDao.comments, serverComments)
        watchCtx.fileDao.contentDao.conflicts = clDiffUtils.mergeObjects(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts, serverConflicts)
        watchCtx.text = serverText
        watchCtx.properties = serverProperties
        watchCtx.discussions = serverDiscussions
        watchCtx.comments = serverComments
        watchCtx.conflicts = serverConflicts
        clContentRevSvc.setContent(watchCtx.fileDao.id, watchCtx)
        apply && $rootScope.$evalAsync()
      }

      clSocketSvc.addMsgHandler('contentChange', function (msg) {
        if (!watchCtx || watchCtx.id !== msg.id || watchCtx.rev >= msg.rev) {
          return
        }
        watchCtx.contentChanges[msg.rev] = msg
        applyContentChangeMsgs()
      })

      clContentSyncSvc.retrieveRevision = function (rev) {
        if (!watchCtx) {
          return
        }
        var toRev = watchCtx.rev
        while (watchCtx.contentChanges[toRev] && toRev > rev) {
          toRev--
        }
        return $q.when()
          .then(function () {
            if (toRev === rev) {
              var result = {
                text: watchCtx.text,
                properties: ({}).cl_extend(watchCtx.properties),
                discussions: ({}).cl_extend(watchCtx.discussions),
                comments: ({}).cl_extend(watchCtx.comments),
                conflicts: ({}).cl_extend(watchCtx.conflicts)
              }
              watchCtx.contentChanges.slice(rev + 1, watchCtx.rev + 1).reverse().cl_each(function (contentChange) {
                result.text = clDiffUtils.applyFlattenedTextPatchesReverse(result.text, contentChange.text || [])
                clDiffUtils.applyFlattenedObjectPatchesReverse(result.properties, contentChange.properties || [])
                clDiffUtils.applyFlattenedObjectPatchesReverse(result.discussions, contentChange.discussions || [])
                clDiffUtils.applyFlattenedObjectPatchesReverse(result.comments, contentChange.comments || [])
                clDiffUtils.applyFlattenedObjectPatchesReverse(result.conflicts, contentChange.conflicts || [])
              })
              return result
            }
            return $http.get('/api/v1/files/' + watchCtx.fileDao.id + '/fromRev/' + rev + '/toRev/' + toRev, {
              headers: clSocketSvc.makeAuthorizationHeader(),
              timeout: clSyncDataSvc.loadingTimeout
            })
              .then(function (result) {
                if (watchCtx && result.data.contentChanges && watchCtx.fileDao.id === result.data.id) {
                  result.data.contentChanges.cl_each(function (contentChange) {
                    watchCtx.contentChanges[contentChange.rev] = contentChange
                  })
                }
                return result.data.content
              })
          })
      }

      clSetInterval(function () {
        // Check that window has focus and socket is online
        if (!clUserActivity.checkActivity() || !clSocketSvc.isOnline()) {
          return
        }
        clFileSvc.localFiles.cl_each(function (fileDao) {
          // Check that content is not being edited
          if (fileDao.isReadOnly || clSyncDataSvc.isFilePendingCreation(fileDao) || (watchCtx && fileDao === watchCtx.fileDao)) {
            return
          }
          if (fileDao.userId && (fileDao.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
            return
          }
          var currentDate = Date.now()
          var fromRev = clContentRevSvc.getRev(fileDao.id)
          fromRev && fileDao.loadExecUnload(function () {
            // Check that content is not being modified in another instance
            if (currentDate - fileDao.contentDao.lastModified < backgroundUpdateContentEvery) {
              return
            }
            if (!clContentRevSvc.isServerContent(fileDao.id, fileDao.contentDao)) {
              clSocketSvc.sendMsg('updateContent', {
                id: fileDao.id,
                fromRev: fromRev,
                text: fileDao.contentDao.text,
                properties: fileDao.contentDao.properties,
                discussions: fileDao.contentDao.discussions,
                comments: fileDao.contentDao.comments,
                conflicts: fileDao.contentDao.conflicts
              })
            }
          })
        })
      }, backgroundUpdateContentEvery)

      clSocketSvc.addMsgHandler('updatedContent', function (msg) {
        var fileDao = clFileSvc.fileMap[msg.id]
        // Check that file still exists and content is still local
        if (!fileDao || !fileDao.contentDao.isLocal) {
          return
        }
        // Check that content is not being edited
        if (watchCtx && watchCtx.fileDao.id === fileDao.id) {
          return
        }
        var currentDate = Date.now()
        fileDao.loadExecUnload(function () {
          // Check that content is not being modified in another instance
          if (currentDate - fileDao.contentDao.lastModified < backgroundUpdateContentEvery) {
            return
          }
          // Update content
          fileDao.contentDao.text = msg.text
          fileDao.contentDao.properties = msg.properties
          fileDao.contentDao.discussions = msg.discussions
          fileDao.contentDao.comments = msg.comments
          fileDao.contentDao.conflicts = msg.conflicts
          fileDao.writeContent()
          clContentRevSvc.setContent(fileDao.id, msg)
        })
      })

      $rootScope.$watch('currentFileDao', function (currentFileDao) {
        if (currentFileDao) {
          currentFileDao.loadPending = true
        }
        if (clSocketSvc.isOnline()) {
          clSyncSvc.saveAll()
          watchFile(currentFileDao)
        } else if (!clSocketSvc.hasToken) {
          getPublicFile(currentFileDao)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        if (clSocketSvc.isOnline()) {
          watchFile($rootScope.currentFileDao)
          sendContentChange()
        } else if (!clSocketSvc.hasToken) {
          getPublicFile($rootScope.currentFileDao)
        }
      }, 200)

      return clContentSyncSvc
    })
