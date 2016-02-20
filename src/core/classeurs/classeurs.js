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
    function (clUid, clLocalStorage, clLocalStorageObject, clFolderSvc, clSettingSvc) {
      var classeurDaoProto = clLocalStorageObject('C', {
        name: 'string',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      }, true)

      function ClasseurDao (id) {
        this.id = id
        this.$setId(id)
        this.read()
      }

      ClasseurDao.prototype = classeurDaoProto

      ClasseurDao.prototype.read = function () {
        this.$read()
        this.$readUpdate()
      }

      ClasseurDao.prototype.write = function () {
        this.$write()
        this.extUpdated = undefined
      }

      var clClasseurSvc = clLocalStorageObject('classeurSvc', {
        classeurIds: 'array',
        classeursToRemove: 'array',
        classeurFolders: 'object',
        classeurAddedFolders: 'object',
        classeurRemovedFolders: 'object'
      })

      var classeurAuthorizedKeys = {
        u: true,
        name: true,
        sharing: true,
        userId: true,
        deleted: true
      }

      function folderChecker (objectName) {
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id] || []
          return ~folderIds.indexOf(folder.id)
        }
      }

      function folderAdder (objectName) {
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id] || []
          folderIds.push(folder.id)
          clClasseurSvc[objectName][classeur.id] = folderIds
        }
      }

      function folderRemover (objectName) {
        return function (classeur, folder) {
          var folderIds = clClasseurSvc[objectName][classeur.id] || []
          var index = folderIds.indexOf(folder.id)
          if (~index) {
            folderIds.splice(index, 1)
            clClasseurSvc[objectName][classeur.id] = folderIds
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

      function isFolderInClasseur (classeur, folder) {
        return !isFolderInClasseurRemovedFolders(classeur, folder) && (
        isFolderInClasseurFolders(classeur, folder) ||
        isFolderInClasseurAddedFolders(classeur, folder)
        )
      }

      function setClasseurFolder (classeur, folder) {
        if (!isFolderInClasseurFolders(classeur, folder)) {
          addFolderInClasseurFolders(classeur, folder)
        }
        removeFolderInClasseurAddedFolders(classeur, folder)
      }

      function unsetClasseurFolder (classeur, folder) {
        removeFolderInClasseurFolders(classeur, folder)
        removeFolderInClasseurRemovedFolders(classeur, folder)
      }

      function addFolderToClasseur (classeur, folder) {
        if (!isFolderInClasseur(classeur, folder)) {
          addFolderInClasseurAddedFolders(classeur, folder)
        }
      }

      function removeFolderFromClasseur (classeur, folder) {
        if (isFolderInClasseur(classeur, folder)) {
          addFolderInClasseurRemovedFolders(classeur, folder)
        }
      }

      var isInitialized

      function init () {
        if (!clClasseurSvc.classeurIds) {
          clClasseurSvc.$read()
        }

        var classeurMap = Object.create(null)
        var deletedClasseurMap = Object.create(null)
        clClasseurSvc.classeurIds = clClasseurSvc.classeurIds.cl_filter(function (id) {
          var classeur = clClasseurSvc.daoMap[id] || clClasseurSvc.deletedDaoMap[id] || new ClasseurDao(id)
          if (!classeur.deleted && !classeurMap[id]) {
            classeurMap[id] = classeur
            return true
          }
          if (classeur.deleted && !deletedClasseurMap[id]) {
            deletedClasseurMap[id] = classeur
            return true
          }
        })
        clClasseurSvc.daoMap = classeurMap
        clClasseurSvc.deletedDaoMap = deletedClasseurMap

        if (!isInitialized) {
          // Backward compatibility
          var oldClasseurs = clLocalStorage.getItem('classeurSvc.classeurs')
          if (oldClasseurs) {
            JSON.parse(oldClasseurs).cl_each(function (item) {
              if (item.isDefault) {
                return
              }
              var classeur = new ClasseurDao(item.id)
              classeur.name = item.name
              classeur.deleted = 0
              clClasseurSvc.classeurIds.push(item.id)
              clClasseurSvc.daoMap[item.id] = classeur
              item.folders.cl_each(function (folderId) {
                var folder = clFolderSvc.daoMap[folderId]
                folder && setClasseurFolder(classeur, folder)
              })
            })
            clLocalStorage.removeItem('classeurSvc.classeurs')
            return init()
          }
        }

        var foldersInClasseurs = Object.create(null)
        clClasseurSvc.defaultClasseur = undefined
        clClasseurSvc.daos = Object.keys(classeurMap).cl_map(function (id) {
          var classeur = classeurMap[id]

          if (id === clSettingSvc.values.defaultClasseurId) {
            clClasseurSvc.defaultClasseur = classeur
          }
          classeur.isDefault = undefined

          // List files in this classeur
          var foldersInClasseur = Object.create(null)
          var folderIds = (clClasseurSvc.classeurFolders[classeur.id] || []).concat(clClasseurSvc.classeurAddedFolders[classeur.id] || [])
          var removedFolderIds = clClasseurSvc.classeurRemovedFolders[classeur.id] || []
          classeur.folders = folderIds.cl_reduce(function (folders, folderId) {
            var folder = clFolderSvc.daoMap[folderId]
            if (folder && !foldersInClasseur[folderId] && !~removedFolderIds.indexOf(folderId)) {
              foldersInClasseur[folderId] = 1
              foldersInClasseurs[folderId] = 1
              folders.push(folder)
            }
            return folders
          }, [])

          return classeur
        })

        clClasseurSvc.deletedDaos = Object.keys(deletedClasseurMap).cl_map(function (id) {
          return deletedClasseurMap[id]
        })

        if (!clClasseurSvc.defaultClasseur) {
          // Create default classeur
          clClasseurSvc.defaultClasseur = new ClasseurDao(clUid())
          clClasseurSvc.defaultClasseur.name = 'Classeur'
          clClasseurSvc.defaultClasseur.isDefault = true
          clClasseurSvc.classeurIds.push(clClasseurSvc.defaultClasseur.id)
          clClasseurSvc.daoMap[clClasseurSvc.defaultClasseur.id] = clClasseurSvc.defaultClasseur
          clSettingSvc.values.defaultClasseurId = clClasseurSvc.defaultClasseur.id
          return init()
        }

        // Add remaining folders in the default classeur
        clClasseurSvc.defaultClasseur.isDefault = true
        clFolderSvc.daos.cl_each(function (folder) {
          if (!foldersInClasseurs[folder.id]) {
            clClasseurSvc.defaultClasseur.folders.push(folder)
          }
        })

        if (!isInitialized) {
          var classeurKeyPrefix = /^C\.(\w+)\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            if (key.charCodeAt(0) === 0x43 /* C */) {
              var match = key.match(classeurKeyPrefix)
              if (match) {
                if ((!clClasseurSvc.daoMap[match[1]] && !clClasseurSvc.deletedDaoMap[match[1]]) ||
                  !classeurAuthorizedKeys.hasOwnProperty(match[2])
                ) {
                  clLocalStorage.removeItem(key)
                }
              }
            }
          })

          isInitialized = true
        }
      }

      function checkLocalStorage () {
        // Check classeur id list
        var checkClasseurSvcUpdate = clClasseurSvc.$checkUpdate()
        clClasseurSvc.$readUpdate()
        if (checkClasseurSvcUpdate && clClasseurSvc.$check()) {
          clClasseurSvc.classeurIds = undefined
        } else {
          clClasseurSvc.$write()
        }

        // Check every classeur
        // var startTime = Date.now()
        var checkClasseurUpdate = classeurDaoProto.$checkGlobalUpdate()
        classeurDaoProto.$readGlobalUpdate()
        clClasseurSvc.daos.concat(clClasseurSvc.deletedDaos).cl_each(function (classeur) {
          if (checkClasseurUpdate && classeur.$checkUpdate()) {
            classeur.read()
          } else {
            classeur.write()
          }
        })
        // console.log('Dirty checking took ' + (Date.now() - startTime) + 'ms')

        if (checkClasseurSvcUpdate || checkClasseurUpdate) {
          init()
          return true
        }
      }

      function createClasseur (name) {
        var classeur = new ClasseurDao(clUid())
        classeur.name = name
        classeur.deleted = 0
        clClasseurSvc.classeurIds.push(classeur.id)
        clClasseurSvc.daoMap[classeur.id] = classeur
        init()
        return classeur
      }

      function setDeletedClasseurs (classeurList) {
        if (!classeurList.length) {
          return
        }
        var currentDate = Date.now()
        classeurList.cl_each(function (classeur) {
          classeur.deleted = currentDate
        })
        init()
      }

      // Remove classeur from classeurs and deletedClasseurs
      function removeClasseurs (classeurList) {
        if (!classeurList.length) {
          return
        }

        // Create hash for fast filter
        var classeurIds = classeurList.cl_reduce(function (classeurIds, classeur) {
          classeurIds[classeur.id] = 1
          return classeurIds
        }, Object.create(null))

        // Filter
        clClasseurSvc.classeurIds = clClasseurSvc.classeurIds.cl_filter(function (classeurId) {
          return !classeurIds[classeurId]
        })
        init()
      }

      function applyClasseurChanges (items) {
        items.cl_each(function (item) {
          var classeur = clClasseurSvc.daoMap[item.id]
          if (item.deleted && classeur) {
            var index = clClasseurSvc.daos.indexOf(classeur)
            clClasseurSvc.classeurIds.splice(index, 1)
          } else if (!item.deleted && !classeur) {
            classeur = new ClasseurDao(item.id)
            clClasseurSvc.daoMap[item.id] = classeur
            clClasseurSvc.classeurIds.push(item.id)
          }
          classeur.userId = item.userId || ''
          classeur.name = item.name || ''
          classeur.$setExtUpdate(item.updated)
        })
        init()
      }

      function mergeDefaultClasseur (newDefaultClasseur) {
        var folderIds = (clClasseurSvc.classeurFolders[clClasseurSvc.defaultClasseur.id] || [])
          .concat(clClasseurSvc.classeurAddedFolders[clClasseurSvc.defaultClasseur.id] || [])
        var removedFolderIds = clClasseurSvc.classeurRemovedFolders[clClasseurSvc.defaultClasseur.id] || []
        folderIds.cl_each(function (folderId) {
          var folder = clFolderSvc.daoMap[folderId]
          if (folder && !~removedFolderIds.indexOf(folderId)) {
            addFolderToClasseur(newDefaultClasseur, folder)
          }
        })
        setDeletedClasseurs([clClasseurSvc.defaultClasseur])
      }

      clClasseurSvc.init = init
      clClasseurSvc.checkLocalStorage = checkLocalStorage
      clClasseurSvc.createClasseur = createClasseur
      clClasseurSvc.removeDaos = removeClasseurs
      clClasseurSvc.setDeletedClasseurs = setDeletedClasseurs
      clClasseurSvc.addFolderToClasseur = addFolderToClasseur
      clClasseurSvc.removeFolderFromClasseur = removeFolderFromClasseur
      clClasseurSvc.applyClasseurChanges = applyClasseurChanges
      clClasseurSvc.mergeDefaultClasseur = mergeDefaultClasseur
      clClasseurSvc.daoMap = Object.create(null)
      clClasseurSvc.deletedDaoMap = Object.create(null)

      init()
      return clClasseurSvc
    })
