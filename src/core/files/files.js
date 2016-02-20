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
            scope.file.name = name
          } else if (!scope.file.name) {
            scope.file.name = 'Untitled'
          }
          return scope.file.name
        }
        scope.name()
        scope.open = function () {
          !scope.isEditing && scope.setCurrentFile(scope.file)
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
        this.content = Object.create(contentDaoProto)
        this.content.$setId(id)
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
        this.content.$read.isLocal()
        this.content.$read.lastChange()
        if (this.state === 'loaded') {
          this.content.$read.text()
          this.content.$read.serverHash()
          this.content.$read.properties()
          this.content.$read.discussions()
          this.content.$read.comments()
          this.content.$read.conflicts()
          this.content.$read.state()
        }
        this.content.$readUpdate()
      }

      FileDao.prototype.freeContent = function () {
        this.content.$free.serverHash()
        this.content.$free.text()
        this.content.$free.properties()
        this.content.$free.discussions()
        this.content.$free.comments()
        this.content.$free.conflicts()
        this.content.$free.state()
      }

      FileDao.prototype.writeContent = function (updateLastChange) {
        this.content.$write.isLocal()
        if (this.state === 'loaded') {
          this.content.$write.serverHash()
          updateLastChange |= this.content.$write.text()
          updateLastChange |= this.content.$write.properties()
          updateLastChange |= this.content.$write.discussions()
          updateLastChange |= this.content.$write.comments()
          updateLastChange |= this.content.$write.conflicts()
          this.content.$write.state()
        }
        if (!this.content.isLocal) {
          if (this.content.lastChange) {
            this.content.lastChange = 0
            this.content.$write.lastChange()
          }
        } else if (updateLastChange) {
          this.content.lastChange = Date.now()
          this.content.$write.lastChange()
        }
      }

      FileDao.prototype.load = function () {
        if (this.state) {
          return
        }
        if (this.content.isLocal) {
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
        var result = cb()
        this.freeContent()
        this.state = state
        return result
      }

      function ReadOnlyFile (name, content) {
        this.name = name
        this.content = {
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
          var file = clFileSvc.daoMap[id] || clFileSvc.deletedDaoMap[id] || new FileDao(id)
          if (!file.deleted && !fileMap[id]) {
            fileMap[id] = file
            return true
          }
          if (file.deleted && !deletedFileMap[id]) {
            deletedFileMap[id] = file
            return true
          }
        })

        clFileSvc.daos.cl_each(function (file) {
          !fileMap[file.id] && file.unload()
        })

        clFileSvc.daos = Object.keys(fileMap).cl_map(function (id) {
          return fileMap[id]
        })
        clFileSvc.daoMap = fileMap

        clFileSvc.deletedDaos = Object.keys(deletedFileMap).cl_map(function (id) {
          return deletedFileMap[id]
        })
        clFileSvc.deletedDaoMap = deletedFileMap

        clFileSvc.localFiles = clFileSvc.daos.cl_filter(function (file) {
          return file.content.isLocal
        })

        clFileSvc.localFiles.sort(function (file1, file2) {
          return file2.content.lastChange - file1.content.lastChange
        }).splice(maxLocalFiles).cl_each(function (file) {
          file.unload()
          file.content.isLocal = ''
          file.writeContent()
        })

        if (!isInitialized) {
          var keyPrefix = /^[fc]\.(\w+)\.(\w+)/
          Object.keys(clLocalStorage).cl_each(function (key) {
            var match
            if (key.charCodeAt(0) === 0x66 /* f */) {
              match = key.match(keyPrefix)
              if (match) {
                if ((!clFileSvc.daoMap[match[1]] && !clFileSvc.deletedDaoMap[match[1]]) ||
                  !fileAuthorizedKeys.hasOwnProperty(match[2])
                ) {
                  clLocalStorage.removeItem(key)
                }
              }
            } else if (key.charCodeAt(0) === 0x63 /* c */) {
              match = key.match(keyPrefix)
              if (match) {
                if (!clFileSvc.daoMap[match[1]] ||
                  !contentAuthorizedKeys.hasOwnProperty(match[2]) ||
                  !clFileSvc.daoMap[match[1]].content.isLocal
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
        clFileSvc.daos.concat(clFileSvc.deletedDaos).cl_each(function (file) {
          if (checkFileUpdate && file.$checkUpdate()) {
            file.read()
          } else {
            file.write()
          }
          if (checkContentUpdate && file.content.$checkUpdate()) {
            file.unload()
            file.readContent()
          } else {
            file.writeContent()
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
        var file = clFileSvc.deletedDaoMap[id] || new FileDao(id)
        file.deleted = 0
        file.isSelected = false
        file.content.isLocal = '1'
        file.writeContent(true)
        clFileSvc.fileIds.push(id)
        clFileSvc.daoMap[id] = file
        init()
        return file
      }

      function createPublicFile (id) {
        var file = clFileSvc.deletedDaoMap[id] || new FileDao(id)
        file.isSelected = false
        file.userId = file.userId || '0' // Will be filled by sync module
        return file // Will be added to the list by core module
      }

      function createReadOnlyFile (name, content) {
        return new ReadOnlyFile(name, content)
      }

      // Remove file from files and deletedFiles
      function removeFiles (fileList) {
        if (!fileList.length) {
          return
        }

        // Create hash for fast filter
        var fileIds = fileList.cl_reduce(function (fileIds, file) {
          fileIds[file.id] = 1
          return fileIds
        }, Object.create(null))

        // Filter
        clFileSvc.fileIds = clFileSvc.fileIds.cl_filter(function (fileId) {
          return !fileIds[fileId]
        })
        init()
      }

      function setDeletedFiles (fileList) {
        if (!fileList.length) {
          return
        }
        var currentDate = Date.now()
        fileList.cl_each(function (file) {
          file.deleted = currentDate
        })
        init()
      }

      function applyFileChanges (items) {
        items.cl_each(function (item) {
          var file = clFileSvc.daoMap[item.id]
          if (item.deleted && file) {
            file.unload()
            clFileSvc.daoMap[item.id] = undefined
            var index = clFileSvc.daos.indexOf(file)
            clFileSvc.fileIds.splice(index, 1)
          } else if (!item.deleted && !file) {
            file = new FileDao(item.id)
            file.deleted = 0
            clFileSvc.daoMap[item.id] = file
            clFileSvc.fileIds.push(item.id)
          }
          file.userId = item.userId || ''
          file.name = item.name || ''
          // Change doesn't contain folderId for public file
          if (!file.userId || !file.folderId || item.folderId) {
            file.folderId = item.folderId || ''
          }
          file.sharing = item.sharing || ''
          file.$setExtUpdate(item.updated)
        })
        init()
      }

      clFileSvc.FileDao = FileDao
      clFileSvc.init = init
      clFileSvc.checkLocalStorage = checkLocalStorage
      clFileSvc.createFile = createFile
      clFileSvc.createPublicFile = createPublicFile
      clFileSvc.createReadOnlyFile = createReadOnlyFile
      clFileSvc.removeDaos = removeFiles
      clFileSvc.setDeletedFiles = setDeletedFiles
      clFileSvc.applyFileChanges = applyFileChanges
      clFileSvc.daos = []
      clFileSvc.deletedDaos = []
      clFileSvc.daoMap = Object.create(null)
      clFileSvc.deletedDaoMap = Object.create(null)
      clFileSvc.firstFileContent = $templateCache.get('core/explorerLayout/firstFile.md')
      clFileSvc.firstFileName = 'My first file'

      init()
      return clFileSvc
    })
