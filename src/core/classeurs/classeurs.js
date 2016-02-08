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
      var classeurContentDaoProto = clLocalStorageObject('Cc', {
        folderIds: 'array',
        addedFolderIds: 'array',
        removedFolderIds: 'array'
      }, true)

      function ClasseurDao (id) {
        this.id = id
        this.$setId(id)
        this.contentDao = Object.create(classeurContentDaoProto)
        this.contentDao.$setId(id)
        this.read()
      }

      ClasseurDao.prototype = classeurDaoProto

      ClasseurDao.prototype.read = function () {
        this.$read()
        this.$readUpdate()
        this.contentDao.$read()
        this.contentDao.$readUpdate()
      }

      ClasseurDao.prototype.write = function () {
        this.$write()
        this.extUpdated = undefined
        this.contentDao.$write()
        this.contentDao.extUpdated = undefined
      }

      var clClasseurSvc = clLocalStorageObject('classeurSvc', {
        classeurIds: 'array',
        classeursToRemove: 'array'
      })

      var classeurAuthorizedKeys = {
        u: true,
        name: true,
        sharing: true,
        userId: true,
        deleted: true
      }

      var classeurContentAuthorizedKeys = {
        u: true,
        folderIds: true,
        addedFolderIds: true,
        removedFolderIds: true
      }

      var isInitialized

      function init () {
        if (!clClasseurSvc.classeurIds) {
          clClasseurSvc.$read()
        }

        var classeurMap = Object.create(null)
        var deletedClasseurMap = Object.create(null)
        clClasseurSvc.classeurIds = clClasseurSvc.classeurIds.cl_filter(function (id) {
          var classeurDao = clClasseurSvc.classeurMap[id] || clClasseurSvc.deletedClasseurMap[id] || new ClasseurDao(id)
          if (!classeurDao.deleted && !classeurMap[id]) {
            classeurMap[id] = classeurDao
            return true
          }
          if (classeurDao.deleted && !deletedClasseurMap[id]) {
            deletedClasseurMap[id] = classeurDao
            return true
          }
        })
        clClasseurSvc.classeurMap = classeurMap
        clClasseurSvc.deletedClasseurMap = deletedClasseurMap

        if (!isInitialized) {
          // Backward compatibility
          var oldClasseurs = clLocalStorage.getItem('classeurSvc.classeurs')
          if (oldClasseurs) {
            JSON.parse(oldClasseurs).cl_each(function (item) {
              var classeurDao = new ClasseurDao(item.id)
              classeurDao.name = item.name
              classeurDao.contentDao.folders = item.folders.sort()
              classeurDao.deleted = 0
              clClasseurSvc.classeurIds.push(item.id)
              clClasseurSvc.classeurMap[item.id] = classeurDao
              if (item.isDefault) {
                clSettingSvc.values.defaultClasseurId = classeurDao.id
              }
            })
            clLocalStorage.removeItem('classeurSvc.classeurs')
            return init()
          }
        }

        var foldersInClasseurs = Object.create(null)
        clClasseurSvc.defaultClasseur = undefined
        clClasseurSvc.classeurs = Object.keys(classeurMap).cl_map(function (id) {
          var classeurDao = classeurMap[id]

          if (id === clSettingSvc.values.defaultClasseurId) {
            clClasseurSvc.defaultClasseur = classeurDao
          }
          classeurDao.default = undefined

          // List files in this classeur
          var removedFolderIds = classeurDao.contentDao.removedFolderIds.cl_reduce(function (removedFolderIds, folderId) {
            removedFolderIds[folderId] = 1
            return removedFolderIds
          }, Object.create(null))
          var foldersInClasseur = Object.create(null)
          classeurDao.folders = classeurDao.contentDao.folderIds.concat(classeurDao.contentDao.addedFolderIds).cl_reduce(function (folders, folderId) {
            var folderDao = clFolderSvc.folderMap[folderId]
            if (folderDao && !foldersInClasseur[folderDao.id] && !removedFolderIds[folderDao.id]) {
              foldersInClasseur[folderDao.id] = 1
              foldersInClasseurs[folderDao.id] = 1
              folders.push(folderDao)
            }
            return folders
          }, [])

          return classeurDao
        })

        clClasseurSvc.deletedClasseurs = Object.keys(deletedClasseurMap).cl_map(function (id) {
          return deletedClasseurMap[id]
        })

        if (!clClasseurSvc.defaultClasseur) {
          // Create default classeur
          clClasseurSvc.defaultClasseur = new ClasseurDao(clUid())
          clClasseurSvc.defaultClasseur.name = 'Classeur'
          clClasseurSvc.defaultClasseur.default = true
          clClasseurSvc.classeurIds.push(clClasseurSvc.defaultClasseur.id)
          clClasseurSvc.classeurMap[clClasseurSvc.defaultClasseur.id] = clClasseurSvc.defaultClasseur
          clSettingSvc.values.defaultClasseurId = clClasseurSvc.defaultClasseur.id
          return init()
        }

        // Add remaining folders in the default classeur
        clClasseurSvc.defaultClasseur.default = true
        clFolderSvc.folders.cl_each(function (folderDao) {
          if (!foldersInClasseurs[folderDao.id]) {
            clClasseurSvc.defaultClasseur.folders.push(folderDao)
          }
        })

        if (!isInitialized) {
          var classeurKeyPrefix = /^C\.(\w+)\.(\w+)/
          var classeurContentKeyPrefix = /^Cc\.(\w+)\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            if (key.charCodeAt(0) === 0x43 /* C */) {
              var match = key.match(classeurKeyPrefix)
              if (match) {
                if ((!clClasseurSvc.classeurMap[match[1]] && !clClasseurSvc.deletedClasseurMap[match[1]]) ||
                  !classeurAuthorizedKeys.hasOwnProperty(match[2])
                ) {
                  clLocalStorage.removeItem(key)
                }
              } else {
                match = key.match(classeurContentKeyPrefix)
                if (match) {
                  if ((!clClasseurSvc.classeurMap[match[1]] && !clClasseurSvc.deletedClasseurMap[match[1]]) ||
                    !classeurContentAuthorizedKeys.hasOwnProperty(match[2])
                  ) {
                    clLocalStorage.removeItem(key)
                  }
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
        var checkClasseurContentUpdate = classeurContentDaoProto.$checkGlobalUpdate()
        classeurContentDaoProto.$readGlobalUpdate()
        clClasseurSvc.classeurs.concat(clClasseurSvc.deletedClasseurs).cl_each(function (classeurDao) {
          if ((checkClasseurUpdate && classeurDao.$checkUpdate()) || (checkClasseurContentUpdate && classeurDao.contentDao.$checkUpdate())) {
            classeurDao.read()
          } else {
            classeurDao.write()
          }
        })
        // console.log('Dirty checking took ' + (Date.now() - startTime) + 'ms')

        if (checkClasseurSvcUpdate || checkClasseurUpdate || checkClasseurContentUpdate) {
          init()
          return true
        }
      }

      function createClasseur (name) {
        var classeurDao = new ClasseurDao(clUid())
        classeurDao.name = name
        classeurDao.deleted = 0
        clClasseurSvc.classeurIds.push(classeurDao.id)
        clClasseurSvc.classeurMap[classeurDao.id] = classeurDao
        init()
        return classeurDao
      }

      function setDeletedClasseurs (classeurDaoList) {
        if (!classeurDaoList.length) {
          return
        }
        var currentDate = Date.now()
        classeurDaoList.cl_each(function (classeurDao) {
          classeurDao.deleted = currentDate
        })
        init()
      }

      // Remove classeurDao from classeurs and deletedClasseurs
      function removeClasseurs (classeurDaoList) {
        if (!classeurDaoList.length) {
          return
        }

        // Create hash for fast filter
        var classeurIds = classeurDaoList.cl_reduce(function (classeurIds, classeurDao) {
          classeurIds[classeurDao.id] = 1
          return classeurIds
        }, Object.create(null))

        // Filter
        clClasseurSvc.classeurIds = clClasseurSvc.classeurIds.cl_filter(function (classeurId) {
          return !classeurIds[classeurId]
        })
        init()
      }

      clClasseurSvc.init = init
      clClasseurSvc.checkLocalStorage = checkLocalStorage
      clClasseurSvc.createClasseur = createClasseur
      clClasseurSvc.setDeletedClasseurs = setDeletedClasseurs
      clClasseurSvc.removeClasseurs = removeClasseurs
      clClasseurSvc.classeurMap = Object.create(null)
      clClasseurSvc.deletedClasseurMap = Object.create(null)

      init()
      return clClasseurSvc
    })
