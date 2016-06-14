angular.module('classeur.core.classeurs', [])
  .directive('clClasseurEntry',
    function ($timeout, clClasseurSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/classeurs/classeurEntry.html',
        link: link
      }

      function link (scope, element) {
        var nameInputElt = element[0].querySelector('.classeur-entry__name-input')
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
            scope.classeur.name = name
          }
          return scope.classeur.name
        }
        scope.name()
        scope.open = function () {
          !scope.isEditing && scope.setClasseur(scope.classeur)
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
              clClasseurSvc.init()
            }, 250)
          }
        }

        // Prevent from selecting the classeur when clicking the menu
        element[0].querySelector('.classeur-entry__menu').addEventListener('click', function (evt) {
          evt.stopPropagation()
        })
      }
    })
  .factory('clClasseurSvc',
    function (clLocalStorage, clLocalDbStore, clFolderSvc, clSettingSvc, clDebug, clHash) {
      var debug = clDebug('classeur:clClasseurSvc')
      var clClasseurSvc = {
        init: init,
        getPatch: getPatch,
        writeAll: writeAll,
        clearAll: clearAll,
        createClasseur: createClasseur,
        createPublicClasseur: createPublicClasseur,
        removeDaos: removeDaos,
        setDeletedClasseurs: setDeletedClasseurs,
        addFolderToClasseur: addFolderToClasseur,
        removeFolderFromClasseur: removeFolderFromClasseur,
        setClasseurFolder: setClasseurFolder,
        unsetClasseurFolder: unsetClasseurFolder,
        applyServerChanges: applyServerChanges,
        mergeDefaultClasseur: mergeDefaultClasseur
      }

      var store = clLocalDbStore('classeurs', {
        name: 'string128',
        userId: 'string',
        deleted: 'int'
      })

      function folderChecker (objectName) {
        // Works with both dao or daoId
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id || classeur] || []
          return ~folderIds.indexOf(folder.id || folder)
        }
      }

      function folderAdder (objectName) {
        // Works with both dao or daoId
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id || classeur] || []
          folderIds.push(folder.id || folder)
          clClasseurSvc[objectName][classeur.id || classeur] = folderIds
        }
      }

      function folderRemover (objectName) {
        // Works with both dao or daoId
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id || classeur] || []
          var index = folderIds.indexOf(folder.id || folder)
          if (~index) {
            folderIds.splice(index, 1)
            clClasseurSvc[objectName][classeur.id || classeur] = folderIds
            return true
          }
        }
      }

      var isFolderInClasseurFolderMap = folderChecker('classeurFolderMap')
      var isFolderInClasseurAddedFolderMap = folderChecker('classeurAddedFolderMap')
      var isFolderInClasseurRemovedFolderMap = folderChecker('classeurRemovedFolderMap')

      var addFolderInClasseurFolderMap = folderAdder('classeurFolderMap')
      var addFolderInClasseurAddedFolderMap = folderAdder('classeurAddedFolderMap')
      var addFolderInClasseurRemovedFolderMap = folderAdder('classeurRemovedFolderMap')

      var removeFolderInClasseurFolderMap = folderRemover('classeurFolderMap')
      var removeFolderInClasseurAddedFolderMap = folderRemover('classeurAddedFolderMap')
      var removeFolderInClasseurRemovedFolderMap = folderRemover('classeurRemovedFolderMap')

      function isFolderInClasseur (classeur, folder) {
        return !isFolderInClasseurRemovedFolderMap(classeur, folder) && (
        isFolderInClasseurFolderMap(classeur, folder) ||
        isFolderInClasseurAddedFolderMap(classeur, folder)
        )
      }

      function setClasseurFolder (classeur, folder) {
        if (!isFolderInClasseurFolderMap(classeur, folder)) {
          addFolderInClasseurFolderMap(classeur, folder)
        }
        removeFolderInClasseurAddedFolderMap(classeur, folder)
      }

      function unsetClasseurFolder (classeur, folder) {
        removeFolderInClasseurFolderMap(classeur, folder)
        removeFolderInClasseurRemovedFolderMap(classeur, folder)
      }

      function addFolderToClasseur (classeur, folder) {
        if (!isFolderInClasseur(classeur, folder)) {
          addFolderInClasseurAddedFolderMap(classeur, folder)
        }
      }

      function removeFolderFromClasseur (classeur, folder) {
        if (isFolderInClasseur(classeur, folder)) {
          addFolderInClasseurRemovedFolderMap(classeur, folder)
        }
      }

      var isInitialized
      var daoMap = {}

      function init () {
        if (!isInitialized) {
          // Backward compatibility
          var oldClasseurs = clLocalStorage.getItem('classeurSvc.classeurs')
          clLocalStorage.removeItem('classeurSvc.classeurs')
          if (oldClasseurs) {
            JSON.parse(oldClasseurs).cl_each(function (item) {
              var classeur = store.createDao(item.id)
              classeur.name = item.name
              daoMap[classeur.id] = classeur
              if (item.isDefault) {
                clSettingSvc.values.defaultClasseurId = item.id
              }
              item.folders.cl_each(function (folderId) {
                addFolderToClasseur(classeur.id, folderId)
              })
            })
          }

          // Eject mapping of classeurs that don't existing
          ;[
            'classeurFolderMap',
            'classeurAddedFolderMap',
            'classeurRemovedFolderMap'
          ]
            .cl_each(function (mapName) {
              Object.keys(clClasseurSvc[mapName]).cl_each(function (classeurId) {
                if (!daoMap[classeurId]) {
                  delete clClasseurSvc[mapName][classeurId]
                }
              })
            })
        }

        var activeDaoMap = clClasseurSvc.activeDaoMap = Object.create(null)
        var deletedDaoMap = clClasseurSvc.deletedDaoMap = Object.create(null)

        daoMap.cl_each(function (dao, id) {
          if (dao.deleted) {
            deletedDaoMap[id] = dao
          } else {
            if (!dao.colorClass0) {
              var index = Math.abs(clHash(id)) % 12
              dao.colorClass0 = 'plastic--' + (index % 12 + 1)
              dao.colorClass1 = 'plastic--' + ((index + 1) % 12 + 1)
              dao.colorClass2 = 'plastic--' + ((index + 2) % 12 + 1)
              dao.folderColorIndex = (index + 3) % 12 + 1
            }
            activeDaoMap[id] = dao
          }
        })

        var foldersInClasseurs = Object.create(null) // To keep track of orphan folders
        clClasseurSvc.defaultClasseur = undefined
        clClasseurSvc.activeDaos = Object.keys(activeDaoMap).cl_map(function (id) {
          var classeur = daoMap[id]

          if (id === clSettingSvc.values.defaultClasseurId && !classeur.userId) { // Default classeur can't be public
            clClasseurSvc.defaultClasseur = classeur
          }
          classeur.isDefault = undefined

          // List folders in this classeur
          var foldersInClasseur = Object.create(null) // To avoid folder duplication
          var folderIds = (clClasseurSvc.classeurFolderMap[classeur.id] || []).concat(clClasseurSvc.classeurAddedFolderMap[classeur.id] || [])
          var removedFolderIds = clClasseurSvc.classeurRemovedFolderMap[classeur.id] || []
          classeur.folders = folderIds.cl_reduce(function (folders, folderId) {
            var folder = clFolderSvc.activeDaoMap[folderId]
            if (folder && !foldersInClasseur[folderId] && !~removedFolderIds.indexOf(folderId)) {
              foldersInClasseur[folderId] = true
              foldersInClasseurs[folderId] = true
              folders.push(folder)
            }
            return folders
          }, [])

          return classeur
        })
          .sort(function (classeur1, classeur2) {
            return classeur1.name.localeCompare(classeur2.name)
          })

        clClasseurSvc.deletedDaos = Object.keys(deletedDaoMap).cl_map(function (id) {
          var classeur = daoMap[id]
          classeur.folders = [] // Release folders for garbage collection
          return classeur
        })

        // Create default classeur if not existing
        if (!clClasseurSvc.defaultClasseur) {
          var classeur = store.createDao()
          classeur.name = 'Classeur'
          daoMap[classeur.id] = classeur
          clSettingSvc.values.defaultClasseurId = classeur.id
          return init()
        }

        // Add orphan folders to the default classeur
        clClasseurSvc.defaultClasseur.isDefault = true
        var foldersToRemove = []
        clFolderSvc.activeDaos.cl_each(function (folder) {
          if (!foldersInClasseurs[folder.id]) {
            // Public folders can't be orphan
            if (folder.userId) {
              foldersToRemove.push(folder)
            } else {
              clClasseurSvc.defaultClasseur.folders.push(folder)
            }
          }
        })

        debug('Init')
        isInitialized = true
        clFolderSvc.removeDaos(foldersToRemove)
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

      function createClasseur (id) {
        var classeur = clClasseurSvc.deletedDaoMap[id] || store.createDao(id)
        classeur.deleted = 0
        daoMap[classeur.id] = classeur
        init()
        return classeur
      }

      function createPublicClasseur (id) {
        var classeur = createClasseur(id)
        classeur.userId = 'null'
        return classeur
      }

      function setDeletedClasseurs (classeurList) {
        if (classeurList.length) {
          var currentDate = Date.now()
          classeurList.cl_each(function (classeur) {
            classeur.updated = currentDate // Ensure we don't keep the server date when called by synchronizer
            classeur.deleted = currentDate
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
          dao.updated = item.updated
        })
        init()
      }

      function mergeDefaultClasseur (newDefaultClasseur) {
        var folderIds = (clClasseurSvc.classeurFolderMap[clClasseurSvc.defaultClasseur.id] || [])
          .concat(clClasseurSvc.classeurAddedFolderMap[clClasseurSvc.defaultClasseur.id] || [])
        var removedFolderIds = clClasseurSvc.classeurRemovedFolderMap[clClasseurSvc.defaultClasseur.id] || []
        folderIds.cl_each(function (folderId) {
          var folder = clFolderSvc.activeDaoMap[folderId]
          if (folder && !~removedFolderIds.indexOf(folderId)) {
            addFolderToClasseur(newDefaultClasseur, folder)
          }
        })
        setDeletedClasseurs([clClasseurSvc.defaultClasseur])
      }

      return clClasseurSvc
    })
