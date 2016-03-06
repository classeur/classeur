angular.module('classeur.core.sync', [])
  .factory('clSyncDataSvc',
    function (clFileSvc, clFolderSvc, clClasseurSvc, clLocalStorage) {
      var cleanPublicObjectAfter = 30 * 24 * 60 * 60 * 1000 // 30 days
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
            clSyncDataSvc[params.group].cl_each(function (updated, id) {
              var dao = params.svc.activeDaoMap[id] || params.svc.deletedDaoMap[id]
              // Eject old syncData for daos that don't exists anymore or that are deleted and public
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

        // Eject old refreshDates
        ;[
          'folderRefreshDates',
          'classeurRefreshDates'
        ]
          .cl_each(function (dateMap) {
            clSyncDataSvc[dateMap].cl_each(function (date, folderId) {
              if (currentDate - date > cleanPublicObjectAfter) {
                delete clSyncDataSvc[dateMap][folderId]
              }
            })
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
    function ($rootScope, $timeout, clIsNavigatorOnline, clLocalStorage, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clRestSvc, clUserActivity, clSetInterval, clLocalDb, clLocalDbStore, clSyncDataSvc, clDebug) {
      var debug = clDebug('classeur:clSyncSvc')
      var userNameMaxLength = 64
      var refreshAfter = 30 * 1000 // 30 sec
      var lastSeqMargin = 1000 // 1 sec
      var ADDED = 1
      var REMOVED = -1
      var clSyncSvc = {
        userNameMaxLength: userNameMaxLength,
        getFolder: getFolder,
        getClasseur: getClasseur
      }

      var daoMap = {}

      // To store small objects in JSON format
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
          return (daoMap[id] && daoMap[id].value) || JSON.parse(defaultValue || '{}')
        }

        function putObjects () {
          putObject('user', orderKeys(clUserSvc.user || null)) // Order keys to ensure `updated` field is updated only if value changed
          putObject('settings', orderKeys(clSettingSvc.values)) // Order keys to ensure `updated` field is updated only if value changed
          putObject('localSettings', clLocalSettingSvc.values)
          putObject('classeurFolderMap', clClasseurSvc.classeurFolderMap)
          putObject('classeurAddedFolderMap', clClasseurSvc.classeurAddedFolderMap)
          putObject('classeurRemovedFolderMap', clClasseurSvc.classeurRemovedFolderMap)
          putObject('classeurSyncData', clSyncDataSvc.classeurs)
          putObject('folderSyncData', clSyncDataSvc.folders)
          putObject('fileSyncData', clSyncDataSvc.files)
          putObject('userSyncData', clSyncDataSvc.user)
          putObject('lastSyncSeqs', clSyncDataSvc.lastSeqs)
          putObject('classeurRefreshDates', clSyncDataSvc.classeurRefreshDates)
          putObject('folderRefreshDates', clSyncDataSvc.folderRefreshDates)
        }

        function getObjects () {
          clUserSvc.user = getObject('user', 'null')
          clSettingSvc.values = getObject('settings', clSettingSvc.defaultSettings)
          clLocalSettingSvc.values = getObject('localSettings', clLocalSettingSvc.defaultLocalSettings)
          clClasseurSvc.classeurFolderMap = getObject('classeurFolderMap')
          clClasseurSvc.classeurAddedFolderMap = getObject('classeurAddedFolderMap')
          clClasseurSvc.classeurRemovedFolderMap = getObject('classeurRemovedFolderMap')
          clSyncDataSvc.classeurs = getObject('classeurSyncData')
          clSyncDataSvc.folders = getObject('folderSyncData')
          clSyncDataSvc.files = getObject('fileSyncData')
          clSyncDataSvc.user = getObject('userSyncData')
          clSyncDataSvc.lastSeqs = getObject('lastSyncSeqs')
          clSyncDataSvc.classeurRefreshDates = getObject('classeurRefreshDates')
          clSyncDataSvc.folderRefreshDates = getObject('folderRefreshDates')
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
                apply |= patches.classeurs() // To be called after settings and folders since it depends on them
                if (!$rootScope.appReady) {
                  clSyncDataSvc.init() // To be called at the end since it checks consistency with others
                  $rootScope.appReady = true
                  apply = true
                }
                // All changes have been applied

                clSocketSvc.toggleSocket()
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
        Object.keys(clLocalStorage).cl_each(function (key) {
          switch (key) {
            // Clear local storage except these keys
            case 'localDbVersion':
            case 'lastWindowFocus':
              return
          }
          clLocalStorage.removeItem(key)
        })
        cb && cb()
        return true // apply
      })

      // Initialize and clean up when user changes
      $rootScope.$watch('socketSvc.ctx.userId', localDbWrapper())

      var isSyncWindow = (function () {
        var lastSyncActivityKey = 'lastSyncActivity'
        var lastSyncActivity
        var inactivityThreshold = 3000 // 3 sec

        return function () {
          var currentDate = Date.now()
          var storedLastSyncActivity = parseInt(clLocalStorage[lastSyncActivityKey], 10) || 0
          if (lastSyncActivity === storedLastSyncActivity || currentDate - storedLastSyncActivity > inactivityThreshold) {
            clLocalStorage[lastSyncActivityKey] = currentDate
            lastSyncActivity = currentDate
            return true
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

        if (!clSocketSvc.isReady) {
          return
        }

        if (!isSyncWindow()) {
          clSocketSvc.ctx.syncQueue = undefined
          return
        }

        var syncQueue = clSocketSvc.ctx.syncQueue
        if (!syncQueue) {
          // Create sync queue
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
                  console.log(err.message, err.stack)
                })
            }
          })()

          syncQueue.watchedFiles = {}
          syncQueue.watchedFolders = {}

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
              (user.updated !== daoMap.user.updated && // Is out of sync
              user.updated !== clSyncDataSvc.user.updated && // Is different from last received
              user.updated !== syncQueue.users[clSyncDataSvc.user.id]) // Is different from last sent
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
          // If folders and classeurs are ready, start attaching them together
          if (syncQueue.folders && !syncQueue.foldersAddedToClasseurs) {
            syncQueue.foldersAddedToClasseurs = {}
            syncQueue.foldersRemovedFromClasseurs = {}
          }

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
              item.updated !== classeur.updated && // Is out of sync
              item.updated !== clSyncDataSvc.classeurs[item.id] && // Is different from last received
              item.updated !== syncQueue.classeurs[item.id]) // Is different from last sent
            ) {
              changesToApply.push(item)
              // Sanitize userId according to current user
              if (item.userId === clSyncDataSvc.user.id) {
                item.userId = undefined
              } else {
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

            function findOne (classeurs, cb, checkExists) {
              return classeurs.cl_some(function (classeur) {
                if ((!checkExists || clSyncDataSvc.classeurs[classeur.id]) && // Exists on the server
                  classeur.name && classeur.updated && // Is ready for sync
                  classeur.updated !== clSyncDataSvc.classeurs[classeur.id] && // Is out of sync
                  classeur.updated !== syncQueue.classeurs[classeur.id] // Is not currently syncing
                ) {
                  result = cb(classeur)
                  return true
                }
              })
            }

            // Send a new/modified classeur
            findOne(clClasseurSvc.activeDaos, function (classeur) {
              debug('Put classeur')
              syncQueue.classeurs[classeur.id] = classeur.updated
              return clRestSvc.request({
                method: 'PUT',
                url: '/api/v2/classeurs/' + classeur.id,
                body: {
                  id: classeur.id,
                  userId: classeur.userId === 'null' ? undefined : classeur.userId || clSyncDataSvc.user.id,
                  name: classeur.name,
                  updated: classeur.updated
                }
              })
            }) ||
            // Or send a deleted classeur
            findOne(clClasseurSvc.deletedDaos, function (classeur) {
              debug('Delete classeur')
              syncQueue.classeurs[classeur.id] = classeur.updated
              return clRestSvc.request({
                method: 'DELETE',
                url: '/api/v2/classeurs/' + classeur.id
              })
            }, true)

            if (result) {
              syncQueue(updateClasseur) // Enqueue other potential changes
              return result
            }
          })
        }

        // ---------------------------
        // FOLDERS

        // Process received folder changes
        var classeurMappingChanged
        if (syncQueue.folders && syncQueue.foldersAddedToClasseurs) {
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
              item.updated !== folder.updated && // Is out of sync
              item.updated !== clSyncDataSvc.folders[item.id] && // Is different from last received
              item.updated !== syncQueue.folders[item.id]) // Is different from last sent
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

            // Apply classeur mapping
            if (item.classeurIds) {
              var mappingChanges = {}
              clClasseurSvc.classeurFolderMap.cl_each(function (folderIds, classeurId) {
                if (~folderIds.indexOf(item.id)) {
                  mappingChanges[classeurId] = REMOVED
                }
              })
              item.classeurIds.cl_each(function (classeurId) {
                if (mappingChanges[classeurId] === REMOVED) {
                  delete mappingChanges[classeurId]
                } else {
                  mappingChanges[classeurId] = ADDED
                }
              })
              mappingChanges.cl_each(function (value, classeurId) {
                if (value === ADDED) {
                  clClasseurSvc.setClasseurFolder(classeurId, item.id)
                  if (syncQueue.foldersAddedToClasseurs[item.id] === classeurId) {
                    delete syncQueue.foldersAddedToClasseurs[item.id]
                  }
                } else {
                  clClasseurSvc.unsetClasseurFolder(classeurId, item.id)
                  if (syncQueue.foldersRemovedFromClasseurs[item.id] === classeurId) {
                    delete syncQueue.foldersRemovedFromClasseurs[item.id]
                  }
                }
                classeurMappingChanged = true
              })
            }
          })

          if (changesToApply.length || classeurMappingChanged) {
            clFolderSvc.applyServerChanges(changesToApply)
            debug('Processed ' + changesToApply.length + ' folder changes')
            hasChanged = true
          }
          clSyncDataSvc.lastSeqs.folders = lastFolderSeq
          pendingChangeGroups.folders = new PendingChangeGroup()

          // Send folder changes
          syncQueue(function updateFolder () {
            var result

            function findOne (folders, cb, checkExists) {
              return folders.cl_some(function (folder) {
                if ((!checkExists || clSyncDataSvc.folders[folder.id]) && // Exists on the server
                  folder.name && folder.updated && // Is ready for sync
                  folder.updated !== clSyncDataSvc.folders[folder.id] && // Is out of sync
                  folder.updated !== syncQueue.folders[folder.id] && // Is not currently syncing
                  (!folder.userId || folder.sharing === 'rw') // Is writable
                ) {
                  result = cb(folder)
                  return true
                }
              })
            }

            // Send a new/modified folder
            findOne(clFolderSvc.activeDaos, function (folder) {
              debug('Put folder')
              syncQueue.folders[folder.id] = folder.updated
              return clRestSvc.request({
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
            }) ||
            // Or send a deleted folder
            findOne(clFolderSvc.deletedDaos, function (folder) {
              debug('Delete folder')
              syncQueue.folders[folder.id] = folder.updated
              return clRestSvc.request({
                method: 'DELETE',
                url: '/api/v2/folders/' + folder.id
              })
            }, true)

            if (result) {
              syncQueue(updateFolder) // Enqueue other potential updates
              return result
            }
          })

          // Send classeur mapping changes
          syncQueue(function updateMapping () {
            var result

            function findOne (map, cb) {
              return map.cl_some(function (folderIds, classeurId) {
                return clSyncDataSvc.classeurs[classeurId] && // Classeur exists on the server
                folderIds.cl_some(function (folderId) {
                  if (
                    clSyncDataSvc.folders[folderId] && // Folder exists on the server
                    !syncQueue.foldersAddedToClasseurs[folderId] && // Is not currently syncing
                    !syncQueue.foldersRemovedFromClasseurs[folderId] // Is not currently syncing
                  ) {
                    result = cb(classeurId, folderId)
                    return true
                  }
                })
              })
            }

            // Add a folder to a classeur
            findOne(clClasseurSvc.classeurAddedFolderMap, function (classeurId, folderId) {
              debug('Add folder to classeur')
              syncQueue.foldersAddedToClasseurs[folderId] = classeurId
              return clRestSvc.request({
                method: 'PUT',
                url: '/api/v2/classeurs/' + classeurId + '/folders/' + folderId
              })
            }) ||
            // Or remove a folder from a classeur
            findOne(clClasseurSvc.classeurRemovedFolderMap, function (classeurId, folderId) {
              debug('Remove folder from classeur')
              syncQueue.foldersRemovedFromClasseurs[folderId] = classeurId
              return clRestSvc.request({
                method: 'DELETE',
                url: '/api/v2/classeurs/' + classeurId + '/folders/' + folderId
              })
            })

            if (result) {
              syncQueue(updateMapping) // Enqueue other potential changes
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
              item.updated !== file.updated && // Is out of sync
              item.updated !== clSyncDataSvc.files[item.id] && // Is different from last received
              item.updated !== syncQueue.files[item.id]) // Is different from last sent
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

            function findOne (files, cb, checkExists) {
              return files.cl_some(function (file) {
                var folder = clFolderSvc.activeDaoMap[file.folderId]
                if ((!checkExists || clSyncDataSvc.files[file.id]) && // Exists on the server
                  file.name && file.updated && // Is ready for sync
                  file.updated !== clSyncDataSvc.files[file.id] && // Is out of sync
                  file.updated !== syncQueue.files[file.id] && // Is not currently syncing
                  (!file.folderId || clSyncDataSvc.folders[file.folderId]) && // Folder exists on the server
                  (!file.userId || (file.sharing === 'rw' || (folder && folder.sharing === 'rw'))) // Is writable
                ) {
                  try {
                    if (clSyncDataSvc.files[file.id] || file
                        .loadDoUnload(function () {
                          // Remove first file in case existing user signs in (#13)
                          if (!clFileSvc.activeDaos.length || file.name !== clFileSvc.firstFileName || file.content.text !== clFileSvc.firstFileContent) {
                            return true
                          }
                          filesToRemove.push(file)
                        })
                    ) {
                      result = cb(file)
                      return true
                    }
                  } catch (e) {
                    // File is not local and was never created
                    filesToRemove.push(file)
                  }
                }
              })
            }

            // Send a new/modified file
            findOne(clFileSvc.activeDaos, function (file) {
              debug('Put file')
              syncQueue.files[file.id] = file.updated
              var folderId = file.folderId || (file.userId ? undefined : 'null') // Remove from folder only if file belongs to user
              return clRestSvc.request({
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
            }) ||
            // Or send a deleted file
            findOne(clFileSvc.deletedDaos, function (file) {
              debug('Put deleted file')
              syncQueue.files[file.id] = file.updated
              var folderId = file.folderId || (file.userId ? undefined : 'null') // Remove from folder only if file belongs to user
              return clRestSvc.request({
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
            }, true)

            if (filesToRemove.length) {
              clFileSvc.removeDaos(filesToRemove)
              $rootScope.$evalAsync()
            }
            if (result) {
              syncQueue(updateFile) // Enqueue other potential changes
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
              settings.updated !== daoMap.settings.updated && // Is out of sync
              settings.updated !== clSyncDataSvc.user.settings && // Is different from last received
              settings.updated !== syncQueue.settings[0] // Is different from last sent
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

        // Watch public files (later)
        setTimeout(function () {
          // Check that the same socket is still open
          if (clSocketSvc.isReady && syncQueue === clSocketSvc.ctx.syncQueue) {
            watchPublicFiles(syncQueue)
          }
        }, 10)

        return hasChanged
      }), 1200)

      function watchPublicFiles (syncQueue) {
        var currentDate = Date.now()

        // Watch local files
        var fileIds = clFileSvc.localFiles
          .cl_filter(function (file) {
            return file.userId && !syncQueue.watchedFiles[file.id]
          })
          .cl_map(function (file) {
            syncQueue.watchedFiles[file.id] = true
            return file.id
          })
        fileIds.length && clSocketSvc.sendMsg('watchFiles', fileIds)

        // Watch files from recent folders
        clSyncDataSvc.folderRefreshDates.cl_each(function (refreshDate, folderId) {
          var folder = clFolderSvc.activeDaoMap[folderId]
          if (folder && folder.userId && !syncQueue.watchedFolders[folderId] && currentDate - refreshDate < refreshAfter) {
            syncQueue.watchedFolders[folderId] = true
            clSocketSvc.sendMsg('watchFolderFiles', folderId)
          }
        })
      }

      function updateFileFromServer (file, item) {
        file.name = item.name
        file.sharing = item.sharing
        file.updated = item.updated
        file.userId = clSyncDataSvc.user.id !== item.userId ? item.userId : ''
        clSyncDataSvc.files[file.id] = item.updated
      }

      function updateFolderFromServer (folder, item) {
        folder.name = item.name
        folder.sharing = item.sharing
        folder.updated = item.updated
        folder.userId = clSyncDataSvc.user.id !== item.userId ? item.userId : ''
        clSyncDataSvc.folders[folder.id] = item.updated
      }

      function updateClasseurFromServer (classeur, item) {
        classeur.name = item.name
        classeur.updated = item.updated
        classeur.userId = clSyncDataSvc.user.id !== item.userId ? 'null' : ''
        clSyncDataSvc.classeurs[classeur.id] = item.updated
      }

      $rootScope.$watch('currentFile', function (file) {
        if (file && !file.name && clIsNavigatorOnline()) {
          clRestSvc.request({
            method: 'GET',
            url: '/api/v2/files/' + file.id
          })
            .then(localDbWrapper(function (res) {
              updateFileFromServer(file, res.body)
              return true // apply
            }))
        }
      })

      function isFresh (refreshDates, id) {
        return Date.now() - (refreshDates[id] || 0) < refreshAfter
      }

      function getPublicLocalFiles () {
        if (!isFresh(clSyncDataSvc.folderRefreshDates, 'local')) {
          var files = clFileSvc.localFiles.cl_filter(function (file) {
            return file.userId
          })
          if (files.length) {
            Promise.all(files.cl_map(function (file) {
              return clRestSvc.request({
                method: 'GET',
                url: '/api/v2/files/' + file.id
              })
                .then(function (res) {
                  return res.body
                }, function () {
                  clToast('File not accessible: ' + (file.name || file.id))
                })
            }))
              .then(localDbWrapper(function (items) {
                var apply
                clSyncDataSvc.folderRefreshDates.local = Date.now()
                items.cl_each(function (item, i) {
                  if (item) {
                    updateFileFromServer(files[i], item)
                    apply = true
                  }
                })
                return apply
              }))
          }
        }
      }

      function getPublicFolder (folder) {
        if (folder.userId && !isFresh(clSyncDataSvc.folderRefreshDates, folder.id)) {
          return clRestSvc.request({
            method: 'GET',
            url: '/api/v2/folders/' + folder.id
          })
            .then(function (res) {
              var folderItem = res.body
              return clRestSvc.list('/api/v2/folders/' + folder.id + '/files')
                .then(localDbWrapper(function (fileItems) {
                  clSyncDataSvc.folderRefreshDates[folder.id] = Date.now()
                  updateFolderFromServer(folder, folderItem)
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
                    updateFileFromServer(file, item)
                  })
                  filesToMove.cl_each(function (file) {
                    file.folderId = ''
                  })
                  clFolderSvc.init() // Refresh tabs order
                  clFileSvc.init()
                  return true // apply
                }))
            })
            .catch(function () {
              clToast('Folder not accessible: ' + (folder.name || folder.id))
              if (!folder.name) {
                // User was attempting to import the folder
                clFolderSvc.removeDaos([folder])
              }
            })
        }
      }

      function getFolder (folder) {
        if (clIsNavigatorOnline()) {
          folder ? getPublicFolder(folder) : getPublicLocalFiles()
        }
      }

      function getClasseur (classeur) {
        if (classeur &&
          (classeur.userId || clSocketSvc.hasToken) && // Classeur is accessible
          (!classeur.name || clSyncDataSvc.classeurs[classeur.id]) && // Trying to import the classeur, or was previously synced
          !isFresh(clSyncDataSvc.classeurRefreshDates, classeur.id)
        ) {
          return clRestSvc.request({
            method: 'GET',
            url: '/api/v2/classeurs/' + classeur.id
          })
            .then(function (res) {
              var classeurItem = res.body
              return clRestSvc.list('/api/v2/classeurs/' + classeur.id + '/folders')
                .then(localDbWrapper(function (folderItems) {
                  clSyncDataSvc.classeurRefreshDates[classeur.id] = Date.now()
                  updateClasseurFromServer(classeur, classeurItem)

                  var mappingChanges = {}
                  var classeurFolderIds = clClasseurSvc.classeurFolderMap[classeur.id] || []
                  classeurFolderIds.cl_reduce(function (folderId) {
                    mappingChanges[folderId] = REMOVED
                  })
                  folderItems.cl_each(function (item) {
                    if (mappingChanges[item.id] === REMOVED) {
                      delete mappingChanges[item.id]
                    } else {
                      mappingChanges[item.id] = ADDED
                    }
                    var folder = clFolderSvc.activeDaoMap[item.id]
                    if (!folder) {
                      folder = clFolderSvc.createPublicFolder(item.id)
                    }
                    updateFolderFromServer(folder, item)
                  })

                  mappingChanges.cl_each(function (value, folderId) {
                    if (value === ADDED) {
                      clClasseurSvc.setClasseurFolder(classeur, folderId)
                    } else {
                      clClasseurSvc.unsetClasseurFolder(classeur, folderId)
                    }
                  })

                  // Classeurs are updated when evaluating folderSvc.activeDaos
                  clFolderSvc.init()
                  return true // apply
                }))
            })
            .catch(function () {
              clToast('Classeur not accessible: ' + (classeur.name || classeur.id))
              if (!classeur.name) {
                // User was attempting to import the classeur
                clClasseurSvc.removeDaos([classeur])
              }
            })
        }
      }

      return clSyncSvc
    })
  .factory('clContentSyncSvc',
    function ($rootScope, $timeout, $q, clRestSvc, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clEditorLayoutSvc) {
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
        // addToDaos calls init
        if (!file.addToDaos) {
          clFileSvc.init() // Will delete the content if called while file is not in the daos
        }
      }

      function setLoadingError (file, error) {
        if (file.state === 'loading') {
          file.state = undefined
        }
        $rootScope.$evalAsync()
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

      function watchContent (file) {
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

      function getPublicContent (file) {
        if (!file || !file.state || !file.loadPending || !file.userId || !clIsNavigatorOnline()) {
          return
        }
        var lastContent
        var syncedContent
        file.loadPending = false
        clRestSvc.request({
          method: 'GET',
          url: '/api/v2/files/' + file.id + '/contentRevs/last'
        })
          .then(function (res) {
            lastContent = res.body
            if (file.content && file.content.syncedRev < lastContent.rev) {
              return clRestSvc.request({
                method: 'GET',
                url: '/api/v2/files/' + file.id + '/contentRevs/' + file.content.syncedRev
              })
                .then(function (res) {
                  syncedContent = res.body
                })
            }
          })
          .then(function () {
            if (!file.content) {
              setLoadedContent(file, lastContent)
            } else {
              applyServerContent(file, syncedContent || lastContent, lastContent)
            }
            file.setContentSynced(lastContent.rev)
            // Evaluate scope synchronously to have cledit instantiated
            $rootScope.$apply()
          })
          .catch(function () {
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
            // Has to be the previously sent message
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
        var fileId = watchCtx.file.id
        return Promise.resolve()
          .then(function () {
            if (toRev !== rev) {
              return clRestSvc.list('/api/v2/files/' + fileId + '/contentChanges', null, rev, toRev - 1)
                .then(function (items) {
                  if (watchCtx && watchCtx.file.id === fileId) {
                    items.cl_each(function (item) {
                      watchCtx.contentChanges[item.rev] = item
                    })
                  }
                })
            }
          })
          .then(function () {
            var result = {
              text: watchCtx.text,
              properties: ({}).cl_extend(watchCtx.properties),
              discussions: ({}).cl_extend(watchCtx.discussions),
              comments: ({}).cl_extend(watchCtx.comments),
              conflicts: ({}).cl_extend(watchCtx.conflicts)
            }
            watchCtx.contentChanges.slice(rev + 1, watchCtx.rev + 1).reverse().cl_each(function (contentChange) {
              result.text = clDiffUtils.applyFlattenedTextPatchesReverse(result.text, contentChange.text || [])
              console.log(result.text, contentChange.text)
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.properties, contentChange.properties || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.discussions, contentChange.discussions || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.comments, contentChange.comments || [])
              clDiffUtils.applyFlattenedObjectPatchesReverse(result.conflicts, contentChange.conflicts || [])
            })
            return result
          })
      }

      clSetInterval(function () {
        // Check that window has focus and socket is online
        if (!clUserActivity.checkActivity() || !clSocketSvc.isReady) {
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
        if (clSocketSvc.isReady) {
          watchContent(currentFile)
        } else if (!clSocketSvc.hasToken) {
          getPublicContent(currentFile)
        }
      })

      clSetInterval(function () {
        if (!clUserActivity.checkActivity()) {
          return
        }
        clFileSvc.readLocalFileChanges()
        if ($rootScope.currentFile && $rootScope.currentFile.state === 'loaded') {
          $rootScope.currentFile.writeContent()
        }
        clFileSvc.writeLocalFileChanges()
        if (clSocketSvc.isReady) {
          watchContent($rootScope.currentFile)
          sendContentChange()
        } else if (!clSocketSvc.hasToken) {
          getPublicContent($rootScope.currentFile)
        }
      }, 200)

      return clContentSyncSvc
    })
