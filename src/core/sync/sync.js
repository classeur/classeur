angular.module('classeur.core.sync', [])
  .factory('clSyncDataSvc',
    function (clLocalStorage, clLocalStorageObject, clFileSvc, clFolderSvc, clClasseurSvc, clSocketSvc) {
      var cleanPublicObjectAfter = 86400000 // 1 day

      var clSyncDataSvc = clLocalStorageObject('syncData', {
        classeurs: 'object',
        folders: 'object',
        lastFolderSeq: 'int',
        files: 'object',
        lastFileSeq: 'int',
        userId: 'string',
        userData: 'object',
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

        ;[{
          group: 'files',
          svc: clFileSvc
        }, {
          group: 'folders',
          svc: clFolderSvc
        }, {
          group: 'classeurs',
          svc: clClasseurSvc
        }]
          .cl_each(function (params) {
            // Eject old public deleted data from clSyncDataSvc
            clSyncDataSvc[params.group] = clSyncDataSvc[params.group].cl_reduce(function (items, updated, id) {
              var dao = params.svc.daoMap[id] || params.svc.deletedDaoMap[id]
              if (dao && (!dao.userId || !dao.deleted || currentDate - dao.deleted < cleanPublicObjectAfter)) {
                items[id] = updated
              }
              return items
            }, {})

            // Remove deletedDaos that are not synced anymore
            params.svc.removeDaos(
              params.svc.deletedDaos.cl_filter(function (dao) {
                if (!clSyncDataSvc[params.group][dao.id]) {
                  return true
                }
              })
            )
          })

        // Eject old folderRefreshDates
        clSyncDataSvc.folderRefreshDates.cl_each(function (date, folderId) {
          if (currentDate - date > cleanPublicObjectAfter) {
            delete clSyncDataSvc.folderRefreshDates[folderId]
          }
        })

        // Remove public files that are not local and not refreshed recently
        clFileSvc.removeDaos(
          clFileSvc.daos.cl_filter(function (file) {
            if (file.userId &&
              !file.content.isLocal &&
              (!file.folderId || !clSyncDataSvc.folderRefreshDates.hasOwnProperty(file.folderId))
            ) {
              return true
            }
          })
        )
      }

      function checkLocalStorage (ctx) {
        if (clSyncDataSvc.$checkUpdate()) {
          read()
        } else {
          write()
        }

        if (ctx && ctx.userId && ctx.userId !== clSyncDataSvc.userId) {
          // Add userId to synced files owned by previous user
          var filesToRemove = clFileSvc.daos.cl_filter(function (file) {
            if (!file.userId && clSyncDataSvc.files.hasOwnProperty(file.id)) {
              file.userId = clSyncDataSvc.userId
              return !file.content.isLocal
            }
          })
          // Remove files that are public and not local
          clFileSvc.removeDaos(filesToRemove)
          // Remove files that are pending for deletion
          clFileSvc.removeDaos(clFileSvc.deletedDaos)

          // Add userId to synced folders owned by previous user
          clFolderSvc.daos.cl_each(function (folder) {
            if (!folder.userId && clSyncDataSvc.folders.hasOwnProperty(folder.id)) {
              folder.userId = clSyncDataSvc.userId
            }
          })
          // Remove folders that are pending for deletion
          clFolderSvc.removeDaos(clFolderSvc.deletedDaos)

          // Remove classeurs that belong to previous user
          clClasseurSvc.removeDaos(
            clClasseurSvc.daos.cl_filter(function (classeur) {
              return !classeur.userId && clSyncDataSvc.classeurs.hasOwnProperty(classeur.id)
            })
          )
          // Remove classeurs that are pending for deletion
          clClasseurSvc.removeDaos(clClasseurSvc.deletedDaos)

          reset()
          clSyncDataSvc.userId = ctx.userId
          return true
        }
      }

      function updatePublicFileMetadata (file, metadata) {
        file.refreshed = Date.now()
        var syncData = clSyncDataSvc.files[file.id] || {}
        if (metadata.updated) {
          // File permission can change without metadata update
          if ((metadata.updated !== syncData.r && metadata.updated !== syncData.s) || file.sharing !== metadata.permission) {
            file.name = metadata.name || ''
            // For public files we take the permission as the file sharing
            file.sharing = metadata.permission || metadata.permission || ''
            file.updated = metadata.updated
            file.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : ''
            file.$setExtUpdate(file.updated)
          }
          syncData.r = metadata.updated
          clSyncDataSvc.files[file.id] = syncData
        }
      }

      function updatePublicFolderMetadata (folder, metadata) {
        var syncData = clSyncDataSvc.folders[folder.id] || {}
        if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
          folder.name = metadata.name || ''
          folder.sharing = metadata.sharing || ''
          folder.updated = metadata.updated
          folder.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : ''
          folder.$setExtUpdate(folder.updated)
        }
        syncData.r = metadata.updated
        clSyncDataSvc.folders[folder.id] = syncData
      }

      function updatePublicClasseurMetadata (classeur, metadata) {
        var syncData = clSyncDataSvc.classeur[classeur.id] || {}
        if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
          classeur.name = metadata.name || ''
          classeur.updated = metadata.updated
          classeur.$setExtUpdate(classeur.updated)
        }
        syncData.r = metadata.updated
        clSyncDataSvc.classeur[classeur.id] = syncData
      }

      clSyncDataSvc.checkLocalStorage = checkLocalStorage
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
            if (!clFileSvc.daoMap[match[1]] || !clFileSvc.daoMap[match[1]].content.isLocal) {
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
    function ($window, $rootScope, $location, $http, $q, $templateCache, clVersion, clIsNavigatorOnline, clLocalStorage, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clRestSvc, clUserActivity, clSetInterval, clSyncDataSvc, clContentRevSvc) {
      var userNameMaxLength = 64
      var nameMaxLength = 128
      var recoverFileTimeout = 30 * 1000 // 30 sec
      var lastSeqMargin = 1000 // 1 sec
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
        // Detect upgrade performed in another tab
        if (clLocalStorage.getItem('version') !== String(clVersion.localStorageVersion)) {
          return $window.location.reload()
        }

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

      clSyncSvc.recoverFile = function (file) {
        var currentDate = Date.now()
        clSyncDataSvc.fileRecoveryDates[file.id] = currentDate
        if (!clFileSvc.daoMap[file.id]) {
          clSocketSvc.sendMsg('putFile', {
            id: file.id,
            userId: file.userId || clSyncDataSvc.userId,
            name: file.name,
            folderId: file.folderId || 'null',
            sharing: file.sharing || undefined,
            updated: currentDate
          })
        }
      }

      var isSyncActive = (function () {
        var lastSyncActivityKey = 'lastSyncActivity'
        var lastSyncActivity
        var inactivityThreshold = 3000 // 3 sec

        return function (currentDate) {
          if (!clSocketSvc.isOnline()) {
            return
          }
          var storedLastSyncActivity = parseInt(clLocalStorage[lastSyncActivityKey], 10) || 0
          if (lastSyncActivity === storedLastSyncActivity || storedLastSyncActivity < currentDate - inactivityThreshold) {
            clLocalStorage[lastSyncActivityKey] = currentDate
            lastSyncActivity = currentDate
            return true
          } else {
            clSocketSvc.ctx.syncQueue = undefined
          }
        }
      })()

      function PendingChangeGroup () {}
      PendingChangeGroup.prototype.$add = function (item) {
        // Only store change if syncing
        if (clSocketSvc.ctx && clSocketSvc.ctx.syncQueue) {
          var pendingChange = this[item.id || 0]
          // And if newer in case other change was received
          if (!pendingChange || !pendingChange.seq || pendingChange.seq < item.seq) {
            this[item.id || 0] = item
          }
        }
      }

      var pendingChangeGroups = {
        users: new PendingChangeGroup(),
        files: new PendingChangeGroup(),
        folders: new PendingChangeGroup(),
        classeurs: new PendingChangeGroup(),
        settings: new PendingChangeGroup()
      }

      ;({
        users: 'userChange',
        files: 'fileChange',
        folders: 'folderChange',
        classeurs: 'classeurChange',
        settings: 'settings'
      })
        .cl_each(function (msgType, group) {
          clSocketSvc.addMsgHandler(msgType, function (item) {
            pendingChangeGroups[group].$add(item)
          })
        })

      clSetInterval(function () {
        doInLocalStorage(function () {
          var changesToApply
          var currentDate = Date.now()

          if (!isSyncActive(currentDate)) {
            return
          }

          clSyncDataSvc.fileRecoveryDates.cl_each(function (date, fileId) {
            if (currentDate - date > recoverFileTimeout) {
              delete clSyncDataSvc.fileRecoveryDates[fileId]
            }
          })

          var syncQueue = clSocketSvc.ctx.syncQueue
          if (!syncQueue) {
            syncQueue = clSocketSvc.ctx.syncQueue = (function () {
              var promise = Promise.resolve()
              return function (cb) {
                promise = promise.then(function (res) {
                  // Drain the queue if socket state changed
                  if (!clSocketSvc.ctx || clSocketSvc.ctx.syncQueue !== syncQueue) {
                    return
                  }
                  return cb(res)
                })
                  .catch(function (err) {
                    err.message && clToast(err.message)
                  })
              }
            })()

            // ---------------------------
            // Init sync

            pendingChangeGroups = {
              users: new PendingChangeGroup(),
              files: new PendingChangeGroup(),
              folders: new PendingChangeGroup(),
              classeurs: new PendingChangeGroup(),
              settings: new PendingChangeGroup()
            }

            // Retrieve user
            syncQueue(function () {
              return clRestSvc.requestIgnore304({
                method: 'GET',
                url: '/api/v2/users/me',
                params: {
                  view: 'private'
                }
              }, clSyncDataSvc.userData.user)
            })
            syncQueue(function (res) {
              res && pendingChangeGroups.users.$add(res.body)
              syncQueue.users = {} // Start syncing and record sent data
            })

            // Retrieve all classeurs
            syncQueue(function () {
              return clRestSvc.list(
                '/api/v2/users/' + clSyncDataSvc.userId + '/classeurs',
                { view: 'private' }
              )
            })
            syncQueue(function (items) {
              items.cl_each(function (item) {
                pendingChangeGroups.classeurs.$add(item)
              })
              // Detect classeurs removed on the server
              Object.keys(clSyncDataSvc.classeurs).cl_each(function (classeurId) {
                if (!pendingChangeGroups.classeurs[classeurId]) {
                  pendingChangeGroups.classeurs.$add({
                    id: classeurId,
                    deleted: true
                  })
                }
              })
              syncQueue.classeurs = {} // Start syncing and record sent data
            })

            // Retrieve folder and file changes that happened before syncing
            ;[{
              group: 'folders',
              lastSeqAttr: 'lastFolderSeq'
            }, {
              group: 'files',
              lastSeqAttr: 'lastFileSeq'
            }]
              .cl_each(function (params) {
                syncQueue(function () {
                  return clRestSvc.listFromSeq(
                    '/api/v2/users/' + clSyncDataSvc.userId + '/' + params.group,
                    clSyncDataSvc[params.lastSeqAttr] - lastSeqMargin
                  )
                })
                syncQueue(function (items) {
                  items.cl_each(function (item) {
                    pendingChangeGroups[params.group].$add(item)
                  })
                  syncQueue[params.group] = {} // Start syncing and record sent data
                })
              })

            // Retrieve settings after classeurs since it contains default classeur ID
            syncQueue(function () {
              return clRestSvc.requestIgnore304({
                method: 'GET',
                url: '/api/v2/users/' + clSyncDataSvc.userId + '/settings'
              }, clSyncDataSvc.userData.settings)
            })
            syncQueue(function (res) {
              res && pendingChangeGroups.settings.$add(res.body)
              syncQueue.settings = {} // Start syncing and record sent data
            })
          }

          // ---------------------------
          // USER

          // Process received user changes
          if (syncQueue.users) {
            var user = pendingChangeGroups.users[clSyncDataSvc.userId]
            if (user) {
              if (
                user.updated !== clUserSvc.updated &&
                user.updated !== clSyncDataSvc.userData.user &&
                user.updated !== syncQueue.users[clSyncDataSvc.userId]
              ) {
                clUserSvc.user = user
                clUserSvc.$setExtUpdate(user.updated)
              }
              clSyncDataSvc.userData.user = user.updated
              delete syncQueue.users[clSyncDataSvc.userId] // Assume we received the change we sent
            }
            pendingChangeGroups.users = new PendingChangeGroup()

            // Send user changes
            syncQueue(function () {
              if (clUserSvc.user && clUserSvc.user.name && clUserSvc.updated &&
                clUserSvc.updated !== clSyncDataSvc.userData.user &&
                clUserSvc.updated !== syncQueue.users[clSyncDataSvc.userId]
              ) {
                if (clUserSvc.user.name.length > userNameMaxLength) {
                  clUserSvc.user.name = clUserSvc.user.name.slice(0, userNameMaxLength)
                  return
                }
                syncQueue.users[clSyncDataSvc.userId] = clUserSvc.updated
                return clRestSvc.request({
                  method: 'PATCH',
                  url: '/api/v2/users/' + clSyncDataSvc.userId,
                  body: {
                    name: clUserSvc.user.name,
                    gravatarEmail: clUserSvc.user.gravatarEmail,
                    updated: clUserSvc.updated
                  }
                })
              }
            })
          }

          // ---------------------------
          // CLASSEURS

          // Process received classeur changes
          if (syncQueue.classeurs) {
            changesToApply = []
            pendingChangeGroups.classeurs.cl_each(function (item) {
              var classeur = clClasseurSvc.daoMap[item.id]
              if (
                // Was deleted on the server
                (item.deleted && classeur) ||
                // Was created on the server and is not pending for deletion locally
                (!item.deleted && !classeur && !clClasseurSvc.deletedDaoMap[item.id]) ||
                // Was updated on the server and is different from local
                (!item.deleted && classeur &&
                item.updated !== classeur.updated &&
                item.updated !== clSyncDataSvc.classeurs[item.id] &&
                item.updated !== syncQueue.classeurs[item.id])
              ) {
                changesToApply.push(item)
                // Sanitize userId according to current user
                if (item.userId === clSyncDataSvc.userId) {
                  item.userId = undefined
                } else if (!item.userId) {
                  item.userId = 'null'
                }
              }
              if (item.deleted) {
                delete clSyncDataSvc.classeurs[item.id]
              } else {
                clSyncDataSvc.classeurs[item.id] = item.updated
              }
              delete syncQueue.classeurs[item.id] // Assume we received the change we sent
            })
            clClasseurSvc.applyClasseurChanges(changesToApply)
            pendingChangeGroups.classeurs = new PendingChangeGroup()

            // Send classeur changes, after settings are merged
            syncQueue.settingsMerged && syncQueue(function updateClasseur () {
              var result

              function isToBeUpdated (classeur) {
                if (classeur.name && classeur.updated &&
                  classeur.updated !== clSyncDataSvc.classeurs[classeur.id] &&
                  classeur.updated !== syncQueue.classeurs[classeur.id]
                ) {
                  if (classeur.name.length > nameMaxLength) {
                    classeur.name = classeur.name.slice(0, nameMaxLength)
                  } else {
                    return true
                  }
                }
              }

              // Send a new/modified classeur
              clClasseurSvc.daos.cl_some(function (classeur) {
                if (isToBeUpdated(classeur)) {
                  syncQueue.classeurs[classeur.id] = classeur.updated
                  result = clRestSvc.request({
                    method: 'PUT',
                    url: '/api/v2/classeurs/' + classeur.id,
                    body: {
                      id: classeur.id,
                      userId: classeur.userId === 'null' ? undefined : classeur.userId || clSyncDataSvc.userId,
                      name: classeur.name,
                      updated: classeur.updated
                    }
                  })
                  return true // Send one at a time
                }
              }) ||
              // Or send a deleted classeur
              clClasseurSvc.deletedDaos.cl_some(function (classeur) {
                // If classeur was synced
                if (clSyncDataSvc.classeurs[classeur.id] && isToBeUpdated(classeur)) {
                  syncQueue.classeurs[classeur.id] = classeur.updated
                  result = clRestSvc.request({
                    method: 'DELETE',
                    url: '/api/v2/classeurs/' + classeur.id
                  })
                  return true // Send one at a time
                }
              })

              if (result) {
                syncQueue(updateClasseur) // Enqueue other potential updates
                return result
              }
            })
          }

          // ---------------------------
          // FOLDERS

          // Process received folder changes
          if (syncQueue.folders) {
            changesToApply = []
            var lastFolderSeq = clSyncDataSvc.lastFolderSeq
            pendingChangeGroups.folders.cl_each(function (item) {
              lastFolderSeq = Math.max(lastFolderSeq, item.seq || 0)
              var folder = clFolderSvc.daoMap[item.id]
              if (
                // Was deleted on the server
                (item.deleted && folder) ||
                // Was created on the server and is not pending for deletion locally
                (!item.deleted && !folder && !clFolderSvc.deletedDaoMap[item.id]) ||
                // Was updated on the server and is different from local
                (!item.deleted && folder &&
                item.updated !== folder.updated &&
                item.updated !== clSyncDataSvc.folders[item.id] &&
                item.updated !== syncQueue.folders[item.id])
              ) {
                changesToApply.push(item)
                // Sanitize userId according to current user
                if (item.userId === clSyncDataSvc.userId) {
                  item.userId = undefined
                }
              }
              if (item.deleted) {
                delete clSyncDataSvc.folders[item.id]
              } else {
                clSyncDataSvc.folders[item.id] = item.updated
              }
              delete syncQueue.folders[item.id] // Assume we received the change we sent
            })
            clFolderSvc.applyFolderChanges(changesToApply)
            clSyncDataSvc.lastFolderSeq = lastFolderSeq
            pendingChangeGroups.folders = new PendingChangeGroup()

            // Send folder changes
            syncQueue(function updateFolder () {
              var result

              function isToBeUpdated (folder) {
                if (folder.name && folder.updated &&
                  folder.updated !== clSyncDataSvc.folders[folder.id] &&
                  folder.updated !== syncQueue.folders[folder.id] &&
                  (!folder.userId || folder.sharing === 'rw')
                ) {
                  if (folder.name.length > nameMaxLength) {
                    folder.name = folder.name.slice(0, nameMaxLength)
                  } else {
                    return true
                  }
                }
              }

              // Send a new/modified folder
              clFolderSvc.daos.cl_some(function (folder) {
                if (isToBeUpdated(folder)) {
                  syncQueue.folders[folder.id] = folder.updated
                  result = clRestSvc.request({
                    method: 'PUT',
                    url: '/api/v2/folders/' + folder.id,
                    body: {
                      id: folder.id,
                      userId: folder.userId || clSyncDataSvc.userId,
                      name: folder.name,
                      sharing: folder.sharing || undefined,
                      updated: folder.updated
                    }
                  })
                  return true // Send one at a time
                }
              }) ||
              // Or send a deleted folder
              clFolderSvc.deletedDaos.cl_some(function (folder) {
                // If folder was synced
                if (clSyncDataSvc.folders[folder.id] && isToBeUpdated(folder)) {
                  syncQueue.folders[folder.id] = folder.updated
                  result = clRestSvc.request({
                    method: 'DELETE',
                    url: '/api/v2/folders/' + folder.id
                  })
                  return true // Send one at a time
                }
              })

              if (result) {
                syncQueue(updateFolder) // Enqueue other potential updates
                return result
              }
            })
          }

          // ---------------------------
          // FILES

          // Process received file changes
          if (syncQueue.files) {
            changesToApply = []
            var lastFileSeq = clSyncDataSvc.lastFileSeq
            pendingChangeGroups.files.cl_each(function (item) {
              lastFileSeq = Math.max(lastFileSeq, item.seq || 0)
              var file = clFileSvc.daoMap[item.id]
              if (file && file.userId && item.deleted) {
                // We just lost ownership of the file
                delete syncQueue.files[item.id]
                return
              }
              if (
                // Was deleted on the server
                (item.deleted && file) ||
                // Was created on the server and is not pending for deletion locally
                (!item.deleted && !file && !clFileSvc.deletedDaoMap[item.id]) ||
                // Was updated on the server and is different from local
                (!item.deleted && file &&
                item.updated !== file.updated &&
                item.updated !== clSyncDataSvc.files[item.id] &&
                item.updated !== syncQueue.files[item.id])
              ) {
                changesToApply.push(item)
                // Sanitize userId according to current user
                if (item.userId === clSyncDataSvc.userId) {
                  item.userId = undefined
                }
              }
              if (item.deleted) {
                delete clSyncDataSvc.files[item.id]
              } else {
                clSyncDataSvc.files[item.id] = item.updated
              }
              delete syncQueue.files[item.id] // Assume we received the change we sent
            })
            clFileSvc.applyFileChanges(changesToApply)
            clSyncDataSvc.lastFileSeq = lastFileSeq
            pendingChangeGroups.files = new PendingChangeGroup()

            // Send file changes
            syncQueue(function updateFile () {
              var filesToRemove = []
              var result

              function isToBeUpdated (file) {
                var folder = clFolderSvc.daoMap[file.folderId]
                if (file.name && file.updated &&
                  file.updated !== clSyncDataSvc.files[file.id] &&
                  file.updated !== syncQueue.files[file.id] &&
                  // File can be saved into folder only if folder was synced
                  (!file.folderId || clSyncDataSvc.folders[file.folderId]) &&
                  // Folder sharing preference overrides file preference
                  (!file.userId || (file.sharing === 'rw' || (folder && folder.sharing === 'rw')))
                ) {
                  if (file.name.length > nameMaxLength) {
                    file.name = file.name.slice(0, nameMaxLength)
                  } else {
                    if (clSyncDataSvc.files[file.id]) {
                      return true
                    }
                    // File is not local and was never created
                    if (!file.content.isLocal) {
                      filesToRemove.push(file)
                      return
                    }
                    return file.loadExecUnload(function () {
                      // Remove first file in case existing user signs in (see #13)
                      if (clFileSvc.daos.length > 1 && file.name === clFileSvc.firstFileName && file.content.text === clFileSvc.firstFileContent) {
                        filesToRemove.push(file)
                        return
                      }
                      // File is to be created
                      return true
                    })
                  }
                }
              }

              // Send a new/modified file
              clFileSvc.daos.cl_some(function (file) {
                if (isToBeUpdated(file)) {
                  syncQueue.files[file.id] = file.updated
                  // Remove from folder only if file belongs to user
                  var folderId = file.folderId || (file.userId ? undefined : 'null')
                  result = clRestSvc.request({
                    method: 'PUT',
                    url: folderId
                      ? '/api/v2/folders/' + folderId + '/files/' + file.id
                      : '/api/v2/files/' + file.id,
                    body: {
                      id: file.id,
                      userId: file.userId || clSyncDataSvc.userId,
                      name: file.name,
                      sharing: file.sharing || undefined,
                      updated: file.updated
                    }
                  })
                  return true // Send one at a time
                }
              }) ||
              // Or send a deleted file
              clFileSvc.deletedDaos.cl_some(function (file) {
                // If file was synced
                if (clSyncDataSvc.files[file.id] && isToBeUpdated(file) && !clSyncDataSvc.fileRecoveryDates.hasOwnProperty(file.id)) {
                  syncQueue.files[file.id] = file.updated
                  // Remove from folder only if file belongs to user
                  var folderId = file.folderId || (file.userId ? undefined : 'null')
                  result = clRestSvc.request({
                    method: 'PUT',
                    url: folderId
                      ? '/api/v2/folders/' + folderId + '/files/' + file.id
                      : '/api/v2/files/' + file.id,
                    body: {
                      id: file.id,
                      userId: file.userId || clSyncDataSvc.userId,
                      name: file.name,
                      sharing: file.sharing || undefined,
                      updated: file.updated,
                      deleted: file.deleted
                    }
                  })
                  return true // Send one at a time
                }
              })

              if (filesToRemove.length) {
                clFileSvc.removeDaos(filesToRemove)
                $rootScope.$evalAsync()
              }
              if (result) {
                syncQueue(updateFile) // Enqueue other potential updates
                return result
              }
            })
          }

          // ---------------------------
          // SETTINGS

          // Process received settings
          if (syncQueue.settings) {
            var settings = pendingChangeGroups.settings[0]
            if (settings) {
              if (
                settings.updated !== clSettingSvc.updated &&
                settings.updated !== clSyncDataSvc.userData.settings &&
                settings.updated !== syncQueue.settings[0]
              ) {
                var newDefaultClasseur
                if (settings.defaultClasseurId !== clSettingSvc.values.defaultClasseurId) {
                  newDefaultClasseur = clClasseurSvc.daoMap[settings.defaultClasseurId]
                }

                clSettingSvc.updateSettings(settings)
                clSettingSvc.$setExtUpdate(settings.updated)

                if (newDefaultClasseur) {
                  // Merge default classeur if different
                  clClasseurSvc.mergeDefaultClasseur(newDefaultClasseur)
                }
              }
              clSyncDataSvc.userData.settings = settings.updated
              delete syncQueue.settings[0] // Assume we received the change we sent
            }
            pendingChangeGroups.settings = new PendingChangeGroup()
            syncQueue.settingsMerged = true // Start sending classeur changes

            // Send settings changes
            syncQueue(function () {
              if (clSettingSvc.updated &&
                clSettingSvc.updated !== clSyncDataSvc.userData.settings &&
                clSettingSvc.updated !== syncQueue.settings[0]
              ) {
                syncQueue.settings[0] = clSettingSvc.updated
                return clRestSvc.request({
                  method: 'PUT',
                  url: '/api/v2/users/' + clSyncDataSvc.userId + '/settings',
                  body: angular.extend({}, clSettingSvc.values, {
                    updated: clSettingSvc.updated
                  })
                })
              }
            })
          }
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
        var filesToRefresh = clFileSvc.localFiles.cl_filter(function (file) {
          return file.userId && (!file.refreshed || currentDate - publicFileRefreshAfter > file.refreshed)
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
            id: filesToRefresh.cl_map(function (file) {
              return file.id
            }).join(',')
          }
        })
          .success(function (res) {
            lastGetExtFileAttempt = 0
            res.cl_each(function (item) {
              var file = clFileSvc.daoMap[item.id]
              if (file) {
                clSyncDataSvc.updatePublicFileMetadata(file, item)
                !item.updated && clToast('File not accessible: ' + (file.name || file.id))
              }
            })
          })
      }

      function getPublicFolder (folder) {
        if (!folder || !folder.userId ||
          (folder.refreshed && Date.now() - folder.refreshed < publicFileRefreshAfter)
        ) {
          return
        }
        $http.get('/api/v1/folders/' + folder.id, {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout
        })
          .success(function (res) {
            var currentDate = Date.now()
            clSyncDataSvc.folderRefreshDates[folder.id] = currentDate
            folder.refreshed = currentDate
            clSyncDataSvc.updatePublicFolderMetadata(folder, res)
            var filesToMove = {}
            clFileSvc.daos.cl_each(function (file) {
              if (file.folderId === folder.id) {
                filesToMove[file.id] = file
              }
            })
            res.files.cl_each(function (item) {
              delete filesToMove[item.id]
              var file = clFileSvc.daoMap[item.id]
              if (!file) {
                file = clFileSvc.createPublicFile(item.id)
                file.deleted = 0
                clFileSvc.daoMap[file.id] = file
                clFileSvc.fileIds.push(file.id)
              }
              file.folderId = folder.id
              file.classeurId = ''
              clSyncDataSvc.updatePublicFileMetadata(file, item)
            })
            filesToMove.cl_each(function (file) {
              file.folderId = ''
            })
            clFolderSvc.init() // Refresh tabs order
            clFileSvc.init()
          })
          .error(function () {
            folder.refreshed = 1 // Get rid of the spinner
            clToast('Folder not accessible: ' + folder.name)
            !folder.name && clFolderSvc.removeDaos([folder])
          })
      }

      return {
        getFolder: function (folder) {
          if (clIsNavigatorOnline()) {
            folder ? getPublicFolder(folder) : getLocalFiles()
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

      function setLoadedContent (file, serverContent) {
        file.content.text = serverContent.text
        file.content.properties = ({}).cl_extend(serverContent.properties)
        file.content.discussions = ({}).cl_extend(serverContent.discussions)
        file.content.comments = ({}).cl_extend(serverContent.comments)
        file.content.conflicts = ({}).cl_extend(serverContent.conflicts)
        file.content.isLocal = '1'
        file.content.state = {}
        file.writeContent(true)
        file.state = 'loaded'
        clFileSvc.init()
      }

      function setLoadingError (file, error) {
        if (file.state === 'loading') {
          file.state = undefined
        }
        clToast(error || 'File not accessible: ' + (file.name || file.id))
      }

      function applyServerContent (file, oldContent, serverContent) {
        var newContent = {
          text: clEditorSvc.cledit.getContent(),
          properties: file.content.properties,
          discussions: file.content.discussions,
          comments: file.content.comments,
          conflicts: file.content.conflicts
        }
        var conflicts = clDiffUtils.mergeContent(oldContent, newContent, serverContent)
        file.content.properties = newContent.properties
        file.content.discussions = newContent.discussions
        file.content.comments = newContent.comments
        file.content.conflicts = newContent.conflicts
        clEditorSvc.setContent(newContent.text, true)
        if (conflicts.length) {
          conflicts.cl_each(function (conflict) {
            file.content.conflicts[clUid()] = conflict
          })
          clEditorLayoutSvc.currentControl = 'conflictAlert'
        }
      }

      function watchFile (file) {
        if (watchCtx) {
          if (file === watchCtx.file) {
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
        if (!file || !file.state || file.isReadOnly || file.isLocalFile || !clSyncDataSvc.files[file.id]) {
          return
        }
        file.loadPending = false
        setWatchCtx({
          id: clUid(),
          file: file,
          userCursors: {},
          contentChanges: []
        })
        clSocketSvc.sendMsg('startWatchContent', {
          id: watchCtx.id,
          fileId: file.id,
          previousRev: clContentRevSvc.getRev(file.id)
        })
        $timeout.cancel(file.loadingTimeoutId)
        file.loadingTimeoutId = $timeout(function () {
          setLoadingError(file, 'Loading timeout.')
        }, clSyncDataSvc.loadingTimeout)
      }

      clSocketSvc.addMsgHandler('watchedContent', function (msg) {
        if (!watchCtx || !watchCtx.file.state || watchCtx.id !== msg.id) {
          return
        }
        var file = watchCtx.file
        $timeout.cancel(file.loadingTimeoutId)
        if (msg.error) {
          return setLoadingError(file)
        }
        var oldContent = clDiffUtils.flattenContent(msg.previousContent || msg.lastContent, true)
        var serverContent = clDiffUtils.flattenContent(msg.lastContent, true)
        if (file.state === 'loading') {
          setLoadedContent(file, serverContent)
        } else {
          applyServerContent(file, oldContent, serverContent)
        }
        watchCtx.chars = serverContent.chars
        watchCtx.text = serverContent.text
        watchCtx.properties = serverContent.properties
        watchCtx.discussions = serverContent.discussions
        watchCtx.comments = serverContent.comments
        watchCtx.conflicts = serverContent.conflicts
        watchCtx.rev = serverContent.rev
        clContentRevSvc.setContent(file.id, serverContent)
        // Evaluate scope synchronously to have cledit instantiated
        $rootScope.$apply()
        // Changes can be received before the watchedFile
        applyContentChangeMsgs()
      })

      function getPublicFile (file) {
        if (!file || !file.state || !file.loadPending || !file.userId || !clIsNavigatorOnline()) {
          return
        }
        file.loadPending = false
        var fromRev = clContentRevSvc.getRev(file.id)
        $http.get('/api/v1/files/' + file.id + (fromRev ? '/fromRev/' + fromRev : ''), {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout,
          params: {
            flatten: false
          }
        })
          .success(function (res) {
            clSyncDataSvc.updatePublicFileMetadata(file, res)
            if (!file.state) {
              return
            }
            var oldContent = clDiffUtils.flattenContent(res.content, true)
            var serverContent = clDiffUtils.applyFlattenedContentChanges(oldContent, res.contentChanges, true)
            if (file.state === 'loading') {
              setLoadedContent(file, serverContent)
            } else {
              applyServerContent(file, oldContent, serverContent)
            }
            clContentRevSvc.setContent(file.id, serverContent)
          })
          .error(function () {
            setLoadingError(file)
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
        if (watchCtx.file.userId && (watchCtx.file.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
          return
        }
        var newText = clEditorSvc.cledit.getContent()
        if (newText.length > textMaxSize) {
          return tooBigWarning()
        }
        var textChanges = clDiffUtils.getTextPatches(watchCtx.text, newText)
        var propertiesPatches = clDiffUtils.getObjectPatches(watchCtx.properties, watchCtx.file.content.properties)
        var discussionsPatches = clDiffUtils.getObjectPatches(watchCtx.discussions, watchCtx.file.content.discussions)
        var commentsPatches = clDiffUtils.getObjectPatches(watchCtx.comments, watchCtx.file.content.comments)
        var conflictsPatches = clDiffUtils.getObjectPatches(watchCtx.conflicts, watchCtx.file.content.conflicts)
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
        watchCtx.file.content.properties = clDiffUtils.mergeObjects(watchCtx.properties, watchCtx.file.content.properties, serverProperties)
        watchCtx.file.content.discussions = clDiffUtils.mergeObjects(watchCtx.discussions, watchCtx.file.content.discussions, serverDiscussions)
        watchCtx.file.content.comments = clDiffUtils.mergeObjects(watchCtx.comments, watchCtx.file.content.comments, serverComments)
        watchCtx.file.content.conflicts = clDiffUtils.mergeObjects(watchCtx.conflicts, watchCtx.file.content.conflicts, serverConflicts)
        watchCtx.text = serverText
        watchCtx.properties = serverProperties
        watchCtx.discussions = serverDiscussions
        watchCtx.comments = serverComments
        watchCtx.conflicts = serverConflicts
        clContentRevSvc.setContent(watchCtx.file.id, watchCtx)
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
            return $http.get('/api/v1/files/' + watchCtx.file.id + '/fromRev/' + rev + '/toRev/' + toRev, {
              headers: clSocketSvc.makeAuthorizationHeader(),
              timeout: clSyncDataSvc.loadingTimeout
            })
              .then(function (result) {
                if (watchCtx && result.data.contentChanges && watchCtx.file.id === result.data.id) {
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
        clFileSvc.localFiles.cl_each(function (file) {
          // Check that content is not being edited
          if (file.isReadOnly || !clSyncDataSvc.files[file.id] || (watchCtx && file === watchCtx.file)) {
            return
          }
          if (file.userId && (file.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
            return
          }
          var currentDate = Date.now()
          var fromRev = clContentRevSvc.getRev(file.id)
          fromRev && file.loadExecUnload(function () {
            // Check that content is not being modified in another instance
            if (currentDate - file.content.lastModified < backgroundUpdateContentEvery) {
              return
            }
            if (!clContentRevSvc.isServerContent(file.id, file.content)) {
              clSocketSvc.sendMsg('updateContent', {
                id: file.id,
                fromRev: fromRev,
                text: file.content.text,
                properties: file.content.properties,
                discussions: file.content.discussions,
                comments: file.content.comments,
                conflicts: file.content.conflicts
              })
            }
          })
        })
      }, backgroundUpdateContentEvery)

      clSocketSvc.addMsgHandler('updatedContent', function (msg) {
        var file = clFileSvc.daoMap[msg.id]
        // Check that file still exists and content is still local
        if (!file || !file.content.isLocal) {
          return
        }
        // Check that content is not being edited
        if (watchCtx && watchCtx.file.id === file.id) {
          return
        }
        var currentDate = Date.now()
        file.loadExecUnload(function () {
          // Check that content is not being modified in another instance
          if (currentDate - file.content.lastModified < backgroundUpdateContentEvery) {
            return
          }
          // Update content
          file.content.text = msg.text
          file.content.properties = msg.properties
          file.content.discussions = msg.discussions
          file.content.comments = msg.comments
          file.content.conflicts = msg.conflicts
          file.writeContent()
          clContentRevSvc.setContent(file.id, msg)
        })
      })

      $rootScope.$watch('currentFile', function (currentFile) {
        if (currentFile) {
          currentFile.loadPending = true
        }
        if (clSocketSvc.isOnline()) {
          clSyncSvc.saveAll()
          watchFile(currentFile)
        } else if (!clSocketSvc.hasToken) {
          getPublicFile(currentFile)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        if (clSocketSvc.isOnline()) {
          watchFile($rootScope.currentFile)
          sendContentChange()
        } else if (!clSocketSvc.hasToken) {
          getPublicFile($rootScope.currentFile)
        }
      }, 200)

      return clContentSyncSvc
    })
