angular.module('classeur.core.sync', [])
  .factory('clSyncDataSvc',
    function (clFileSvc, clFolderSvc, clClasseurSvc, clLocalStorage) {
      var cleanPublicObjectAfter = 15 * 24 * 60 * 60 * 1000 // 15 days
      var clSyncDataSvc = {
        init: init,
        checkUserChanged: checkUserChanged,
        loadingTimeout: 30 * 1000 // 30 sec
      }

      var isInitialized

      function init () {
        if (!isInitialized) {
          // Backward compatibility
          var oldUserId = clLocalStorage.getItem('syncData.userId')
          clLocalStorage.removeItem('syncData.userId')
          if (oldUserId && !clSyncDataSvc.user.id) {
            clSyncDataSvc.user = {id: oldUserId}
            angular.extend(clSyncDataSvc.files, JSON.parse(clLocalStorage.getItem('syncData.files') || '{}'))
            angular.extend(clSyncDataSvc.folders, JSON.parse(clLocalStorage.getItem('syncData.folders') || '{}'))
            clLocalStorage.removeItem('syncData.files')
            clLocalStorage.removeItem('syncData.folders')
          }
        }

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
            // Eject old syncData for deleted public daos
            clSyncDataSvc[params.group].cl_each(function (updated, id) {
              var dao = params.svc.activeDaoMap[id] || params.svc.deletedDaoMap[id]
              if (!dao || (dao.userId && dao.deleted && currentDate - dao.deleted > cleanPublicObjectAfter)) {
                delete clSyncDataSvc[params.group][id]
              }
            })

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
          clFileSvc.activeDaos.cl_filter(function (file) {
            if (file.userId &&
              !file.content &&
              (!file.folderId || !clSyncDataSvc.folderRefreshDates[file.folderId])
            ) {
              return true
            }
          })
        )

        isInitialized = true
      }

      function checkUserChanged (ctx) {
        if (ctx && ctx.userId && ctx.userId !== clSyncDataSvc.user.id) {
          // Add userId to synced files owned by previous user
          var filesToRemove = clFileSvc.activeDaos.cl_filter(function (file) {
            if (!file.userId && clSyncDataSvc.files[file.id]) {
              file.userId = clSyncDataSvc.user.id
              return !file.content
            }
          })
          // Remove files that are public and not local
          clFileSvc.removeDaos(filesToRemove)
          // Remove files that are pending for deletion
          clFileSvc.removeDaos(clFileSvc.deletedDaos)

          // Add userId to synced folders owned by previous user
          clFolderSvc.activeDaos.cl_each(function (folder) {
            if (!folder.userId && clSyncDataSvc.folders[folder.id]) {
              folder.userId = clSyncDataSvc.user.id
            }
          })
          // Remove folders that are pending for deletion
          clFolderSvc.removeDaos(clFolderSvc.deletedDaos)

          // Remove classeurs that belong to previous user
          clClasseurSvc.removeDaos(
            clClasseurSvc.activeDaos.cl_filter(function (classeur) {
              return !classeur.userId && clSyncDataSvc.classeurs[classeur.id]
            })
          )
          // Remove classeurs that are pending for deletion
          clClasseurSvc.removeDaos(clClasseurSvc.deletedDaos)

          clSyncDataSvc.user = {id: ctx.userId}
          clSyncDataSvc.lastSeqs = {}
          return true
        }
      }

      return clSyncDataSvc
    })
  .factory('clSyncSvc',
    function ($rootScope, clIsNavigatorOnline, clLocalStorage, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clRestSvc, clUserActivity, clSetInterval, clLocalDb, clLocalDbStore, clSyncDataSvc, clDebug) {
      var debug = clDebug('classeur:clSyncSvc')
      var userNameMaxLength = 64
      var recoverFileTimeout = 30 * 1000 // 30 sec
      var lastSeqMargin = 1000 // 1 sec
      var clSyncSvc = {
        userNameMaxLength: userNameMaxLength,
        getFolder: getFolder,
        recoverFile: recoverFile,
        saveAll: localDbWrapper()
      }

      var daoMap = {}

      var objectStoreWrapper = (function () {
        var store = clLocalDbStore('objects', {
          value: 'object'
        })

        // Make object serializable in a predictable way
        function orderKeys (value) {
          return value && Object.keys(value).sort().cl_reduce(function (result, key) {
            result[key] = value[key]
            return result
          }, {})
        }

        function putObject (id, value) {
          var dao = daoMap[id] || store.createDao(id)
          dao.value = value
          daoMap[id] = dao
        }

        function getObject (id, defaultValue) {
          return daoMap[id] ? daoMap[id].value : JSON.parse(defaultValue || '{}')
        }

        function putObjects () {
          putObject('user', orderKeys(clUserSvc.user || null)) // Order keys to ensure `updated` field is updated only if value changed
          putObject('settings', orderKeys(clSettingSvc.values)) // Order keys to ensure `updated` field is updated only if value changed
          putObject('localSettings', clLocalSettingSvc.values)
          putObject('classeurSyncData', clSyncDataSvc.classeurs)
          putObject('folderSyncData', clSyncDataSvc.folders)
          putObject('fileSyncData', clSyncDataSvc.files)
          putObject('userSyncData', clSyncDataSvc.user)
          putObject('lastSyncSeqs', clSyncDataSvc.lastSeqs)
          putObject('fileCreationDates', clSyncDataSvc.fileCreationDates)
          putObject('folderRefreshDates', clSyncDataSvc.folderRefreshDates)
          putObject('fileRecoveryDates', clSyncDataSvc.fileRecoveryDates)
        }

        function getObjects () {
          clUserSvc.user = getObject('user', 'null')
          clSettingSvc.values = getObject('settings', clSettingSvc.defaultSettings)
          clLocalSettingSvc.values = getObject('localSettings', clLocalSettingSvc.defaultLocalSettings)
          clSyncDataSvc.classeurs = getObject('classeurSyncData')
          clSyncDataSvc.folders = getObject('folderSyncData')
          clSyncDataSvc.files = getObject('fileSyncData')
          clSyncDataSvc.user = getObject('userSyncData')
          clSyncDataSvc.lastSeqs = getObject('lastSyncSeqs')
          clSyncDataSvc.fileCreationDates = getObject('fileCreationDates')
          clSyncDataSvc.folderRefreshDates = getObject('folderRefreshDates')
          clSyncDataSvc.fileRecoveryDates = getObject('fileRecoveryDates')
        }

        function getPatch (tx, cb) {
          store.getPatch(tx, function (patch) {
            cb(function () {
              putObjects()
              var hasChanged = patch(daoMap)
              getObjects()
              return hasChanged
            })
          })
        }

        function writeAll (tx) {
          putObjects()
          store.writeAll(daoMap, tx)
        }

        function clearAll () {
          daoMap = {}
          getObjects()
        }

        return {
          getPatch: getPatch,
          writeAll: writeAll,
          clearAll: clearAll
        }
      })()

      var storeWrappers = {
        objects: objectStoreWrapper,
        files: clFileSvc,
        folders: clFolderSvc,
        classeurs: clClasseurSvc
      }

      function localDbWrapper (cb) {
        return function () {
          var args = arguments
          clLocalDb(function (tx) {
            var apply
            var patches = {}
            // Retrieve changes from DB
            storeWrappers.cl_each(function (storeWrapper, storeName) {
              storeWrapper.getPatch(tx, function (patch) {
                patches[storeName] = patch
                // Wait for all patches
                if (Object.keys(patches).length < Object.keys(storeWrappers).length) {
                  return
                }

                // Apply patches in a specific order
                apply |= patches.objects()
                if (!$rootScope.appReady) {
                  // Need to initialize settings before classeurs
                  clSettingSvc.init()
                  clLocalSettingSvc.init()
                }
                apply |= patches.files()
                apply |= patches.folders()
                apply |= patches.classeurs() // Call classeur.init at the end since it depends on other
                if (!$rootScope.appReady) {
                  clSyncDataSvc.init()
                  $rootScope.appReady = true
                  apply = true
                }
                // All changes have been applied

                var userChanged = clSyncDataSvc.checkUserChanged(clSocketSvc.ctx)
                if (!userChanged && cb) {
                  apply |= cb.apply(null, args)
                }
                // Write potential changes to DB
                storeWrappers.cl_each(function (storeWrapper) {
                  storeWrapper.writeAll(tx)
                })
                // Apply potential UI changes
                if (userChanged || apply) {
                  $rootScope.$evalAsync()
                }
              })
            })
          })
        }
      }

      clSyncSvc.clearAll = localDbWrapper(function (cb) {
        storeWrappers.cl_each(function (storeWrapper) {
          storeWrapper.clearAll()
        })
        var dbversion = clLocalStorage.localDbVersion
        clLocalStorage.clear()
        clLocalStorage.localDbVersion = dbversion // Prevent localDb from refreshing the browser
        cb && cb()
        return true
      })

      $rootScope.$watch('socketSvc.ctx.userId', function (userId) {
        // Make some cleaning when user changes
        userId && clSyncSvc.saveAll()
      })

      function recoverFile (file) {
        var currentDate = Date.now()
        clSyncDataSvc.fileRecoveryDates[file.id] = currentDate
        if (!clFileSvc.activeDaoMap[file.id]) {
          clSocketSvc.sendMsg('putFile', {
            id: file.id,
            userId: file.userId || clSyncDataSvc.user.id,
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

      clSetInterval(localDbWrapper(function () {
        var hasChanged
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

          // Retrieve user from the server
          syncQueue(function () {
            return clRestSvc.requestIgnore304({
              method: 'GET',
              url: '/api/v2/users/me',
              params: {
                view: 'private'
              }
            }, clSyncDataSvc.user.updated)
          })
          syncQueue(function (res) {
            res && pendingChangeGroups.users.$add(res.body)
            syncQueue.users = {} // Start syncing and record sent data
          })

          // Retrieve all classeurs from the server
          syncQueue(function () {
            return clRestSvc.list(
              '/api/v2/users/' + clSyncDataSvc.user.id + '/classeurs',
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

          // Retrieve from the server folder and file changes that happened before syncing
          ;['folders', 'files']
            .cl_each(function (group) {
              syncQueue(function () {
                return clRestSvc.listFromSeq(
                  '/api/v2/users/' + clSyncDataSvc.user.id + '/' + group,
                  (clSyncDataSvc.lastSeqs[group] || 0) - lastSeqMargin
                )
              })
              syncQueue(function (items) {
                items.cl_each(function (item) {
                  pendingChangeGroups[group].$add(item)
                })
                syncQueue[group] = {} // Start syncing and record sent data
              })
            })

          // Retrieve settings after classeurs since it contains default classeur ID
          syncQueue(function () {
            return clRestSvc.requestIgnore304({
              method: 'GET',
              url: '/api/v2/users/' + clSyncDataSvc.user.id + '/settings'
            }, clSyncDataSvc.user.settings)
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
          var user = pendingChangeGroups.users[clSyncDataSvc.user.id]
          if (user) {
            if (!clUserSvc.user ||
              (user.updated !== daoMap.user.updated &&
              user.updated !== clSyncDataSvc.user.updated &&
              user.updated !== syncQueue.users[clSyncDataSvc.user.id])
            ) {
              clUserSvc.user = user
              daoMap.user.updated = user.updated
              debug('Processed user change')
              hasChanged = true
            }
            clSyncDataSvc.user.updated = user.updated
            delete syncQueue.users[clSyncDataSvc.user.id] // Assume we received the change we sent
          }
          pendingChangeGroups.users = new PendingChangeGroup()

          // Send user changes
          syncQueue(function () {
            if (clUserSvc.user && clUserSvc.user.name && daoMap.user.updated &&
              daoMap.user.updated !== clSyncDataSvc.user.updated &&
              daoMap.user.updated !== syncQueue.users[clSyncDataSvc.user.id]
            ) {
              if (clUserSvc.user.name.length > userNameMaxLength) {
                clUserSvc.user.name = clUserSvc.user.name.slice(0, userNameMaxLength)
                return
              }
              debug('Patch user')
              syncQueue.users[clSyncDataSvc.user.id] = daoMap.user.updated
              return clRestSvc.request({
                method: 'PATCH',
                url: '/api/v2/users/' + clSyncDataSvc.user.id,
                body: {
                  name: clUserSvc.user.name,
                  gravatarEmail: clUserSvc.user.gravatarEmail,
                  updated: daoMap.user.updated
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
            var classeur = clClasseurSvc.activeDaoMap[item.id]
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
              if (item.userId === clSyncDataSvc.user.id) {
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

          if (changesToApply.length) {
            clClasseurSvc.applyServerChanges(changesToApply)
            debug('Processed ' + changesToApply.length + ' classeur changes')
            hasChanged = true
          }
          pendingChangeGroups.classeurs = new PendingChangeGroup()

          // Send classeur changes, after settings are merged
          syncQueue.settingsMerged && syncQueue(function updateClasseur () {
            var result

            function isToBeUpdated (classeur) {
              return classeur.name && classeur.updated &&
              classeur.updated !== clSyncDataSvc.classeurs[classeur.id] &&
              classeur.updated !== syncQueue.classeurs[classeur.id]
            }

            // Send a new/modified classeur
            clClasseurSvc.activeDaos.cl_some(function (classeur) {
              if (isToBeUpdated(classeur)) {
                debug('Put classeur')
                syncQueue.classeurs[classeur.id] = classeur.updated
                result = clRestSvc.request({
                  method: 'PUT',
                  url: '/api/v2/classeurs/' + classeur.id,
                  body: {
                    id: classeur.id,
                    userId: classeur.userId === 'null' ? undefined : classeur.userId || clSyncDataSvc.user.id,
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
                debug('Delete classeur')
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
          var lastFolderSeq = clSyncDataSvc.lastSeqs.folders
          pendingChangeGroups.folders.cl_each(function (item) {
            lastFolderSeq = Math.max(lastFolderSeq, item.seq || 0)
            var folder = clFolderSvc.activeDaoMap[item.id]
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
              if (item.userId === clSyncDataSvc.user.id) {
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

          if (changesToApply.length) {
            clFolderSvc.applyServerChanges(changesToApply)
            debug('Processed ' + changesToApply.length + ' folder changes')
            hasChanged = true
          }
          clSyncDataSvc.lastSeqs.folders = lastFolderSeq
          pendingChangeGroups.folders = new PendingChangeGroup()

          // Send folder changes
          syncQueue(function updateFolder () {
            var result

            function isToBeUpdated (folder) {
              return folder.name && folder.updated &&
              folder.updated !== clSyncDataSvc.folders[folder.id] &&
              folder.updated !== syncQueue.folders[folder.id] &&
              (!folder.userId || folder.sharing === 'rw')
            }

            // Send a new/modified folder
            clFolderSvc.activeDaos.cl_some(function (folder) {
              if (isToBeUpdated(folder)) {
                debug('Put folder')
                syncQueue.folders[folder.id] = folder.updated
                result = clRestSvc.request({
                  method: 'PUT',
                  url: '/api/v2/folders/' + folder.id,
                  body: {
                    id: folder.id,
                    userId: folder.userId || clSyncDataSvc.user.id,
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
                debug('Delete folder')
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
          var lastFileSeq = clSyncDataSvc.lastSeqs.files
          pendingChangeGroups.files.cl_each(function (item) {
            lastFileSeq = Math.max(lastFileSeq, item.seq || 0)
            var file = clFileSvc.activeDaoMap[item.id]
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
              if (item.userId === clSyncDataSvc.user.id) {
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

          if (changesToApply.length) {
            clFileSvc.applyServerChanges(changesToApply)
            debug('Processed ' + changesToApply.length + ' file changes')
            hasChanged = true
          }
          clSyncDataSvc.lastSeqs.files = lastFileSeq
          pendingChangeGroups.files = new PendingChangeGroup()

          // Send file changes
          syncQueue(function updateFile () {
            var filesToRemove = []
            var result

            function isToBeUpdated (file) {
              var folder = clFolderSvc.activeDaoMap[file.folderId]
              if (file.name && file.updated &&
                file.updated !== clSyncDataSvc.files[file.id] &&
                file.updated !== syncQueue.files[file.id] &&
                // File can be saved into folder only if folder was synced
                (!file.folderId || clSyncDataSvc.folders[file.folderId]) &&
                // Folder sharing preference overrides file preference
                (!file.userId || (file.sharing === 'rw' || (folder && folder.sharing === 'rw')))
              ) {
                if (clSyncDataSvc.files[file.id]) {
                  return true
                }
                try {
                  return file.loadDoUnload(function () {
                    // Remove first file in case existing user signs in (see #13)
                    if (clFileSvc.activeDaos.length > 1 && file.name === clFileSvc.firstFileName && file.content.text === clFileSvc.firstFileContent) {
                      filesToRemove.push(file)
                      return
                    }
                    return true
                  })
                } catch (e) {
                  // File is not local and was never created
                  filesToRemove.push(file)
                  return
                }
              }
            }

            // Send a new/modified file
            clFileSvc.activeDaos.cl_some(function (file) {
              if (isToBeUpdated(file)) {
                debug('Put file')
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
                    userId: file.userId || clSyncDataSvc.user.id,
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
                debug('Put deleted file')
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
                    userId: file.userId || clSyncDataSvc.user.id,
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
              settings.updated !== daoMap.settings.updated &&
              settings.updated !== clSyncDataSvc.user.settings &&
              settings.updated !== syncQueue.settings[0]
            ) {
              var newDefaultClasseur
              if (settings.defaultClasseurId !== clSettingSvc.values.defaultClasseurId) {
                newDefaultClasseur = clClasseurSvc.activeDaoMap[settings.defaultClasseurId]
              }

              clSettingSvc.updateSettings(settings)
              daoMap.settings.updated = settings.updated
              debug('Processed setting change')
              hasChanged = true

              if (newDefaultClasseur) {
                // Merge default classeur if different
                clClasseurSvc.mergeDefaultClasseur(newDefaultClasseur)
              }
            }
            clSyncDataSvc.user.settings = settings.updated
            delete syncQueue.settings[0] // Assume we received the change we sent
          }
          pendingChangeGroups.settings = new PendingChangeGroup()
          syncQueue.settingsMerged = true // Start sending classeur changes

          // Send settings changes
          syncQueue(function () {
            if (daoMap.settings.updated &&
              daoMap.settings.updated !== clSyncDataSvc.user.settings &&
              daoMap.settings.updated !== syncQueue.settings[0]
            ) {
              debug('Put settings')
              syncQueue.settings[0] = daoMap.settings.updated
              return clRestSvc.request({
                method: 'PUT',
                url: '/api/v2/users/' + clSyncDataSvc.user.id + '/settings',
                body: angular.extend({}, clSettingSvc.values, {
                  updated: daoMap.settings.updated
                })
              })
            }
          })
        }

        return hasChanged
      }), 1200)

      function updatePublicFile (file, item) {
        file.refreshed = Date.now()
        // File sharing may change without metadata update because of folder sharing
        if (file.sharing !== item.sharing || item.updated !== clSyncDataSvc.files[file.id]) {
          file.name = item.name
          file.sharing = item.sharing
          file.updated = item.updated
          file.userId = clSyncDataSvc.user.id !== item.userId ? item.userId : ''
        }
        clSyncDataSvc.files[file.id] = item.updated
      }

      function updatePublicFolder (folder, item) {
        if (item.updated !== clSyncDataSvc.folders[folder.id]) {
          folder.name = item.name
          folder.sharing = item.sharing
          folder.updated = item.updated
          folder.userId = clSyncDataSvc.user.id !== item.userId ? item.userId : ''
        }
        clSyncDataSvc.folders[folder.id] = item.updated
      }

      // function updatePublicClasseurMetadata (classeur, metadata) {
      //   var syncData = clSyncDataSvc.classeur[classeur.id] || {}
      //   if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
      //     classeur.name = metadata.name
      //     classeur.updated = metadata.updated
      //     classeur.userId = clSyncDataSvc.user.id !== classeur.userId ? 'null' : ''
      //   }
      //   syncData.r = metadata.updated
      //   clSyncDataSvc.classeur[classeur.id] = syncData
      // }

      var publicFileRefreshAfter = 30 * 1000 // 30 sec
      var lastGetExtFile = 0

      function getPublicLocalFiles () {
        var currentDate = Date.now()
        var files = clFileSvc.localFiles
          .cl_filter(function (file) {
            return file.userId && (!file.refreshed || currentDate - publicFileRefreshAfter > file.refreshed)
          })
        if (!files.length ||
          currentDate - lastGetExtFile < publicFileRefreshAfter
        ) {
          return
        }

        lastGetExtFile = currentDate
        var items = []
        ;(function getFile () {
          var file = files.pop()
          if (!file) {
            return items
          }
          return clRestSvc.request({
            method: 'GET',
            url: '/api/v2/files/' + file.id
          })
            .catch(function () {
              clToast('File not accessible: ' + (file.name || file.id))
            })
            .then(function (item) {
              item && items.push(item)
              return getFile()
            })
        })()
          .then(localDbWrapper(function () {
            items.cl_each(function (item) {
              var file = clFileSvc.activeDaoMap[item.id]
              file && updatePublicFile(file, item)
            })
            return items.length
          }))
      }

      function getPublicFolder (folder) {
        if (!folder.userId || folder.refreshed && Date.now() - folder.refreshed < publicFileRefreshAfter) {
          return
        }
        return clRestSvc.request({
          method: 'GET',
          url: '/api/v2/folders/' + folder.id
        })
          .then(function (folderItem) {
            return clRestSvc.list('/api/v2/folders/' + folder.id + '/files')
              .then(localDbWrapper(function (fileItems) {
                var currentDate = Date.now()
                clSyncDataSvc.folderRefreshDates[folder.id] = currentDate
                folder.refreshed = currentDate
                updatePublicFolder(folder, folderItem)
                var filesToMove = {}
                clFileSvc.activeDaos.cl_each(function (file) {
                  if (file.folderId === folder.id) {
                    filesToMove[file.id] = file
                  }
                })
                fileItems.cl_each(function (item) {
                  delete filesToMove[item.id]
                  var file = clFileSvc.activeDaoMap[item.id] || clFileSvc.createPublicFile(item.id)
                  file.folderId = folder.id
                  updatePublicFile(file, item)
                })
                filesToMove.cl_each(function (file) {
                  file.folderId = ''
                })
                clFolderSvc.init() // Refresh tabs order
                clFileSvc.init()
              }))
          })
          .catch(function () {
            folder.refreshed = 1 // Get rid of the spinner
            clToast('Folder not accessible: ' + (folder.name || folder.id))
            !folder.name && clFolderSvc.removeDaos([folder])
          })
      }

      function getFolder (folder) {
        if (clIsNavigatorOnline()) {
          folder ? getPublicFolder(folder) : getPublicLocalFiles()
        }
      }

      return clSyncSvc
    })
  .factory('clContentSyncSvc',
    function ($rootScope, $timeout, $http, $q, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clEditorLayoutSvc) {
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
        file.setLoaded()
        file.content.text = serverContent.text
        file.content.properties = ({}).cl_extend(serverContent.properties)
        file.content.discussions = ({}).cl_extend(serverContent.discussions)
        file.content.comments = ({}).cl_extend(serverContent.comments)
        file.content.conflicts = ({}).cl_extend(serverContent.conflicts)
        file.content.state = {}
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
        if (!file || !file.state || file.isLocalFile || !clSyncDataSvc.files[file.id]) {
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
          previousRev: file.content && file.content.syncedRev
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
        var fromRev = file.content.syncedRev
        $http.get('/api/v1/files/' + file.id + (fromRev ? '/fromRev/' + fromRev : ''), {
          headers: clSocketSvc.makeAuthorizationHeader(),
          timeout: clSyncDataSvc.loadingTimeout,
          params: {
            flatten: false
          }
        })
          .success(function (res) {
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // updatePublicFileMetadata(file, res)
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
            file.setContentSynced(serverContent.rev)
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
          watchCtx.chars = clDiffUtils.applyCharPatches(watchCtx.chars, msg.text || [], msg.userId || clSyncDataSvc.user.id)
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
        watchCtx.file.setContentSynced(watchCtx.rev)
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
          if (!clSyncDataSvc.files[file.id] || (watchCtx && file === watchCtx.file)) {
            return
          }
          if (file.userId && (file.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
            return
          }
          var currentDate = Date.now()
          try {
            file.loadDoUnload(function () {
              var fromRev = file.content.syncedRev
              // Check that content is not being modified in another instance
              if (fromRev === undefined || currentDate - file.content.lastModified < backgroundUpdateContentEvery) {
                return
              }
              if (!file.isContentSynced()) {
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
          } catch (e) {
            // File is not local
          }
        })
      }, backgroundUpdateContentEvery)

      clSocketSvc.addMsgHandler('updatedContent', function (msg) {
        var file = clFileSvc.activeDaoMap[msg.id]
        // Check that file still exists and content is still local
        if (!file || !file.content.isLocal) {
          return
        }
        // Check that content is not being edited
        if (watchCtx && watchCtx.file.id === file.id) {
          return
        }
        var currentDate = Date.now()
        try {
          file.loadDoUnload(function () {
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
            file.setContentSynced(msg.rev)
            file.writeContent()
          })
        } catch (e) {
          // File is not local
        }
      })

      $rootScope.$watch('currentFile', function (currentFile) {
        if (currentFile) {
          currentFile.loadPending = true
        }
        if (clSocketSvc.isOnline()) {
          watchFile(currentFile)
        } else if (!clSocketSvc.hasToken) {
          getPublicFile(currentFile)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        if ($rootScope.currentFile && $rootScope.currentFile.state === 'loaded') {
          $rootScope.currentFile.writeContent()
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
