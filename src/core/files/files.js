angular.module('classeur.core.files', [])
  .directive('clFileEntry',
    function ($timeout, clExplorerLayoutSvc) {
      return {
        restrict: 'E',
        templateUrl: 'core/files/fileEntry.html',
        link: link
      }

      function link (scope, element) {
        var nameInputElt = element[0].querySelector('.file-entry__name input')
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
            scope.fileDao.name = name
          } else if (!scope.fileDao.name) {
            scope.fileDao.name = 'Untitled'
          }
          return scope.fileDao.name
        }
        scope.name()
        scope.open = function () {
          !scope.isEditing && scope.setCurrentFile(scope.fileDao)
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
              clExplorerLayoutSvc.refreshFiles()
            }, 250)
          }
        }
      }
    })
  .factory('clFileSvc',
    function ($timeout, $templateCache, clLocalStorage, clUid, clLocalStorageObject, clSocketSvc, clIsNavigatorOnline) {
      var maxLocalFiles = 25
      var fileDaoProto = clLocalStorageObject('f', {
        name: 'string',
        folderId: 'string',
        classeurId: 'string',
        sharing: 'string',
        userId: 'string',
        deleted: 'int'
      }, true)
      var contentDaoProto = clLocalStorageObject('c', {
        isLocal: 'string',
        lastChange: 'int',
        serverHash: 'string',
        text: 'string',
        properties: 'object',
        discussions: 'object',
        comments: 'object',
        conflicts: 'object',
        state: 'object'
      }, true)

      function FileDao (id) {
        this.id = id
        this.$setId(id)
        this.contentDao = Object.create(contentDaoProto)
        this.contentDao.$setId(id)
        this.read()
        this.readContent()
      }

      FileDao.prototype = fileDaoProto

      FileDao.prototype.read = function () {
        this.$read()
        this.$readUpdate()
      }

      FileDao.prototype.write = function () {
        this.$write()
        this.extUpdated = undefined
      }

      FileDao.prototype.readContent = function () {
        this.contentDao.$read.isLocal()
        this.contentDao.$read.lastChange()
        if (this.state === 'loaded') {
          this.contentDao.$read.text()
          this.contentDao.$read.serverHash()
          this.contentDao.$read.properties()
          this.contentDao.$read.discussions()
          this.contentDao.$read.comments()
          this.contentDao.$read.conflicts()
          this.contentDao.$read.state()
        }
        this.contentDao.$readUpdate()
      }

      FileDao.prototype.freeContent = function () {
        this.contentDao.$free.serverHash()
        this.contentDao.$free.text()
        this.contentDao.$free.properties()
        this.contentDao.$free.discussions()
        this.contentDao.$free.comments()
        this.contentDao.$free.conflicts()
        this.contentDao.$free.state()
      }

      FileDao.prototype.writeContent = function (updateLastChange) {
        this.contentDao.$write.isLocal()
        if (this.state === 'loaded') {
          this.contentDao.$write.serverHash()
          updateLastChange |= this.contentDao.$write.text()
          updateLastChange |= this.contentDao.$write.properties()
          updateLastChange |= this.contentDao.$write.discussions()
          updateLastChange |= this.contentDao.$write.comments()
          updateLastChange |= this.contentDao.$write.conflicts()
          this.contentDao.$write.state()
        }
        if (!this.contentDao.isLocal) {
          if (this.contentDao.lastChange) {
            this.contentDao.lastChange = 0
            this.contentDao.$write.lastChange()
          }
        } else if (updateLastChange) {
          this.contentDao.lastChange = Date.now()
          this.contentDao.$write.lastChange()
        }
      }

      FileDao.prototype.load = function () {
        if (this.state) {
          return
        }
        if (this.contentDao.isLocal) {
          this.state = 'loading'
          $timeout(function () {
            if (this.state === 'loading') {
              this.state = 'loaded' // Need to set this before readContent
              this.readContent()
            }
          }.cl_bind(this))
        } else if (clSocketSvc.isReady || (this.userId && clIsNavigatorOnline())) {
          this.state = 'loading'
        }
      }

      FileDao.prototype.unload = function () {
        this.freeContent()
        this.state = undefined
      }

      FileDao.prototype.loadExecUnload = function (cb) {
        var state = this.state
        if (state === 'loaded') {
          return cb()
        }
        this.state = 'loaded'
        this.readContent()
        cb()
        this.freeContent()
        this.state = state
      }

      function ReadOnlyFile (name, content) {
        this.name = name
        this.contentDao = {
          text: content,
          state: {},
          properties: {},
          discussions: {},
          comments: {},
          conflicts: {}
        }
        this.isReadOnly = true
        this.state = 'loaded'
        this.unload = function () {}
      }

      var clFileSvc = clLocalStorageObject('fileSvc', {
        fileIds: 'array'
      })

      var fileAuthorizedKeys = {
        u: true,
        userId: true,
        name: true,
        sharing: true,
        folderId: true,
        classeurId: true,
        deleted: true
      }

      var contentAuthorizedKeys = {
        u: true,
        lastChange: true,
        isLocal: true,
        serverHash: true,
        text: true,
        properties: true,
        discussions: true,
        comments: true,
        conflicts: true,
        state: true
      }

      var isInitialized

      function init () {
        if (!clFileSvc.fileIds) {
          clFileSvc.$read()
        }

        var fileMap = Object.create(null)
        var deletedFileMap = Object.create(null)
        clFileSvc.fileIds = clFileSvc.fileIds.cl_filter(function (id) {
          var fileDao = clFileSvc.fileMap[id] || clFileSvc.deletedFileMap[id] || new FileDao(id)
          if (!fileDao.deleted && !fileMap[id]) {
            fileMap[id] = fileDao
            return true
          }
          if (fileDao.deleted && !deletedFileMap[id]) {
            deletedFileMap[id] = fileDao
            return true
          }
        })

        clFileSvc.files.cl_each(function (fileDao) {
          !fileMap[fileDao.id] && fileDao.unload()
        })

        clFileSvc.files = Object.keys(fileMap).cl_map(function (id) {
          return fileMap[id]
        })
        clFileSvc.fileMap = fileMap

        clFileSvc.deletedFiles = Object.keys(deletedFileMap).cl_map(function (id) {
          return deletedFileMap[id]
        })
        clFileSvc.deletedFileMap = deletedFileMap

        clFileSvc.localFiles = clFileSvc.files.cl_filter(function (fileDao) {
          return fileDao.contentDao.isLocal
        })

        clFileSvc.localFiles.sort(function (fileDao1, fileDao2) {
          return fileDao2.contentDao.lastChange - fileDao1.contentDao.lastChange
        }).splice(maxLocalFiles).cl_each(function (fileDao) {
          fileDao.unload()
          fileDao.contentDao.isLocal = ''
          fileDao.writeContent()
        })

        if (!isInitialized) {
          var keyPrefix = /^[fc]\.(\w+)\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            var match
            if (key.charCodeAt(0) === 0x66 /* f */) {
              match = key.match(keyPrefix)
              if (match) {
                if ((!clFileSvc.fileMap[match[1]] && !clFileSvc.deletedFileMap[match[1]]) ||
                  !fileAuthorizedKeys.hasOwnProperty(match[2])
                ) {
                  clLocalStorage.removeItem(key)
                }
              }
            } else if (key.charCodeAt(0) === 0x63 /* c */) {
              match = key.match(keyPrefix)
              if (match) {
                if (!clFileSvc.fileMap[match[1]] ||
                  !contentAuthorizedKeys.hasOwnProperty(match[2]) ||
                  !clFileSvc.fileMap[match[1]].contentDao.isLocal
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
        // Check file id list
        var checkFileSvcUpdate = clFileSvc.$checkUpdate()
        clFileSvc.$readUpdate()
        if (checkFileSvcUpdate && clFileSvc.$check()) {
          clFileSvc.fileIds = undefined
        } else {
          clFileSvc.$write()
        }

        // Check every file
        // var startTime = Date.now()
        var checkFileUpdate = fileDaoProto.$checkGlobalUpdate()
        fileDaoProto.$readGlobalUpdate()
        var checkContentUpdate = contentDaoProto.$checkGlobalUpdate()
        contentDaoProto.$readGlobalUpdate()
        clFileSvc.files.concat(clFileSvc.deletedFiles).cl_each(function (fileDao) {
          if (checkFileUpdate && fileDao.$checkUpdate()) {
            fileDao.read()
          } else {
            fileDao.write()
          }
          if (checkContentUpdate && fileDao.contentDao.$checkUpdate()) {
            fileDao.unload()
            fileDao.readContent()
          } else {
            fileDao.writeContent()
          }
        })
        // console.log('Dirty checking took ' + (Date.now() - startTime) + 'ms')

        if (checkFileSvcUpdate || checkFileUpdate || checkContentUpdate) {
          init()
          return true
        }
      }

      function createFile (id) {
        id = id || clUid()
        var fileDao = clFileSvc.deletedFileMap[id] || new FileDao(id)
        fileDao.deleted = 0
        fileDao.isSelected = false
        fileDao.contentDao.isLocal = '1'
        fileDao.writeContent(true)
        clFileSvc.fileIds.push(id)
        clFileSvc.fileMap[id] = fileDao
        init()
        return fileDao
      }

      function createPublicFile (id) {
        var fileDao = clFileSvc.deletedFileMap[id] || new FileDao(id)
        fileDao.isSelected = false
        fileDao.userId = fileDao.userId || '0' // Will be filled by sync module
        return fileDao // Will be added to the list by core module
      }

      function createReadOnlyFile (name, content) {
        return new ReadOnlyFile(name, content)
      }

      // Remove fileDao from files and deletedFiles
      function removeFiles (fileDaoList) {
        if (!fileDaoList.length) {
          return
        }

        // Create hash for fast filter
        var fileIds = fileDaoList.cl_reduce(function (fileIds, fileDao) {
          fileIds[fileDao.id] = 1
          return fileIds
        }, Object.create(null))

        // Filter
        clFileSvc.fileIds = clFileSvc.fileIds.cl_filter(function (fileId) {
          return !fileIds[fileId]
        })
        init()
      }

      function setDeletedFiles (fileDaoList) {
        if (!fileDaoList.length) {
          return
        }
        var currentDate = Date.now()
        fileDaoList.cl_each(function (fileDao) {
          fileDao.deleted = currentDate
        })
        init()
      }

      function updateUserFiles (changes) {
        changes.cl_each(function (change) {
          var fileDao = clFileSvc.fileMap[change.id]
          if (change.deleted && fileDao) {
            fileDao.unload()
            clFileSvc.fileMap[change.id] = undefined
            var index = clFileSvc.files.indexOf(fileDao)
            clFileSvc.fileIds.splice(index, 1)
          } else if (!change.deleted && !fileDao) {
            fileDao = new FileDao(change.id)
            fileDao.deleted = 0
            clFileSvc.fileMap[change.id] = fileDao
            clFileSvc.fileIds.push(change.id)
          }
          fileDao.name = change.name || ''
          fileDao.folderId = change.folderId || ''
          fileDao.classeurId = change.classeurId || ''
          fileDao.sharing = change.sharing || ''
          fileDao.userId = ''
          fileDao.$setExtUpdate(change.updated)
        })
        init()
      }

      clFileSvc.FileDao = FileDao
      clFileSvc.init = init
      clFileSvc.checkLocalStorage = checkLocalStorage
      clFileSvc.createFile = createFile
      clFileSvc.createPublicFile = createPublicFile
      clFileSvc.createReadOnlyFile = createReadOnlyFile
      clFileSvc.removeFiles = removeFiles
      clFileSvc.setDeletedFiles = setDeletedFiles
      clFileSvc.updateUserFiles = updateUserFiles
      clFileSvc.files = []
      clFileSvc.deletedFiles = []
      clFileSvc.fileMap = Object.create(null)
      clFileSvc.deletedFileMap = Object.create(null)
      clFileSvc.firstFileContent = $templateCache.get('core/explorerLayout/firstFile.md')
      clFileSvc.firstFileName = 'My first file'

      init()
      return clFileSvc
    })
