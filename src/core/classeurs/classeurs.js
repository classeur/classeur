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
          } else if (!scope.classeur.name) {
            scope.classeur.name = 'Untitled'
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
    function (clUid, clLocalStorage, clLocalDbStore, clFolderSvc, clSettingSvc) {
      var clClasseurSvc = {
        classeurFolders: {},
        classeurAddedFolders: {},
        classeurRemovedFolders: {},
        init: init,
        readAll: readAll,
        writeAll: writeAll,
        createClasseur: createClasseur,
        removeDaos: removeDaos,
        setDeletedClasseurs: setDeletedClasseurs,
        addFolderToClasseur: addFolderToClasseur,
        removeFolderFromClasseur: removeFolderFromClasseur,
        applyServerChanges: applyServerChanges,
        mergeDefaultClasseur: mergeDefaultClasseur
      }

      var store = clLocalDbStore('classeurs', {
        name: 'string',
        userId: 'string',
        deleted: 'int'
      })

      function Classeur (id) {
        this.id = id || clUid()
        this.name = ''
        this.userId = ''
        this.deleted = 0
      }

      function folderChecker (objectName) {
        return function (classeurId, folderId) {
          var folderIds = clClasseurSvc[objectName][classeurId] || []
          return ~folderIds.indexOf(folderId)
        }
      }

      function folderAdder (objectName) {
        return function (classeurId, folderId) {
          var folderIds = clClasseurSvc[objectName][classeurId] || []
          folderIds.push(folderId)
          clClasseurSvc[objectName][classeurId] = folderIds
        }
      }

      function folderRemover (objectName) {
        return function (classeurId, folderId) {
          var folderIds = clClasseurSvc[objectName][classeurId] || []
          var index = folderIds.indexOf(folderId)
          if (~index) {
            folderIds.splice(index, 1)
            clClasseurSvc[objectName][classeurId] = folderIds
          }
        }
      }

      var isFolderInClasseurFolders = folderChecker('classeurFolders')
      var isFolderInClasseurAddedFolders = folderChecker('classeurAddedFolders')
      var isFolderInClasseurRemovedFolders = folderChecker('classeurRemovedFolders')

      var addFolderInClasseurFolders = folderAdder('classeurFolders')
      var addFolderInClasseurAddedFolders = folderAdder('classeurAddedFolders')
      var addFolderInClasseurRemovedFolders = folderAdder('classeurRemovedFolders')

      var removeFolderInClasseurFolders = folderRemover('classeurFolders')
      var removeFolderInClasseurAddedFolders = folderRemover('classeurAddedFolders')
      var removeFolderInClasseurRemovedFolders = folderRemover('classeurRemovedFolders')

      function isFolderInClasseur (classeurId, folderId) {
        return !isFolderInClasseurRemovedFolders(classeurId, folderId) && (
        isFolderInClasseurFolders(classeurId, folderId) ||
        isFolderInClasseurAddedFolders(classeurId, folderId)
        )
      }

      function setClasseurFolder (classeurId, folderId) {
        if (!isFolderInClasseurFolders(classeurId, folderId)) {
          addFolderInClasseurFolders(classeurId, folderId)
        }
        removeFolderInClasseurAddedFolders(classeurId, folderId)
      }

      function unsetClasseurFolder (classeurId, folderId) {
        removeFolderInClasseurFolders(classeurId, folderId)
        removeFolderInClasseurRemovedFolders(classeurId, folderId)
      }

      function addFolderToClasseur (classeurId, folderId) {
        if (!isFolderInClasseur(classeurId, folderId)) {
          addFolderInClasseurAddedFolders(classeurId, folderId)
        }
      }

      function removeFolderFromClasseur (classeurId, folderId) {
        if (isFolderInClasseur(classeurId, folderId)) {
          addFolderInClasseurRemovedFolders(classeurId, folderId)
        }
      }

      var isInitialized
      var daoMap = {}

      function init () {
        if (!isInitialized) {
          // Backward compatibility
          var done = clLocalStorage.getItem('classeurSvc.done')
          clLocalStorage.setItem('classeurSvc.done', 1)
          var oldClasseurs = clLocalStorage.getItem('classeurSvc.classeurs')
          clLocalStorage.removeItem('classeurSvc.classeurs')
          if (!done && oldClasseurs) {
            JSON.parse(oldClasseurs).cl_each(function (item) {
              var classeur = new Classeur(item.id)
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
        }

        var activeDaoMap = clClasseurSvc.activeDaoMap = Object.create(null)
        var deletedDaoMap = clClasseurSvc.deletedDaoMap = Object.create(null)

        daoMap.cl_each(function (dao, id) {
          if (dao.deleted) {
            deletedDaoMap[id] = dao
          } else {
            activeDaoMap[id] = dao
          }
        })

        var foldersInClasseurs = Object.create(null)
        clClasseurSvc.defaultClasseur = undefined
        clClasseurSvc.activeDaos = Object.keys(activeDaoMap).cl_map(function (id) {
          var classeur = daoMap[id]

          if (id === clSettingSvc.values.defaultClasseurId) {
            clClasseurSvc.defaultClasseur = classeur
          }
          classeur.isDefault = undefined

          // List folders in this classeur
          var foldersInClasseur = Object.create(null)
          var folderIds = (clClasseurSvc.classeurFolders[classeur.id] || []).concat(clClasseurSvc.classeurAddedFolders[classeur.id] || [])
          var removedFolderIds = clClasseurSvc.classeurRemovedFolders[classeur.id] || []
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

        clClasseurSvc.deletedDaos = Object.keys(deletedDaoMap).cl_map(function (id) {
          var classeur = daoMap[id]
          classeur.folders = undefined // Release folders for garbage collection
          return classeur
        })

        // Create default classeur if not existing
        if (!clClasseurSvc.defaultClasseur) {
          clClasseurSvc.defaultClasseur = new Classeur()
          clClasseurSvc.defaultClasseur.name = 'Classeur'
          clSettingSvc.values.defaultClasseurId = clClasseurSvc.defaultClasseur.id
          return init()
        }

        // Add remaining folders in the default classeur
        clClasseurSvc.defaultClasseur.isDefault = true
        clFolderSvc.activeDaos.cl_each(function (folder) {
          if (!foldersInClasseurs[folder.id]) {
            clClasseurSvc.defaultClasseur.folders.push(folder)
          }
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

      function createClasseur (id) {
        var classeur = clClasseurSvc.deletedDaoMap[id] || new Classeur(id)
        classeur.deleted = 0
        daoMap[classeur.id] = classeur
        init()
        return classeur
      }

      function setDeletedClasseurs (classeurList) {
        if (classeurList.length) {
          var currentDate = Date.now()
          classeurList.cl_each(function (classeur) {
            classeur.deleted = currentDate
          })
          init()
        }
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
          var dao = daoMap[item.id] || new Classeur(item.id)
          if (item.deleted) {
            delete daoMap[item.id]
          } else if (!item.deleted) {
            dao.deleted = 0
            daoMap[item.id] = dao
          }
          dao.userId = item.userId || ''
          dao.name = item.name || ''
          dao.updated = item.updated
        })
        items.length && init()
      }

      function mergeDefaultClasseur (newDefaultClasseur) {
        var folderIds = (clClasseurSvc.classeurFolders[clClasseurSvc.defaultClasseur.id] || [])
          .concat(clClasseurSvc.classeurAddedFolders[clClasseurSvc.defaultClasseur.id] || [])
        var removedFolderIds = clClasseurSvc.classeurRemovedFolders[clClasseurSvc.defaultClasseur.id] || []
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
